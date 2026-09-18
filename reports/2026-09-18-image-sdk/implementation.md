# 图片版本地实现记录

范围为独立 `web-sdk-pp-segmentation@0.1.0-alpha.0`，未执行远程建库、双源模型上传、npm 发布或 Demo 部署。门户只更新路线与证据索引。原始完整质量结论见[64图验收报告](README.md)，其严格验收状态仍为 failed，不因本地工程检查通过而改变。

## 已实现

框架无关 SDK、PP-YOLOE_seg_s 四输出后处理、紧致 ROI 掩码、WASM/WebGPU、主线程/Worker、Blob/RGBA、下载进度、SHA-256、独立 IndexedDB 缓存、取消与释放。React Demo 延续 Detection 工作台，结果图与实例列表并排，选择实例使用固定工具栏；另提供可运行 Vanilla 示例与双语文档。

数值审查发现的检测框 ROI 截断已修正为完整前景包围盒，横纵十倍放大反例均保留全部 10 个像素。27 项数值测试、14 组归档四输出与 88 实例对照通过，独立复审通过。运行时补充了参数前置校验和非法清单的稳定错误测试；核心测试总数为 42。

Demo 审查发现的无效输入预览残留已修复。有效图切换到损坏 PNG 时会清除旧画面和结果、显示双语 INVALID_INPUT 并禁用运行；4097×4096 PNG 在给产品画布分配原图大小前被拒绝。新旧图片解码按输入代次隔离，恢复有效图后真实推理通过。折叠验证矩阵、390px布局及两种缓存清理均有真实 UI 验证。

## 质量与发布边界

64 图四组合、主线程/Worker 一致性与生命周期已有可复算记录。mask AP 相对官方下降约 0.078 个百分点，符合≤0.5点门槛；423 个高分匹配中 1 个完整原图 mask IoU 低于0.99。该例全部差异来自官方 Float32 尺寸除法后整数截断丢失的58个边缘前景像素，共同区域完全一致。保留 SDK 的完整原图语义、原始官方输出与失败判定，下一发布阶段再明确兼容口径，不通过裁掉前景或改阈值掩盖差异。

正式发布前仍需完成这项验收语义决策、权重再分发许可核验、ModelScope/Hugging Face 不可变来源、GitHub 治理、npm 和 HTTPS Demo。手机、Safari/Firefox、NPU、摄像头和视频不属于本轮已验证能力。

## 检查范围

核心测试、类型检查、SDK/Demo 构建、npm 文件清单与真实 UI 验证记录在同目录 `local-verification.json` 和 `ui/summary.json`。产物不含 ONNX；当前生产 Demo 明确禁用尚未发布的模型来源。

门户维护目录 `src` 和 `tools` 的 65 项测试通过，Astro 检查与14页构建通过。门户的裸 `pnpm test` 会额外发现忽略目录 `.tmp` 中旧 SDK 副本的测试，本轮已中止该误扫描，使用 `pnpm test src tools --exclude '**/.tmp/**' --exclude '**/.worktrees/**'` 验证当前维护代码，没有修改旧副本。用户既有 `picodet-series-after.json` 保持不变。

SDK 标准检查由门户运行，前后证据位于其 `reports/sdk-standard/segmentation-before.json` 和 `segmentation-after.json`。最终本地 required 失败为0；远程规则未核验。推荐规则 EXAMPLE-003 的静态发现器按 examples/vite 目录判断，不能识别 Vite 与 React 复用完整 Demo 的声明；可运行示例已有真实浏览器验证。此静态结果不替代数值门槛或发布核验。
