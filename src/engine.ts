import type * as Ort from "onnxruntime-web";
import type {
  Backend,
  ExecutionMode,
  PixelImage,
  RunOptions,
  SegmentationResult,
  SegmentationErrorCode,
} from "./types";
import { SegmentationError, checkAbort, wrapError } from "./errors";
import { preprocess } from "./preprocess";
import { postprocess } from "./postprocess";
import { loadOrt } from "./ort";
export type CoreResult = Pick<
  SegmentationResult,
  "image" | "instances" | "timings"
>;
export interface RunnerOptions {
  backend: Backend;
  executionMode: ExecutionMode;
  runtimeBaseUrl: string;
}
export interface Runner {
  load(data: Uint8Array, signal?: AbortSignal): Promise<void>;
  run(
    image: PixelImage,
    options?: RunOptions,
    signal?: AbortSignal,
  ): Promise<CoreResult>;
  dispose(): Promise<void>;
}
export function createRunner(options: RunnerOptions): Runner {
  return options.executionMode === "worker"
    ? new WorkerRunner(options)
    : new MainRunner(options);
}
class MainRunner implements Runner {
  private ort?: typeof Ort;
  private session?: Ort.InferenceSession;
  constructor(private options: RunnerOptions) {}
  async load(data: Uint8Array, signal?: AbortSignal) {
    checkAbort(signal);
    this.ort = await loadOrt(this.options.runtimeBaseUrl);
    checkAbort(signal);
    this.ort.env.wasm.wasmPaths = this.options.runtimeBaseUrl;
    this.ort.env.wasm.numThreads = 1;
    this.ort.env.wasm.proxy = false;
    if (this.options.backend === "webgpu") {
      const gpu = (
        globalThis.navigator as unknown as
          | { gpu?: { requestAdapter: (o: unknown) => Promise<unknown> } }
          | undefined
      )?.gpu;
      const adapter = await gpu
        ?.requestAdapter({ powerPreference: "high-performance" })
        .catch(() => null);
      checkAbort(signal);
      if (!adapter)
        throw new SegmentationError(
          "UNSUPPORTED",
          "当前执行环境没有可用的WebGPU适配器",
        );
      // 使用实际探测到的适配器，避免探测与会话选择不一致。
      (this.ort.env.webgpu as { adapter?: unknown }).adapter = adapter;
    }
    this.session = await this.ort.InferenceSession.create(data, {
      executionProviders: [this.options.backend],
      graphOptimizationLevel: "all",
    });
    checkAbort(signal);
    if (
      this.session.inputNames.length !== 1 ||
      this.session.inputNames[0] !== "image" ||
      this.session.outputNames.length !== 4
    )
      throw new SegmentationError(
        "INVALID_MANIFEST",
        "模型输入输出不符合PP-YOLOE_seg四输出契约",
      );
  }
  async run(
    image: PixelImage,
    options: RunOptions = {},
    signal?: AbortSignal,
  ): Promise<CoreResult> {
    checkAbort(signal);
    if (!this.ort || !this.session)
      throw new SegmentationError("NOT_LOADED", "模型尚未加载");
    const start = performance.now(),
      data = preprocess(image),
      preprocessMs = performance.now() - start;
    const tensor = new this.ort.Tensor("float32", data, [1, 3, 640, 640]);
    let outputs: Ort.InferenceSession.ReturnType | undefined;
    try {
      checkAbort(signal);
      const inferenceStart = performance.now();
      outputs = await this.session.run({ image: tensor });
      const inferenceMs = performance.now() - inferenceStart;
      checkAbort(signal);
      const postStart = performance.now(),
        shapes = [
          [1, 8400, 4],
          [1, 80, 8400],
          [1, 32, 8400],
          [1, 32, 160, 160],
        ];
      const values = this.session.outputNames.map((name, i) => {
        const t = outputs![name];
        if (
          !(t.data instanceof Float32Array) ||
          t.dims.length !== shapes[i].length ||
          !t.dims.every((v, j) => v === shapes[i][j])
        )
          throw new SegmentationError("INFERENCE", "模型输出形状或类型错误");
        return t.data;
      });
      const instances = postprocess(values, image.width, image.height, options);
      checkAbort(signal);
      return {
        image: { width: image.width, height: image.height },
        instances,
        timings: {
          decodeMs: 0,
          preprocessMs,
          inferenceMs,
          postprocessMs: performance.now() - postStart,
          totalMs: performance.now() - start,
        },
      };
    } finally {
      tensor.dispose();
      if (outputs) for (const t of new Set(Object.values(outputs))) t.dispose();
    }
  }
  async dispose() {
    const session = this.session;
    this.session = undefined;
    this.ort = undefined;
    await session?.release();
  }
}
interface Reply {
  id: number;
  result?: CoreResult;
  error?: { code?: SegmentationErrorCode; message: string };
}
class WorkerRunner implements Runner {
  private worker: Worker;
  private next = 0;
  private dead = false;
  private bootstrap?: string;
  private pending = new Map<
    number,
    {
      resolve: (v: CoreResult | undefined) => void;
      reject: (e: unknown) => void;
    }
  >();
  constructor(private options: RunnerOptions) {
    if (typeof Worker === "undefined")
      throw new SegmentationError("UNSUPPORTED", "当前执行环境不支持Worker");
    const url = new URL("inference.worker.js", options.runtimeBaseUrl);
    try {
      if (typeof location !== "undefined" && url.origin !== location.origin)
        this.bootstrap = URL.createObjectURL(
          new Blob([`import ${JSON.stringify(url.href)};`], {
            type: "text/javascript",
          }),
        );
      this.worker = new Worker(this.bootstrap ?? url, {
        type: "module",
        name: "pp-segmentation",
      });
    } catch (error) {
      this.revokeBootstrap();
      throw wrapError(error, "UNSUPPORTED", "无法启动推理Worker");
    }
    this.worker.onmessage = (event: MessageEvent<Reply>) => {
      this.revokeBootstrap();
      const item = this.pending.get(event.data.id);
      if (!item) return;
      this.pending.delete(event.data.id);
      if (event.data.error)
        item.reject(
          new SegmentationError(
            event.data.error.code ?? "INFERENCE",
            event.data.error.message,
          ),
        );
      else item.resolve(event.data.result);
    };
    this.worker.onerror = () =>
      this.fail(new SegmentationError("SESSION", "推理Worker加载或执行失败"));
    this.worker.onmessageerror = () =>
      this.fail(new SegmentationError("INFERENCE", "推理Worker消息解析失败"));
  }
  private revokeBootstrap() {
    if (this.bootstrap) {
      URL.revokeObjectURL(this.bootstrap);
      this.bootstrap = undefined;
    }
  }
  private fail(error: unknown) {
    this.dead = true;
    this.worker.terminate();
    this.revokeBootstrap();
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  private call(
    type: string,
    payload: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<CoreResult | undefined> {
    if (this.dead)
      return Promise.reject(new SegmentationError("DISPOSED", "Worker已释放"));
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, type, ...payload }, transfer);
      } catch (error) {
        this.pending.delete(id);
        reject(wrapError(error, "INFERENCE", "无法提交Worker消息"));
      }
    });
  }
  async load(data: Uint8Array, signal?: AbortSignal) {
    checkAbort(signal);
    const owned = new Uint8Array(data);
    await this.call("load", { data: owned, options: this.options }, [
      owned.buffer,
    ]);
    checkAbort(signal);
  }
  async run(
    image: PixelImage,
    options: RunOptions = {},
    signal?: AbortSignal,
  ): Promise<CoreResult> {
    checkAbort(signal);
    const owned = new Uint8Array(image.data),
      { signal: _ignored, ...transferOptions } = options;
    const result = await this.call(
      "run",
      {
        image: { width: image.width, height: image.height, data: owned },
        options: transferOptions,
      },
      [owned.buffer],
    );
    checkAbort(signal);
    return result!;
  }
  async dispose() {
    if (!this.dead)
      this.fail(new SegmentationError("ABORTED", "推理Worker已终止"));
  }
}
