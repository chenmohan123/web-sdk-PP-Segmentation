import { createRunner, type Runner, type RunnerOptions } from "./engine";
import type { PixelImage, RunOptions } from "./types";
import { wrapError, SegmentationError } from "./errors";
let runner: Runner | undefined;
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (m: unknown, t?: Transferable[]) => void;
};
scope.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: string;
    data: Uint8Array;
    options: RunnerOptions & RunOptions;
    image: PixelImage;
  }>,
) => {
  const { id, type } = event.data;
  try {
    if (type === "load") {
      await runner?.dispose();
      runner = createRunner({ ...event.data.options, executionMode: "main" });
      await runner.load(event.data.data);
      scope.postMessage({ id });
    } else if (type === "run") {
      if (!runner) throw new SegmentationError("NOT_LOADED", "模型尚未加载");
      const result = await runner.run(event.data.image, event.data.options);
      scope.postMessage(
        { id, result },
        result.instances.map((x) => x.mask.data.buffer as ArrayBuffer),
      );
    } else throw new SegmentationError("INVALID_INPUT", "未知Worker操作");
  } catch (error) {
    const converted = wrapError(
      error,
      type === "load" ? "SESSION" : "INFERENCE",
      "Worker操作失败",
    );
    scope.postMessage({
      id,
      error: { code: converted.code, message: converted.message },
    });
  }
};
