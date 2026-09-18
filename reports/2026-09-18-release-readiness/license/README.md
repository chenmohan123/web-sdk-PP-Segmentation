# PP-YOLOE_seg_s 640 FP32 权重许可与第三方归因核验

核验日期：2026-09-18（Asia/Shanghai）。范围：`PP-YOLOE_seg_s 640 FP32` 官方权重、ONNX 转换物及直接相关来源。此次只形成许可采用依据，未上传或发布资产。

## 采用结论

固定 PaddleDetection 仓库以 Apache-2.0 发布：总 README 顶部展示 Apache 2.0 徽章，并明确写明“本项目的发布受 Apache 2.0 license 许可认证”；同一固定仓库的 PP-YOLOE-Seg 模型表直接提供 S 权重，相关配置与源文件也在该发布范围内。未找到针对该权重另行适用的许可证、限制或例外条款。

基于这些正向证据，并与已发布 Detection 模型采用的“固定 PaddleDetection Apache-2.0 仓库 + 官方权重表 + 转换归因”口径一致，**本报告支持项目将 Apache-2.0 作为该官方权重及其 ONNX 转换物的许可标识并进行再分发**。模型卡应随附固定上游 LICENSE、官方权重 URL 与摘要、转换说明和第三方归因，不把 ModelScope／Hugging Face 说成授权方，也不声称是 Paddle 官方 Hub 发布。

这是基于固定仓库公开发布上下文作出的可追溯采用决定，不是发现了单独的权重许可证。若项目要求许可证逐字点名权重文件，现有材料不能满足该更窄标准；向上游询问可以补强证据，但不预设为发布硬门槛。不含权重且没有复制相关上游 Python 代码的 SDK 源码按本项目 Apache-2.0 和依赖归因独立评估。

## 正向依据

1. 固定上游 `b25522a0f4bde8c80603f3ba5e3472059972e3b5` 的根 `LICENSE` 是 Apache-2.0，SHA-256 为 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`。
2. 固定 `README_cn.md` 的许可证章节明确写“本项目的发布受 Apache 2.0 license 许可认证”；SHA-256 为 `8381d2ecb2dd88a8edb633a37a3517e8296e1fffd95c5089f7966a38e075abda`。英文 README 有等价章节。
3. `configs/ppyoloe_seg/README.md` 直接把目标 `.pdparams` 列为 S 模型下载项；SHA-256 为 `293c1d7d6464eb05c396b38908af43593c46cbd644c80522c4f40898033323d2`。
4. `ppyoloe_seg_s_80e_coco.yml` 固定训练输出名与 Object365 预训练权重 URL；SHA-256 为 `eccde862c3d47aa4c8affb5fdf63a38a62498fda8d7354219fd8d0d49de64ba3`。这证明该权重属于官方发布链，但不单独决定许可证。
5. 官方权重 HEAD 为 200，大小 36,122,452 字节，Last-Modified 为 2024-05-29，ETag 为 `"-7143702661c4b49c011b30467ce76946"`；已下载对象 SHA-256 为 `ee507d8f9e5fad6290ee54ee6704b9b1f2ab26a109cc668e1a966f90fe174cef`。
6. 固定 `ppyoloe_ins_head.py` 文件头声明 PaddlePaddle Authors 与 Apache-2.0；SHA-256 为 `cf0287f8a946d54e7bcb16808c7f3e9dafe5f365105f715525e3d5a8521d44b9`。
7. 对固定总 README、PP-YOLOE-Seg README、配置和相关文件的检索没有发现该权重适用不同许可证、非商业限制或再分发例外。

## 来源追溯边界

PaddleDetection PR [#9117](https://github.com/PaddlePaddle/PaddleDetection/pull/9117) 标题为 `copy ppyoloe_seg from paddleyolo`；合并提交 [`1e209331...`](https://github.com/PaddlePaddle/PaddleDetection/commit/1e209331d8a70380897a288b4b4824787b12b0a6) 的消息为 `copy ppyoloe_seg from ppyolo (#9117)`。这证明来源项目，但没有给出所复制 PaddleYOLO 的精确 revision。

合并前可定位的 PaddleYOLO 快照 `8e4ec69c...` 是实例分割引入提交 `d98d525b...` 的后代。该快照根 LICENSE 为 GPL-3.0，相关 Python 文件头则为 Apache-2.0。混合许可仓库中根许可与组件许可并存不构成冲突，也不能据此推导权重、ONNX 或本项目 TypeScript 代码适用 GPL。

`MaskProto` 注释和结构引用 YOLOv8 Proto 概念，但没有固定 Ultralytics URL、版本或提交。架构或算法相似不能确定受保护表达来源，最终许可采用依据不依赖 Ultralytics 版本旁证，也不添加未经证实的 GPL／AGPL 声明。

PaddleYOLO `d98d525b...` 的消息是 `merge ins_seg branch`；GitHub commit-associated-pulls 接口返回空数组，公开搜索也未找到可固定的原始发布 PR。因此只引用不可变提交，不臆造 PR 许可说明。

## 发布时应保留

- 模型卡标识 `Apache-2.0`，说明依据是固定仓库的项目发布声明与官方模型表，并随附上游 LICENSE。
- 固定原始权重 URL、大小、SHA-256；记录 ONNX 36,265,193 字节、SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`、opset 17 和转换步骤。
- 明确 Hub 镜像由本项目维护；保留 PaddleDetection、PaddlePaddle Authors、转换工具及 ORT MIT 归因。
- COCO 图片和标签若被分发，按各自许可单独处理。
- 只有上传并回读固定 Hub revision、路径、字节数和 SHA-256 后，才填写 `models/model.json.sources` 并宣称远程模型可用。

结构化证据见 [sources.lock.json](sources.lock.json)，关键原文见 [upstream-context.md](upstream-context.md)。大型原文保存在 `.tmp/release-readiness/license/`，正式报告通过不可变 URL、revision、字节数与 SHA-256 支持重取。**本轮未找到单独点名该权重的许可证文本；这限定了 Apache-2.0 采用依据的解释范围，但不是存在禁止再分发条款的证据。**
