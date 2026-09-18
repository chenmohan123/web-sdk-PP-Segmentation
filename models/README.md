# PP-YOLOE_seg_s FP32 模型卡

[English](README.en.md)

这是 chenmohan 维护的 PaddlePaddle/PaddleDetection 浏览器实例分割 ONNX 镜像，并非 Paddle 官方账号。来源与不可变提交以 [SDK 模型清单](https://github.com/chenmohan123/web-sdk-PP-Segmentation/blob/main/models/model.json) 为准。

| 项目 | 值 |
|---|---|
| 模型 | PP-YOLOE_seg_s 640 FP32 |
| 标识 | `ppyoloe-seg-s-640-fp32` |
| 版本 | `0.1.0` |
| 类别 | COCO 80 类实例分割 |
| 训练参数 | 8,995,698 |
| 格式 | ONNX opset 17，FP32 |
| 文件大小 | 36,265,193 字节 |
| SHA-256 | `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334` |
| 正式默认来源 | ModelScope；另提供 Hugging Face，显式选择失败不自动换源 |

## 来源与转换

- 上游固定提交：[b25522a0f4bde8c80603f3ba5e3472059972e3b5](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5)。
- 官方配置：`configs/ppyoloe_seg/ppyoloe_seg_s_80e_coco.yml`。
- 原始权重：[ppyoloe_seg_s_80e_coco.pdparams](https://paddledet.bj.bcebos.com/models/ppyoloe_seg_s_80e_coco.pdparams)，36,122,452 字节，SHA-256 `ee507d8f9e5fad6290ee54ee6704b9b1f2ab26a109cc668e1a966f90fe174cef`。
- 转换工具：PaddlePaddle 2.6.2、Paddle2ONNX 1.3.1、ONNX 1.16.2。导出固定单图原始分割头；NMS 和原图掩码恢复由 SDK 执行。保留训练权重，未重新训练或量化。
- 导出与逐文件来源记录见相邻门户 `reports/segmentation/2026-09-18-feasibility/`；转换所用补丁属于本项目修改，不把含补丁的工作目录作为未经修改的上游源码。

## 输入与输出

输入 `image` 为 Float32 `[1,3,640,640]`。SDK 将原图 RGB 用 bicubic（A=-0.75）缩放，量化到 uint8 后除以 255；透明像素先合成白底。模型不直接接收 JPEG 或浏览器 canvas。

输出四个 Float32 张量：框 `[1,8400,4]`、类别分数 `[1,80,8400]`、掩码系数 `[1,32,8400]`、原型 `[1,32,160,160]`。SDK 执行逐类 NMS 和两次双线性掩码恢复，返回原图坐标的紧致 0/1 ROI；完整画布尺寸以输入解码后的整数宽高为准。

## 验证范围

已在 2026-09-18 的 Windows/Chromium 桌面上执行 ORT Web 1.27.0 WASM/WebGPU × main/Worker。64 图原图整数尺寸独立参考验收通过：四组合各 423 个高分实例匹配，最低 mask IoU 0.998708，AP 下降最多 0.077690 个百分点。旧原始参考裁剪边缘的失败档案保留；SDK 256 次推理复用已核验历史档案。详见[兼容性说明](https://github.com/chenmohan123/web-sdk-PP-Segmentation/blob/main/docs/zh-CN/compatibility.md)。64 图子集不代表完整 COCO 精度或所有设备；未验证手机、NPU、Safari、Firefox 和 WebView。

## 许可与素材

模型采用 Apache-2.0 标识，依据是固定官方仓库的项目发布声明、官方模型表和相关文件许可；未发现单独点名权重的许可证，这属于解释边界。随附 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)；[许可追溯](https://github.com/chenmohan123/web-sdk-PP-Segmentation/blob/main/reports/2026-09-18-release-readiness/license/README.md) 记录 PaddleYOLO 来源边界，不由架构相似推导额外 GPL/AGPL 条款。镜像平台不是授权方。

评估 COCO 图片各有原始许可，不包含于模型包、npm 或生产 Demo。两个来源均采用不可变 revision、文件大小和 SHA-256 校验；下载清单以 SDK 仓库实际发布记录为准。
