# 原图尺寸参考独立审查

审查日期：2026-09-18。分层：单 SDK 数值验证。审查范围为设计文档的原图尺寸契约及执行范围第 1 项；不修改产品、冻结证据，不执行提交或远程操作。

## 结论

规格符合，当前归档的数值验收通过。未发现需要否定此次结果的阻塞问题。SDK 的 256 次推理来自历史四模式各 64 图归档，本次参考任务和本次审查均未新增 SDK/浏览器推理；不能表述为本轮重跑四模式。新的 Paddle 64 图执行来自 reference-execution.json 和 verification.json 的已有记录，本审查没有再次执行 Paddle。

参考脚本独立运行固定 Paddle 模型，SDK mask 未参与参考生成。实际 crop-only.patch 只把 CPU 最终裁剪及空输出的 4 处 int(ori_h/w) 替换成输入整数尺寸；NMS、原型、sigmoid、插值和二值化保持原计算。空输出分支的尺寸修改合理；NPU 未修改、未验证。

## 独立只读验证

使用相邻 Detection venv 的 Python，带 -B 禁止生成缓存；从 stdin 执行只读审查程序，不运行会写回报告的 compare_original_size.py/run()。

- 新旧 evidence-integrity.json 中所有文件的字节数与 SHA256 全部通过；verification.json 中三个脚本摘要通过。旧严格失败档案仍完整。
- 当前全部锁定 SDK 源码、当前 dist、历史冻结 dist 与浏览器档案的摘要通过；本地 ONNX SHA 与 browser-execution.json 模型身份一致；原始与新 Paddle 权重 SHA 一致；64 个输入 tensor 摘要全部通过。
- 独立解码并比较全部 64 图、6400 实例：旧新 classId、score、box 精确相等；新 mask 均为完整整数原图；共同区域逐像素差异为 0。执行摘要另记录原始 Paddle 重跑与旧档 6400 实例 mask/score/box 精确一致。
- 独立复算四模式完整原图匹配：每模式 423 个 score>0.5 匹配，双方未匹配均为空，最小 IoU 均为 0.9987084870848708。
- 独立复算新参考及四模式共五组 COCO AP，与归档浮点数精确相同。WASM 两模式 AP 下降 0.07768926117917574 个百分点；WebGPU 两模式下降 0.07768469154607605 个百分点，均小于 0.5。
- 无写回执行 tests/original_size_regression.py：4 项通过，覆盖缺图、重复 ID、双方未匹配及四条边差异。

## 代码质量与可行动改进

1. 非阻塞，复算身份核验应集中到入口：compare_original_size.py 会核验旧归档、SDK 源码与 dist，但没有显式比较新旧 Paddle weightsSha256，也没有将历史 browser.model.sha256 与指定模型身份交叉断言；原始参考脚本只在执行末尾记录当前权重摘要。本次已独立确认实际一致，因此不影响当前数值结论。建议添加固定模型/权重身份断言，并将其写入 reuse-integrity.json，避免未来替换权重后只能依赖结果相等间接发现错误。
2. 非阻塞，提供真正只读复算模式：目前 README 的“复算”会覆盖 acceptance.json、README.md、逐实例与 reuse 摘要，使已冻结 evidence-integrity.json 失效。建议新增 --check-only 或要求 --out 指向新目录，并把冻结目录作为显式禁止覆盖目标；不要为了此改进重写当前冻结报告。本次通过加载函数自行只读复算规避了覆盖。
3. 非阻塞，审计脚本普遍使用 assert 承担完整性门槛，python -O 会关闭它们。建议入口拒绝优化模式，或逐步使用显式校验异常；当前记录命令未使用 -O，实际门槛有效。

本审查仅支持固定 64 张 COCO、已有 Windows 桌面 WASM/WebGPU 档案与原图尺寸参考结论，不扩展到完整 COCO、移动端、NPU 或正式发布来源。
