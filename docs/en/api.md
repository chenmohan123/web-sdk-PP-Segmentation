# API

[中文](../zh-CN/api.md) · [README](../../README.en.md)

[src/types.ts](../../src/types.ts) is the type reference. The runtime in `web-sdk-pp-segmentation@0.1.0` is independent of UI frameworks. Only the fixed four-output PP-YOLOE_seg_s 640 FP32 contract has been exercised.

## Creation and lifecycle

`createSegmentation(options): Segmentation` validates options synchronously and returns an instance. It does not start downloading.

| Option             | Type, default, and meaning                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `model`            | Required: `{ id, version, url, bytes, sha256 }`                                                                     |
| `model.id/version` | Nonempty strings; part of cache isolation                                                                           |
| `model.url`        | Absolute HTTP(S) URL; caller explicitly selects the source                                                          |
| `model.bytes`      | Positive safe integer; download length must match                                                                   |
| `model.sha256`     | 64 hexadecimal SHA-256 characters, normalized to lowercase; checked for both cached and downloaded bytes            |
| `backend`          | `'wasm' \| 'webgpu'`, default `'wasm'`                                                                              |
| `executionMode`    | `'main' \| 'worker'`, default `'worker'`                                                                            |
| `runtimeBaseUrl`   | ORT/Worker resource directory; an absolute URL ending in `/` is recommended. Omission uses the SDK module directory |

The returned `manifest` is a read-only model snapshot. `capabilities` contains `wasm/webgpu/worker/secureContext`; feature detection does not prove that the model can run. `loadTimings` is a read-only snapshot of the latest actual load. An unsupported requested backend does not switch automatically; this release has no fallback option.

`load({ signal?, onProgress? }?)` reads IndexedDB or downloads the model, verifies byte length and SHA-256, then creates the session. Progress phases are `downloading` (optionally with `loadedBytes/totalBytes`), `integrity`, `loading`, and `ready`. Cache-read time is exposed through `loadTimings.modelCacheReadMs`; there is no separate `cache` progress enum. Calling `load()` on a loaded instance only emits `ready` and reuses the session. Invalid cache entries are deleted and downloaded again. Network loading can continue when cache reads or writes are unavailable.

Call `run({ image }, options?)` serially after `load()` completes. Each instance permits one active `load/run` at a time; concurrent calls raise `BUSY`. There is no automatic queue.

`dispose(): Promise<void>` cancels active work and releases the session/Worker. Repeated calls are safe; await completion. Disposal does not clear persistent model cache. A disposed instance raises `DISPOSED` and cannot be loaded again.

## Inputs and run options

`image` accepts a `Blob` (including a user-selected `File`) or `PixelImage = { width, height, data }`. `data` must be RGBA in a `Uint8Array | Uint8ClampedArray` of exactly `width × height × 4` bytes. Dimensions are positive safe integers with at most 16,777,216 total pixels. The SDK copies the caller's buffer without modifying or detaching it.

Blob decoding uses the browser and applies EXIF orientation; transparency is composited over white. Preprocessing directly resizes RGB to 640×640 with bicubic interpolation (A=-0.75), quantizes back to uint8, divides by 255, and produces NCHW. It does not use letterboxing or accept video streams.

| Run option       | Default | Allowed values and meaning                               |
| ---------------- | ------: | -------------------------------------------------------- |
| `scoreThreshold` |     0.5 | Finite number in [0,1]; scores must be strictly greater  |
| `nmsThreshold`   |     0.7 | Finite number in [0,1]; class-wise box-IoU NMS threshold |
| `maxDetections`  |     100 | Integer from 1 to 300; global result limit               |
| `signal`         |    None | `AbortSignal`                                            |

Each class is sorted by score and NMS examines at most its top 1000 candidates; the highest-scoring instances are then selected globally. Returned ROI masks together are limited to 64 MiB. Exceeding this raises `OUT_OF_MEMORY`; instances are not silently discarded.

## Results and mask coordinates

`SegmentationResult` contains:

