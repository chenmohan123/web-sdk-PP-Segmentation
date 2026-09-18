# Release notes

[中文](../zh-CN/release.md) · [README](../../README.en.md)

## 0.1.0 · First release delivery · 2026-09-18

The first release includes the framework-neutral image segmentation SDK, module Worker, React Demo, Vanilla example, integrity checks, versioned caching, cancellation/disposal and bilingual guides. Both weight sources, the independent repository and HTTPS Demo are published and verified. npm publication and the final version tag await account verification.

- Model: PP-YOLOE_seg_s 640 FP32, COCO 80 classes, ONNX opset 17, 8,995,698 parameters; 36,265,193 bytes; SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`.
- Upstream: PaddleDetection source pinned to `b25522a0f4bde8c80603f3ba5e3472059972e3b5`; see [NOTICE](../../NOTICE). It is not a Hub publication revision.
- Backends: ORT Web 1.27.0, WASM/WebGPU × main/worker. The API defaults to WASM/Worker and the Demo to WebGPU/Worker, without silent fallback.
- Output: original-image boxes and independent compact binary ROIs, preserving all foreground after the second interpolation and instance overlaps. Array positions are not tracking IDs.
- Distribution: ModelScope and Hugging Face. Read the default source and fixed URLs from `defaultSource`/`sources` in [models/model.json](../../models/model.json). npm and Demo artifacts do not embed ONNX.
- License: Apache-2.0 is applied to the SDK, official weights, and their ONNX conversion with upstream and conversion attribution. Hub mirrors are maintained by this project. The lack of a separate license naming the weight file is an interpretive boundary, not an additional authorization gate.

## Quality evidence and limits

WASM/WebGPU × main/worker passed the original-integer-size independent reference on the fixed 64-image subset. Every mode matched 423 instances at `score>0.5`, with none unmatched and minimum mask IoU 0.9987084870848708. WASM/WebGPU mask AP drops were 0.07768926117917574/0.07768469154607605 percentage points. The independent reference changes only final crop and empty-mask dimensions; SDK numerics are unchanged. The 256 SDK inferences reuse an archive whose source, frozen inputs, and current build checksums were verified; they were not rerun for this acceptance. See the [original-size acceptance](../../reports/2026-09-18-original-size/README.md).

The original official-truncation failure remains archived so the criteria change is auditable. The 64-image subset does not represent full COCO. Evidence applies only to the recorded Windows/Chromium desktop environment, not phones, NPU, Safari, Firefox, WebViews, video, or cameras. The Demo ships no public sample image; COCO is local acceptance data only.

## Delivery status

[PR #2](https://github.com/chenmohan123/web-sdk-PP-Segmentation/pull/2) passed Linux CI and merged. All 22 files in the [HTTPS Demo](https://chenmohan123.github.io/web-sdk-PP-Segmentation/) match accepted artifacts; the default ModelScope/GPU/Worker path ran successfully. See the [live receipt](../../reports/2026-09-18-release-readiness/demo-published.json) and [remote governance](../../reports/2026-09-18-release-readiness/governance-published.json). npm publication still requires account verification, followed by the immutable tag and GitHub Release. See the [release checklist](../release-checklist.md).
