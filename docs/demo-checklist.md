# Demo 检查清单

依据门户标准 v1 的 `templates/demo-checklist.md`，记录 `0.1.0` Demo 在 2026-09-18 的实现和验证。勾选仅表示对应证据覆盖；远程链接必须在实际发布后另行回读。

主要证据：[demo/src/App.tsx](../demo/src/App.tsx)、[UI 冒烟汇总](../reports/2026-09-18-release-readiness/ui/summary.json)、[验收报告](../reports/2026-09-18-image-sdk/README.md)。

最新视觉修正以[Detection 风格对齐记录](../reports/2026-09-18-ui-alignment/README.md)、[四组合复验](../reports/2026-09-18-ui-alignment/browser-summary.json)和[响应式布局记录](../reports/2026-09-18-ui-alignment/layout.json)为准。

- [x] Demo 只聚焦当前 PP-Segmentation/PP-YOLOE_seg_s 图片模型。
- [x] 初始页面为中文 `zh-CN`。
- [x] 实际对照 Detection 线上 Demo：深色顶栏、三栏工作台、分段按钮、小圆角及右侧折叠信息；1440/1366/1024/390px 中英切换与实例选择不改变画布位置。
- [x] 中英切换保留当前结果，不重载模型状态；`language=true`。
- [x] 品牌栏版本为 0.1.0，GitHub、npm 与 HTTPS Demo 均已发布，入口可用。
- [x] 选图、CPU/GPU、main/worker、运行/重置与禁用/加载状态可用；本版精度固定 FP32。
- [x] 空态不显示破损图片；真实 UI 冒烟无 page error。
- [x] 状态及错误使用可读文案与稳定错误码；实现位于 App。
- [x] 信息区展示模型、版本、大小、参数量、FP32、ONNX、当前来源、许可采用依据与 SHA-256。
- [x] 信息区展示请求/实际后端、执行模式和 ORT 版本。
- [x] 折叠信息区展示日期、浏览器、OS、CPU/GPU及两种执行模式；`verificationMatrix=true`，已验证展开后的实际文本。
- [x] 加载与运行九项耗时可查看：下载、缓存、完整性、会话、解码、预处理、推理、后处理、总耗时。
- [x] 当前模型缓存用量、当前/全部清理均由用户触发并有结果反馈；`cacheClear=true`。
- [x] 本地处理和隐私说明可见。
- [x] 390px 视口无横向溢出；`viewport390=true`，不代表手机推理验证。
- [x] WASM/WebGPU × main/worker 四组合真实运行。
- [x] 实例选择后画布坐标不变；四组合 `selectionStable=true`。
- [x] 取消、连续换图后可恢复；`cancelRecovery/replaceImage=true`。
- [x] 损坏图片和超过16,777,216像素的图片在预览绘制前被拒绝，清空旧画面和结果；换回有效图片后可恢复推理。
- [x] Vanilla 基线示例实际运行；`vanilla=true`。
- [x] 生产双源浏览器验收八组合全部通过，见[发布验收](../reports/2026-09-18-release-readiness/release-acceptance.json)与 [UI 汇总](../reports/2026-09-18-release-readiness/ui/summary.json)；早期来源缺失时的禁用记录继续作为历史证据保留。
- [x] 原图整数尺寸独立参考的严格质量门槛全部通过；四模式各匹配 423 个实例，最小 mask IoU 0.9987084870848708，见[验收报告](../reports/2026-09-18-original-size/README.md)。旧官方截断口径失败档案保留。

上述项目均有对应验收或交付证据。发布与远程治理另见[发布检查清单](release-checklist.md)。
