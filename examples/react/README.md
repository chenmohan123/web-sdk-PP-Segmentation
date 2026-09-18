# React 完整参考示例

对应 `web-sdk-pp-segmentation@0.1.0` 发布候选。完整实现直接复用 [demo/src/App.tsx](../../demo/src/App.tsx) 和 [demo/src/main.tsx](../../demo/src/main.tsx)，构建配置为 [demo/vite.config.ts](../../demo/vite.config.ts)；不再复制第二份界面或推理代码。React 仅管理界面，推理调用框架无关的公共 SDK。

在仓库根目录准备匹配 [models/model.json](../../models/model.json) 的 `.tmp/model.onnx`，然后执行：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

打开 [http://127.0.0.1:4188/](http://127.0.0.1:4188/)。中文为默认语言，界面可切英文；默认 WebGPU/Worker，可明确选择 WASM 与 main。示例包括选图、原图/掩码叠加、实例选择、状态与稳定错误码、加载进度、取消、重置、缓存信息与清理、模型信息及九项耗时。

每次图片运行都创建、加载并释放 SDK 实例；换图/取消需丢弃过时结果，组件卸载也释放资源。再次运行命中模型缓存仍需创建会话，不是基准中的热会话复用。选中实例使用固定工具栏，避免工作区跳动。

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false typecheck:demo
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build:demo
```

生产产物位于 `demo-dist/`，携带 SDK/ORT 静态资源但不携带 ONNX；模型来源读取 `models/model.json`，来源尚未发布时会禁用推理并说明原因。不要把开发服务器模型覆盖当作生产来源。Vite 是这里的构建工具，`examples/react` 也作为 Vite 集成说明入口，无需复制为另一套示例。

2026-09-18 的中英、四组合、实例选择、390px、取消恢复、缓存和生产来源检查见 [ui/summary.json](../../reports/2026-09-18-image-sdk/ui/summary.json)；原图整数尺寸质量验收已通过。响应式布局通过不等于手机推理验证。[中文快速开始](../../docs/zh-CN/quick-start.md) · [English quick start](../../docs/en/quick-start.md)。
