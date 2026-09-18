import { afterEach, expect, it, vi } from "vitest";
import { createRunner } from "../src/engine";
const workers: TestWorker[] = [];
class TestWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  messages: any[] = [];
  terminated = false;
  constructor() {
    workers.push(this);
  }
  postMessage(m: unknown, t: Transferable[]) {
    this.messages.push(structuredClone(m, { transfer: t }));
  }
  terminate() {
    this.terminated = true;
  }
  reply(result?: unknown) {
    this.onmessage?.({
      data: { id: this.messages.at(-1).id, result },
    } as MessageEvent);
  }
}
afterEach(() => {
  workers.length = 0;
  vi.unstubAllGlobals();
});
it("转移SDK自有副本，保留调用者模型及像素，释放拒绝在途请求", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const r = createRunner({
    backend: "wasm",
    executionMode: "worker",
    runtimeBaseUrl: "https://example.com/sdk/",
  });
  const bytes = new Uint8Array([1, 2, 3]),
    loading = r.load(bytes);
  expect(bytes.byteLength).toBe(3);
  workers[0].reply();
  await loading;
  const pixels = new Uint8Array(16),
    running = r.run(
      { width: 2, height: 2, data: pixels },
      { scoreThreshold: 0.4 },
    );
  expect(pixels.byteLength).toBe(16);
  expect(workers[0].messages.at(-1).options.scoreThreshold).toBe(0.4);
  const rejected = expect(running).rejects.toMatchObject({ code: "ABORTED" });
  await r.dispose();
  await rejected;
  expect(workers[0].terminated).toBe(true);
});
it("Worker加载错误结束所有待办", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const r = createRunner({
    backend: "wasm",
    executionMode: "worker",
    runtimeBaseUrl: "https://example.com/sdk/",
  });
  const rejected = expect(r.load(new Uint8Array(1))).rejects.toMatchObject({
    code: "SESSION",
  });
  workers[0].onerror?.();
  await rejected;
  await r.dispose();
});
