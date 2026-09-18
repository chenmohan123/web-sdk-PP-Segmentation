# 固定上游许可上下文摘录

以下摘录来自 PaddleDetection `b25522a0f4bde8c80603f3ba5e3472059972e3b5`；完整文件的 URL、字节数与 SHA-256 见 `sources.lock.json`。

## 总 README

`README_cn.md` 顶部徽章：

```html
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202-dfd.svg"></a>
```

许可证章节：

```text
## 📝许可证书

本项目的发布受[Apache 2.0 license](LICENSE)许可认证。
```

英文等价章节：

```text
## License

PaddlePaddle is provided under the [Apache 2.0 license](LICENSE)
```

## 模型表与配置

`configs/ppyoloe_seg/README.md` 的目标行直接链接：

```text
PP-YOLOE_seg_s | 640 | 80e | box AP 42.3 | mask AP 32.5 | Params 8.99 | https://paddledet.bj.bcebos.com/models/ppyoloe_seg_s_80e_coco.pdparams
```

`configs/ppyoloe_seg/ppyoloe_seg_s_80e_coco.yml`：

```yaml
weights: output/ppyoloe_seg_s_80e_coco/model_final
pretrain_weights: https://bj.bcebos.com/v1/paddledet/models/pretrained/ppyoloe_crn_s_obj365_pretrained.pdparams
```

本轮未找到针对目标权重的不同许可证、非商业限制、再分发例外，也未找到单独点名该权重文件的许可证文本。
