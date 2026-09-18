# 双源 Demo 接入准备报告

日期：2026-09-18

## 本次变更

- 将 `models/model.json` 的 `sources` 从无类型对象改为空数组，保留正式来源尚未发布的事实。
- 新增 Demo 来源解析模块，只接受 ModelScope 与 Hugging Face；默认 ModelScope，显式选择不自动换源。
- 来源条目需包含合法的仓库、不可变 revision、路径、HTTPS 下载地址、文件大小与 SHA-256，并与顶层模型身份一致。下载地址必须精确匹配对应 Hub 的 `repository/revision/path` resolve 结构，拒绝错误主机、凭据、查询、片段和可变引用。
- 本地开发构建继续显式使用 `local-model/model.onnx`；生产构建仅在当前正式来源完整有效时允许运行。
- 来源切换复用现有 `reset()`，中止并释放旧会话，同时清除旧结果、耗时、进度与错误状态。
- 模型信息区显示当前本地或生产来源；正式来源缺失或非法时禁用运行。缓存统计和清理由模型身份确定，不依赖 Hub 可用性。

## 验证结果

- `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test`：通过，5 个测试文件、49 项测试全部通过。
- `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false typecheck:demo`：通过。
- `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build:demo`：通过，生产构建未复制本地 ONNX。
- `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec prettier --check models/model.json demo/src/model-sources.ts demo/src/App.tsx tests/model-sources.test.ts`：通过。
- 生产构建浏览器烟测（宿主机 Chrome，1280×800）：空来源时推理保持禁用；缓存用量显示 `0.00 MB`，当前模型与全部缓存均可清理；默认 ModelScope，显式来源仍不自动回退。

## 测试范围

来源解析夹具覆盖空来源、缺失数组、未知选择、错误摘要、重复来源、大小不符、Hub/仓库/revision/路径不一致、凭据、查询、片段、可变引用、ModelScope 默认、Hugging Face 显式选择、生产禁用、本地开发覆盖及显式来源缺失时不回退。夹具中的 revision 仅满足不可变格式校验，不作为远端实测或发布证据。

## 剩余依赖

- 等待 ModelScope 与 Hugging Face 上同一模型文件的正式仓库、不可变 revision、路径和下载地址；不得用夹具值补入清单。
- 等待权重再分发许可结论；本报告不判定模型已获许可。
- 等待原图尺寸数值验收结论；本报告不判定数值验收已通过。
- 正式来源落地后仍需分别验证下载、大小、SHA-256、浏览器加载与显式来源失败行为，再执行门户后置 `sdk:check` 和整体发布检查。

SDK 推理 `src/`、现有模型 bytes/SHA-256、正式 `sdk-manifest.yaml`、远端仓库和发布状态均未修改。
