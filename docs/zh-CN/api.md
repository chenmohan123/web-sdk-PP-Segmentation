# API

[English](../en/api.md) · [返回 README](../../README.md)

类型以 [src/types.ts](../../src/types.ts) 为准。包 `web-sdk-pp-segmentation@0.1.0-alpha.0` 的 runtime 与 UI 框架无关；当前只验证 PP-YOLOE_seg_s 640 FP32 的固定四输出契约。

## 创建与生命周期

`createSegmentation(options): Segmentation` 同步检查参数，返回实例；不会立即下载模型。

| 选项 | 类型、默认值与语义 |
|---|---|
| `model` | 必填：`{ id, version, url, bytes, sha256 }` |
| `model.id/version` | 非空字符串；参与缓存隔离 |
| `model.url` | HTTP(S) 绝对地址；调用者显式指定来源 |
| `model.bytes` | 正安全整数；下载长度必须一致 |
| `model.sha256` | 64 位十六进制 SHA-256，内部转小写；缓存和下载均校验 |
| `backend` | `'wasm' \| 'webgpu'`，默认 `'wasm'` |
| `executionMode` | `'main' \| 'worker'`，默认 `'worker'` |
| `runtimeBaseUrl` | ORT/Worker 资源目录；推荐以 `/` 结尾的绝对 URL。省略时以 SDK 模块目录为基准 |

返回的 `manifest` 为只读模型快照；`capabilities` 包含 `wasm/webgpu/worker/secureContext`，仅做能力探测，不证明模型可运行。`loadTimings` 是最近一次实际加载的只读耗时快照。显式后端不支持时不自动切换；本版没有 fallback 选项。

`load({ signal?, onProgress? }?)` 读取 IndexedDB 缓存或下载、验证长度和 SHA-256，再创建会话。进度为 `downloading`（可含 `loadedBytes/totalBytes`）、`integrity`、`loading`、`ready`。缓存读取耗时通过 `loadTimings.modelCacheReadMs` 暴露；没有独立的 `cache` 进度枚举。已加载实例再次 `load()` 只通知 `ready` 并复用会话。缓存损坏会删除该条目并重新下载；缓存读写不可用时仍可从网络加载。

`run({ image }, options?)` 必须在 `load()` 完成后串行调用。单实例同一时刻只允许一个 `load/run`，冲突报 `BUSY`，没有自动队列。

`dispose(): Promise<void>` 会取消当前操作并释放会话/Worker，重复调用安全；应等待其完成。释放不会清理持久模型缓存。释放后的实例报 `DISPOSED`，不能重新加载。

## 输入与运行参数

`image` 为 `Blob`（包括用户选择的 `File`）或 `PixelImage = { width, height, data }`。`data` 必须为 `Uint8Array | Uint8ClampedArray` 的 RGBA，长度恰好 `width × height × 4`；宽高为正安全整数，总像素 ≤16,777,216。SDK 复制调用者 buffer，不修改或分离原 buffer。

Blob 使用浏览器解码并应用 EXIF 方向；透明部分合成白底。模型预处理把 RGB 直接缩放到 640×640，采用 bicubic（A=-0.75），量化回 uint8 后除以 255，输出 NCHW。不是 letterbox；不接受视频流。

| 运行选项 | 默认值 | 合法值与含义 |
|---|---:|---|
| `scoreThreshold` | 0.5 | 有限数 [0,1]；仅保留严格大于阈值的分数 |
| `nmsThreshold` | 0.7 | 有限数 [0,1]；逐类框 IoU 的 NMS 阈值 |
| `maxDetections` | 100 | 整数 1～300；全局输出上限 |
| `signal` | 无 | `AbortSignal` |

每类先按分数排序，最多检查前 1000 个候选执行 NMS，最后全局取分数最高的实例。返回全部 ROI mask 的字节数累计上限为 64 MiB；超出抛 `OUT_OF_MEMORY`，不会静默丢实例。

