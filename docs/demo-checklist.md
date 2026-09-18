# Demo 检查清单

依据门户标准 v1 的 `templates/demo-checklist.md`，记录 `0.1.0-alpha.0` 本地 Demo 在 2026-09-18 的实现和验证。勾选仅表示下列本地证据覆盖，不能用于声明远程发布或稳定模型质量通过。

主要证据：[demo/src/App.tsx](../demo/src/App.tsx)、[UI 冒烟汇总](../reports/2026-09-18-image-sdk/ui/summary.json)、[验收报告](../reports/2026-09-18-image-sdk/README.md)。

- [x] Demo 只聚焦当前 PP-Segmentation/PP-YOLOE_seg_s 图片模型。
- [x] 初始页面为中文 `zh-CN`。
- [x] 中英切换保留当前结果，不重载模型状态；`language=true`。
- [ ] 品牌栏的包版本、GitHub 和 Demo 入口全部为可用正式链接；当前只可核验本地名称/版本与规划链接，远程尚未发布。
- [x] 选图、CPU/GPU、main/worker、运行/重置与禁用/加载状态可用；本版精度固定 FP32。
- [x] 空态不显示破损图片；真实 UI 冒烟无 page error。
- [x] 状态及错误使用可读文案与稳定错误码；实现位于 App。
- [x] 信息区展示模型、版本、大小、参数量、FP32、ONNX、当前本地来源/未发布提示、源码许可边界与 SHA-256。
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
- [x] 生产来源缺失时禁用推理；`productionSourceDisabled=true`，没有模型请求。
- [ ] 严格质量门槛全部通过；目前仍有官方末行/末列裁剪造成的已知失败，见[边缘诊断](../reports/2026-09-18-image-sdk/edge-diagnosis.json)。

未完成项由主流程补写最新证据后再勾选。发布与远程治理另见[发布检查清单](release-checklist.md)。