| Field       | Meaning                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `image`     | Original `{ width, height }`                                                                           |
| `instances` | `{ classId, label, score, box, mask }[]`, descending by score                                          |
| `runtime`   | `requestedBackend/actualBackend/executionMode/runtimeVersion`; current ORT is `onnxruntime-web@1.27.0` |
| `model`     | The `id/version/sha256` used                                                                           |
| `timings`   | `decodeMs/preprocessMs/inferenceMs/postprocessMs/totalMs`; see [Performance](performance.md)           |

`classId` is a contiguous COCO index from 0 to 79; `label` is the English class name. `box` is a floating-point `{ x, y, width, height }` in original-image pixels, clipped to the image bounds.

`mask` is `{ x, y, width, height, data: Uint8Array }` with integer original-image coordinates and dimensions. `data[y * width + x]` is 0 or 1. Pixels outside the ROI are zero. An empty mask is `{ x: 0, y: 0, width: 0, height: 0, data: new Uint8Array(0) }`.

The ROI contains all foreground after the second interpolation. Its bounds are independent of `box` and may extend beyond the detection box. Offset overlays using `mask.x/y`; do not clip them to the box again. Instances may overlap and are not merged into a mutually exclusive semantic map. Array positions are not tracking IDs.

The decoded integer `image.width/height` define the full output canvas. Reconstruct ROI masks using these dimensions; truncating dimensions recovered from a floating-point scale factor must not discard the last row or column. This is the SDK's size contract, independently of the integer truncation in some upstream CPU postprocessing paths.

## Cancellation and recovery

Pass `AbortController.signal` to `load/run`; canceled results are not returned normally. AbortSignal does not promise to preempt already submitted ORT kernels or synchronous CPU code. Wait for the Promise to settle before retrying. Retry `load` after a canceled load, or reuse the loaded instance with `run` after a canceled run. Calling `dispose()` terminates a Worker; main-thread disposal waits for submitted computation to finish before releasing it.

## Persistent cache

The following functions are exported from the package root; aliases have identical signatures:

| Function                                                   | Return value and scope                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `getModelCacheInfo(model)` / `getCacheUsage(model)`        | `Promise<{ entries: number; bytes: number }>` for the specified model |
| `clearCurrentModelCache(model)` / `clearModelCache(model)` | `Promise<void>`; delete the specified model's cache                   |
| `clearAllModelCache()` / `clearAllModelCaches()`           | `Promise<void>`; delete all model entries in this SDK's database      |

The cache key is `[id, version, sha256.toLowerCase()]` in database `web-sdk-pp-segmentation-models-v1`. A different version or checksum cannot reuse old weights. URL is not part of the key, so the same identity/version/checksum can share cached bytes. “All” does not clear other SDK databases, the HTTP cache, or loaded sessions. Clearing does not reload an active session.

## Stable error codes

`SegmentationError` extends `Error` with stable `code` and a human-readable `message`. Branch on `code`, not message text.

| code               | Meaning                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `INVALID_INPUT`    | Invalid input, thresholds, execution options, or resource-directory URL           |
| `INVALID_MANIFEST` | Invalid identity/URL/size/checksum or incompatible input/output contract          |
| `DOWNLOAD`         | Model network, HTTP, or read failure                                              |
| `INTEGRITY`        | Model byte length or SHA-256 mismatch                                             |
| `UNSUPPORTED`      | Missing secure-context capabilities, decoding, Worker, WebGPU adapter, or similar |
| `OUT_OF_MEMORY`    | Allocation failure or returned masks exceeding 64 MiB                             |
| `SESSION`          | ORT resource or session-creation failure                                          |
| `INFERENCE`        | Execution, output shape/type/finite-value, or Worker communication error          |
| `BUSY`             | Another operation is active on the instance                                       |
| `ABORTED`          | The operation was canceled                                                        |
| `DISPOSED`         | The instance has been disposed                                                    |
| `NOT_LOADED`       | Loading has not completed                                                         |

See [Troubleshooting](troubleshooting.md) for remedies.
