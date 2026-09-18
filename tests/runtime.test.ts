import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  cache: new Map<string, Uint8Array>(),
  runs: 0,
  loads: 0,
  releases: 0,
  loadGate: undefined as Promise<void> | undefined,
  runGate: undefined as Promise<void> | undefined,
  fail: false,
}));
vi.mock("../src/cache", () => ({
  readModelCache: async (k: string) => state.cache.get(k)?.slice(),
  writeModelCache: async (k: string, v: Uint8Array) => {
    state.cache.set(k, v.slice());
  },
  deleteModelCache: async (k: string) => {
    state.cache.delete(k);
  },
}));
// ORT依赖浏览器：仅替换会话边界，用完成时机检验SDK竞争和取消语义。
vi.mock("../src/engine", () => ({
  createRunner: () => ({
    load: async () => {
      state.loads++;
      await state.loadGate;
      if (state.fail) throw new Error("后端不可用");
    },
    run: async () => {
      state.runs++;
      await state.runGate;
      return {
        image: { width: 1, height: 1 },
        instances: [],
        timings: {
          decodeMs: 0,
          preprocessMs: 0,
          inferenceMs: 0,
          postprocessMs: 0,
          totalMs: 0,
        },
      };
    },
    dispose: async () => {
      state.releases++;
    },
  }),
}));
import { createSegmentation } from "../src/runtime";
const bytes = new Uint8Array([1, 2, 3, 4]);
const model = {
  id: "fixture",
  version: "1",
  url: "https://example.com/model.onnx",
  bytes: 4,
  sha256: "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
};
const image = { width: 1, height: 1, data: new Uint8Array([1, 2, 3, 255]) };
const make = () => createSegmentation({ model, executionMode: "main" });
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  state.cache.clear();
  Object.assign(state, {
    runs: 0,
    loads: 0,
    releases: 0,
    loadGate: undefined,
    runGate: undefined,
    fail: false,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("拒绝非法清单、未知后端和执行模式", () => {
  expect(() =>
    createSegmentation({ model: { ...model, bytes: -1 } }),
  ).toThrow();
  expect(() =>
    createSegmentation({ model, backend: "npu" as never }),
  ).toThrow();
  expect(() =>
    createSegmentation({ model: { ...model, url: "file:///model" } }),
  ).toThrow();
});
it("加载前拒绝推理，释放幂等且不能复活", async () => {
  const sdk = make();
  await expect(sdk.run({ image })).rejects.toMatchObject({
    code: "NOT_LOADED",
  });
  await sdk.dispose();
  await sdk.dispose();
  await expect(sdk.load()).rejects.toMatchObject({ code: "DISPOSED" });
});
it("预取消不产生下载；已加载的预取消不产生推理", async () => {
  const sdk = make(),
    c = new AbortController();
  c.abort();
  await expect(sdk.load({ signal: c.signal })).rejects.toMatchObject({
    code: "ABORTED",
  });
  expect(fetch).not.toHaveBeenCalled();
  await sdk.load();
  await expect(sdk.run({ image }, { signal: c.signal })).rejects.toMatchObject({
    code: "ABORTED",
  });
  expect(state.runs).toBe(0);
  await sdk.dispose();
});
it("加载复用、并发拒绝，结果包含实际运行信息且调用者buffer保留", async () => {
  const sdk = make();
  await sdk.load();
  await sdk.load();
  expect(state.loads).toBe(1);
  const g = gate();
  state.runGate = g.promise;
  const running = sdk.run({ image });
  await expect(sdk.run({ image })).rejects.toMatchObject({ code: "BUSY" });
  g.resolve();
  const r = await running;
  expect(r.runtime).toMatchObject({
    actualBackend: "wasm",
    executionMode: "main",
    runtimeVersion: "onnxruntime-web@1.27.0",
  });
  expect(image.data).toEqual(new Uint8Array([1, 2, 3, 255]));
  expect(r.timings.decodeMs).toBeGreaterThanOrEqual(0);
  await sdk.dispose();
});
it("在途运行取消后丢弃结果并可恢复", async () => {
  const sdk = make();
  await sdk.load();
  const g = gate();
  state.runGate = g.promise;
  const c = new AbortController(),
    running = sdk.run({ image }, { signal: c.signal });
  await vi.waitFor(() => expect(state.runs).toBe(1));
  c.abort();
  g.resolve();
  await expect(running).rejects.toMatchObject({ code: "ABORTED" });
  state.runGate = undefined;
  expect((await sdk.run({ image })).instances).toEqual([]);
  await sdk.dispose();
});
it("会话创建期间dispose等待结束且只释放一次", async () => {
  const sdk = make(),
    g = gate();
  state.loadGate = g.promise;
  const loading = sdk.load(),
    rejected = expect(loading).rejects.toMatchObject({ code: "ABORTED" });
  await vi.waitFor(() => expect(state.loads).toBe(1));
  const disposal = sdk.dispose();
  g.resolve();
  await Promise.all([rejected, disposal, sdk.dispose()]);
  expect(state.releases).toBe(1);
});
it("显式GPU失败不会尝试CPU", async () => {
  state.fail = true;
  const sdk = createSegmentation({
    model,
    backend: "webgpu",
    executionMode: "main",
  });
  await expect(sdk.load()).rejects.toMatchObject({ code: "SESSION" });
  expect(state.loads).toBe(1);
  expect(state.releases).toBe(1);
  await sdk.dispose();
});
it("损坏缓存会被删除，下载完整性错误不进入会话", async () => {
  const sdk = make();
  await sdk.load();
  await sdk.dispose();
  const k = [...state.cache.keys()][0];
  state.cache.set(k, new Uint8Array([0, 0, 0, 0]));
  const b = make();
  await b.load();
  expect(state.cache.get(k)).toEqual(bytes);
  await b.dispose();
  state.cache.clear();
  vi.stubGlobal(
    "fetch",
    async () => new Response(new Uint8Array([4, 3, 2, 1])),
  );
  await expect(make().load()).rejects.toMatchObject({ code: "INTEGRITY" });
  expect(state.cache.size).toBe(0);
  expect(state.loads).toBe(2);
});
it("流式下载超长或截断都会拒绝且不会创建会话", async () => {
  for (const data of [new Uint8Array(3), new Uint8Array(5)]) {
    vi.stubGlobal("fetch", async () => new Response(data));
    await expect(make().load()).rejects.toMatchObject({ code: "INTEGRITY" });
  }
  expect(state.loads).toBe(0);
});
it("非法运行参数在解码或提交推理前拒绝", async () => {
  const sdk = make();
  await sdk.load();
  for (const options of [
    { scoreThreshold: NaN },
    { nmsThreshold: 2 },
    { maxDetections: 301 },
    { maxDetections: 1.5 },
  ]) {
    await expect(sdk.run({ image }, options)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  }
  expect(state.runs).toBe(0);
  await sdk.dispose();
});
it("非字符串摘要和非法运行目录返回稳定错误", () => {
  expect(() =>
    createSegmentation({
      model: { ...model, sha256: { toString: () => model.sha256 } as never },
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_MANIFEST" }));
  expect(() =>
    createSegmentation({ model, runtimeBaseUrl: "http://[" }),
  ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
});
