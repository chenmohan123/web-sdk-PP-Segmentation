export type Backend = "wasm" | "webgpu";
export type ExecutionMode = "main" | "worker";
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PixelImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}
export interface SegmentationModel {
  id: string;
  version: string;
  url: string;
  bytes: number;
  sha256: string;
}
export interface InstanceMask extends Box {
  data: Uint8Array;
}
export interface SegmentationInstance {
  classId: number;
  label: string;
  score: number;
  box: Box;
  mask: InstanceMask;
}
export interface LoadProgress {
  phase: "downloading" | "integrity" | "loading" | "ready";
  loadedBytes?: number;
  totalBytes?: number;
}
export interface LoadOptions {
  signal?: AbortSignal;
  onProgress?: (event: LoadProgress) => void;
}
export interface RunOptions {
  signal?: AbortSignal;
  scoreThreshold?: number;
  nmsThreshold?: number;
  maxDetections?: number;
}
export interface SegmentationInput {
  image: PixelImage | Blob;
}
export interface SegmentationOptions {
  model: SegmentationModel;
  backend?: Backend;
  executionMode?: ExecutionMode;
  runtimeBaseUrl?: string;
}
export interface LoadTimings {
  modelDownloadMs: number;
  modelCacheReadMs: number;
  integrityMs: number;
  sessionMs: number;
}
export interface SegmentationResult {
  image: { width: number; height: number };
  instances: SegmentationInstance[];
  runtime: {
    requestedBackend: Backend;
    actualBackend: Backend;
    executionMode: ExecutionMode;
    runtimeVersion: string;
  };
  model: Pick<SegmentationModel, "id" | "version" | "sha256">;
  timings: {
    decodeMs: number;
    preprocessMs: number;
    inferenceMs: number;
    postprocessMs: number;
    totalMs: number;
  };
}
export interface Capabilities {
  wasm: boolean;
  webgpu: boolean;
  worker: boolean;
  secureContext: boolean;
}
export interface Segmentation {
  readonly manifest: Readonly<SegmentationModel>;
  readonly capabilities: Readonly<Capabilities>;
  readonly loadTimings: Readonly<LoadTimings>;
  load(options?: LoadOptions): Promise<void>;
  run(
    input: SegmentationInput,
    options?: RunOptions,
  ): Promise<SegmentationResult>;
  dispose(): Promise<void>;
}
export type SegmentationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_MANIFEST"
  | "DOWNLOAD"
  | "INTEGRITY"
  | "UNSUPPORTED"
  | "OUT_OF_MEMORY"
  | "SESSION"
  | "INFERENCE"
  | "BUSY"
  | "ABORTED"
  | "DISPOSED"
  | "NOT_LOADED";
