# 隐私与部署

[English](../en/privacy-deployment.md) · [返回 README](../../README.md)

SDK 在浏览器本地解码和推理图片，没有上传图片的 API，也不发送内置遥测。应用自身的上传、日志、分析脚本及托管服务另有数据流，需要由应用说明。模型下载会连接配置的模型主机，主机可看到请求 IP 等常规网络信息。

## 数据与缓存

输入像素、原图预览和结果保留在页面/Worker 内存中；SDK 持久保存的是模型字节，不把图片或掩码写入 IndexedDB。调用者应自行释放保存的结果、Object URL 和画布引用。图片太大时浏览器解码本身可能先消耗内存，像素上限不是通用内存保障。

模型缓存数据库为 `web-sdk-pp-segmentation-models-v1`，键为模型 `id/version/sha256`。版本或摘要不同就隔离，缓存与下载都校验长度和 SHA-256。缓存写入失败不阻止本次运行，浏览器也可能清理缓存；不承诺永久离线可用。

`clearCurrentModelCache(model)` 只删当前模型；`clearAllModelCache()` 只清本 SDK 模型库。“全部”不会清其他 SDK、HTTP 缓存或已加载会话。由用户主动触发清理并报告结果；`dispose()` 只释放会话/Worker，不删除持久缓存。导出及别名见 [API](api.md)。

## 静态资源部署

运行 `pnpm build` 后，把整个 `dist/` 放到与应用同源的静态目录 `/sdk/`，保留 SDK 入口、类型、Worker、ORT JavaScript/WASM 及构建生成的其他资源。不要混用不同 ORT 版本。当前 runtime 为 1.27.0，构建包含：

- `index.js` 和 `inference.worker.js`；
- `ort.webgpu.bundle.min.mjs`；
- `ort-wasm-simd-threaded.asyncify.mjs`、`ort-wasm-simd-threaded.asyncify.wasm`；
- 同目录类型与 sourcemap 等产物。

使用 `runtimeBaseUrl: new URL('/sdk/', location.origin).href`；完整目录 URL 必须以 `/` 结尾。即使应用从 npm 包导入，也仍需托管这些静态资源。发布升级时原子替换完整目录，或使用版本目录并同步入口 URL，避免浏览器拿到新 SDK 和旧 ORT 的混合文件。

为 `.js/.mjs` 返回 JavaScript MIME，为 `.wasm` 返回 `application/wasm`。不要将找不到的 Worker/WASM 路径重写成 SPA 的 HTML。静态服务应避免内容转换导致模型字节变化。

当前 WASM 设置为单线程（`numThreads=1`），文件名含 `threaded` 不表示多线程已启用。不要据此声明 SharedArrayBuffer 或跨源隔离已验证；若将来启用多线程，需要重新评估 COOP/COEP 及浏览器证据。

## HTTPS、CORS 与 CSP

生产站点使用 HTTPS。Web Crypto SHA-256 与 WebGPU 依赖安全上下文；本地使用 localhost/127.0.0.1。不要用 HTTP 公网页面或 `file://` 代替。

首选同源 SDK 资源。模型可跨源，但模型主机及其重定向目标必须返回允许应用来源的 CORS 响应；URL 最终应返回原始 ONNX，而不是登录页、下载介绍页或 Git LFS pointer。SDK 不自动换源，失败时应用应展示错误并由用户选择可用配置。跨源 Worker/ORT 还涉及模块 CORS 与可能的 Blob Worker 引导，需单独验证；同源是本版部署示例基线。

CSP 按实际应用资源设置。以下仅是同源静态应用的起点，需要结合浏览器控制台及站点脚本/样式策略验证，不能替代生产验收：

```text
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
connect-src 'self';
img-src 'self' blob: data:;
style-src 'self';
object-src 'none';
base-uri 'self';
```

把实际模型来源主机加入 `connect-src`；如跨源加载 ORT 模块，还需相应 `script-src` 和资源 CORS。内联脚本/样式需应用自己的 nonce/hash 策略，不建议直接扩大为任意来源。WASM 编译、模块 Worker、模型请求和图片预览分别受对应指令约束；排障时检查被阻止的具体 URL/指令。

## 模型来源与发布边界

`models/model.json` 是模型身份与分发来源的唯一事实源。读取 `defaultSource`，再从 `sources` 选择同名条目的固定 `downloadUrl`、`bytes` 和 `sha256`；不要在应用或文档中复制 revision。清单尚无来源时表示远程权重仍待发布，不得用规划地址代替。

本地开发用显式 `new URL('/local-model/model.onnx', location.origin).href` 覆盖，Vite 从忽略目录 `.tmp/model.onnx` 提供；它不是正式分发来源。SDK npm 产物与生产 Demo 不包含 ONNX。正式来源未配置时，生产 Demo 应保持不可运行并显示原因。

ModelScope/Hugging Face 发布必须固定不可变 revision、完整 URL、字节数及 SHA-256，并做完整下载回读。基于固定 PaddleDetection Apache-2.0 项目声明、官方权重表与归因证据，本项目对官方权重及 ONNX 转换物采用 Apache-2.0；Hub 镜像由本项目维护，见 [NOTICE](../../NOTICE) 与[许可决定](../../reports/2026-09-18-release-readiness/license/README.md)。未找到独立点名权重的许可文本是解释边界，不是额外授权硬门槛。评估图片不作为生产 Demo 素材再分发。
