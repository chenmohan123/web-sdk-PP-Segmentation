# PP-YOLOE_seg_s FP32 model card

[中文](README.md)

This is a PaddlePaddle/PaddleDetection ONNX mirror maintained by chenmohan, not the official Paddle account. The [SDK model manifest](https://github.com/chenmohan123/web-sdk-PP-Segmentation/blob/main/models/model.json) records sources and immutable revisions.

| Field | Value |
|---|---|
| Model | PP-YOLOE_seg_s 640 FP32 |
| Identity | `ppyoloe-seg-s-640-fp32` |
| Version | `0.1.0` |
| Classes | COCO 80-class instance segmentation |
| Trainable parameters | 8,995,698 |
| Format | ONNX opset 17, FP32 |
| File size | 36,265,193 bytes |
| SHA-256 | `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334` |
| Default source | ModelScope, with Hugging Face as another explicitly selected source; no silent source fallback |

## Source and conversion

- Pinned upstream revision: [b25522a0f4bde8c80603f3ba5e3472059972e3b5](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5).
- Official configuration: `configs/ppyoloe_seg/ppyoloe_seg_s_80e_coco.yml`.
- Original weights: [ppyoloe_seg_s_80e_coco.pdparams](https://paddledet.bj.bcebos.com/models/ppyoloe_seg_s_80e_coco.pdparams), 36,122,452 bytes, SHA-256 `ee507d8f9e5fad6290ee54ee6704b9b1f2ab26a109cc668e1a966f90fe174cef`.
- Conversion tools: PaddlePaddle 2.6.2, Paddle2ONNX 1.3.1, ONNX 1.16.2. The export exposes a fixed single-image raw segmentation head; the SDK performs NMS and original-image mask recovery. The trained weights are retained without retraining or quantization.
- Export and per-file source evidence is in the adjacent portal's `reports/segmentation/2026-09-18-feasibility/`. Export patches are this project's modifications; a patched working directory must not be described as untouched upstream source.

## Input and output

The `image` input is Float32 `[1,3,640,640]`. The SDK resizes RGB with bicubic interpolation (A=-0.75), quantizes to uint8, and divides by 255. Transparent pixels are composited over white first. The model does not directly accept JPEG files or browser canvases.

Four Float32 outputs provide boxes `[1,8400,4]`, class scores `[1,80,8400]`, mask coefficients `[1,32,8400]`, and prototypes `[1,32,160,160]`. The SDK performs class-wise NMS and two bilinear mask-resizing stages, returning compact 0/1 ROIs in original-image coordinates. The decoded integer input dimensions define the full canvas.

## Verification scope

ORT Web 1.27.0 WASM/WebGPU × main/Worker executed on the recorded Windows/Chromium desktop environment on 2026-09-18. The independent integer-original-size reference passed on 64 images: 423 high-score matches per mode, minimum mask IoU 0.998708 and maximum AP drop 0.077690 percentage points. The original cropped-edge failure is preserved; the 256 SDK runs reuse verified historical archives. See [Compatibility](https://github.com/chenmohan123/web-sdk-PP-Segmentation/blob/main/docs/en/compatibility.md). The 64-image subset does not establish full-COCO accuracy or universal device support. Phones, NPU, Safari, Firefox, and WebViews remain unverified.

## Licensing and images

Apache-2.0 is adopted from the pinned official project release statement, model table and file licenses. No separate weight-specific license was found; this limits the interpretation. See the bundled [LICENSE](LICENSE), [NOTICE](NOTICE) and [license investigation](https://github.com/chenmohan123/web-sdk-PP-Segmentation/blob/main/reports/2026-09-18-release-readiness/license/README.md) for the PaddleYOLO provenance boundary. Architectural similarity does not establish additional GPL/AGPL terms. Mirror platforms are not the licensor.

COCO evaluation images retain their original individual licenses and are excluded from the model package, npm package, and production Demo. Both sources use immutable revisions, byte sizes and SHA-256 verification. The SDK repository records the actual published download manifest.
