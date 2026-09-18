# PP-Segmentation

[English](README.en.md)

浏览器端 PP-YOLOE_seg_s 实例分割 SDK。输入一张 `Blob` 或 RGBA 图片，输出对象类别、分数、原图边界框和紧致二值实例掩码；图片在浏览器本地处理，runtime 不依赖 React。

> `web-sdk-pp-segmentation@0.1.0-alpha.0` 是本地 alpha，尚未发布 npm 包、远程仓库、模型权重或在线 Demo。以下远程地址为规划地址，不能作为可用性或分发证据。

## 当前范围

- 单帧图片；PP-YOLOE_seg_s 640 FP32、COCO 80 类、ONNX opset 17，模型 36,265,193 字节、8,995,698 参数。
- WASM/CPU 与 WebGPU/GPU，`main` 或 `worker`。API 默认 `wasm/worker`；React Demo 默认 `webgpu/worker`。显式后端失败不会静默回退。
- 每个实例保留独立、可重叠的 ROI 二值 `Uint8Array`。ROI 包含二次插值后的全部前景，可能超出检测框；绘制以 `mask.x/y` 为准。列表序号不是跟踪 ID。
- 正式模型来源仅 ModelScope/Hugging Face，默认 ModelScope；当前 `models/model.json` 的 `sources` 为空，仅用显式本地开发地址验证。
- 本轮不包含视频、摄像头、NPU、门户组合或移动端兼容承诺。

## 本地运行

需要 Node.js ≥22.12.0、pnpm、此工作区源码及已经取得的本地模型 `.tmp/model.onnx`。模型身份、大小和摘要见 [models/model.json](models/model.json)；仓库和 npm 构建产物不携带模型。缺少权重时先按已有授权来源准备与该摘要一致的模型，不把尚未发布的 Hub 当作下载入口。

在仓库根目录执行：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

打开 [React Demo](http://127.0.0.1:4188/)，选择本地图片后开始分割。[Vanilla TypeScript 示例](examples/vanilla/README.md) 使用 `pnpm dev:vanilla`，地址为 [127.0.0.1:4189](http://127.0.0.1:4189/)。[React 示例说明](examples/react/README.md) 直接指向完整参考 Demo。

下面的浏览器模块示例使用上述开发服务提供的 `/sdk/` 和 `/local-model/`。HTML 放置 `<input id="image" type="file" accept="image/*">`；事件中的 `file` 来自用户选择，未选择时不运行：

```js
import { createSegmentation } from '/sdk/index.js';

document.querySelector('#image').addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const sdk = createSegmentation({
    model: {
      id: 'ppyoloe-seg-s-640-fp32',
      version: '0.1.0-alpha.0',
      url: new URL('/local-model/model.onnx', location.origin).href,
      bytes: 36265193,
      sha256: 'd418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334',
    },
    backend: 'wasm',
    executionMode: 'worker',
    runtimeBaseUrl: new URL('/sdk/', location.origin).href,
  });
  try {
    await sdk.load({ onProgress: console.log });
    const result = await sdk.run({ image: file });
    console.log(result.instances, sdk.loadTimings, result.timings);
  } catch (error) {
    console.error(error.code, error.message);
  } finally {
    await sdk.dispose();
  }
});
```

接入其他应用时将整个 `dist/` 部署到同源 `/sdk/`，包括 Worker 和同版本 ORT 文件；`runtimeBaseUrl` 使用以 `/` 结尾的完整 URL。应用也可安装本地打包文件后从包名导入。正式 npm 发布前不要使用 `pnpm add web-sdk-pp-segmentation` 作为安装步骤，详见[快速开始](docs/zh-CN/quick-start.md)。

## 文档与证据

| 中文 | English |
|---|---|
| [快速开始](docs/zh-CN/quick-start.md) | [Quick start](docs/en/quick-start.md) |
| [API](docs/zh-CN/api.md) | [API](docs/en/api.md) |
| [兼容性](docs/zh-CN/compatibility.md) | [Compatibility](docs/en/compatibility.md) |
| [排障](docs/zh-CN/troubleshooting.md) | [Troubleshooting](docs/en/troubleshooting.md) |
| [隐私与部署](docs/zh-CN/privacy-deployment.md) | [Privacy and deployment](docs/en/privacy-deployment.md) |
| [性能](docs/zh-CN/performance.md) | [Performance](docs/en/performance.md) |
| [发布说明](docs/zh-CN/release.md) | [Release notes](docs/en/release.md) |

2026-09-18 的固定 64 图公共 SDK 四组合已执行，但严格质量验收仍未通过：图片 204871 的一个 car 实例有 58 个差异像素，全部在官方 612×612→611×611 裁剪丢掉的边缘，共同区域一致。SDK 保留完整原图且不降低门槛，见[边缘诊断](reports/2026-09-18-image-sdk/edge-diagnosis.json)。完整结论、环境和逐图记录见[本地验收报告](reports/2026-09-18-image-sdk/README.md)，不代表完整 COCO 或其他设备表现。[Demo 检查清单](docs/demo-checklist.md)与[发布检查清单](docs/release-checklist.md)区分本地实现和未完成发布事项。

规划入口：[GitHub（尚未创建）](https://github.com/chenmohan123/web-sdk-PP-Segmentation) · [npm（尚未发布）](https://www.npmjs.com/package/web-sdk-pp-segmentation) · [在线 Demo（尚未部署）](https://chenmohan123.github.io/web-sdk-PP-Segmentation/)。可行性阶段的上游来源与转换记录见门户[实例分割评估报告](https://github.com/chenmohan123/chenmohan123.github.io/tree/main/reports/segmentation/2026-09-18-feasibility)。

## 本地检查与许可证

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test:browser
```

浏览器检查需要本地模型、已构建资源和可用 Chromium；具体验收操作见 [scripts/evaluation/README.md](scripts/evaluation/README.md)。标准检查从相邻门户执行，见发布清单。

SDK 源码使用 Apache-2.0，见 [LICENSE](LICENSE)。上游 PaddleDetection 源码许可不等同于模型权重再分发审查；正式上传权重前仍需核验权重许可、来源及第三方归因，见 [NOTICE](NOTICE)。评估数据和模型不进入 npm 或 Git。
