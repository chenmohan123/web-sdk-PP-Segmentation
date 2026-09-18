# Release notes

[中文](../zh-CN/release.md) · [README](../../README.en.md)

## 0.1.0-alpha.0 · Local development release · 2026-09-18

This version implements a runnable image-segmentation SDK, module Worker, React Demo, Vanilla example, integrity checks, versioned model caching, cancellation/disposal, and bilingual guides. Scope remains local implementation and acceptance; the remote repository, uploaded weights, npm package, and hosted Demo are unpublished.

- Model: PP-YOLOE_seg_s 640 FP32, COCO 80 classes, ONNX opset 17, 8,995,698 parameters; 36,265,193 bytes; SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`.
- Upstream: PaddleDetection source pinned to `b25522a0f4bde8c80603f3ba5e3472059972e3b5`; see [NOTICE](../../NOTICE). This is not a ModelScope/Hugging Face publication revision.
- Backends: ORT Web 1.27.0, WASM/WebGPU × main/worker. The API defaults to WASM/Worker and the Demo to WebGPU/Worker, without silent fallback.
- Output: original-image boxes and independent compact binary ROIs, preserving all foreground after the second interpolation and overlaps between instances. Positions are not tracking IDs.
- Distribution: official sources are limited to ModelScope/Hugging Face, defaulting to ModelScope, but `sources` is currently empty. Only an explicit local model override is available. npm and production Demo artifacts exclude ONNX.
- Licensing: SDK and upstream source are Apache-2.0. Weight redistribution, third-party attribution, and production example-asset licensing still require verification.

## Evidence and known limitations

Public SDK execution on the fixed 64-image dataset covers all four combinations. AP and instance-quality records are in the [acceptance report](../../reports/2026-09-18-image-sdk/README.md). Original strict quality acceptance remains failed: for the car mask in image `204871`, the official path truncates 612×612 to 611×611. All 58 differing pixels lie on the removed edges, and common-region IoU is 1. The SDK retains the entire original image without trimming edges or weakening gates; see [edge-diagnosis.json](../../reports/2026-09-18-image-sdk/edge-diagnosis.json). This is therefore a runnable alpha, not stable quality acceptance.

The [UI smoke record](../../reports/2026-09-18-image-sdk/ui/summary.json) covers real Demo execution in all four combinations, language switching, stable canvas position after selection, no overflow at 390px, cancellation/image-replacement recovery, cache cleanup, Vanilla, and disabled production sources. Its `pageErrors` is empty. Evidence applies to the recorded Windows/Chromium desktop environment, not phones, NPU, Safari, Firefox, WebViews, video, or cameras.

Local tests, types, builds, package checks, and standard-checker results are tracked in the [release checklist](../release-checklist.md) and logs retained by the main acceptance workflow. Passing UI and required static checks does not replace numerical quality or remote-governance acceptance.

## Before publication

Resolve the strict quality-acceptance conclusion; verify weight licenses and asset attribution; pin both Hubs to immutable revisions and verify full downloads; configure the GitHub repository, CI, branch/tag Rulesets, and About; publish npm and an immutable GitHub Release; deploy the HTTPS Demo and verify version links with dated remote evidence. Planned URLs do not mean publication. Track each gate in the [release checklist](../release-checklist.md) and [Demo checklist](../demo-checklist.md).

