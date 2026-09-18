# Performance and timings

[中文](../zh-CN/performance.md) · [README](../../README.en.md)

The SDK exposes nine stable timing names, all in milliseconds. `sdk.loadTimings` supplies four loading fields; `result.timings` supplies five run fields. These groups cover different intervals.

| Field | Interval and interpretation |
|---|---|
| `modelDownloadMs` | Downloading model bytes; 0 on this SDK's cache hit. Browser HTTP caching can still change network cost |
| `modelCacheReadMs` | Attempted IndexedDB read, potentially nonzero even on a miss |
| `integrityMs` | Byte-length and SHA-256 verification; may accumulate two checks if invalid cached bytes are downloaded again |
| `sessionMs` | Runner loading of model/ORT and session creation, including messages during this phase in Worker mode |
| `decodeMs` | Input reading; Blob includes decoding, orientation, and canvas pixels; RGBA includes validation and copying |
| `preprocessMs` | CPU direct resize to 640, quantization, and NCHW conversion |
| `inferenceMs` | Wall time of `session.run()`, not pure GPU-kernel time |
| `postprocessMs` | Output validation, NMS, prototype composition, two interpolations, cropping, and binary ROI packing; currently CPU work |
| `totalMs` | Wall time inside public `run()`, from processing start to returned result, including decoding, scheduling, and Worker transfers; excludes `load()` and UI drawing |

Unlisted overhead means stage timings need not sum exactly to `totalMs`. The four load fields also do not cover all `load()` wall time; cache writes, for example, are not separately timed. To measure visible-result latency, the application must time the complete load, run, and drawing sequence.

## Cold start, cached start, and warm runs

- Cold start: a new instance misses the cache, downloads, verifies, creates a session, and runs for the first time. Report loading and running separately.
- Cached start: a new instance hits versioned IndexedDB but still reads, verifies, and creates a session; it does not reuse a warm session.
- Warm run: an already loaded instance runs serially again with the same session. First inference can include compilation/warmup; document warmup policy separately.

Calling `load()` again on a loaded instance does not reset its earlier `loadTimings`. Do not infer a cache hit from total time alone; combine zero download time with cache information and loading records.

The React Demo and Vanilla example create, load, and `dispose()` an instance for every image run. Repeated runs still pay session-creation cost even when model bytes are cached. The 64-image AP benchmark reuses a session per mode, so its run timings do not directly represent each Demo click. Parameters also differ: Demo/API default to `score>0.5`; AP evaluation uses `score>0.01/maxDetections=100`, potentially creating more masks and heavier postprocessing.

## Limits and tuning

WebGPU accelerates the model execution path; mask postprocessing remains CPU work. Main mode places that work on the page thread. Worker mode moves preprocessing, inference, and postprocessing into a Worker to improve responsiveness, but input Blob decoding still occurs on the caller side and copying/transfers have costs. Worker mode is not guaranteed to compute faster. GPU inference time cannot be converted into product FPS.

Model input is batch 1, 640×640 FP32. Input is limited to 16,777,216 pixels and returned masks total at most 64 MiB. The latter limits returned bytes, not peak process memory. Large images, many instances, interpolation buffers, ORT weights, and tensors all consume memory.

Reduce overhead by resizing the original image, increasing `scoreThreshold`, decreasing `maxDetections`, or reusing sessions when the application permits it. Parameter changes affect results; fix inputs and thresholds before comparing. Dispose of long-lived resources when finished and avoid unbounded concurrent sessions.

## Measurement evidence

The [acceptance report](../../reports/2026-09-18-image-sdk/README.md) contains the fixed 64-image WASM/WebGPU × main/worker records dated 2026-09-18, returned mask bytes, median/p95 timings, and environment. Quality has a [known edge difference](compatibility.md); speed measurements do not establish quality acceptance.

Performance conclusions apply only to the report's Windows/Chromium/hardware/date, not phones, NPU, or other browsers. Future benchmarks should record model checksum, precision, image dimensions/count, thresholds, cold/warm state, warmup count, backend/execution mode, runtime/driver, cache bytes, peak-memory measurement method, and date.

