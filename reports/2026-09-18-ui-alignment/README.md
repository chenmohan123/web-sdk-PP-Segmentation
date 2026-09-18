# Detection 风格对齐记录

2026-09-18，单 SDK Demo 本地修正。基线提交为 `c02fc63`，参考页面为
[PP-Detection SDK 0.4.0](https://chenmohan123.github.io/web-sdk-PP-Detection/)。
实际读取线上页面并在 1440 × 900 视口截图，与本地修改前后页面对照。

## 修正内容

- 白色顶栏及上下卡片改为 Detection 的深色顶栏、左侧参数、中间图片、右侧结果。
- 对齐 270px/弹性/340px 三栏、紧凑控件、蓝色分段按钮、灰蓝画布和小圆角；共享令牌继续取自 `demo/ui-tokens.json`。
- 模型、后端、执行模式、选图、运行、重置和状态集中在左侧；右侧直接显示实例及主要耗时，详细耗时、运行信息和缓存默认折叠。
- 实例提示与恢复全部实例固定在图片工具栏；掩码使用与 Detection 标签开关一致的复选框。窄屏按参考页面收为上下布局。
- 保留本地开发/alpha 状态和不可用正式来源的禁用提示。SDK 推理代码、模型与严格质量结论均未调整。

## 验证与证据

- Demo TypeScript 检查与最终生产构建退出码均为 0。
- [浏览器复验](browser-summary.json)：Chromium 153.0.8010.12，WASM/WebGPU × main/Worker 四组合，每次得到 4 个实例；选择、掩码开关、中英切换、缓存、取消/换图、损坏/超限预览恢复、Vanilla 与生产来源禁用通过，页面异常为 0。
- [最终布局复验](layout.json)：1440 × 900、1366 × 768、1024 × 768、390 × 844，中文和英文均无横向溢出；实例选择、恢复全部实例及中英切换前后画布坐标与尺寸一致。1440px 和 1366px 桌面图片和结果在同一屏，信息区自行滚动。
- 标准检查[修改前](check-before.json)及[修改后](check-after.json)均为 required 18 通过、0 失败、4 项远程检查跳过。`EXAMPLE-003` 仍为推荐项失败：示例与声明目标需继续对齐，证据路径及补救要求见报告，不改变本地合规等级。
- SDK 入口 SHA-256 仍为 `bec08d2754a4b278f89faea15ca64f785aac5cb5f0f76503ca7004cab7a4f8e3`，Worker 仍为 `672886c08f66995832cc780b2496104e30501bd4cd4ebaae9b9368e2aa9de885`。

截图留在忽略目录 `.tmp/ui-alignment/`：`detection.png`、`segmentation-before.png`、`segmentation-1440.png`、`segmentation-1366.png`、`segmentation-1024.png`、`segmentation-390.png`；含本地评估图片，不随源码分发。

复验使用 `pnpm typecheck:demo`、`pnpm build:demo` 和 `node tests/browser.mjs`；pnpm 按仓库约定附加两项配置参数。浏览器设置 `PLAYWRIGHT_BROWSERS_PATH` 为 Detection 的 `.tmp/dependencies-compatible-browsers`，`SDK_UI_EVIDENCE_DIR=.tmp/ui-alignment/validation`，避免覆盖旧验收。

第一次冒烟在读取默认折叠的缓存区域时失败，原因是测试仍假设缓存文本始终可见；已改为展开后读取并复验通过。最后的窄屏间距修正另经布局记录验证。

本记录只说明本地 UI 修正。既有严格掩码质量验收的官方边缘裁剪差异仍在，保持 `0.1.0-alpha.0`；未执行远程发布，也不扩展为手机推理兼容证据。
