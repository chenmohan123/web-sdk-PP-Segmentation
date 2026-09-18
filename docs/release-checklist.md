# 发布检查清单

依据门户标准 v1 的 `templates/release-checklist.md`。当前范围为 `0.1.0` 首版发布候选，日期 2026-09-18；质量与本地实现已通过，本清单不是已发布声明。源码/运行证据与正式发布证据分别保留。

## 本地实现与验收

- [x] 中文 README 为默认入口，完整英文 README 与六组指南互链；发布说明也有英文对应。
- [x] README 清楚标出包名/版本、本地运行、发布后 npm 安装步骤及 GitHub/npm/Demo 的候选状态。
- [x] `CHANGELOG.md` 含 0.1.0 发布候选条目。
- [x] 模型有固定身份、大小、SHA-256 与上游源码 revision；正式来源从 [models/model.json](../models/model.json) 的 `defaultSource`/`sources` 读取，不在文档复制 Hub revision。
- [x] 兼容性记录浏览器、OS、设备、驱动、后端、runtime 与日期；见[兼容性](zh-CN/compatibility.md)和 [host.json](../reports/2026-09-18-image-sdk/host.json)。
- [x] 固定 64 图公共 SDK 四组合已执行并归档；本次核验 256 次 SDK 推理旧档的源码、冻结文件与当前构建摘要，没有重跑。
- [x] React/Vanilla 与生产来源边界真实浏览器冒烟通过；见 [ui/summary.json](../reports/2026-09-18-release-readiness/ui/summary.json)。
- [x] 2026-09-18 完整 `pnpm verify` 退出0：50单测、两项类型检查、两构建、npm包清单检查通过。见[结构化记录](../reports/2026-09-18-release-readiness/local-verification.json)与[完整日志](../reports/2026-09-18-release-readiness/local-verification.txt)。
- [ ] CI 覆盖测试、类型、构建与模型/摘要校验，且在远程实际运行；本地 workflow 文件不能证明远程 CI 生效。
- [x] 2026-09-18 修改[前](../reports/2026-09-18-release-readiness/standard-before.json)与[后](../reports/2026-09-18-release-readiness/standard-after.json)的标准检查已附；最终 required 失败0，远程 required 跳过4。Vite复用React完整Demo的静态发现限制 `EXAMPLE-003` 保留为推荐项失败，可运行示例已有浏览器证据。
- [x] 原图整数尺寸独立参考的严格模型质量通过：四模式各匹配 423 个 `score>0.5` 实例，未匹配 0，最小 mask IoU 0.9987084870848708；WASM/WebGPU AP 下降为 0.07768926117917574/0.07768469154607605 个百分点。见[验收报告](../reports/2026-09-18-original-size/README.md)。旧官方截断口径失败档案保留。
- [x] Demo 信息区完整验证矩阵验收；见[Demo 清单](demo-checklist.md)和`ui/summary.json`的`verificationMatrix=true`。

从 SDK 根目录执行最终本地验证：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test:browser
```

从相邻门户 `chenmohan123.github.io` 根目录执行标准检查：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false sdk:check -- --repo ../web-sdk-PP-Segmentation --format table
```

标准检查仅证明本地静态声明与证据路径，不代替模型推理、浏览器或远程配置验收。

## 正式发布门槛

- [x] 权重许可采用与归因决定完成：基于固定 PaddleDetection Apache-2.0 项目声明和官方模型表，对官方权重及 ONNX 转换物采用 Apache-2.0；解释边界见[许可决定](../reports/2026-09-18-release-readiness/license/README.md)与 [NOTICE](../NOTICE)。
- [x] Demo 不附带公开示例图片；COCO 只用于本地验收，不制造素材审核阻塞。
- [x] ModelScope/Hugging Face 两源均固定不可变 revision、完整 HTTP(S) URL、字节数、SHA-256，并完成完整下载回读；默认 ModelScope，显式来源失败不换源。
- [x] 创建正式 GitHub 仓库并核验 About description、Homepage/Demo URL、topics。
- [x] 默认分支 active Ruleset 要求 PR、当前 CI checks、已解决会话，并禁止删除/force push。
- [x] 发布 tag active Ruleset 防止已发布标签更新/删除；bypass actor 为空或记录最小权限理由。
- [ ] npm 包正式发布且名称/版本可回读，安装包不含模型、原始输出、评估数据或本地测试图片。
- [ ] GitHub Release 使用现存不可变 tag，说明模型来源、许可、默认资产、后端与已知限制。
- [ ] 正式仓库、npm、在线 Demo 的 README 链接全部可用。
- [ ] HTTPS Demo 从受保护源码通过可复现流程部署，保留关联 commit 的部署记录；正式来源可下载且生产产物不含 ONNX。
- [x] GitHub Pages Source 为 GitHub Actions，使用 `github-pages` environment、限定 Pages 权限、HTTPS 与并发控制。
- [ ] 远程 API 治理证据记录仓库、Ruleset/environment 标识、观察值、验证时间及修复建议，不含凭据。
- [ ] 适用远程 required 规则全部核验后，才将 `locally-compliant` 提升为 `compliant`。

远程项由主发布流程完成并回填证据；真实完成前不得写成已上线。
