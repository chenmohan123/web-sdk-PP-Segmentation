# PP-Segmentation

[中文](README.md)

A browser instance-segmentation SDK for PP-YOLOE_seg_s. One `Blob` or RGBA image produces classes, scores, original-image boxes, and compact binary instance masks. Images are processed locally in the browser; the runtime does not depend on React.

> `web-sdk-pp-segmentation@0.1.0` provides PP-YOLOE_seg_s 640 FP32 image instance segmentation with CPU/GPU and Worker support. Quality acceptance, both model sources and the HTTPS Demo have been verified. See below for installation and usage.

## Current scope

- Single images; PP-YOLOE_seg_s 640 FP32, COCO 80 classes, ONNX opset 17, 36,265,193 model bytes, and 8,995,698 parameters.
- WASM/CPU and WebGPU/GPU with `main` or `worker` execution. API defaults are `wasm/worker`; the React Demo defaults to `webgpu/worker`. A requested backend never silently falls back.
- Independent, potentially overlapping ROI masks stored as binary `Uint8Array`. Each ROI encloses all foreground after the second interpolation and may extend beyond the detection box. Draw using `mask.x/y`. List positions are not tracking IDs.
- Official model sources are ModelScope and Hugging Face. Read `defaultSource` and fixed download URLs from [models/model.json](models/model.json); this guide does not duplicate revisions that can become stale.
- Video, camera, NPU, portal workflows, and mobile compatibility claims are outside this phase.

## Installation

```powershell
pnpm add web-sdk-pp-segmentation@0.1.0
```

See [Quick start](docs/en/quick-start.md) to configure model and ORT static resources for your application.

## Run locally

Use Node.js ≥22.12.0, pnpm, this local checkout, and a local model at `.tmp/model.onnx`. Read its identity, size, checksum, and published fixed sources from [models/model.json](models/model.json). Select the `sources` entry named by `defaultSource`, download its `downloadUrl`, and verify `bytes` and `sha256`. Neither Git nor npm build artifacts contain the model.

Run from the repository root:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

Open the [React Demo](http://127.0.0.1:4188/), choose a local image, and start segmentation. The [Vanilla TypeScript example](examples/vanilla/README.md) runs with `pnpm dev:vanilla` at [127.0.0.1:4189](http://127.0.0.1:4189/). The [React example guide](examples/react/README.md) points directly to the full reference Demo.

This browser module uses `/sdk/` and `/local-model/` served by the development server above. Add `<input id="image" type="file" accept="image/*">` to the HTML. The handler obtains `file` from the user's selection and skips empty selections:

```js
import { createSegmentation } from "/sdk/index.js";

document.querySelector("#image").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const sdk = createSegmentation({
    model: {
      id: "ppyoloe-seg-s-640-fp32",
      version: "0.1.0",
      url: new URL("/local-model/model.onnx", location.origin).href,
      bytes: 36265193,
      sha256:
        "d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334",
    },
    backend: "wasm",
    executionMode: "worker",
    runtimeBaseUrl: new URL("/sdk/", location.origin).href,
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

For another application, host the entire `dist/` directory at same-origin `/sdk/`, including the Worker and matching ORT files. Set `runtimeBaseUrl` to an absolute URL ending with `/`. Install with `pnpm add web-sdk-pp-segmentation@0.1.0` and import from the package name. See [Quick start](docs/en/quick-start.md).

## Documentation and evidence

| 中文                                           | English                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| [快速开始](docs/zh-CN/quick-start.md)          | [Quick start](docs/en/quick-start.md)                   |
| [API](docs/zh-CN/api.md)                       | [API](docs/en/api.md)                                   |
| [兼容性](docs/zh-CN/compatibility.md)          | [Compatibility](docs/en/compatibility.md)               |
| [排障](docs/zh-CN/troubleshooting.md)          | [Troubleshooting](docs/en/troubleshooting.md)           |
| [隐私与部署](docs/zh-CN/privacy-deployment.md) | [Privacy and deployment](docs/en/privacy-deployment.md) |
| [性能](docs/zh-CN/performance.md)              | [Performance](docs/en/performance.md)                   |
| [发布说明](docs/zh-CN/release.md)              | [Release notes](docs/en/release.md)                     |

All four public-SDK combinations passed the original-integer-size reference acceptance on the fixed 64-image subset dated 2026-09-18. Each mode matched 423 instances at `score>0.5`, with minimum mask IoU 0.9987084870848708. Mask AP drops were 0.07768926117917574 percentage points for WASM and 0.07768469154607605 for WebGPU. Only the reference's final crop and empty-mask dimensions changed; SDK numerics did not. The 256 SDK inferences reuse a checksum-verified archive and were not rerun in this acceptance. See the [original-size report](reports/2026-09-18-original-size/README.md). The old official-truncation failure remains archived. This subset does not establish full-COCO, phone, or NPU performance.

Project links: [GitHub](https://github.com/chenmohan123/web-sdk-PP-Segmentation) · [npm](https://www.npmjs.com/package/web-sdk-pp-segmentation) · [hosted Demo](https://chenmohan123.github.io/web-sdk-PP-Segmentation/). Upstream provenance and conversion records are in the portal's [segmentation report](https://github.com/chenmohan123/chenmohan123.github.io/tree/main/reports/segmentation/2026-09-18-feasibility).

## Local checks and license

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test:browser
```

Browser checks require the local model, built resources, and an available Chromium executable. See [scripts/evaluation/README.md](scripts/evaluation/README.md) for acceptance operations. Run the standard checker from the adjacent portal as described in the release checklist.

SDK source is Apache-2.0; see [LICENSE](LICENSE). Based on the pinned PaddleDetection Apache-2.0 project statement, official model table, and attribution evidence, this project applies Apache-2.0 to the official weights and their ONNX conversion. The absence of a separate license naming the weight file is an interpretive boundary, not an additional authorization gate. Hub mirrors are maintained by this project; see [NOTICE](NOTICE) and the [license decision](reports/2026-09-18-release-readiness/license/README.md). Evaluation data is excluded from npm, Git, and the public Demo.
