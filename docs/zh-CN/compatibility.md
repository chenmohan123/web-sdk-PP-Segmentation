# 兼容性

[English](../en/compatibility.md) · [返回 README](../../README.md)

`0.1.0-alpha.0` 可在已验证的本地桌面环境运行，但稳定质量验收尚未通过。能力探测、运行成功和质量合格是不同结论。

## 2026-09-18 验证环境

| 项目 | 实测环境 |
|---|---|
| 操作系统 | Windows 11 专业版，10.0.26200 / Build 26200 |
| 浏览器 | Chromium 153.0.8010.12 |
| CPU | Intel Core i5-10400F @ 2.90 GHz，6 核 / 12 线程 |
| GPU | NVIDIA GeForce RTX 5060 Ti |
| GPU 驱动 | 32.0.16.1692 |
| Runtime | onnxruntime-web 1.27.0；WASM 单线程 |
| 模型 | PP-YOLOE_seg_s 640 FP32，ONNX opset 17 |
| 日期及证据 | 2026-09-18；[host.json](../../reports/2026-09-18-image-sdk/host.json)、[验收报告](../../reports/2026-09-18-image-sdk/README.md) |

| 后端 | 执行模式 | 本轮范围与结论 |
|---|---|---|
| WASM | main | 固定 64 图公共 SDK 已执行；质量门槛未全部通过 |
| WASM | worker | 固定 64 图公共 SDK 已执行；质量门槛未全部通过 |
| WebGPU | main | 固定 64 图公共 SDK 已执行；质量门槛未全部通过 |
| WebGPU | worker | 固定 64 图公共 SDK 已执行；质量门槛未全部通过 |

四种组合使用同一批带 segmentation GT 的 COCO val2017 图片，经公共 `run({ image: RGBA })` 调用。AP 评测参数为 `scoreThreshold=0.01/nmsThreshold=0.7/maxDetections=100`；逐实例一致性检查使用 `score>0.5`。AP 下降须 ≤0.5 个百分点，匹配实例 mask IoU 须 ≥0.99。具体数值、未匹配实例及 main/worker 一致性以报告为准。Blob、空白图、取消恢复和重复释放等实际记录见 [browser-execution.json](../../reports/2026-09-18-image-sdk/browser-execution.json)；Demo 四组合、中英切换、选择稳定、390px、取消/换图与缓存等已通过 [UI 冒烟](../../reports/2026-09-18-image-sdk/ui/summary.json)。

## 已知质量差异

COCO 图片 `204871` 的一个 `car` 实例在严格 mask IoU 门槛下失败：官方路径将 612×612 原图掩码截为 611×611，差异的 58 个像素位于被裁掉的末行/末列；共同 611×611 区域的 IoU 为 1。SDK 保留完整原图前景，没有为通过验收裁掉边缘，也没有降低 0.99 门槛。因此原始严格验收仍为失败，不能标为稳定质量通过。诊断及原始口径见 [edge-diagnosis.json](../../reports/2026-09-18-image-sdk/edge-diagnosis.json) 和[验收报告](../../reports/2026-09-18-image-sdk/README.md)。

## 使用前提与未验证范围

WebGPU 需要安全上下文、浏览器 WebGPU 实现及当前执行环境内真实可用的适配器。`navigator.gpu` 存在不保证会话可建立；Worker 的 GPU 能力也需独立验证。显式请求不可用后端会报错，不自动换成 WASM。当前 WebGPU 的预处理与掩码后处理仍是 CPU 代码，不承诺逐算子全 GPU。

WASM 模式同样需要 WebAssembly、Web Crypto SHA-256 及可正常加载的 ORT 文件；Worker 模式需要模块 Worker。生产使用 HTTPS，本地测试使用 localhost/127.0.0.1 安全上下文。

本轮未验证手机、Safari、Firefox、微信或其他 WebView、NPU，以及其他系统/浏览器/GPU 驱动组合。视频、摄像头与跟踪不是当前 SDK 的输入能力。390px 响应式 UI 测试只说明布局，不构成手机推理兼容证据。64 图子集不能代表完整 COCO 精度，也不能据此宣称普遍设备性能。

新增兼容性声明前，应记录日期、系统、浏览器、设备、驱动、runtime、后端/执行模式、模型摘要、输入和实际结果；模板与发布门槛见[发布检查清单](../release-checklist.md)。

