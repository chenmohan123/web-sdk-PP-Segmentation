import type { SegmentationModel } from "../../src/types";

export type ModelSourceKind = "modelscope" | "huggingface";

export interface ModelSource {
  kind: ModelSourceKind;
  repository: string;
  revision: string;
  path: string;
  downloadUrl: string;
  bytes: number;
  sha256: string;
}

type SourceErrorCode =
  | "INVALID_MODEL_SOURCES"
  | "INVALID_MODEL_SOURCE"
  | "INVALID_SOURCE_SELECTION"
  | "SOURCE_UNAVAILABLE";

type SourceFailure = { ok: false; code: SourceErrorCode };
type PublishedResolution = {
  ok: true;
  mode: "published";
  source: ModelSource;
  model: SegmentationModel;
};
type LocalResolution = {
  ok: true;
  mode: "local";
  model: SegmentationModel;
};

const SHA256 = /^[0-9a-f]{64}$/i;
const IMMUTABLE_REVISION = /^[0-9a-f]{40,64}$/i;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MODEL_PATH = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
const sourceKinds: readonly ModelSourceKind[] = ["modelscope", "huggingface"];

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function modelIdentity(value: unknown): SegmentationModel | undefined {
  const model = record(value);
  if (
    !model ||
    typeof model.id !== "string" ||
    !model.id ||
    typeof model.version !== "string" ||
    !model.version ||
    typeof model.bytes !== "number" ||
    !Number.isSafeInteger(model.bytes) ||
    model.bytes <= 0 ||
    typeof model.sha256 !== "string" ||
    !SHA256.test(model.sha256)
  )
    return undefined;
  return {
    id: model.id,
    version: model.version,
    bytes: model.bytes,
    sha256: model.sha256.toLowerCase(),
    url: "",
  };
}

function parseSource(value: unknown, identity: SegmentationModel) {
  const source = record(value);
  if (!source || !sourceKinds.includes(source.kind as ModelSourceKind))
    return undefined;
  if (
    typeof source.repository !== "string" ||
    !REPOSITORY.test(source.repository) ||
    source.repository
      .split("/")
      .some((part) => part === "." || part === "..") ||
    typeof source.path !== "string" ||
    !MODEL_PATH.test(source.path) ||
    source.path.split("/").some((part) => part === "." || part === "..") ||
    typeof source.revision !== "string" ||
    !IMMUTABLE_REVISION.test(source.revision) ||
    typeof source.downloadUrl !== "string" ||
    source.bytes !== identity.bytes ||
    typeof source.sha256 !== "string" ||
    source.sha256.toLowerCase() !== identity.sha256
  )
    return undefined;
  const kind = source.kind as ModelSourceKind;
  const prefix =
    kind === "modelscope"
      ? "https://www.modelscope.cn/models/"
      : "https://huggingface.co/";
  const expectedUrl = `${prefix}${source.repository}/resolve/${source.revision.toLowerCase()}/${source.path}`;
  if (source.downloadUrl !== expectedUrl) return undefined;
  return {
    kind,
    repository: source.repository,
    revision: source.revision.toLowerCase(),
    path: source.path,
    downloadUrl: expectedUrl,
    bytes: identity.bytes,
    sha256: identity.sha256,
  } satisfies ModelSource;
}

export function resolvePublishedModel(
  manifest: unknown,
  requested?: unknown,
): PublishedResolution | SourceFailure {
  if (
    requested !== undefined &&
    !sourceKinds.includes(requested as ModelSourceKind)
  )
    return { ok: false, code: "INVALID_SOURCE_SELECTION" };
  const raw = record(manifest);
  const identity = modelIdentity(raw);
  if (!identity || !Array.isArray(raw?.sources))
    return { ok: false, code: "INVALID_MODEL_SOURCES" };
  if (raw.sources.length === 0)
    return { ok: false, code: "SOURCE_UNAVAILABLE" };
  const sources = raw.sources.map((item) => parseSource(item, identity));
  if (
    sources.some((item) => !item) ||
    new Set(sources.map((item) => item?.kind)).size !== sources.length
  )
    return { ok: false, code: "INVALID_MODEL_SOURCE" };
  const kind = (requested ?? "modelscope") as ModelSourceKind;
  const source = sources.find((item) => item?.kind === kind);
  if (!source) return { ok: false, code: "SOURCE_UNAVAILABLE" };
  return {
    ok: true,
    mode: "published",
    source,
    model: { ...identity, url: source.downloadUrl },
  };
}

export function resolveDemoModel(
  manifest: unknown,
  requested: unknown,
  localDevelopment: boolean,
  baseUrl: string,
): PublishedResolution | LocalResolution | SourceFailure {
  if (!localDevelopment) return resolvePublishedModel(manifest, requested);
  const identity = modelIdentity(manifest);
  if (!identity) return { ok: false, code: "INVALID_MODEL_SOURCES" };
  return {
    ok: true,
    mode: "local",
    model: {
      ...identity,
      url: new URL("local-model/model.onnx", baseUrl).href,
    },
  };
}