## 结果与掩码坐标

`SegmentationResult` 含以下字段：

| 字段 | 语义 |
|---|---|
| `image` | 原图 `{ width, height }` |
| `instances` | `{ classId, label, score, box, mask }[]`，按分数递减 |
| `runtime` | `requestedBackend/actualBackend/executionMode/runtimeVersion`；当前 ORT 为 `onnxruntime-web@1.27.0` |
| `model` | 实际使用的 `id/version/sha256` |
| `timings` | `decodeMs/preprocessMs/inferenceMs/postprocessMs/totalMs`，详见[性能](performance.md) |

`classId` 是 0～79 的 COCO 连续类别编号，`label` 为英文标签。`box` 是裁到原图边界内的浮点 `{ x, y, width, height }`。

`mask` 是 `{ x, y, width, height, data: Uint8Array }`，坐标及尺寸为原图整数像素；`data[y * width + x]` 为 0 或 1。ROI 外视为 0。空 mask 为 `{ x: 0, y: 0, width: 0, height: 0, data: new Uint8Array(0) }`。

ROI 包含二次插值后全部前景，边界独立于 `box`，可能超出检测框。叠加时用 `mask.x/y` 平移，不再次裁到框内。实例间允许重叠，不合并成互斥语义图；数组序号不是跟踪 ID。

## 取消与恢复

向 `load/run` 传入 `AbortController.signal`，取消后结果不会正常返回。AbortSignal 不承诺抢占已提交的 ORT 内核或同步 CPU 代码；等待返回的 Promise 结束后再重试。取消 `load` 后重新 `load`；取消 `run` 后已加载实例可再次 `run`。需要释放 Worker 时调用 `dispose()` 会终止它；主线程会等待已提交计算完成后释放。

## 持久缓存

以下函数从包根导出，别名具有相同签名：

| 函数 | 返回值与范围 |
|---|---|
| `getModelCacheInfo(model)` / `getCacheUsage(model)` | `Promise<{ entries: number; bytes: number }>`，仅指定模型 |
| `clearCurrentModelCache(model)` / `clearModelCache(model)` | `Promise<void>`，删除指定模型缓存 |
| `clearAllModelCache()` / `clearAllModelCaches()` | `Promise<void>`，删除本 SDK 数据库中的全部模型 |

缓存键为 `[id, version, sha256.toLowerCase()]`，数据库名 `web-sdk-pp-segmentation-models-v1`。更换版本或摘要不会误用旧权重；URL 不在键中，相同身份/版本/摘要可复用缓存。“全部”不清理其他 SDK 数据库、浏览器 HTTP 缓存或已加载会话。清理不会触发运行中会话重载。

## 稳定错误码

`SegmentationError` 继承 `Error`，提供稳定 `code` 和人类可读 `message`。按 `code` 分支，不解析消息文本。

| code | 含义 |
|---|---|
| `INVALID_INPUT` | 输入、阈值、执行选项或资源目录 URL 无效 |
| `INVALID_MANIFEST` | 模型身份/URL/大小/摘要无效，或输入输出契约不符 |
| `DOWNLOAD` | 模型网络、HTTP 或读取失败 |
| `INTEGRITY` | 模型长度或 SHA-256 不符 |
| `UNSUPPORTED` | 缺失安全上下文能力、解码、Worker 或 WebGPU 适配器等 |
| `OUT_OF_MEMORY` | 分配失败或返回掩码累计超过 64 MiB |
| `SESSION` | ORT 资源或会话创建失败 |
| `INFERENCE` | 模型运行、输出形状/类型/有限值或 Worker 通信异常 |
| `BUSY` | 同实例已有活动操作 |
| `ABORTED` | 操作被取消 |
| `DISPOSED` | 实例已释放 |
| `NOT_LOADED` | 尚未完成加载 |

处理建议见[排障](troubleshooting.md)。
