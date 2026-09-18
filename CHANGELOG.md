# 更新记录

发布说明：[中文](docs/zh-CN/release.md) · [English](docs/en/release.md)。

## 0.1.0 - 2026-09-18

- 建立 PP-YOLOE_seg_s 640 FP32 图片实例分割 runtime、Worker 和 React Demo。
- 修正 Demo 为 Detection 线上版本的深色顶栏和三栏工作台，统一控件、结果列表与信息折叠；实例选择及中英切换保持画布位置。
- 增加 ROI 二值掩码、缓存、完整性校验、取消和生命周期测试。
- 固定 0.1.0 首版 API、双语指南与npm 安装流程。
- 通过原图整数尺寸独立参考的 64 图四组合质量验收，并保留旧官方截断口径档案。
- 记录 ModelScope/Hugging Face 双源清单规则、Apache-2.0 权重采用决定与上线前回读门槛。
- 运行后端为 ORT Web 1.27.0 WASM/CPU 与 WebGPU/GPU，均支持 main/Worker；API 默认 WASM/Worker，Demo 默认 WebGPU/Worker，失败不静默回退。
- 默认模型 PP-YOLOE_seg_s 640 FP32（36,265,193 字节，8,995,698 参数）来自 PaddleDetection 官方权重；双源镜像默认 ModelScope，固定来源及 SHA-256 见 [模型清单](models/model.json)，Apache-2.0 采用依据与归因见 [模型卡](models/README.md)。
- 已验证范围为 2026-09-18 Windows 11 / Chromium 153 / i5-10400F / RTX 5060 Ti 桌面，64 图仅衡量数值一致性，不代表完整 COCO 精度。手机、Safari、Firefox、WebView 与 NPU 未验证；本版不包含视频、摄像头或跟踪。
