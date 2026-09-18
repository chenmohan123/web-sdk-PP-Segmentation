import React, { useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  Upload,
  Play,
  Square,
  Trash2,
  ChevronDown,
  Github,
} from "lucide-react";
import type {
  Segmentation,
  SegmentationResult,
  Backend,
  ExecutionMode,
  LoadTimings,
} from "../../src/types";
import metadata from "../../models/model.json";
import tokens from "../ui-tokens.json";
import { drawMask } from "./draw-mask";
import { resolveDemoModel, type ModelSourceKind } from "./model-sources";
declare const __LOCAL_MODEL__: boolean;
type Api = typeof import("../../src/index");
const labels = {
  zh: {
    title: "实例分割",
    model: "分割模型",
    subtitle: "PP-YOLOE_seg_s · FP32",
    input: "选择图片",
    run: "开始分割",
    cancel: "取消",
    clear: "重置",
    backend: "运行后端",
    mode: "执行模式",
    source: "模型来源",
    worker: "Worker",
    main: "主线程",
    local: "本地开发模型",
    unpublished: "模型来源尚未发布",
    invalidSource: "模型来源配置无效",
    empty: "上传图片，查看每个对象的轮廓",
    upload: "选择 JPG、PNG 或 WebP 图片",
    ready: "等待运行",
    previewLoading: "正在读取图片",
    invalidImage:
      "无法解码图片或图片尺寸无效，请重新选择 JPG、PNG 或 WebP 图片。",
    oversizedImage: "图片超过 16,777,216 像素上限，请缩小后重新选择。",
    downloading: "正在下载模型",
    error: "操作失败",
    unsupported: "当前环境不支持",
    clearing: "正在清理缓存",
    cacheUsage: "当前模型缓存",
    loading: "正在加载模型",
    running: "正在分割",
    success: "分割完成",
    aborted: "已取消",
    all: "全部实例",
    overlay: "显示掩码",
    original: "原图",
    results: "实例",
    resultTitle: "分割结果",
    resultEmpty: "分割后在这里查看实例",
    noInstances: "未识别到实例",
    cacheTitle: "缓存管理",
    inference: "模型推理",
    info: "模型与运行信息",
    cache: "清理当前模型缓存",
    cacheAll: "清理本 SDK 全部缓存",
    privacy: "图片在本地处理",
    details: "耗时详情",
    load: "初始化",
    total: "本次总耗时",
    count: "个实例",
    development: "开发预览",
    cacheDone: "缓存已清理",
    repo: "GitHub",
    cpu: "CPU",
    gpu: "GPU",
  },
  en: {
    title: "Instance segmentation",
    model: "Segmentation model",
    subtitle: "PP-YOLOE_seg_s · FP32",
    input: "Choose image",
    run: "Segment image",
    cancel: "Cancel",
    clear: "Reset",
    backend: "Backend",
    mode: "Execution",
    source: "Model source",
    worker: "Worker",
    main: "Main thread",
    local: "Local development model",
    unpublished: "Model sources are not published yet",
    invalidSource: "Model source configuration is invalid",
    empty: "Upload an image to reveal object masks",
    upload: "Choose a JPG, PNG or WebP image",
    ready: "Ready to run",
    previewLoading: "Reading image",
    invalidImage:
      "Cannot decode this image or its dimensions are invalid. Choose another JPG, PNG or WebP image.",
    oversizedImage:
      "This image exceeds the 16,777,216 pixel limit. Resize it and choose it again.",
    downloading: "Downloading model",
    error: "Operation failed",
    unsupported: "Unsupported environment",
    clearing: "Clearing cache",
    cacheUsage: "Model cache",
    loading: "Loading model",
    running: "Segmenting",
    success: "Completed",
    aborted: "Cancelled",
    all: "All instances",
    overlay: "Show masks",
    original: "Original",
    results: "Instances",
    resultTitle: "Segmentation results",
    resultEmpty: "Instances appear here after segmentation",
    noInstances: "No instances found",
    cacheTitle: "Cache management",
    inference: "Inference",
    info: "Model and runtime",
    cache: "Clear model cache",
    cacheAll: "Clear all SDK caches",
    privacy: "Images stay on this device",
    details: "Timing details",
    load: "Initialization",
    total: "Total run time",
    count: "instances",
    development: "Development preview",
    cacheDone: "Cache cleared",
    repo: "GitHub",
    cpu: "CPU",
    gpu: "GPU",
  },
};
const timingLabels: Record<"zh" | "en", Record<string, string>> = {
  zh: {
    modelDownloadMs: "模型下载",
    modelCacheReadMs: "缓存读取",
    integrityMs: "完整性校验",
    sessionMs: "会话初始化",
    decodeMs: "图片解码",
    preprocessMs: "预处理",
    inferenceMs: "模型推理",
    postprocessMs: "后处理",
    totalMs: "本次总耗时",
  },
  en: {
    modelDownloadMs: "Download",
    modelCacheReadMs: "Cache read",
    integrityMs: "Integrity check",
    sessionMs: "Session setup",
    decodeMs: "Image decode",
    preprocessMs: "Preprocess",
    inferenceMs: "Inference",
    postprocessMs: "Postprocess",
    totalMs: "Total run time",
  },
};
export default function App() {
  const [lang, setLang] = useState<"zh" | "en">("zh"),
    t = labels[lang];
  const [backend, setBackend] = useState<Backend>("webgpu"),
    [mode, setMode] = useState<ExecutionMode>("worker"),
    [source, setSource] = useState<ModelSourceKind>("modelscope");
  const [file, setFile] = useState<File>(),
    [url, setUrl] = useState(""),
    [preview, setPreview] = useState<HTMLImageElement>(),
    [previewError, setPreviewError] = useState<
      "invalidImage" | "oversizedImage" | ""
    >(""),
    [result, setResult] = useState<SegmentationResult>(),
    [load, setLoad] = useState<Readonly<LoadTimings>>();
  const [phase, setPhase] = useState("ready"),
    [notice, setNotice] = useState(""),
    [cacheBytes, setCacheBytes] = useState<number>(),
    [clearing, setClearing] = useState(false),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(-1),
    [overlay, setOverlay] = useState(true);
  const sdk = useRef<Segmentation | null>(null),
    controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    previewGeneration = useRef(0),
    canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null),
    api = useRef<Api | null>(null),
    release = useRef<Promise<void>>(Promise.resolve()),
    cacheOperation = useRef(false);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  useEffect(() => {
    for (const [key, value] of Object.entries(tokens.color))
      document.documentElement.style.setProperty(`--${key}`, value);
    for (const [key, value] of Object.entries(tokens.space))
      document.documentElement.style.setProperty(`--space-${key}`, value);
    for (const [key, value] of Object.entries(tokens.radius))
      document.documentElement.style.setProperty(`--radius-${key}`, value);
    document.documentElement.style.setProperty(
      "--focus-ring",
      tokens.focus.ring,
    );
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      previewGeneration.current++;
      controller.current?.abort();
      void sdk.current?.dispose().catch(() => {});
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    if (!url) return;
    let current = true;
    const id = previewGeneration.current;
    const img = new Image();
    const isCurrent = () => current && id === previewGeneration.current;
    img.onload = () => {
      if (!isCurrent()) return;
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        setPreviewError("invalidImage");
      } else if (img.naturalWidth * img.naturalHeight > 16_777_216) {
        setPreviewError("oversizedImage");
      } else {
        setPreview(img);
      }
    };
    img.onerror = () => {
      if (isCurrent()) setPreviewError("invalidImage");
    };
    img.src = url;
    return () => {
      current = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);
  useEffect(() => {
    if (preview && canvas.current)
      drawMask(canvas.current, preview, result, selected, overlay);
  }, [preview, result, selected, overlay]);
  const getApi = async () =>
    (api.current ??= (await import(
      /* @vite-ignore */ new URL("sdk/index.js", document.baseURI).href
    )) as Api);
  const distribution = resolveDemoModel(
    metadata,
    source,
    __LOCAL_MODEL__,
    document.baseURI,
  );
  const sourceStatus = distribution.ok
    ? distribution.mode === "local"
      ? t.local
      : distribution.source.kind === "modelscope"
        ? "ModelScope"
        : "Hugging Face"
    : distribution.code === "SOURCE_UNAVAILABLE"
      ? t.unpublished
      : t.invalidSource;
  const model = () => {
    if (!distribution.ok) throw new Error(distribution.code);
    return distribution.model;
  };
  const cacheModel = {
    id: metadata.id,
    version: metadata.version,
    bytes: metadata.bytes,
    sha256: metadata.sha256,
    url: "",
  };
  async function updateCache(id: number) {
    try {
      const value = await (await getApi()).getCacheUsage(cacheModel);
      if (id === generation.current) setCacheBytes(value.bytes);
    } catch {
      if (id === generation.current) setCacheBytes(undefined);
    }
  }
  useEffect(() => {
    void updateCache(generation.current);
  }, []);
  function reset(clearImage = false) {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    const owned = sdk.current;
    sdk.current = null;
    setBusy(false);
    setResult(undefined);
    setSelected(-1);
    setLoad(undefined);
    setPhase("ready");
    setProgress(0);
    setError("");
    setNotice("");
    if (clearImage) {
      clearPreview();
      setFile(undefined);
      setUrl("");
      if (input.current) input.current.value = "";
    }
    // 立即更新所选图片；新推理等待旧会话释放，避免异步换图逆序覆盖。
    release.current = Promise.all([release.current, owned?.dispose()]).then(
      () => {},
      () => {},
    );
    return generation.current;
  }
  function clearPreview() {
    previewGeneration.current++;
    setPreview(undefined);
    setPreviewError("");
    // 在新图片解码前清除旧像素；尺寸通过校验后才分配预览画布。
    if (canvas.current) {
      canvas.current.width = 0;
      canvas.current.height = 0;
    }
  }
  function choose(next?: File) {
    if (!next || cacheOperation.current) return;
    clearPreview();
    reset();
    setFile(next);
    setUrl(URL.createObjectURL(next));
  }
  async function run() {
    if (
      !file ||
      !preview ||
      previewError ||
      controller.current ||
      cacheOperation.current ||
      !distribution.ok
    )
      return;
    const id = ++generation.current,
      c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setNotice("");
    setPhase("loading");
    setResult(undefined);
    setSelected(-1);
    let owned: Segmentation | undefined;
    try {
      await release.current;
      const module = await getApi();
      if (id !== generation.current) return;
      owned = module.createSegmentation({
        model: model(),
        backend,
        executionMode: mode,
        runtimeBaseUrl: new URL("sdk/", document.baseURI).href,
      });
      sdk.current = owned;
      await owned.load({
        signal: c.signal,
        onProgress: (event) => {
          if (id === generation.current) {
            setPhase(event.phase === "downloading" ? "downloading" : "loading");
            if (event.phase === "downloading")
              setProgress(
                Math.round(
                  ((event.loadedBytes ?? 0) / (event.totalBytes ?? 1)) * 100,
                ),
              );
          }
        },
      });
      if (id !== generation.current) return;
      setLoad(owned.loadTimings);
      void updateCache(id);
      setPhase("running");
      const output = await owned.run({ image: file }, { signal: c.signal });
      if (id === generation.current) {
        setResult(output);
        setPhase("success");
      }
    } catch (e) {
      if (id === generation.current) {
        const code = (e as { code?: string }).code;
        setPhase(
          code === "ABORTED"
            ? "ready"
            : code === "UNSUPPORTED"
              ? "unsupported"
              : "error",
        );
        setNotice(code === "ABORTED" ? "aborted" : "");
        setError(code === "ABORTED" ? "" : (code ?? "ERROR"));
      }
    } finally {
      await owned?.dispose().catch(() => {});
      if (sdk.current === owned) sdk.current = null;
      if (id === generation.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  async function clearCache(all = false) {
    if (cacheOperation.current) return;
    const id = reset();
    cacheOperation.current = true;
    setClearing(true);
    setNotice("clearing");
    try {
      await release.current;
      const module = await getApi();
      if (all) await module.clearAllModelCaches();
      else await module.clearModelCache(cacheModel);
      await updateCache(id);
      if (id === generation.current) setNotice("cacheDone");
    } catch {
      if (id === generation.current) {
        setPhase("error");
        setNotice("");
        setError("CACHE");
      }
    } finally {
      cacheOperation.current = false;
      setClearing(false);
    }
  }
  const displayPhase = previewError ? "error" : phase;
  const displayError = previewError
    ? `INVALID_INPUT · ${t[previewError]}`
    : error;
  const stateText =
    file && !preview && !previewError
      ? t.previewLoading
      : ((t as Record<string, string>)[notice || displayPhase] ?? displayPhase);
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="eyebrow">ONNX RUNTIME WEB</span>
          <h1>PP-Segmentation</h1>
          <span className="version">SDK 0.1.0</span>
        </div>
        <nav className="top-actions">
          <a
            className="repository-link"
            href="https://github.com/chenmohan123/web-sdk-PP-Segmentation"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} />
            {t.repo}
          </a>
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {lang === "zh" ? "English" : "中文"}
          </button>
        </nav>
      </header>
      <main className="demo-workspace">
        <aside className="controls-panel">
          <section className="control-band">
            <div className="control-group model-control">
              <div className="control-label model-label">
                <span>{t.model}</span>
                <span className="badge">{t.development}</span>
              </div>
              <div className="model-value">{t.subtitle}</div>
            </div>
            <label className="control-group source-control">
              <span className="control-label">{t.source}</span>
              <select
                disabled={busy || clearing || __LOCAL_MODEL__}
                value={source}
                onChange={(e) => {
                  const next = e.target.value as ModelSourceKind;
                  if (next === source) return;
                  reset();
                  setSource(next);
                }}
              >
                <option value="modelscope">ModelScope</option>
                <option value="huggingface">Hugging Face</option>
              </select>
              <span className="source-note">{sourceStatus}</span>
            </label>
            <div className="control-group" role="group" aria-label={t.backend}>
              <span className="control-label">{t.backend}</span>
              <div className="segmented">
                {(["webgpu", "wasm"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={backend === value}
                    disabled={busy || clearing}
                    onClick={() => {
                      setBackend(value);
                      void reset();
                    }}
                  >
                    {value === "webgpu" ? t.gpu : t.cpu}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group" role="group" aria-label={t.mode}>
              <span className="control-label">{t.mode}</span>
              <div className="segmented">
                {(["worker", "main"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={mode === value}
                    disabled={busy || clearing}
                    onClick={() => {
                      setMode(value);
                      void reset();
                    }}
                  >
                    {value === "worker" ? t.worker : t.main}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-actions">
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label={t.input}
                hidden
                disabled={clearing}
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                }}
              />
              <button
                className="file-button"
                disabled={clearing}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                {t.input}
              </button>
              {busy ? (
                <button
                  onClick={() => {
                    controller.current?.abort();
                    void sdk.current?.dispose().catch(() => {});
                  }}
                >
                  <Square size={15} />
                  {t.cancel}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={
                    !file ||
                    !preview ||
                    !!previewError ||
                    clearing ||
                    !distribution.ok
                  }
                  onClick={() => void run()}
                >
                  <Play size={16} />
                  {t.run}
                </button>
              )}
              <button disabled={clearing} onClick={() => void reset(true)}>
                <Trash2 size={16} />
                {t.clear}
              </button>
            </div>
          </section>
          <div className="status" role="status" data-state={displayPhase}>
            <span className={busy ? "dot pulse" : "dot"} />
            <span>
              {stateText}
              {busy && phase === "downloading" && progress > 0
                ? ` · ${progress}%`
                : ""}
            </span>
            {displayError && (
              <span role="alert" className="error">
                {displayError}
              </span>
            )}
          </div>
        </aside>
        <section className="viewer">
          <div className="viewer-toolbar">
            <h2>{t.title}</h2>
            <span className="selection" title={file?.name}>
              {selected >= 0
                ? `#${selected + 1} · ${result?.instances[selected]?.label ?? ""}`
                : (file?.name ?? "")}
            </span>
            <button
              className="all-instances"
              disabled={selected < 0}
              onClick={() => setSelected(-1)}
            >
              {t.all}
            </button>
            <label className="label-toggle">
              <input
                type="checkbox"
                checked={overlay}
                onChange={(e) => setOverlay(e.target.checked)}
              />
              {t.overlay}
            </label>
          </div>
          <div className="canvas-wrap">
            {url ? (
              <canvas ref={canvas} aria-label={t.title} />
            ) : (
              <button
                className="empty"
                disabled={clearing}
                onClick={() => input.current?.click()}
              >
                <ImagePlus size={30} />
                <strong>{t.empty}</strong>
                <span>{t.upload}</span>
              </button>
            )}
          </div>
        </section>
        <aside className="details-panel">
          <section className="results detail-section">
            <div className="panel-title">
              <h2>{t.resultTitle}</h2>
              <span className="count-badge">
                {result?.instances.length ?? 0} {t.count}
              </span>
            </div>
            <div className="result-list">
              {result?.instances.map((item, i) => (
                <button
                  key={i}
                  className="result-row"
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                >
                  <i
                    style={{
                      background: [
                        "#2563eb",
                        "#0ea582",
                        "#ea580c",
                        "#9333ea",
                        "#e11d48",
                      ][i % 5],
                    }}
                  />
                  <span className="result-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="result-label">
                    <strong>{item.label}</strong>
                    <small>{(item.score * 100).toFixed(1)}%</small>
                  </span>
                </button>
              ))}
              {!result?.instances.length && (
                <p className="result-empty">
                  {result ? t.noInstances : t.resultEmpty}
                </p>
              )}
            </div>
          </section>
          <section className="detail-section">
            <dl className="timing-summary">
              <div>
                <dt>{t.total}</dt>
                <dd>
                  {result ? `${result.timings.totalMs.toFixed(1)} ms` : "—"}
                </dd>
              </div>
              <div>
                <dt>{t.inference}</dt>
                <dd>
                  {result ? `${result.timings.inferenceMs.toFixed(1)} ms` : "—"}
                </dd>
              </div>
            </dl>
            <details>
              <summary>
                {t.details}
                <ChevronDown size={17} />
              </summary>
              <div data-sdk-timing className="timings">
                {Object.entries({ ...load, ...result?.timings }).map(
                  ([k, v]) => (
                    <div key={k}>
                      <span>{timingLabels[lang][k] ?? k}</span>
                      <b>{v.toFixed(1)} ms</b>
                    </div>
                  ),
                )}
              </div>
            </details>
          </section>
          <details className="detail-section">
            <summary>
              {t.info}
              <ChevronDown size={17} />
            </summary>
            <div className="info-grid">
              <div data-sdk-model-info>
                <b>PP-YOLOE_seg_s · FP32</b>
                <p>36.27 MB · 8.996M · ONNX opset 17</p>
                <p>640 × 640 · COCO 80</p>
                <p>
                  {metadata.version} · {sourceStatus}
                </p>
                <p>
                  SHA-256: <code>{metadata.sha256}</code>
                </p>
                <p>
                  {lang === "zh"
                    ? "Apache-2.0 · 来源与许可依据见模型卡"
                    : "Apache-2.0 · See the model card for provenance and license scope"}
                </p>
              </div>
              <div data-sdk-runtime-info>
                <b>
                  {backend.toUpperCase()} · {mode}
                </b>
                <p>ONNX Runtime Web 1.27.0</p>
                <p data-sdk-verification>
                  {lang === "zh"
                    ? "已验证环境（2026-09-18）"
                    : "Verified environment (2026-09-18)"}
                  <br />
                  Windows 11 10.0.26200 · Chromium 153.0.8010.12
                  <br />
                  CPU i5-10400F · WASM · main + Worker
                  <br />
                  GPU RTX 5060 Ti · WebGPU · main + Worker
                </p>
                <p>
                  {lang === "zh"
                    ? "64 图原图尺寸参考验收通过；最小掩码 IoU 0.9987。"
                    : "Passed the 64-image original-size reference check; minimum mask IoU 0.9987."}
                </p>
                {result && (
                  <p>
                    {result.runtime.requestedBackend} →{" "}
                    {result.runtime.actualBackend}
                  </p>
                )}
                <p>
                  {lang === "zh"
                    ? "验证范围为上述桌面环境；手机和 NPU 未验证。"
                    : "Evidence covers the desktop environment above; mobile and NPU are unverified."}
                </p>
              </div>
            </div>
          </details>
          <details className="detail-section cache-section">
            <summary>
              {t.cacheTitle}
              <ChevronDown size={17} />
            </summary>
            <div className="cache-usage">
              <span>{t.cacheUsage}</span>
              <span data-sdk-cache-usage>
                {cacheBytes === undefined
                  ? "—"
                  : `${(cacheBytes / 1e6).toFixed(2)} MB`}
              </span>
            </div>
            <div className="cache-actions">
              <button
                disabled={clearing}
                data-sdk-cache-clear="current"
                onClick={() => void clearCache()}
              >
                {t.cache}
              </button>
              <button
                disabled={clearing}
                data-sdk-cache-clear="all"
                onClick={() => void clearCache(true)}
              >
                {t.cacheAll}
              </button>
            </div>
            <p className="privacy">{t.privacy}</p>
          </details>
        </aside>
      </main>
    </div>
  );
}
