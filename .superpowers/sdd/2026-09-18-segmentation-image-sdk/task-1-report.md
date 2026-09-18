# Task 1 数值处理报告

日期：2026-09-18

## 实现

- `src/preprocess.ts` 校验 `PixelImage` 尺寸、RGBA 长度及 16,777,216 像素上限；透明像素先合成白底，再用 A=-0.75 bicubic 直缩到 640，量化到 uint8 后按 NCHW 输出。输入 buffer 不会被修改，并导出 `validatePixels` 供图片解码入口复用。
- `src/postprocess.ts` 消费固定四输出（8400×4、80×8400、32×8400、32×160×160），逐类阈值筛选、top1000、稳定 NMS，最终按分数排序并限制 maxDetections。掩码按官方 160→640、640 网格框裁剪、640→原图双线性顺序恢复，返回原图检测框对应的整数 ROI；无前景返回空 ROI。
- 原型矩阵使用 Float64 单实例 logits、Float32 概率/裁剪缓冲复用，避免同时构造多张整图浮点掩码；累计 ROI 数据超过 64MiB 抛出 `OUT_OF_MEMORY`。
- `src/labels.ts` 提供 COCO 80 个连续 classId 标签。

## 证据与测试

`tests/segmentation.test.ts` 含 24 项测试：非法输入、透明白底、bicubic 量化、零输出、逐类 NMS、COCO 标签、对角掩码、两次插值、ROI/空掩码、选项及张量校验、64MiB 边界，以及从 `.tmp/segmentation-20260918/reference/000000010977.npz` 提取的 32 通道官方瓶子掩码小夹具（`tests/fixtures/official-bottle.json.gz`）。夹具提取脚本为 `tests/fixtures/extract_official.py`，不在运行时使用。

验证命令：

```powershell
node node_modules/vitest/vitest.mjs run tests/segmentation.test.ts
pnpm typecheck
```

两项均通过；测试总耗时约 4 秒，其中 64MiB 失败边界约 2.7 秒，官方掩码对照约 0.5 秒（当前本机 Node/Vitest）。

## 限制与疑虑

- 预处理采用与归档实验一致的 RGBA 合成和量化路径；浏览器 Blob 解码、EXIF 方向由 runtime 层负责。
- 仅对归档四输出和一个真实实例做数值对照，尚未声称完整 COCO AP 或跨浏览器性能兼容。
- ROI 边界按检测框 floor/ceil，框内插值为 0 的像素保留，便于与 box 对齐；无正像素时按契约返回 0×0 空掩码。
