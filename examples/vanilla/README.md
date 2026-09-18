# Vanilla TypeScript 示例

对应 `web-sdk-pp-segmentation@0.1.0`。可运行入口为 [index.html](index.html) 与 [main.ts](main.ts)，通过构建后的公共 SDK 实现选图、WASM/Worker 分割、ROI 叠加、错误反馈和资源释放，不依赖 React。

在仓库根目录准备匹配 [models/model.json](../../models/model.json) 的 `.tmp/model.onnx`，再运行：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev:vanilla
```

打开 [http://127.0.0.1:4189/](http://127.0.0.1:4189/)，选取本地图片并开始分割。每次操作使用新实例，完成后 `dispose()`，不复用热会话。绘制使用 `mask.x/y` 与 mask 自身尺寸，不再次按检测框裁剪。图片不上传，首次运行需读取本地模型并建会话。

模型与 SDK 由开发服务器提供：`/local-model/model.onnx` 显式映射到忽略目录，`/sdk/` 提供完整构建文件。前者不是正式模型分发地址；生产来源读取 `models/model.json`，生产构建不携带 ONNX。该示例是浏览器 DOM/TypeScript 接入基线，不能据此宣称微信/WebView 或移动设备已验证。

2026-09-18 的实际运行证据见 [ui/summary.json](../../reports/2026-09-18-image-sdk/ui/summary.json)；原图整数尺寸质量验收已通过，见[兼容性](../../docs/zh-CN/compatibility.md)。更完整的选项、取消、缓存与后端切换交互见 [React 参考](../react/README.md)。[中文快速开始](../../docs/zh-CN/quick-start.md) · [English quick start](../../docs/en/quick-start.md)。
