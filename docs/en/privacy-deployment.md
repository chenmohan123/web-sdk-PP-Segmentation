# Privacy and deployment

[中文](../zh-CN/privacy-deployment.md) · [README](../../README.en.md)

The SDK decodes and runs images locally in the browser. It has no image-upload API or built-in telemetry. Application uploads, logging, analytics scripts, and hosting services have their own data flows that the application must describe. Model downloads contact the configured host, which can observe normal request information such as IP addresses.

## Data and cache

Input pixels, image previews, and results remain in page/Worker memory. The SDK persists model bytes, not images or masks, in IndexedDB. Callers should release retained results, Object URLs, and canvas references. Browser decoding may consume substantial memory before an oversized image is rejected; the pixel limit is not a universal memory guarantee.

Model database `web-sdk-pp-segmentation-models-v1` uses the model's `id/version/sha256` as its key. Versions/checksums are isolated, and both cached and downloaded bytes undergo length and SHA-256 checks. Cache-write failures do not prevent the current run; browsers may evict data. Permanent offline availability is not promised.

`clearCurrentModelCache(model)` deletes only that model; `clearAllModelCache()` clears only this SDK's model database. “All” does not clear other SDKs, HTTP cache, or loaded sessions. Cleanup should be user initiated and report its result. `dispose()` releases the session/Worker without deleting persistent cache. See [API](api.md) for exports and aliases.

## Static resources

After `pnpm build`, host the entire `dist/` directory at same-origin `/sdk/`. Keep the SDK entry, types, Worker, ORT JavaScript/WASM, and all other generated files together. Do not mix ORT versions. Runtime 1.27.0 currently includes:

- `index.js` and `inference.worker.js`;
- `ort.webgpu.bundle.min.mjs`;
- `ort-wasm-simd-threaded.asyncify.mjs` and `ort-wasm-simd-threaded.asyncify.wasm`;
- adjacent types, sourcemaps, and other outputs.

Use `runtimeBaseUrl: new URL('/sdk/', location.origin).href`. The absolute directory URL must end in `/`. Static resources remain necessary even when importing from an npm package. Upgrade the complete directory atomically, or use versioned directories and update entry URLs together, to avoid mixing a new SDK with old ORT files.

Serve JavaScript MIME types for `.js/.mjs` and `application/wasm` for `.wasm`. Missing Worker/WASM routes must not be rewritten to SPA HTML. Avoid transformations that change model bytes.

Current WASM uses one thread (`numThreads=1`). A filename containing `threaded` does not mean multiple threads are enabled. It also does not establish SharedArrayBuffer or cross-origin isolation support; enabling threading later requires renewed COOP/COEP and browser verification.

## HTTPS, CORS, and CSP

Use HTTPS in production. Web Crypto SHA-256 and WebGPU require a secure context; use localhost/127.0.0.1 locally. Public HTTP pages and `file://` are not substitutes.

Prefer same-origin SDK resources. Models may be cross-origin, but their host and redirect targets must supply CORS responses allowing the application origin. The final URL must return raw ONNX, not a login page, download landing page, or Git LFS pointer. The SDK does not automatically switch sources: surface the error and let users select a working configuration. Cross-origin Worker/ORT loading also involves module CORS and potentially Blob Worker bootstrapping and must be independently verified. Same-origin hosting is this release's example baseline.

Set CSP for the actual application. This is only a starting point for a same-origin static site; validate it against browser console messages and the site's script/style policies. It is not production acceptance evidence:

```text
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
connect-src 'self';
img-src 'self' blob: data:;
style-src 'self';
object-src 'none';
base-uri 'self';
```

Add the actual model hosts to `connect-src`. Cross-origin ORT modules also need the corresponding `script-src` origins and resource CORS. Inline scripts/styles require the application's nonce/hash policy; avoid broadly allowing arbitrary origins. WASM compilation, module Workers, model requests, and previews are controlled by their respective directives. Inspect the specific blocked URL/directive when troubleshooting.

## Model sources and publication boundaries

`models/model.json` records the current size, checksum, format, and upstream identity. Official sources are limited to ModelScope/Hugging Face, with ModelScope as default. Its `sources` is currently empty: no official repository revision or weight URL is available. Do not invent revisions.

Local development explicitly overrides the URL with `new URL('/local-model/model.onnx', location.origin).href`; Vite serves the file from ignored `.tmp/model.onnx`. This is not an official distribution source. npm artifacts and the production Demo exclude ONNX. Without official sources configured, the production Demo must remain unable to run and explain why.

Before publication, pin each Hub to an immutable revision, full URL, byte length, and SHA-256, then verify a complete download. Review weight redistribution permission and third-party attribution. Apache-2.0 source licensing does not establish the weight license; see [NOTICE](../../NOTICE). Evaluation images also have individual licenses and cannot automatically be redistributed as production Demo assets. See [Release notes](release.md) for other gates.

