# 快速开始

[English](../en/quick-start.md) · [返回 README](../../README.md)

当前包为 `web-sdk-pp-segmentation@0.1.0-alpha.0`，仅本地可用，尚未发布 npm、Hub 权重或在线 Demo。稳定质量验收尚未通过，见[兼容性](compatibility.md)。

## 准备与启动

使用 Node.js ≥22.12.0 和 pnpm，在仓库根目录放好已经取得的 `.tmp/model.onnx`。它必须匹配 [models/model.json](../../models/model.json)：36,265,193 字节，SHA-256 为 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`。可以用 PowerShell 检查文件：

```powershell
(Get-Item -LiteralPath .tmp/model.onnx).Length
(Get-FileHash -LiteralPath .tmp/model.onnx -Algorithm SHA256).Hash
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev
```

打开 [127.0.0.1:4188](http://127.0.0.1:4188/)，选择一张本地图片。Demo 默认 WebGPU/Worker；机器无可用 GPU 时需明确切换 WASM。另一个终端可运行下列命令启动 [Vanilla 示例](http://127.0.0.1:4189/)：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false dev:vanilla
```

开发服务仅从忽略目录读取本地模型。正式 ModelScope/Hugging Face 来源尚未发布，不能凭规划地址下载；缺少模型时需先准备上述已知文件。生产 Demo 构建不包含 ONNX，未配置正式来源时不能运行推理。

## 调用公共 API

开发服务把构建后的整个 SDK 放在 `/sdk/`，把本地模型放在 `/local-model/model.onnx`。在该服务下的页面加入文件选择器：

```html
<input id="image" type="file" accept="image/*">
```

浏览器模块代码如下。不要从 `file://` 直接打开页面：

```js
import { createSegmentation } from '/sdk/index.js';

const input = document.querySelector('#image');
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  input.disabled = true;
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
    const result = await sdk.run({ image: file }, {
      scoreThreshold: 0.5,
      nmsThreshold: 0.7,
      maxDetections: 100,
    });
    console.log(result.instances, result.runtime, result.timings);
  } catch (error) {
    console.error(error.code, error.message);
  } finally {
    await sdk.dispose();
    input.disabled = false;
  }
});
```

API 默认也是 `wasm/worker`。如果希望复用模型会话，应在业务生命周期开始时创建并 `load()`，串行调用多次 `run()`，结束时再 `dispose()`。React Demo 和 Vanilla 示例每次图片运行都新建、加载并释放实例，不能把再次点击解释为复用热会话。

## 读取结果

`result.instances` 按分数递减排列。`classId` 是 COCO 80 类的连续编号；`box` 是裁到原图边界内的像素框。`mask.data` 为行优先的 0/1 字节，尺寸为 `mask.width × mask.height`，其局部像素 `(x, y)` 对应原图 `(x + mask.x, y + mask.y)`。

ROI 紧包二次插值后的全部前景，可能超出 `box`；不要再次按检测框裁剪。ROI 外视为 0，空掩码用宽高 0 和空数组表示。各实例可重叠，数组序号不表示跨帧身份。完整绘制实现见 [Vanilla main.ts](../../examples/vanilla/main.ts)。

输入 RGBA buffer 不会被 SDK 转移或修改。单图最多 16,777,216 像素，返回掩码累计最多 64 MiB；超限会报错。取消用 `AbortController.signal` 传入 `load/run`；它不承诺抢占已提交的计算内核。等待取消操作结束后可以重试，`dispose()` 后需新建实例。详见 [API](api.md)。

## 接入另一应用

先构建 SDK，再将整个 `dist/` 复制到应用同源静态目录 `/sdk/`，保留所有文件名；不要只复制 `index.js`。`runtimeBaseUrl` 应是以 `/` 结尾的完整 URL。正式模型 URL 也必须为 HTTP(S) 完整地址，并保留准确字节数和 SHA-256。

如需通过包名导入，可在 SDK 根目录生成本地安装包：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false pack --pack-destination .tmp
```

在与 SDK 并列的应用目录安装本地文件：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false add ../web-sdk-PP-Segmentation/.tmp/web-sdk-pp-segmentation-0.1.0-alpha.0.tgz
```

随后可用 `import { createSegmentation } from 'web-sdk-pp-segmentation'`；ORT/Worker 静态目录仍须部署。HTTPS、CORS、CSP 和缓存要求见[隐私与部署](privacy-deployment.md)。
