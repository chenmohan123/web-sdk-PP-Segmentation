# 原图整数尺寸独立参考验收

执行时间：2026-09-18T05:27:45.352833+00:00；新参考结论 **passed**；原始官方严格结论 **failed**，旧证据完全保留。

原图输入整数width/height是画布权威。完整Paddle model(inputs)执行一次前向，在同一head_outs分别调用固定源post_process和尺寸修正版。仅CPU最后裁剪/空输出尺寸由int(ori_h/w)改为输入整数；原型、sigmoid、插值、框裁剪、NMS和二值化不变。不是未修改的官方基线。SDK输出不参与生成参考。

612经Float32比例恢复为611.9999389648438，int得到611，而原官方插值round得到612。synthetic.json覆盖7种横竖/矩形/单像素尺寸及四边前景；新参考保留已计算的末行/列。完整64图的共同区域逐像素一致，原始参考重跑scores/boxes精确一致；见reference-execution.json。

| 模式 | SDK AP% | 原始官方最小IoU / 结论 | 整数尺寸最小IoU / 结论 | 新参考AP下降百分点 |
|---|---:|---|---|---:|
| wasm-main | 36.855369 | 0.9788243885 / False | 0.9987084871 / True | 0.077689 |
| wasm-worker | 36.855369 | 0.9788243885 / False | 0.9987084871 / True | 0.077689 |
| webgpu-main | 36.855373 | 0.9788243885 / False | 0.9987084871 / True | 0.077685 |
| webgpu-worker | 36.855373 | 0.9788243885 / False | 0.9987084871 / True | 0.077685 |

原始官方AP=36.933058%；整数尺寸参考AP=36.933058%。每种模式均检查全部423个score>0.5实例，完整原图mask IoU≥0.99、AP下降≤0.5个百分点、双方未匹配均失败。未切除边缘、未放宽阈值。

四模式及生命周期均复用2026-09-18归档，无新SDK或浏览器推理；核验全部归档hash、64个有序唯一ID、源码、冻结与当前dist摘要。

main/worker在score>0.01下继续使用原匹配规则复算。原始主线程定时取消失败及补测均保留；此处不新增可中断性承诺。

复算（不运行Paddle）：`../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/compare_original_size.py`。完整重跑参考：同Python执行`scripts/evaluation/original_size_reference.py`。复算成功退出0，数值不通过退出1，完整性断言失败亦为非0。GT位于相邻Detection忽略目录，其SHA见reuse-integrity.json；未再分发图片。

完整函数、实际裁剪补丁及源SHA均归档。最初源AST检查错误地假设下载源不含export_mode而失败；paddle.log保留在.tmp，随后改为完整AST精确比较并断言export_mode关闭，实际完成日志为paddle-rerun.log。下载固定路径内容本身含export_mode，不据此假称整个本地源码树未修改。

范围仅固定64张COCO val2017、此次Windows桌面Chromium/WASM/WebGPU档案；不代表完整COCO、移动端、NPU、远程分发或稳定版本验收。
