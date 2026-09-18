# 发布说明

[English](../en/release.md) · [返回 README](../../README.md)

## 0.1.0 · 发布候选 · 2026-09-18

首版包含框架无关的图片实例分割 SDK、模块 Worker、React Demo、Vanilla 示例、完整性校验、版本化模型缓存、取消/释放及完整双语指南。质量与本地实现门槛已通过，ModelScope/Hugging Face 权重已发布并完整回读，GitHub 仓库与治理已配置；npm 和 HTTPS Demo 仍以实际发布及回读结果为准。

- 模型：PP-YOLOE_seg_s 640 FP32，COCO 80 类，ONNX opset 17，8,995,698 参数；36,265,193 字节，SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`。
- 上游：PaddleDetection 固定源码提交 `b25522a0f4bde8c80603f3ba5e3472059972e3b5`，见 [NOTICE](../../NOTICE)；它不是 Hub 发布 revision。
- 后端：ORT Web 1.27.0，WASM/WebGPU × main/worker；API 默认 WASM/Worker，Demo 默认 WebGPU/Worker，不静默回退。
- 输出：原图框与独立紧致二值 ROI；保留二次插值后的全部前景和实例重叠，序号不是跟踪 ID。
- 分发：ModelScope/Hugging Face 两源，默认来源及固定 URL 读取 [models/model.json](../../models/model.json) 的 `defaultSource`/`sources`；npm 和 Demo 产物不内置 ONNX。
- 许可：SDK、官方权重及其 ONNX 转换物采用 Apache-2.0，并保留上游与转换归因；Hub 镜像由本项目维护。没有独立点名权重的许可文本是解释边界，不是额外授权硬门槛。

## 质量证据和限制

固定 64 图的 WASM/WebGPU × main/worker 均通过原图整数尺寸独立参考验收。每种模式匹配 423 个 `score>0.5` 实例，未匹配 0，最小 mask IoU 0.9987084870848708；WASM/WebGPU mask AP 下降分别为 0.07768926117917574/0.07768469154607605 个百分点。独立参考只修正最终裁剪与空掩码尺寸，SDK 无数值改动。256 次 SDK 推理复用核验过源码、冻结文件和当前构建摘要的旧归档，并非本次重跑。见[原图尺寸验收](../../reports/2026-09-18-original-size/README.md)。

原始官方截断参考的失败记录继续保留，便于审计口径变化。64 图子集不代表完整 COCO；证据仅适用于记录中的 Windows/Chromium 桌面环境，不扩展为手机、NPU、Safari、Firefox、WebView、视频或摄像头兼容。Demo 不附带公开示例图片，COCO 只用于本地验收。

## 发布前剩余事项

主流程还需发布 npm、不可变 GitHub Release 和 HTTPS Demo，再核验版本链接并保存带日期的远程证据。目标链接不代表已经上线。逐项状态见[发布检查清单](../release-checklist.md)和[Demo 检查清单](../demo-checklist.md)。
