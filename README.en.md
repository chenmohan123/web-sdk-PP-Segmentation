# PP-Segmentation

[中文](README.md)

A browser instance-segmentation SDK for PP-YOLOE_seg_s. One `Blob` or RGBA image produces classes, scores, original-image boxes, and compact binary instance masks. Images are processed locally in the browser; the runtime does not depend on React.

> `web-sdk-pp-segmentation@0.1.0-alpha.0` is a local alpha. The npm package, remote repository, model weights, and hosted Demo have not been published. Remote links below are planned destinations, not evidence of availability or distribution.

## Current scope

- Single images; PP-YOLOE_seg_s 640 FP32, COCO 80 classes, ONNX opset 17, 36,265,193 model bytes, and 8,995,698 parameters.
- WASM/CPU and WebGPU/GPU with `main` or `worker` execution. API defaults are `wasm/worker`; the React Demo defaults to `webgpu/worker`. A requested backend never silently falls back.
- Independent, potentially overlapping ROI masks stored as binary `Uint8Array`. Each ROI encloses all foreground after the second interpolation and may extend beyond the detection box. Draw using `mask.x/y`. List positions are not tracking IDs.
- Official model sources are limited to ModelScope and Hugging Face, with ModelScope as the default. `sources` in `models/model.json` is currently empty; verification uses an explicit local development URL.
- Video, camera, NPU, portal workflows, and mobile compatibility claims are outside this phase.

## Run locally

Use Node.js ≥22.12.0, pnpm, this local checkout, and the already acquired model at `.tmp/model.onnx`. See [models/model.json](models/model.json) for its identity, size, and checksum. Neither Git nor npm build artifacts contain the model. If the weights are missing, prepare the matching model from your authorized source; the unpublished Hubs are not download endpoints.

Run from the repository root:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

Open the [React Demo](http://127.0.0.1:4188/), choose a local image, and start segmentation. The [Vanilla TypeScript example](examples/vanilla/README.md) runs with `pnpm dev:vanilla` at [127.0.0.1:4189](http://127.0.0.1:4189/). The [React example guide](examples/react/README.md) points directly to the full reference Demo.

This browser module uses `/sdk/` and `/local-model/` served by the development server above. Add `<input id="image" type="file" accept="image/*">` to the HTML. The handler obtains `file` from the user's selection and skips empty selections:

```js
import { createSegmentation } from '/sdk/index.js';

document.querySelector('#image').addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const sdk = createSegmentation({
    model: {
      id: 'ppyoloe-seg-s-640-fp32',
      version: '0.1.0-alpha.0',
      url: new URL('/local-model/model.onnx', location.origin).href,
      bytes: 36265193,
      sha256: 'd418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334',
    },
    backend: 'wasm',
    executionMode: 'worker',
    runtimeBaseUrl: new URL('/sdk/', location.origin).href,
  });
  try {
    await sdk.load({ onProgress: console.log });
    const result = await sdk.run({ image: file });
    console.log(result.instances, sdk.loadTimings, result.timings);
  } catch (error) {
    console.error(error.code, error.message);
  } finally {
    await sdk.dispose();
  }
});
```

For another application, host the entire `dist/` directory at same-origin `/sdk/`, including the Worker and matching ORT files. Set `runtimeBaseUrl` to an absolute URL ending with `/`. Applications may also install a locally packed archive and import by package name. Until npm publication, do not use `pnpm add web-sdk-pp-segmentation` as an installation step. See [Quick start](docs/en/quick-start.md).

## Documentation and evidence

| 中文 | English |
|---|---|
| [快速开始](docs/zh-CN/quick-start.md) | [Quick start](docs/en/quick-start.md) |
| [API](docs/zh-CN/api.md) | [API](docs/en/api.md) |
| [兼容性](docs/zh-CN/compatibility.md) | [Compatibility](docs/en/compatibility.md) |
| [排障](docs/zh-CN/troubleshooting.md) | [Troubleshooting](docs/en/troubleshooting.md) |
| [隐私与部署](docs/zh-CN/privacy-deployment.md) | [Privacy and deployment](docs/en/privacy-deployment.md) |
| [性能](docs/zh-CN/performance.md) | [Performance](docs/en/performance.md) |
| [发布说明](docs/zh-CN/release.md) | [Release notes](docs/en/release.md) |

The public SDK executed all four combinations on the fixed 64-image dataset dated 2026-09-18, but strict quality acceptance remains failed. One car instance in image 204871 differs by 58 pixels, all on edges removed by the official 612×612→611×611 truncation; the common region agrees. The SDK preserves the entire original image without weakening gates; see the [edge diagnosis](reports/2026-09-18-image-sdk/edge-diagnosis.json). Full conclusions, environment, and per-image records are in the [local acceptance report](reports/2026-09-18-image-sdk/README.md), without establishing full-COCO or other-device performance. The [Demo checklist](docs/demo-checklist.md) and [release checklist](docs/release-checklist.md) separate local implementation from outstanding publication work.

Planned destinations: [GitHub (not created)](https://github.com/chenmohan123/web-sdk-PP-Segmentation) · [npm (not published)](https://www.npmjs.com/package/web-sdk-pp-segmentation) · [hosted Demo (not deployed)](https://chenmohan123.github.io/web-sdk-PP-Segmentation/). Upstream provenance and conversion records from the feasibility phase are in the portal's [segmentation report](https://github.com/chenmohan123/chenmohan123.github.io/tree/main/reports/segmentation/2026-09-18-feasibility).

## Local checks and license

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test:browser
```

Browser checks require the local model, built resources, and an available Chromium executable. See [scripts/evaluation/README.md](scripts/evaluation/README.md) for acceptance operations. Run the standard checker from the adjacent portal as described in the release checklist.

SDK source is Apache-2.0; see [LICENSE](LICENSE). The upstream PaddleDetection source license does not establish permission to redistribute model weights. Weight licensing, provenance, and third-party attribution remain gates before uploading weights; see [NOTICE](NOTICE). Evaluation data and model binaries are excluded from npm and Git.
