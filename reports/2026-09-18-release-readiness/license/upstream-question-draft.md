# 上游许可澄清问题草稿（尚未发送）

建议目标：PaddlePaddle/PaddleDetection 的 Issue 或 Discussion。此文件仅为本地草稿；发送需用户明确授权。

标题：请确认 PP-YOLOE_seg 权重再分发许可及 PaddleYOLO 来源归因

各位维护者好，我们正在把 PP-YOLOE_seg_s 转换为 ONNX，在浏览器中通过 ONNX Runtime Web 运行，希望确认以下发布事项。

模型来源：

- 固定 PaddleDetection 提交：`b25522a0f4bde8c80603f3ba5e3472059972e3b5`。
- 配置：`configs/ppyoloe_seg/ppyoloe_seg_s_80e_coco.yml`。
- 官方权重：`https://paddledet.bj.bcebos.com/models/ppyoloe_seg_s_80e_coco.pdparams`。
- 原权重 SHA-256：`ee507d8f9e5fad6290ee54ee6704b9b1f2ab26a109cc668e1a966f90fe174cef`。
- 用途：保留训练权重，导出 FP32 ONNX，在项目自己的 ModelScope/Hugging Face 仓库提供下载；模型与 SDK 分开分发，并保留来源、许可证及转换说明。

希望确认：

1. 上述 `.pdparams` 权重是否按 Apache-2.0 发布？是否允许第三方重新托管原权重或转换后的 ONNX，并用于商业项目？若适用其他条款，能否提供对应文本或链接？
2. [PR #9117](https://github.com/PaddlePaddle/PaddleDetection/pull/9117) 说明 `ppyoloe_seg` 从 PaddleYOLO 复制。我们看到复制前 PaddleYOLO 修订 `8e4ec69c631e33bae7d331c228cf707e0622ac60` 的根 LICENSE 为 GPL-3.0，而 `ppyoloe_ins_head.py` 和 `yolov8_head.py` 文件头为 Apache-2.0。对于 PaddleDetection 中的相关实现，应如何记录适用许可证和第三方归因？
3. 分割头中的 `YOLOv8 mask Proto module` 注释是否对应某个需要保留归因的具体来源版本？发布转换模型时，除了 PaddleDetection 的 LICENSE、版权声明、来源链接和修改说明，还需附带哪些 NOTICE？

我们没有据此认定权重或模型转换物受 GPL/AGPL 约束，只希望让发布元数据准确。若项目已有统一权重许可说明，提供链接即可。感谢。
