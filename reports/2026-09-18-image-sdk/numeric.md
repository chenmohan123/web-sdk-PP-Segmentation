# 图片SDK数值处理验证

日期：2026-09-18。范围为本地数值模块，不涉及模型发布。

## 实现与接口

`preprocess(image)` 校验完整 RGBA 和 16,777,216 像素上限，透明像素合成白底，A=-0.75 bicubic 直缩 640，量化回 uint8 后输出 RGB/NCHW。四条水平扫描线复用，避免原图浮点副本。`validatePixels(image)` 可供解码入口使用。

`postprocess(values,width,height,options)` 接受固定四输出：8400×4、80×8400、32×8400、32×160×160。按 COCO80 连续类别执行阈值筛选和逐类 top1000 NMS，按分数排序后应用 maxDetections。`validateRunOptions(options)` 供公共运行入口在模型推理前校验参数，后处理也会再次校验。

掩码恢复严格保留 sigmoid、160→640 双线性插值、640 网格按框裁剪、640→原图双线性插值、严格大于 0.5 二值化的顺序。原型矩阵连续按通道读，单实例 logits、概率与 640 裁剪缓冲复用。

返回的 `mask` 是原图坐标中包含全部二值前景的最小整数矩形（紧致 ROI），与 `box` 边界独立。绘制时必须使用 `mask.x/y/width/height`；第二次插值产生的框外前景会保留。ROI 外像素均为 0，空前景返回 0×0 空数据。返回 ROI 字节累计超过 64MiB 报 `OUT_OF_MEMORY`，不静默截断实例。

## 审查修复与测试

修复前曾将 ROI 再次限制为检测框 floor/ceil，导致第二次插值边缘丢失。独立反例：原图 6400×1、640 网格框 `[319.1,0,320.1,640]`、单通道系数 1、原型恒 10。第 320 列缩放十倍后前景应为 x=3200..3209；旧实现仅保留 x=3200..3201。修复后使用已扫描的 min/max 前景边界，横向与纵向反例均保留全部 10 像素。

`tests/segmentation.test.ts` 含 27 项测试。先复现 3 项 ROI 断言失败，再实现修复；运行选项导出也先观察缺失函数失败。完整测试包含透明白底、bicubic 量化、非法输入、NMS、COCO 类别、独立 2×2 掩码、插值边缘、空掩码、参数及张量校验、64MiB 上限，以及真实官方瓶子掩码夹具。

```powershell
node node_modules/vitest/vitest.mjs run tests/segmentation.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

以上命令均通过：27 项数值测试全部通过，TypeScript 检查退出码 0。

## 真实四输出对照

本次使用相邻门户 `.tmp/segmentation-20260918` 的 6 张 COCO 图片和 1 张空白图，分别读取既有 WASM、WebGPU 四输出，共 14 组、88 个实例。在 Node 中对比实验全图恢复实现和归档 Paddle 官方 mask，不重新运行模型。14 组的实验参考像素差异均为 0，官方 mask 最小 IoU 为 1；分数与类别也一致。逐组耗时与返回字节在 `numeric.json`。

可复现命令（需要实验归档及含 NumPy 的 Python）：

```powershell
node tests/fixtures/compare_archived.mjs ../chenmohan123.github.io/.tmp/segmentation-20260918 ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe ../chenmohan123.github.io/reports/segmentation/2026-09-18-feasibility/reproduction/postprocess.mjs
```

单次 Node 耗时同时包含各自的筛选与掩码恢复；SDK 额外执行完整张量数值校验。JIT、先后顺序和本机负载会影响结果，这些数据不代表浏览器性能或端到端 FPS。原始大张量和官方全图掩码仍在忽略目录；提交夹具 `official-bottle.json.gz` 仅约 70KB，提取脚本不依赖被测实现。

## 范围限制

本报告不声称 64 图 COCO AP、浏览器 Blob/EXIF 解码、跨浏览器兼容或公共 API 后端矩阵已完成；这些由主验收记录覆盖。正式快速开始中曾有“mask覆盖检测框”的描述，需要与本文紧致前景 ROI 语义同步，接口字段无需变更。
