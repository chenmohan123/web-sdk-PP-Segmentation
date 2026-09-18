# 图片 SDK 全分支最终独立审查

审查日期：2026-09-18。分类：单 SDK/runtime 与当前模型 Demo。范围为设计提交 `33e472c` 至本轮工作区，依据 `.tmp/final-review.diff`、图片版设计/计划、门户标准 v1 及最终工作区文件；本地 HEAD 为 `1751d48b2b7e52ad71fa775e4fa038994eeea70d`。另纳入 Demo P2 修复报告和主流程刚生成的最终工程记录。

本审查只读源码、产物、文档和证据，仅写本报告；未修改产品或验收结果，未派生任务，未重跑模型、核心测试或浏览器测试。

## 两项结论

| 项目 | 结论 |
|---|---|
| 规格 | 本地 `0.1.0-alpha.0` 实现及能力披露符合本轮范围。未发现需要阻止本地交付的新规格缺陷。原设计中的严格模型质量门槛仍未通过，已按要求保留失败并披露，不能将本结论解释为全部验收通过。 |
| 质量 | 工程代码和本轮修复审查通过，未发现新增 P0/P1/P2 问题；严格模型质量继续为 **failed**。可以交付带明确限制的本地 alpha，不能宣称稳定质量通过或已正式发布。 |

## 跨层一致性

- 公共类型、runtime、Demo/Vanilla 和中英文 API 文档一致：Blob/RGBA、16,777,216 像素、64 MiB 总返回掩码、默认100/上限300实例、严格分数阈值、逐类 NMS、独立紧致前景 ROI、main/Worker、显式后端无自动回退、取消与释放边界均有实现和说明。绘制使用 `mask.x/y`，未再次裁到检测框。
- `package.json`、`models/model.json`、开发 manifest、README 与报告的版本、模型身份、36,265,193 字节、SHA-256、ORT 1.27.0 和环境信息一致。`sdk-manifest.yaml` 的 custom/localhost 仅作为明确标注的开发资源；`models/model.json` 的正式默认来源为 ModelScope，sources 为空，没有虚构正式来源。
- Demo 仅消费构建后的公共 SDK；runtime 无 React 依赖。构建复制完整同版本 Worker/ORT 静态资源，npm 文件白名单排除模型及开发数据。生产构建禁用推理且无模型请求，有源码和 UI 证据对应。
- README、七组中英指南、发布清单与 Demo 中的 alpha、未发布来源、当前桌面范围、主线程不能抢占同步计算、冷/缓存/热会话区别均一致。未将390px布局测试扩展为手机推理兼容，也未将GPU模型耗时换算为产品FPS。

## Demo P2 复审

修复通过。`demo/src/App.tsx:186` 的解码回调使用独立输入代次及清理标记；`:192` 在设置有效预览前检查天然尺寸及像素上限；`:262`、`:272` 在换图时立即清零旧画布并清除旧结果；`:279`、`:493` 的运行路径和按钮均要求有效预览。预览解码和结果绘制已分离，选择实例、切换掩码和语言不重新解码。

`tests/browser.mjs:28` 的回归实际构造损坏PNG与4097×4096 PNG；每次先获得真实分割结果，再验证旧像素/结果清空、稳定错误码、中英提示、运行禁用和产品画布未超限分配，最后验证恢复推理。最终 `ui/summary.json:2` 时间为 `2026-09-18T04:29:29.983Z`，四组合均成功，invalidPreview/oversizedPreview/previewRecovery/verificationMatrix 均为 true，pageErrors 为空。独立查看了信息展开、损坏预览和390px截图，与摘要一致。

## 证据及工程验证

- 本审查重新只读计算 `evidence-integrity.json` 所列18个归档的字节数及SHA-256，全部一致；`dataset.lock.json` 的12个 SDK 源码摘要全部一致。
- `dist`、`demo/public/sdk`、`demo-dist/sdk` 三处入口和 Worker 摘要均与64图验收相同：SDK `bec08d2754a4b278f89faea15ca64f785aac5cb5f0f76503ca7004cab7a4f8e3`；Worker `672886c08f66995832cc780b2496104e30501bd4cd4ebaae9b9368e2aa9de885`。
- 已读取 `local-verification.json` 和完整 `.txt` 日志：最终 verify 退出0，42/42单测、SDK与Demo/Vanilla类型检查、SDK/Demo构建、24文件npm清单均通过。记录内5项文件摘要也逐项核对一致。
- 修改前标准检查为18项required失败；最终 `standard-after.json` 为18项通过、0失败、4项远程跳过，结论为 locally-compliant。保留的 EXAMPLE-003 推荐项与发现器仅按 examples/vite 或 examples/vanilla-vite 识别 Vite 有关，manifest明确复用 examples/react，真实Vite/React与Vanilla执行证据存在；此项不构成本次新增运行缺陷。

## 必须保留的质量边界

`reports/2026-09-18-image-sdk/acceptance.json:2` 状态为 failed；`:11` 保持0.99门槛，`:71` 的423个高分匹配中有1项失败，`:72` 的最小IoU为0.9788243884629427。四组合均是图204871的car实例。AP下降约0.07769个百分点符合≤0.5门槛，但不能覆盖逐实例门槛失败。

`edge-diagnosis.json:5` 开始的诊断记录显示官方611×611输出与612×612原图相比缺失58个边缘前景像素，共同区域差异为0。比较脚本保留官方原始RLE、仅左上回填原图并在缺失边缘填0；共同区域IoU=1仅用于诊断，没有替换正式标准。`README.md:77`、双语兼容性/发布说明、报告及检查清单均诚实保留这一边界。

后续正式发布仍须解决严格质量兼容口径，并完成已列明的权重许可、双Hub不可变来源及完整回读、远程治理、npm和HTTPS部署。本轮未发布本身不作为本地实现缺陷。

归档补记：被审查的实现已保存为本地提交 `97d6207`。之后仅规整文档末尾空行、补写执行状态及归档记录，SDK源码和产物摘要未变。完整性索引后续增加工程记录文件，审查所述18个文件是原始验收集合。
