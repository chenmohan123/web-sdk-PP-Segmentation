import React, { useEffect, useRef, useState } from "react";
import {
  Scan,
  Upload,
  Play,
  Square,
  Trash2,
  ChevronDown,
  Layers,
  Globe,
  ExternalLink,
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
declare const __LOCAL_MODEL__: boolean;
type Api = typeof import("../../src/index");
const labels = {
  zh: {
    title: "实例分割",
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
export default function App() {
  const [lang, setLang] = useState<"zh" | "en">("zh"),
    t = labels[lang];
  const [backend, setBackend] = useState<Backend>("webgpu"),
    [mode, setMode] = useState<ExecutionMode>("worker"),
    [source, setSource] = useState("modelscope");
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
  const model = () => ({
    ...metadata,
    url: new URL("local-model/model.onnx", document.baseURI).href,
  });
  async function updateCache(id: number) {
    try {
      const value = await (await getApi()).getCacheUsage(model());
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
      !__LOCAL_MODEL__
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
      else await module.clearModelCache(model());
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
      <header>
        <a className="brand" href="#">
          <span className="logo">
            <Scan size={23} />
          </span>
          <span>
            PP-Segmentation<small>{t.title}</small>
          </span>
        </a>
        <nav>
          <span className="version">0.1.0-alpha.0</span>
          <button
            className="quiet"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          >
            <Globe size={16} />
            {lang === "zh" ? "English" : "中文"}
          </button>
          <a
            href="https://github.com/chenmohan123/web-sdk-PP-Segmentation"
            title={t.repo}
          >
            <ExternalLink size={18} />
          </a>
        </nav>
      </header>
      <main>
        <div className="heading">
          <div>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          <span className="badge">{t.development}</span>
        </div>
        <section className="controls">
          <label>
            {t.backend}
            <select
              value={backend}
              disabled={busy || clearing}
              onChange={(e) => {
                setBackend(e.target.value as Backend);
                void reset();
              }}
            >
              <option value="webgpu">GPU · WebGPU</option>
              <option value="wasm">CPU · WASM</option>
            </select>
          </label>
          <label>
            {t.mode}
            <select
              value={mode}
              disabled={busy || clearing}
              onChange={(e) => {
                setMode(e.target.value as ExecutionMode);
                void reset();
              }}
            >
              <option value="worker">{t.worker}</option>
              <option value="main">{t.main}</option>
            </select>
          </label>
          <label>
            {t.source}
            <select
              disabled
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="modelscope">ModelScope</option>
              <option value="huggingface">Hugging Face</option>
            </select>
          </label>
          <span className="source-note">
            {__LOCAL_MODEL__ ? t.local : t.unpublished}
          </span>
          <div className="actions">
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
            <button disabled={clearing} onClick={() => input.current?.click()}>
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
                  !__LOCAL_MODEL__
                }
                onClick={() => void run()}
              >
                <Play size={16} />
                {t.run}
              </button>
            )}
            <button
              className="quiet"
              disabled={clearing}
              onClick={() => void reset(true)}
              aria-label={t.clear}
            >
              <Trash2 size={17} />
            </button>
          </div>
        </section>
        <div className="status" role="status" data-state={displayPhase}>
          <span className={busy ? "dot pulse" : "dot"} />
          {stateText}
          {busy && phase === "downloading" && progress > 0
            ? ` · ${progress}%`
            : ""}
          {displayError && (
            <span role="alert" className="error">
              {displayError}
            </span>
          )}
        </div>
        <div className="workspace">
          <section className="viewer">
            <div className="viewer-toolbar">
              <span>{file?.name ?? t.original}</span>
              <button
                className={overlay ? "toggle active" : "toggle"}
                onClick={() => setOverlay(!overlay)}
              >
                <Layers size={15} />
                {t.overlay}
              </button>
              <span className="selection">
                {selected >= 0 ? `#${selected + 1}` : t.all}
              </span>
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
                  <span className="empty-icon">
                    <Scan size={42} />
                  </span>
                  <strong>{t.empty}</strong>
                  <span>{t.upload}</span>
                </button>
              )}
            </div>
          </section>
          <aside className="results">
            <div className="panel-title">
              <h2>{t.results}</h2>
              <span>{result?.instances.length ?? 0}</span>
            </div>
            <button
              className={selected === -1 ? "result-row selected" : "result-row"}
              disabled={!result}
              onClick={() => setSelected(-1)}
            >
              {t.all}
            </button>
            <div className="result-list">
              {result?.instances.map((item, i) => (
                <button
                  key={i}
                  className={
                    selected === i ? "result-row selected" : "result-row"
                  }
                  onClick={() => setSelected(i)}
                >
                  <span>
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
                    #{i + 1} {item.label}
                  </span>
                  <span>{(item.score * 100).toFixed(1)}%</span>
                </button>
              ))}
            </div>
            {result && (
              <div className="summary">
                <span>{t.total}</span>
                <strong>{result.timings.totalMs.toFixed(1)} ms</strong>
              </div>
            )}
          </aside>
        </div>
        <section className="information">
          <details>
            <summary>
              <ChevronDown size={16} />
              {t.info}
            </summary>
            <div className="info-grid">
              <div data-sdk-model-info>
                <b>PP-YOLOE_seg_s · FP32</b>
                <p>36.27 MB · 8.996M · ONNX opset 17</p>
                <p>640 × 640 · COCO 80</p>
                <p>
                  {metadata.version} ·{" "}
                  {__LOCAL_MODEL__ ? t.local : t.unpublished}
                </p>
                <p>
                  SHA-256: <code>{metadata.sha256}</code>
                </p>
                <p>
                  {lang === "zh"
                    ? "上游源码 Apache-2.0；权重再分发待核验"
                    : "Upstream code: Apache-2.0; weight redistribution under review"}
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
                    ? "严格掩码验收仍有 1 个官方边缘裁剪差异，保持 alpha。"
                    : "Strict mask acceptance still has one official edge-cropping difference; this remains alpha."}
                </p>
                {result && (
                  <p>
                    {result.runtime.requestedBackend} →{" "}
                    {result.runtime.actualBackend}
                  </p>
                )}
                <p>
                  {lang === "zh"
                    ? "本地实验版本；未声明手机或 NPU 兼容。"
                    : "Local alpha; mobile and NPU are unverified."}
                </p>
              </div>
            </div>
          </details>
          <details>
            <summary>
              <ChevronDown size={16} />
              {t.details}
            </summary>
            <div data-sdk-timing className="timings">
              {Object.entries({ ...load, ...result?.timings }).map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v.toFixed(1)} ms</b>
                </div>
              ))}
            </div>
          </details>
          <div className="footer-controls">
            <span>{t.privacy}</span>
            <span data-sdk-cache-usage>
              {t.cacheUsage}:{" "}
              {cacheBytes === undefined
                ? "—"
                : `${(cacheBytes / 1e6).toFixed(2)} MB`}
            </span>
            <button
              className="link"
              disabled={clearing}
              data-sdk-cache-clear="current"
              onClick={() => void clearCache()}
            >
              {t.cache}
            </button>
            <button
              className="link"
              disabled={clearing}
              data-sdk-cache-clear="all"
              onClick={() => void clearCache(true)}
            >
              {t.cacheAll}
            </button>
          </div>
        </section>
      </main>
      <footer>PP-Segmentation · Web Model SDK</footer>
    </div>
  );
}
