# Compatibility

[中文](../zh-CN/compatibility.md) · [README](../../README.en.md)

Release `0.1.0` passed fixed-64-image quality acceptance in all four modes in the desktop environment below. Feature detection, successful execution, quality acceptance, and remote publication remain separate conclusions.

## Environment verified on 2026-09-18

| Item              | Observed environment                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating system  | Windows 11 Pro, 10.0.26200 / Build 26200                                                                                                            |
| Browser           | Chromium 153.0.8010.12                                                                                                                              |
| CPU               | Intel Core i5-10400F @ 2.90 GHz, 6 cores / 12 threads                                                                                               |
| GPU               | NVIDIA GeForce RTX 5060 Ti                                                                                                                          |
| GPU driver        | 32.0.16.1692                                                                                                                                        |
| Runtime           | onnxruntime-web 1.27.0; single-threaded WASM                                                                                                        |
| Model             | PP-YOLOE_seg_s 640 FP32, ONNX opset 17                                                                                                              |
| Date and evidence | 2026-09-18; [host.json](../../reports/2026-09-18-image-sdk/host.json), [original-size acceptance](../../reports/2026-09-18-original-size/README.md) |

| Backend | Execution mode | Scope and conclusion                               |
| ------- | -------------- | -------------------------------------------------- |
| WASM    | main           | Passed against the original-integer-size reference |
| WASM    | worker         | Passed against the original-integer-size reference |
| WebGPU  | main           | Passed against the original-integer-size reference |
| WebGPU  | worker         | Passed against the original-integer-size reference |

All combinations use the same COCO val2017 subset with segmentation GT and public `run({ image: RGBA })` calls. AP evaluation uses `scoreThreshold=0.01/nmsThreshold=0.7/maxDetections=100`; instance agreement uses `score>0.5`. Every mode matched 423 instances with none unmatched and minimum mask IoU 0.9987084870848708. Mask AP drops were 0.07768926117917574 percentage points for WASM and 0.07768469154607605 for WebGPU, within the ≤0.5-point and ≥0.99-IoU gates. Main and Worker matched all 6,400 instances per backend with identical masks. The 256 SDK inferences reuse an archive whose source, frozen inputs, and current `dist` checksums were verified; SDK inference was not rerun for this acceptance. Blob, blank-image, cancellation/recovery, and repeated-disposal records remain in [browser-execution.json](../../reports/2026-09-18-image-sdk/browser-execution.json).

## Reference criteria

Decoded integer `width/height` values are authoritative for the output canvas. The independent reference changes only the upstream final crop and empty-mask dimensions to use those integers; prototypes, interpolation, NMS, thresholds, and SDK numerics are unchanged. The original official CPU path truncated image `204871` from 612×612 to 611×611. Its failed result remains in the [old acceptance report](../../reports/2026-09-18-image-sdk/README.md); the current conclusion is in the [original-size acceptance](../../reports/2026-09-18-original-size/README.md).

## Requirements and unverified scope

WebGPU requires a secure context, a browser implementation, and a usable adapter in the selected execution environment. The existence of `navigator.gpu` does not guarantee session creation; Worker GPU capability must also be verified. An unavailable requested backend raises an error without switching to WASM. WebGPU preprocessing and mask postprocessing still run on the CPU; no all-operator GPU execution is promised.

WASM also needs WebAssembly, Web Crypto SHA-256, and correctly served ORT assets. Worker mode requires module Workers. Use HTTPS in production and localhost/127.0.0.1 secure contexts for local tests.

Phones, Safari, Firefox, WeChat or other WebViews, NPU, and other OS/browser/GPU-driver combinations have not been verified. Video, camera, and tracking are outside the current input contract. A responsive UI test at 390px establishes layout behavior only, not phone inference compatibility. The 64-image subset does not establish full-COCO accuracy or universal device performance.

Before adding compatibility claims, record the date, OS, browser, device, driver, runtime, backend/execution mode, model checksum, input, and actual results. See the [release checklist](../release-checklist.md) for release gates.
