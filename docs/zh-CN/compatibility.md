# 兼容性

[English](../en/compatibility.md) · [返回 README](../../README.md)

`0.1.0`已在下列本地桌面环境通过固定 64 图四组合质量验收。能力探测、运行成功、质量合格和远程发布仍是不同结论。

## 2026-09-18 验证环境

| 项目       | 实测环境                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 操作系统   | Windows 11 专业版，10.0.26200 / Build 26200                                                                                             |
| 浏览器     | Chromium 153.0.8010.12                                                                                                                  |
| CPU        | Intel Core i5-10400F @ 2.90 GHz，6 核 / 12 线程                                                                                         |
| GPU        | NVIDIA GeForce RTX 5060 Ti                                                                                                              |
| GPU 驱动   | 32.0.16.1692                                                                                                                            |
| Runtime    | onnxruntime-web 1.27.0；WASM 单线程                                                                                                     |
| 模型       | PP-YOLOE_seg_s 640 FP32，ONNX opset 17                                                                                                  |
| 日期及证据 | 2026-09-18；[host.json](../../reports/2026-09-18-image-sdk/host.json)、[原图尺寸验收](../../reports/2026-09-18-original-size/README.md) |

| 后端   | 执行模式 | 本轮范围与结论       |
| ------ | -------- | -------------------- |
| WASM   | main     | 原图整数尺寸参考通过 |
| WASM   | worker   | 原图整数尺寸参考通过 |
| WebGPU | main     | 原图整数尺寸参考通过 |
| WebGPU | worker   | 原图整数尺寸参考通过 |

四种组合使用同一批带 segmentation GT 的 COCO val2017 图片，经公共 `run({ image: RGBA })` 调用。AP 参数为 `scoreThreshold=0.01/nmsThreshold=0.7/maxDetections=100`；一致性检查使用 `score>0.5`。每种模式匹配 423 个实例，未匹配 0，最小 mask IoU 0.9987084870848708；WASM/WebGPU 的 mask AP 下降分别为 0.07768926117917574/0.07768469154607605 个百分点，满足 AP 下降 ≤0.5、mask IoU ≥0.99 的门槛。主线程与 Worker 在各后端均匹配 6400 个实例，mask 完全一致。256 次 SDK 推理复用已核验源码、冻结文件和当前 `dist` 摘要的旧归档，本次未重新运行 SDK 推理。Blob、空白图、取消恢复和重复释放等记录见 [browser-execution.json](../../reports/2026-09-18-image-sdk/browser-execution.json)。

## 参考口径说明

输入解码得到的整数 `width/height` 是输出画布权威。独立参考只把上游最终裁剪和空掩码尺寸改为这些整数，原型、插值、NMS、阈值和 SDK 均未改动。原始官方 CPU 路径会把图片 `204871` 的 612×612 掩码截成 611×611，其失败档案仍保留在[旧验收报告](../../reports/2026-09-18-image-sdk/README.md)；新结论见[原图尺寸验收](../../reports/2026-09-18-original-size/README.md)。

## 使用前提与未验证范围

WebGPU 需要安全上下文、浏览器 WebGPU 实现及当前执行环境内真实可用的适配器。`navigator.gpu` 存在不保证会话可建立；Worker 的 GPU 能力也需独立验证。显式请求不可用后端会报错，不自动换成 WASM。当前 WebGPU 的预处理与掩码后处理仍是 CPU 代码，不承诺逐算子全 GPU。

WASM 模式同样需要 WebAssembly、Web Crypto SHA-256 及可正常加载的 ORT 文件；Worker 模式需要模块 Worker。生产使用 HTTPS，本地测试使用 localhost/127.0.0.1 安全上下文。

本轮未验证手机、Safari、Firefox、微信或其他 WebView、NPU，以及其他系统/浏览器/GPU 驱动组合。视频、摄像头与跟踪不是当前 SDK 的输入能力。390px 响应式 UI 测试只说明布局，不构成手机推理兼容证据。64 图子集不能代表完整 COCO 精度，也不能据此宣称普遍设备性能。

新增兼容性声明前，应记录日期、系统、浏览器、设备、驱动、runtime、后端/执行模式、模型摘要、输入和实际结果；模板与发布门槛见[发布检查清单](../release-checklist.md)。
