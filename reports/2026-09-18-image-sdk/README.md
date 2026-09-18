# 64图公共SDK真实验收

执行时间：2026-09-18T04:11:07.779292+00:00；状态：**failed**。

固定64张COCO val2017、716项segmentation标注。scoreThreshold=0.01，nmsThreshold=0.7，maxDetections=100。Paddle官方model(inputs)与公共SDK共享产品预处理生成的Float32输入；浏览器通过公共run({image:RGBA})重新执行同一预处理。

官方基线 segm AP：36.933058%。

| 模式 | segm AP (%) | AP下降(百分点) | >0.5最小mask IoU | total中位数(ms) | inference中位数(ms) | postprocess中位数(ms) |
|---|---:|---:|---:|---:|---:|---:|
| wasm-main | 36.855369 | 0.077689 | 0.97882439 | 1631.80 | 1347.20 | 216.00 |
| wasm-worker | 36.855369 | 0.077689 | 0.97882439 | 1591.25 | 1321.55 | 210.35 |
| webgpu-main | 36.855373 | 0.077685 | 0.97882439 | 293.40 | 31.65 | 209.05 |
| webgpu-worker | 36.855373 | 0.077685 | 0.97882439 | 296.90 | 32.20 | 210.90 |

## 未通过项

- 图204871，classId=2，官方分数0.83743262，maskIoU=0.9788243885，低于0.99；未排除该实例，整体状态保留failed。

四模式均为同一项：SDK前景2739像素，官方前景2681像素。58个不同像素全部位于官方缺失边缘；共同区域差异0像素，诊断用共同区域IoU=1.0。此诊断不替代完整原图门槛；SDK保留正确原图边缘，后续需单独决策上游尺寸语义，当前不能宣称稳定验收通过。

官方输出有5图因Float32尺寸除法后int截断少一行/列：173091, 204871, 212166, 287874, 341828。官方原始RLE保留在归档；评测仅按左上原点置于原图画布，缺失边缘填0，不拉伸、不新增前景。受影响实例数、原始尺寸与高分匹配见acceptance.json的baselineMaskCanvasAdjustments及agreement；边缘诊断见edge-diagnosis.json。

主线程WASM会阻塞事件循环：首轮10ms定时器取消断言未在结果返回前触发，原始失败记录保留于browser-execution-initial.json。补测确认公共run提交后立即abort返回ABORTED并可恢复；Worker另验证运行中的定时取消。browser-execution.json保留定时器实际触发与结果返回时间，不能据此宣称main内核可强制中断。

## 同raw后处理对照

独立Node环境，固定第1、22、43图，一次预热、五次交替测量；全部原图二值mask要求完全相同。该三图实验不代替上表64图公共SDK耗时。

| 图ID | 分数阈值 | 实例数 | 全图参考中位(ms) | ROI中位(ms) | 全图字节 | ROI字节 |
|---|---:|---:|---:|---:|---:|---:|
| 10977 | 0.5 | 4 | 124.74 | 23.25 | 750000 | 8774 |
| 10977 | 0.01 | 100 | 2987.11 | 213.92 | 18750000 | 444727 |
| 235836 | 0.5 | 6 | 241.55 | 19.25 | 1639680 | 84300 |
| 235836 | 0.01 | 100 | 4299.77 | 232.24 | 27328000 | 608478 |
| 386879 | 0.5 | 2 | 87.20 | 14.45 | 545280 | 218930 |
| 386879 | 0.01 | 100 | 4026.88 | 258.13 | 27264000 | 1568564 |

AP通过标准为下降≤0.5个百分点；score>0.5同类别框匹配maskIoU≥0.99，双方未匹配实例均计失败。main/worker在score>0.01下另行一致性比较。生命周期实际结果见browser-execution.json，摘要见acceptance.json，逐实例匹配见instance-comparisons.json.gz，逐图输出与耗时见四个results.json.gz。

## 复算与边界

先执行 `node scripts/evaluation/prepare.mjs`，再用包含Paddle2.6.2、pycocotools的Python执行 `scripts/evaluation/paddle_reference.py`；设置真实Chromium路径后执行 `node tests/acceptance.mjs`，最后执行 `scripts/evaluation/compare.py`。完整操作和依赖路径见scripts/evaluation/README.md。

归档包含ROI行优先0/1游程与官方COCO压缩RLE，可脱离模型复算AP和掩码一致性。原始JSON及640tensor仅在忽略目录.tmp/acceptance-20260918；dataset.lock.json保留图片许可、来源、RGBA与tensor SHA256。测试图片含非商用/相同方式共享许可，不作为生产Demo素材再分发。

本报告仅覆盖本次Windows桌面、Chromium和真实GPU适配器环境；四模式顺序运行。total为公共run墙钟耗时，不含load及显示绘制；不据此换算产品FPS。不代表完整COCO精度、移动端、NPU或远程分发兼容承诺。
