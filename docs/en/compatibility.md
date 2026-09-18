# Compatibility

[中文](../zh-CN/compatibility.md) · [README](../../README.en.md)

`0.1.0-alpha.0` runs in the verified local desktop environment, but stable quality acceptance has not passed. Feature detection, successful execution, and quality acceptance are separate conclusions.

## Environment verified on 2026-09-18

| Item | Observed environment |
|---|---|
| Operating system | Windows 11 Pro, 10.0.26200 / Build 26200 |
| Browser | Chromium 153.0.8010.12 |
| CPU | Intel Core i5-10400F @ 2.90 GHz, 6 cores / 12 threads |
| GPU | NVIDIA GeForce RTX 5060 Ti |
| GPU driver | 32.0.16.1692 |
| Runtime | onnxruntime-web 1.27.0; single-threaded WASM |
| Model | PP-YOLOE_seg_s 640 FP32, ONNX opset 17 |
| Date and evidence | 2026-09-18; [host.json](../../reports/2026-09-18-image-sdk/host.json), [acceptance report](../../reports/2026-09-18-image-sdk/README.md) |

| Backend | Execution mode | Scope and conclusion |
|---|---|---|
| WASM | main | Public SDK executed on 64 fixed images; not all quality gates passed |
| WASM | worker | Public SDK executed on 64 fixed images; not all quality gates passed |
| WebGPU | main | Public SDK executed on 64 fixed images; not all quality gates passed |
| WebGPU | worker | Public SDK executed on 64 fixed images; not all quality gates passed |

All combinations use the same COCO val2017 subset with segmentation GT and public `run({ image: RGBA })` calls. AP evaluation uses `scoreThreshold=0.01/nmsThreshold=0.7/maxDetections=100`; instance agreement uses `score>0.5`. AP drop must be ≤0.5 percentage points, and matched masks must have IoU ≥0.99. See the report for values, unmatched instances, and main/worker agreement. Actual Blob, blank-image, cancellation/recovery, and repeated-disposal records are in [browser-execution.json](../../reports/2026-09-18-image-sdk/browser-execution.json). Demo combinations, language switching, stable selection, 390px layout, cancellation/image replacement, and cache actions passed the [UI smoke checks](../../reports/2026-09-18-image-sdk/ui/summary.json).

## Known quality difference

One `car` instance in COCO image `204871` fails the strict mask-IoU gate. The official path truncates the original 612×612 mask to 611×611; all 58 differing pixels are in the removed last row/column. IoU within the common 611×611 region is 1. The SDK preserves the complete original-image foreground, without trimming its edges to pass or lowering the 0.99 threshold. Original strict acceptance therefore remains failed and cannot be labeled stable quality acceptance. See [edge-diagnosis.json](../../reports/2026-09-18-image-sdk/edge-diagnosis.json) and the [acceptance report](../../reports/2026-09-18-image-sdk/README.md) for diagnosis and the original comparison criteria.

## Requirements and unverified scope

WebGPU requires a secure context, a browser implementation, and a usable adapter in the selected execution environment. The existence of `navigator.gpu` does not guarantee session creation; Worker GPU capability must also be verified. An unavailable requested backend raises an error without switching to WASM. WebGPU preprocessing and mask postprocessing still run on the CPU; no all-operator GPU execution is promised.

WASM also needs WebAssembly, Web Crypto SHA-256, and correctly served ORT assets. Worker mode requires module Workers. Use HTTPS in production and localhost/127.0.0.1 secure contexts for local tests.

Phones, Safari, Firefox, WeChat or other WebViews, NPU, and other OS/browser/GPU-driver combinations have not been verified. Video, camera, and tracking are outside the current input contract. A responsive UI test at 390px establishes layout behavior only, not phone inference compatibility. The 64-image subset does not establish full-COCO accuracy or universal device performance.

Before adding compatibility claims, record the date, OS, browser, device, driver, runtime, backend/execution mode, model checksum, input, and actual results. See the [release checklist](../release-checklist.md) for release gates.

