# 首版发布整体独立审查

审查日期：2026-09-18。分层：单 SDK、其 Demo 与发布流程。范围为基线 `7f60c97` 至当前工作树的差异及新增文件；只读产品，唯一写入本报告。未执行远程修改、发布或再次运行 64 图推理。

## 结论

当前 0.1.0 候选规格基本符合，未发现会使已锁定 0.1.0 模型、SDK 或 Demo 失效的阻塞缺陷。源码 runtime 未变化；数值参考修订及许可范围已有独立审查，整体实现没有把参考修改误写成 SDK 数值修复，也没有把准备完成写成 npm/线上 Demo 已发布。

本次发现的两项发布流程问题均已修复并复核关闭，当前无待处理的发布阻塞发现。下文保留原发现与修复记录，便于追溯。远程部署、npm 元数据与资产回读、最终 GitHub Release 是主流程尚需完成的交付步骤，不是本审查发现的产品缺陷。

## 发现

1. **P2：发布前未绑定标签版本与实际包版本。** `.github/workflows/release.yml:34` 只验证标签格式、HEAD 和 main 祖先关系；`scripts/check-release-ready.mjs:12` 只验证包内部版本一致。随后 workflow 第 70 行使用标签版本查询 npm，但第 77 行按 tarball 内版本执行不可逆的 publish。若误将 v0.1.1 指向当前 0.1.0 源码，verify 可通过，首次发布时可能先把 0.1.0 发出，再因查询 0.1.1 超时而失败。最低修复：verify 阶段明确断言 `RELEASE_TAG === 'v' + package.json.version`，且在 publish 前完成；可再断言打包 manifest 与包名。无需重跑模型验收。
2. **P2：GitHub Release 正文缺少约定要求的运行后端与已知局限。** `.github/workflows/release.yml:130` 直接以整个 `CHANGELOG.md` 作为 release body；当前 `CHANGELOG.md:5` 起的 0.1.0 条目没有明确写 WASM/WebGPU、main/Worker、64 图桌面验证边界以及手机/NPU 未验证。这些信息在公开双语指南中完整存在，但不会进入自动生成的 Release 正文。最低修复：为本版条目补充后端、固定模型身份/来源入口、许可证及已知局限，或使用已有完整发布说明生成正文。后续版本还应避免把所有历史 changelog 都作为当前版本正文。

## 规格与质量核验

- 已读取本仓库 AGENTS、门户标准入口及文档发布/仓库治理契约、设计规格；对照审查既有数值与许可独审报告。
- `node scripts/check-release-ready.mjs` 本次实际执行通过：固定双源回执、旧新归档摘要、SDK 全部锁定源码及两个执行产物、当前 dist/demo-dist 全量文件与八组合浏览器回执均一致。
- `git diff --check 7f60c97` 实际通过。工作树文本按 `.gitattributes` 固定 LF；不把 Windows 本地通过当作尚未运行的 GitHub Linux workflow 通过。
- 双源解析核对 kind、仓库、revision、path、精确 URL、大小与摘要；默认 ModelScope，显式选择不回退。无来源时运行禁用，缓存操作依赖模型身份而不依赖可用下载地址。来源切换复用既有 reset/dispose 流程。
- 浏览器验收脚本使用实际公共 dist SDK，在独立浏览器上下文逐源下载，每源覆盖 WASM/WebGPU × main/worker，并用生产 Demo 制造选定来源失败验证不访问另一来源。该脚本的单张正向验收主要覆盖 SDK 下载及推理；完整 Demo 交互另由 ui 证据支持。
- npm files 白名单与 check-package 排除 ONNX、训练权重、归档和开发数据；LICENSE/NOTICE 随包，NOTICE 补充原样 ORT JavaScript/WASM 的 MIT 正文。固定模型卡区分项目镜像、官方来源、许可证采用依据及解释范围。
- 双语主要入口、快速开始、API、兼容性、性能、隐私、排障及发布说明具备对应内容，明确既有 256 次推理复用、旧失败档案和桌面验证局限。
- 发布环境只在相应 job 获得写权限；Pages 使用官方 artifact/deploy action、github-pages 环境及部署级串行组。正式来源本身已存在固定完整 GET 回执；当前报告不独立宣称尚未发生的 npm/Pages 发布成功。

## 非阻塞维护风险

生产分发浏览器脚本从相邻 Detection 的忽略目录读取固定图片，完整复现需要既有工作区素材；建议后续允许显式输入路径并检查预期摘要。来源解析 MODEL_PATH 允许 `.`/`..` 段，而发布检查会拒绝这些段；当前锁定清单不含该问题，后续可统一解析器约束并补夹具。既有数值独审提出的只读复算入口、显式权重身份断言和 Python 优化模式防护仍是维护建议，本次没有更改冻结证据。

## 审查期间修复复核

标签版本项已由主流程修复：`scripts/check-release-ready.mjs:13` 在 RELEASE_TAG 存在时断言等于包版本的 v 标签，workflow verify job 已提供该环境变量。独立只读子进程验证 v0.1.0 返回 0，v0.1.1 返回 1，符合预期。发现第 1 项现已关闭，不再作为待办。

来源解析点段项也已读到修复：repository 与 path 在正则格式检查之外逐段拒绝 `.`、`..`。现有不可变正常 URL 行为不变，该维护项关闭。修改 Demo 源码后必须重建并更新真实浏览器产物绑定，旧 release-acceptance 不应直接当作新产物证据；主流程负责该重验。

CHANGELOG 修复复核：当前 0.1.0 条目已补齐 ORT 1.27.0、WASM/WebGPU、main/Worker、默认组合及失败不回退；模型名称、大小、参数量、官方来源、默认 ModelScope、固定清单与 Apache-2.0 模型卡入口；日期化 Windows/Chromium/CPU/GPU 环境、64 图范围、未验证平台及视频/跟踪边界。发现第 2 项现已关闭。按本次追加任务范围，仅核对该文档修复，不重复广泛审查；主流程正在刷新的生产浏览器证据仍须完成后才支持新产物验收声明。

