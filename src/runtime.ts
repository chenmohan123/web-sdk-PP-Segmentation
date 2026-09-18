import type {
  SegmentationOptions,
  Segmentation,
  LoadOptions,
  RunOptions,
  SegmentationInput,
  SegmentationResult,
  LoadTimings,
} from "./types";
import { SegmentationError, checkAbort, wrapError } from "./errors";
import { readModelCache, writeModelCache, deleteModelCache } from "./cache";
import { createRunner, type Runner } from "./engine";
import { readPixels } from "./image";
import { validateRunOptions } from "./postprocess";
function validateOptions(options: SegmentationOptions): void {
  const m = options?.model;
  if (
    !m ||
    typeof m.id !== "string" ||
    !m.id.trim() ||
    typeof m.version !== "string" ||
    !m.version.trim() ||
    typeof m.url !== "string" ||
    !m.url ||
    !Number.isSafeInteger(m.bytes) ||
    m.bytes <= 0 ||
    typeof m.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(m.sha256)
  )
    throw new SegmentationError(
      "INVALID_MANIFEST",
      "模型清单需包含身份、版本、地址、字节数及 SHA-256",
    );
  try {
    if (!["http:", "https:"].includes(new URL(m.url).protocol))
      throw new Error();
  } catch {
    throw new SegmentationError(
      "INVALID_MANIFEST",
      "模型地址必须为HTTP(S)绝对地址",
    );
  }
  if (
    options.backend !== undefined &&
    !["wasm", "webgpu"].includes(options.backend)
  )
    throw new SegmentationError("INVALID_INPUT", "未知执行后端");
  if (
    options.executionMode !== undefined &&
    !["main", "worker"].includes(options.executionMode)
  )
    throw new SegmentationError("INVALID_INPUT", "未知执行模式");
}
export function createSegmentation(options: SegmentationOptions): Segmentation {
  validateOptions(options);
  const model = Object.freeze({
    ...options.model,
    sha256: options.model.sha256.toLowerCase(),
  });
  const backend = options.backend ?? "wasm",
    executionMode = options.executionMode ?? "worker";
  let runtimeBaseUrl: string;
  try {
    runtimeBaseUrl = new URL(options.runtimeBaseUrl ?? "./", import.meta.url)
      .href;
    if (!runtimeBaseUrl.endsWith("/")) throw new Error();
  } catch {
    throw new SegmentationError(
      "INVALID_INPUT",
      "运行资源地址必须为以斜线结尾的有效目录 URL",
    );
  }
  const cacheKey = JSON.stringify([model.id, model.version, model.sha256]);
  const capabilities = Object.freeze({
    wasm: typeof WebAssembly !== "undefined",
    webgpu: typeof navigator !== "undefined" && "gpu" in navigator,
    worker: typeof Worker !== "undefined",
    secureContext: globalThis.isSecureContext === true,
  });
  const timings: LoadTimings = {
    modelDownloadMs: 0,
    modelCacheReadMs: 0,
    integrityMs: 0,
    sessionMs: 0,
  };
  let runner: Runner | undefined,
    ready = false,
    disposed = false,
    active: Promise<unknown> | undefined,
    controller: AbortController | undefined,
    disposing: Promise<void> | undefined;
  function guard(signal?: AbortSignal) {
    if (disposed) throw new SegmentationError("DISPOSED", "实例已释放");
    checkAbort(signal);
    if (active)
      throw new SegmentationError("BUSY", "实例正忙，请等待当前操作完成");
  }
  function operate<T>(
    signal: AbortSignal | undefined,
    task: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    guard(signal);
    const local = new AbortController();
    controller = local;
    const cancel = () => local.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const promise = Promise.resolve()
      .then(() => {
        checkAbort(local.signal);
        return task(local.signal);
      })
      .finally(() => {
        signal?.removeEventListener("abort", cancel);
        if (controller === local) controller = undefined;
        active = undefined;
      });
    active = promise;
    return promise;
  }
  async function integrity(
    data: Uint8Array,
    signal: AbortSignal,
  ): Promise<boolean> {
    checkAbort(signal);
    const start = performance.now();
    if (!globalThis.crypto?.subtle)
      throw new SegmentationError(
        "UNSUPPORTED",
        "SHA-256 校验需要安全上下文的 Web Crypto",
      );
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(data).buffer,
    );
    checkAbort(signal);
    timings.integrityMs += performance.now() - start;
    return (
      data.byteLength === model.bytes &&
      Array.from(new Uint8Array(hash), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("") === model.sha256
    );
  }
  async function download(
    signal: AbortSignal,
    onProgress: LoadOptions["onProgress"],
  ): Promise<Uint8Array> {
    const start = performance.now();
    onProgress?.({
      phase: "downloading",
      loadedBytes: 0,
      totalBytes: model.bytes,
    });
    let response: Response;
    try {
      response = await fetch(model.url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      throw wrapError(error, "DOWNLOAD", "模型下载失败");
    }
    const data = new Uint8Array(model.bytes);
    let offset = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          checkAbort(signal);
          const { done, value } = await reader.read();
          if (done) break;
          if (offset + value.length > data.length)
            throw new SegmentationError("INTEGRITY", "模型字节数超过清单");
          data.set(value, offset);
          offset += value.length;
          onProgress?.({
            phase: "downloading",
            loadedBytes: offset,
            totalBytes: model.bytes,
          });
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw wrapError(error, "DOWNLOAD", "模型下载失败");
      } finally {
        reader.releaseLock();
      }
    } else {
      const value = new Uint8Array(await response.arrayBuffer());
      if (value.length > data.length)
        throw new SegmentationError("INTEGRITY", "模型字节数超过清单");
      data.set(value);
      offset = value.length;
    }
    checkAbort(signal);
    timings.modelDownloadMs = performance.now() - start;
    if (offset !== model.bytes)
      throw new SegmentationError("INTEGRITY", "模型字节数与清单不符");
    return data;
  }
  return {
    manifest: model,
    capabilities,
    get loadTimings() {
      return Object.freeze({ ...timings });
    },
    async load(loadOptions: LoadOptions = {}) {
      guard(loadOptions.signal);
      if (ready) {
        loadOptions.onProgress?.({ phase: "ready" });
        return;
      }
      return operate(loadOptions.signal, async (signal) => {
        Object.assign(timings, {
          modelDownloadMs: 0,
          modelCacheReadMs: 0,
          integrityMs: 0,
          sessionMs: 0,
        });
        try {
          const start = performance.now();
          let bytes = await readModelCache(cacheKey).catch(() => undefined);
          timings.modelCacheReadMs = performance.now() - start;
          checkAbort(signal);
          if (bytes) {
            loadOptions.onProgress?.({ phase: "integrity" });
            if (!(await integrity(bytes, signal))) {
              await deleteModelCache(cacheKey).catch(() => {});
              bytes = undefined;
            }
          }
          if (!bytes) {
            bytes = await download(signal, loadOptions.onProgress);
            loadOptions.onProgress?.({ phase: "integrity" });
            if (!(await integrity(bytes, signal)))
              throw new SegmentationError("INTEGRITY", "模型 SHA-256 校验失败");
            await writeModelCache(cacheKey, bytes).catch(() => {});
          }
          checkAbort(signal);
          loadOptions.onProgress?.({ phase: "loading" });
          runner = createRunner({
            backend,
            executionMode,
            runtimeBaseUrl,
          });
          const sessionStart = performance.now();
          await runner.load(bytes, signal);
          timings.sessionMs = performance.now() - sessionStart;
          checkAbort(signal);
          ready = true;
          loadOptions.onProgress?.({ phase: "ready" });
        } catch (error) {
          ready = false;
          const owned = runner;
          runner = undefined;
          await owned?.dispose();
          throw wrapError(error, "SESSION", "模型会话创建失败");
        }
      });
    },
    async run(
      input: SegmentationInput,
      runOptions: RunOptions = {},
    ): Promise<SegmentationResult> {
      guard(runOptions.signal);
      if (!ready || !runner)
        throw new SegmentationError("NOT_LOADED", "请先加载模型");
      validateRunOptions(runOptions);
      return operate(runOptions.signal, async (signal) => {
        const start = performance.now();
        try {
          if (!input?.image)
            throw new SegmentationError("INVALID_INPUT", "缺少输入图片");
          const decodeStart = performance.now();
          const image = await readPixels(input.image, signal);
          const decodeMs = performance.now() - decodeStart;
          checkAbort(signal);
          const result = await runner!.run(image, runOptions, signal);
          checkAbort(signal);
          return {
            ...result,
            timings: {
              ...result.timings,
              decodeMs,
              totalMs: performance.now() - start,
            },
            runtime: {
              requestedBackend: backend,
              actualBackend: backend,
              runtimeVersion: "onnxruntime-web@1.27.0",
              executionMode,
            },
            model: {
              id: model.id,
              version: model.version,
              sha256: model.sha256,
            },
          };
        } catch (error) {
          throw wrapError(error, "INFERENCE", "实例分割推理失败");
        }
      });
    },
    dispose(): Promise<void> {
      if (disposing) return disposing;
      disposed = true;
      ready = false;
      controller?.abort();
      // Worker 可立即终止；主线程等待已提交内核完成后释放会话。
      const workerDisposal =
        executionMode === "worker" ? runner?.dispose() : undefined;
      disposing = (async () => {
        await active?.catch(() => {});
        if (executionMode === "worker") await workerDisposal;
        else await runner?.dispose();
        runner = undefined;
      })();
      return disposing;
    },
  };
}
