# PP-Segmentation

[English](README.en.md)

浏览器端 PP-YOLOE_seg_s 实例分割 SDK。输入一张 `Blob` 或 RGBA 图片，输出对象类别、分数、原图边界框和紧致二值实例掩码；图片在浏览器本地处理，runtime 不依赖 React。

> `web-sdk-pp-segmentation@0.1.0` 首版质量验收已通过，独立 GitHub 仓库、ModelScope/Hugging Face 权重与 HTTPS Demo 已上线并完成回读。npm 首次发布仍待账号验证；完成前使用下面的本地构建流程。

## 当前范围

- 单帧图片；PP-YOLOE_seg_s 640 FP32、COCO 80 类、ONNX opset 17，模型 36,265,193 字节、8,995,698 参数。
- WASM/CPU 与 WebGPU/GPU，`main` 或 `worker`。API 默认 `wasm/worker`；React Demo 默认 `webgpu/worker`。显式后端失败不会静默回退。
- 每个实例保留独立、可重叠的 ROI 二值 `Uint8Array`。ROI 包含二次插值后的全部前景，可能超出检测框；绘制以 `mask.x/y` 为准。列表序号不是跟踪 ID。
- 正式模型来源为 ModelScope/Hugging Face，默认来源及固定下载 URL 以 [models/model.json](models/model.json) 的 `defaultSource` 与 `sources` 为准；文档不复制可能过期的 revision。
- 本轮不包含视频、摄像头、NPU、门户组合或移动端兼容承诺。

## 本地运行

需要 Node.js ≥22.12.0、pnpm、此工作区源码及本地模型 `.tmp/model.onnx`。模型身份、大小、摘要和已发布的固定来源见 [models/model.json](models/model.json)；按 `defaultSource` 从 `sources` 读取 `downloadUrl`，下载后核对 `bytes` 与 `sha256`。仓库和 npm 构建产物不携带模型。

在仓库根目录执行：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

打开 [React Demo](http://127.0.0.1:4188/)，选择本地图片后开始分割。[Vanilla TypeScript 示例](examples/vanilla/README.md) 使用 `pnpm dev:vanilla`，地址为 [127.0.0.1:4189](http://127.0.0.1:4189/)。[React 示例说明](examples/react/README.md) 直接指向完整参考 Demo。

下面的浏览器模块示例使用上述开发服务提供的 `/sdk/` 和 `/local-model/`。HTML 放置 `<input id="image" type="file" accept="image/*">`；事件中的 `file` 来自用户选择，未选择时不运行：

```js
import { createSegmentation } from "/sdk/index.js";

document.querySelector("#image").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const sdk = createSegmentation({
    model: {
      id: "ppyoloe-seg-s-640-fp32",
      version: "0.1.0",
      url: new URL("/local-model/model.onnx", location.origin).href,
      bytes: 36265193,
      sha256:
        "d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334",
    },
    backend: "wasm",
    executionMode: "worker",
    runtimeBaseUrl: new URL("/sdk/", location.origin).href,
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

接入其他应用时将整个 `dist/` 部署到同源 `/sdk/`，包括 Worker 和同版本 ORT 文件；`runtimeBaseUrl` 使用以 `/` 结尾的完整 URL。正式发布后可执行 `pnpm add web-sdk-pp-segmentation@0.1.0`；npm 账号验证完成前使用本地打包文件。详见[快速开始](docs/zh-CN/quick-start.md)。

## 文档与证据

| 中文                                           | English                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| [快速开始](docs/zh-CN/quick-start.md)          | [Quick start](docs/en/quick-start.md)                   |
| [API](docs/zh-CN/api.md)                       | [API](docs/en/api.md)                                   |
| [兼容性](docs/zh-CN/compatibility.md)          | [Compatibility](docs/en/compatibility.md)               |
| [排障](docs/zh-CN/troubleshooting.md)          | [Troubleshooting](docs/en/troubleshooting.md)           |
| [隐私与部署](docs/zh-CN/privacy-deployment.md) | [Privacy and deployment](docs/en/privacy-deployment.md) |
| [性能](docs/zh-CN/performance.md)              | [Performance](docs/en/performance.md)                   |
| [发布说明](docs/zh-CN/release.md)              | [Release notes](docs/en/release.md)                     |

2026-09-18 的固定 64 图公共 SDK 四组合通过原图整数尺寸独立参考验收：每种模式匹配 423 个 `score>0.5` 实例，最小 mask IoU 为 0.9987084870848708；WASM 与 WebGPU 的 mask AP 下降分别为 0.07768926117917574 和 0.07768469154607605 个百分点。此次仅修正参考实现最终裁剪及空掩码尺寸，SDK 无数值改动；256 次 SDK 推理复用已核验摘要的既有归档，并非本次重跑。见[原图尺寸验收](reports/2026-09-18-original-size/README.md)。旧官方截断口径的失败档案继续保留；64 图子集不代表完整 COCO、手机或 NPU 表现。[Demo 检查清单](docs/demo-checklist.md)与[发布检查清单](docs/release-checklist.md)区分质量通过和仍待完成的发布事项。

发布目标：[GitHub](https://github.com/chenmohan123/web-sdk-PP-Segmentation) · [npm](https://www.npmjs.com/package/web-sdk-pp-segmentation) · [在线 Demo](https://chenmohan123.github.io/web-sdk-PP-Segmentation/)。在发布检查清单完成前，这些链接不构成已上线声明。可行性阶段的上游来源与转换记录见门户[实例分割评估报告](https://github.com/chenmohan123/chenmohan123.github.io/tree/main/reports/segmentation/2026-09-18-feasibility)。

## 本地检查与许可证

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test:browser
```

浏览器检查需要本地模型、已构建资源和可用 Chromium；具体验收操作见 [scripts/evaluation/README.md](scripts/evaluation/README.md)。标准检查从相邻门户执行，见发布清单。

SDK 源码使用 Apache-2.0，见 [LICENSE](LICENSE)。基于固定 PaddleDetection Apache-2.0 项目声明、官方模型表及归因证据，项目将 Apache-2.0 用于官方权重及其 ONNX 转换物；未找到独立点名该权重的许可文本是解释边界，不是额外授权硬门槛。Hub 镜像由本项目维护，详见 [NOTICE](NOTICE) 与[许可决定](reports/2026-09-18-release-readiness/license/README.md)。评估数据不进入 npm、Git 或公开 Demo。
