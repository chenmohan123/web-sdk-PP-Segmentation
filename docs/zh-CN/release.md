# 发布说明

[English](../en/release.md) · [返回 README](../../README.md)

## 0.1.0-alpha.0 · 本地开发版 · 2026-09-18

当前已实现可运行的图片实例分割 SDK、模块 Worker、React Demo、Vanilla 示例、完整性校验、版本化模型缓存、取消与释放及双语指南。范围仅限本地实现与验收，尚未创建远程仓库、上传模型、发布 npm 包或部署在线 Demo。

- 模型：PP-YOLOE_seg_s 640 FP32，COCO 80 类，ONNX opset 17，8,995,698 参数；36,265,193 字节，SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`。
- 上游：PaddleDetection，固定源码提交 `b25522a0f4bde8c80603f3ba5e3472059972e3b5`，见 [NOTICE](../../NOTICE)；这不是 ModelScope/Hugging Face 的发布 revision。
- 后端：ORT Web 1.27.0，WASM/WebGPU × main/worker；API 默认 WASM/Worker，Demo 默认 WebGPU/Worker，不静默回退。
- 输出：原图框与独立紧致二值 ROI；保留二次插值全部前景及实例重叠，序号不是跟踪 ID。
- 分发：正式来源仅 ModelScope/Hugging Face，默认 ModelScope，但 `sources` 当前为空。仅显式本地模型覆盖；npm 和生产 Demo 不含 ONNX。
- 许可：SDK 与上游源码使用 Apache-2.0；模型权重再分发、第三方归因与生产示例素材许可仍待核验。

## 本轮证据和已知限制

固定 64 图已完成公共 SDK 四组合执行，AP 和逐实例质量记录见[验收报告](../../reports/2026-09-18-image-sdk/README.md)。原严格质量验收仍为失败：图片 `204871` 的 car 掩码，官方把 612×612 截成 611×611，58 个差异像素都在被裁边缘，共同区域 IoU 为 1。SDK 保留完整原图，不裁边缘或降低门槛；见 [edge-diagnosis.json](../../reports/2026-09-18-image-sdk/edge-diagnosis.json)。因此当前仅为可运行 alpha，不声明稳定质量合格。

真实 Demo 的四组合、中英切换、选择后画布位置稳定、390px 无溢出、取消/换图恢复、缓存清理、Vanilla 和生产来源禁用已经有 [UI 冒烟记录](../../reports/2026-09-18-image-sdk/ui/summary.json)，其中 `pageErrors` 为空。该证据限定记录中的 Windows/Chromium 桌面环境，不扩展为手机、NPU、Safari、Firefox、WebView、视频或摄像头兼容。

本地测试/类型/构建/打包与标准检查以[发布检查清单](../release-checklist.md)及主验收保存的日志为准。UI 成功和 required 静态检查通过不能替代数值质量及远程治理验收。

## 正式发布前

继续处理严格质量验收结论；核验权重许可和素材归因；为两个 Hub 固定不可变 revision 并完整下载回读；完成 GitHub 仓库、CI、分支/tag Rulesets 和 About；发布 npm 与不可变 GitHub Release；完成 HTTPS Demo 部署、版本链接回读及带日期的远程证据。规划地址不代表已发布。逐项追踪见[发布检查清单](../release-checklist.md)和[Demo 检查清单](../demo-checklist.md)。

