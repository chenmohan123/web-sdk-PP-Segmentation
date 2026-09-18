# PP-Segmentation 0.1.0 首版交付记录

日期：2026-09-18。独立 SDK 层；保持 Detection Demo 风格，不涉及门户组合、视频或摄像头。

## 已完成

- 原图整数尺寸契约独立参考通过。64 张 COCO 子集，四模式各 423 个高分实例，最小 mask IoU 0.9987084870848708；最大 AP 下降 0.07768926117917574 个百分点。SDK 数值实现未改，本次数值比较复用摘要核验过的历史 256 次推理。详见[原图尺寸参考](../2026-09-18-original-size/README.md)及[独立审查](original-size-review.md)。
- [许可决定](license/README.md)依据固定官方项目 Apache-2.0 发布声明、模型表与文件许可。保留独立权重声明未找到的解释范围、PaddleYOLO 来源边界、原始权重/ONNX 摘要、转换记录和 LICENSE/NOTICE。
- ModelScope/Hugging Face 已发布，默认 ModelScope。模型 36,265,193 字节，SHA-256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`。两源固定提交所有文件完整 GET 回读见 [weights](distribution-weights-verified.json) 与 [metadata](distribution-metadata-verified.json)。
- [生产构建验收](release-acceptance.json)：实际双源下载，各自覆盖 WASM/WebGPU × main/Worker，共八组合；显式 ModelScope 下载失败不访问 Hugging Face。该轮使用单张本地图片验证交付路径，不替代 64 图数值档案。
- [工程验证](local-verification.json)：50 单测、两项类型检查、SDK/Demo 构建与 npm 清单检查通过。[UI 验证](ui/summary.json)：四组合、无效预览拒绝、取消/换图恢复、缓存、Vanilla、中英、390px 与实例选择不跳动通过。
- [PR #2](https://github.com/chenmohan123/web-sdk-PP-Segmentation/pull/2) 通过 Linux CI 后合并为 `c62c2187fd5fc1014c48937b538fa910a6eb796f`。CI 核验当前构建与真实八组合回执，冻结证据按原始字节入 Git；没有改写旧失败结果。
- [HTTPS Demo](https://chenmohan123.github.io/web-sdk-PP-Segmentation/) 已上线；[回读](demo-published.json)确认 22 个文件与验收构建逐字节一致，默认 ModelScope/WebGPU/Worker 实际识别 4 个实例，中英切换保留结果。
- [远程治理](governance-published.json)：默认分支 PR/严格 CI/会话解决/禁止删除和强推；v* 标签禁止修改删除；Pages Actions、HTTPS、受保护来源、最小部署权限与串行部署。四项适用远程规则通过，本地[标准检查](standard-after.json) required 失败 0。推荐项 EXAMPLE-003 是 Vite 复用 React 示例的静态发现限制，已有可运行证据。

## 剩余交付

npm 的本机凭据失效，首次发布需要账号登录和可能的安全密钥验证。当前没有发布 npm 0.1.0，也没有创建最终 v0.1.0 标签或 GitHub Release。产物、workflow、来源和验收均已准备；账号验证后继续发布并独立回读 tarball，最后记录版本标签与 Release。

## 范围与归档

验证仅覆盖记录中的 Windows 11、Chromium 153、i5-10400F 与 RTX 5060 Ti。64 图不代表完整 COCO 精度；移动端、NPU、Safari、Firefox、WebView 未验证。COCO 图片、模型权重及本地截图不进入 npm 或 Git。

原始官方尺寸截断口径的失败档案保持于 `reports/2026-09-18-image-sdk/`。新原图参考另存；两套数值证据在 Git 内按原始字节保存以保持其 SHA-256，不通过改写摘要掩盖差异。
