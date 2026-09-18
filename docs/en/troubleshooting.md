# Troubleshooting

[中文](../zh-CN/troubleshooting.md) · [README](../../README.en.md)

Record `error.code`, model `id/version/sha256`, requested/actual backend, execution mode, browser version, and the failing URL. Do not log user images or full pixel buffers by default. See [API](api.md) for the complete error contract.

| Error or symptom | Checks and remedy |
|---|---|
| `INVALID_INPUT` | Check Blob decoding, RGBA length of width×height×4, and the 16,777,216-pixel limit. Thresholds must be in [0,1], detection count an integer from 1 to 300, and resource-directory URLs must end with `/` |
| `INVALID_MANIFEST` | Check nonempty identity/version, absolute HTTP(S) URL, positive byte length, and 64-character SHA-256. Custom ONNX must also match the current PP-YOLOE_seg input/four-output contract |
| `DOWNLOAD` | Inspect HTTP status, CORS, redirects, connectivity, and CSP `connect-src` in Network tools. Ensure local `.tmp/model.onnx` exists; official Hubs are unpublished |
| `INTEGRITY` | Ensure the URL returns raw ONNX rather than HTML or an LFS pointer; verify complete byte length/checksum against metadata. Clear the current model cache and retry; do not change the checksum to bypass verification |
| `UNSUPPORTED` | Check HTTPS/secure context, Web Crypto, WebAssembly, module Workers, and image decoding. WebGPU needs a usable adapter. The user may explicitly choose an available WASM/main configuration |
| `OUT_OF_MEMORY` | Resize the original image, reduce `maxDetections`, increase `scoreThreshold`, and release unused sessions. Lower thresholds can increase candidates/masks and worsen memory use. The 64 MiB return limit is not a process-memory limit |
| `SESSION` | Check that the entire `dist/` is hosted, ORT versions match, Worker/`.mjs/.wasm` responses use correct MIME instead of HTML, and CSP permits loading/compilation |
| `INFERENCE` | Verify model output shapes, types, and finite values; record device/runtime errors. Do not silently substitute models/backends or suppress the error |
| `NOT_LOADED` | First `await sdk.load()`; fix the cause of a failed load before retrying |
| `BUSY` | Another `load/run` is active on the instance. Wait for it or manage separate instances and their resources; do not overlap calls |
| `ABORTED` | Check whether the user canceled; wait for settlement. Load again after a canceled load, or reuse a loaded instance after a canceled run. Cancellation does not promise immediate kernel interruption |
| `DISPOSED` | Create a new instance; disposed instances cannot be reused |
| Run button unavailable | Select an image and confirm a development server is in use. Disabling production inference while official model sources are unpublished is expected |
| Worker 404/cross-origin failure | Deploy all of `dist/`; prefer same-origin `/sdk/`. Use an absolute `runtimeBaseUrl`, such as `new URL('/sdk/', location.origin).href`. Cross-origin deployment requires additional module CORS/CSP verification |
| Repeated runs remain slow | The Demo creates and disposes a session each time. Cached model bytes still require verification and session creation. Benchmarks reusing sessions are not directly comparable to Demo latency |
| Fast GPU inference but an unresponsive page | Preprocessing/mask postprocessing use CPU in main mode. Worker can improve responsiveness without guaranteeing faster computation |
| Shifted masks or missing edges | Use `mask.x/y` and `mask.width/height`, not box coordinates. Do not clip masks to the box again; empty masks have zero dimensions |
| All modes execute but acceptance says failed | Execution does not establish quality acceptance. The official path has a known last-row/column truncation difference; see [Compatibility](compatibility.md) and diagnosis. Do not weaken gates to hide it |

Cache-cleanup example (`sdk` is an instance already created by the application):

```js
import { clearCurrentModelCache, getModelCacheInfo } from '/sdk/index.js';

await clearCurrentModelCache(sdk.manifest);
console.log(await getModelCacheInfo(sdk.manifest));
```

Clearing persistent cache does not unload a session. To force a fresh download, dispose of the old instance, clear its cache, then create and load a new one. See [Privacy and deployment](privacy-deployment.md) for deployment details.

