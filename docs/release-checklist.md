# 发布检查清单

依据门户标准 v1 的 `templates/release-checklist.md`。当前范围为 `0.1.0` 首版，日期 2026-09-18；质量、双源、npm、GitHub Release 与 HTTPS Demo 均已发布并回读验证。源码/运行证据与正式发布证据分别保留。

## 本地实现与验收

- [x] 中文 README 为默认入口，完整英文 README 与六组指南互链；发布说明也有英文对应。
- [x] README 清楚标出包名/版本、本地运行、npm 安装步骤及 GitHub/npm/Demo 正式入口。
- [x] `CHANGELOG.md` 含 0.1.0 正式版本条目。
- [x] 模型有固定身份、大小、SHA-256 与上游源码 revision；正式来源从 [models/model.json](../models/model.json) 的 `defaultSource`/`sources` 读取，不在文档复制 Hub revision。
- [x] 兼容性记录浏览器、OS、设备、驱动、后端、runtime 与日期；见[兼容性](zh-CN/compatibility.md)和 [host.json](../reports/2026-09-18-image-sdk/host.json)。
- [x] 固定 64 图公共 SDK 四组合已执行并归档；本次核验 256 次 SDK 推理旧档的源码、冻结文件与当前构建摘要，没有重跑。
- [x] React/Vanilla 与生产来源边界真实浏览器冒烟通过；见 [ui/summary.json](../reports/2026-09-18-release-readiness/ui/summary.json)。
- [x] 2026-09-18 完整 `pnpm verify` 退出0：50单测、两项类型检查、两构建、npm包清单检查通过。见[结构化记录](../reports/2026-09-18-release-readiness/local-verification.json)与[完整日志](../reports/2026-09-18-release-readiness/local-verification.txt)。
- [x] CI 覆盖测试、类型、构建与模型/摘要校验，且在 Linux CI 实际通过，见 [PR #2](https://github.com/chenmohan123/web-sdk-PP-Segmentation/pull/2)；发布检查同时绑定当前产物、冻结证据和八组合真实浏览器回执。
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
- [x] npm `web-sdk-pp-segmentation@0.1.0` 已发布；[完整 tarball 回读](../reports/2026-09-18-release-readiness/npm-published.json)与 GitHub 验收包逐字节一致，[实际安装与公共导入](../reports/2026-09-18-release-readiness/npm-installation.json)通过，产物不含模型或评估素材。
- [x] [GitHub Release v0.1.0](https://github.com/chenmohan123/web-sdk-PP-Segmentation/releases/tag/v0.1.0) 已发布，不可变标签固定 `dfbc72056e8c8cf748a7697778f5d14a921b5302`；[回执](../reports/2026-09-18-release-readiness/github-published.json)记录成功工作流。说明包含来源、许可、模型、后端和局限。
- [x] 正式仓库、npm、在线 Demo 的 README 入口均已发布；npm registry 完整下载与 Demo 实际运行已核验。
- [x] HTTPS Demo 已从受保护源码部署，22 个线上文件与验收构建逐字节一致，默认源 GPU/Worker 实测通过；见 [demo-published.json](../reports/2026-09-18-release-readiness/demo-published.json)。
- [x] GitHub Pages Source 为 GitHub Actions，使用 `github-pages` environment、限定 Pages 权限、HTTPS 与并发控制。
- [x] [远程治理回执](../reports/2026-09-18-release-readiness/governance-published.json)记录仓库、Ruleset/environment、Pages、成功部署 commit 和验证时间，不含凭据。
- [x] 本地 required 失败 0，四项适用远程治理规则已核验通过；npm 发布另有独立回读与安装证据。

首版交付完成。后续自动 npm 发布仍需为此新包配置 Trusted Publishing；首版已由本机经安全验证发布，并由标签工作流独立核验完整性。
