# Quick start

[中文](../zh-CN/quick-start.md) · [README](../../README.en.md)

The current package is `web-sdk-pp-segmentation@0.1.0-alpha.0`, available locally only. npm, Hub weights, and the hosted Demo are unpublished. Stable quality acceptance has not passed; see [Compatibility](compatibility.md).

## Prepare and start

Use Node.js ≥22.12.0 and pnpm. Place the already acquired model at `.tmp/model.onnx` in the repository root. It must match [models/model.json](../../models/model.json): 36,265,193 bytes and SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`. Check it with PowerShell:

```powershell
(Get-Item -LiteralPath .tmp/model.onnx).Length
(Get-FileHash -LiteralPath .tmp/model.onnx -Algorithm SHA256).Hash
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

Open [127.0.0.1:4188](http://127.0.0.1:4188/) and select a local image. The Demo defaults to WebGPU/Worker; explicitly select WASM if no usable GPU is available. Start the [Vanilla example](http://127.0.0.1:4189/) in another terminal:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev:vanilla
```

The development server reads the local model only from the ignored directory. Official ModelScope/Hugging Face sources are unpublished; planned URLs cannot supply a download. Prepare the known file above before running. The production Demo build contains no ONNX and cannot run inference until an official source is configured.

## Call the public API

The development server serves the entire built SDK at `/sdk/` and the local model at `/local-model/model.onnx`. Add a file picker to a page served there:

```html
<input id="image" type="file" accept="image/*">
```

Use the following browser module. Do not open the page directly through `file://`:

```js
import { createSegmentation } from '/sdk/index.js';

const input = document.querySelector('#image');
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  input.disabled = true;
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
    const result = await sdk.run({ image: file }, {
      scoreThreshold: 0.5,
      nmsThreshold: 0.7,
      maxDetections: 100,
    });
    console.log(result.instances, result.runtime, result.timings);
  } catch (error) {
    console.error(error.code, error.message);
  } finally {
    await sdk.dispose();
    input.disabled = false;
  }
});
```

The API also defaults to `wasm/worker`. To reuse a model session, create and `load()` once at the start of the application lifecycle, call `run()` serially, and `dispose()` at the end. The React Demo and Vanilla example create, load, and release a new instance for each image run. Clicking again does not reuse a warm session.

## Read results

`result.instances` is sorted by descending score. `classId` is a contiguous COCO 80-class index; `box` is an original-image pixel box clipped to image bounds. `mask.data` contains row-major 0/1 bytes with size `mask.width × mask.height`. Local mask pixel `(x, y)` maps to original-image pixel `(x + mask.x, y + mask.y)`.

The ROI tightly encloses all foreground after the second interpolation and may extend beyond `box`; do not clip it to the detection box again. Pixels outside the ROI are zero. Empty masks have zero width/height and an empty array. Instances may overlap; array positions do not identify objects across frames. See [Vanilla main.ts](../../examples/vanilla/main.ts) for a complete drawing implementation.

The SDK neither transfers nor modifies the caller's RGBA buffer. Input is limited to 16,777,216 pixels, and returned masks total at most 64 MiB; exceeding a limit raises an error. Pass `AbortController.signal` to `load/run` to cancel. Cancellation does not promise to preempt submitted kernels. Retry after the canceled operation settles; create a new instance after `dispose()`. See [API](api.md).

## Integrate with another application

Build the SDK, then copy the entire `dist/` directory to the application's same-origin static `/sdk/` directory, preserving filenames. Copying only `index.js` is insufficient. Set `runtimeBaseUrl` to an absolute URL ending with `/`. The model URL must also be an absolute HTTP(S) URL with accurate bytes and SHA-256.

To import by package name, create a local package in the SDK root:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false pack --pack-destination .tmp
```

From an application directory beside the SDK directory, install the local file:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false add ../web-sdk-PP-Segmentation/.tmp/web-sdk-pp-segmentation-0.1.0-alpha.0.tgz
```

You can then use `import { createSegmentation } from 'web-sdk-pp-segmentation'`. The ORT/Worker static directory must still be deployed. See [Privacy and deployment](privacy-deployment.md) for HTTPS, CORS, CSP, and caching.

