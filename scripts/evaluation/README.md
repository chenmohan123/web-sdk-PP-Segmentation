# 真实模型64图验收脚本

脚本从本仓根目录执行。只启动随机端口的localhost资源白名单服务，不依赖Demo服务，不访问远程模型。每次生成的dist快照与预处理tensor留在忽略目录`.tmp/acceptance-20260918`，产品源码和归档输入摘要保留SHA256。

当前本机数据依赖：相邻`web-sdk-PP-Detection/.tmp/phase2/dataset`的64张固定RGBA、`images.lock.json`与`annotations.json`；模型为本仓`.tmp/model.onnx`，固定36265193字节、SHA256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`。官方权重来自相邻门户`.tmp/segmentation-20260918/ppyoloe_seg_s_80e_coco.pdparams`，PaddleDetection使用相邻Detection仓已有的固定revision源码。图片数据仅本机使用，许可逐图保存在归档锁文件中。

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
node scripts/evaluation/prepare.mjs
& ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/paddle_reference.py
& ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/preprocessing_compare.py
$env:PLAYWRIGHT_BROWSERS_PATH = 'F:/git/00_chenmohan/github/web-sdk-PP-Detection/.tmp/dependencies-compatible-browsers'
node tests/acceptance.mjs
& ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/compare.py
& ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/raw_samples.py
node scripts/evaluation/postprocess_benchmark.mjs
& ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/diagnose_edges.py
& ../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/compare.py
& scripts/evaluation/capture-host.ps1
node scripts/evaluation/verify_artifacts.mjs
```

Python环境需要Paddle2.6.2、numpy、scipy、OpenCV及pycocotools；浏览器使用仓库锁定的Playwright与对应Chromium。Paddle在CPU四线程运行，与浏览器四模式按顺序运行，避免硬件资源争用。WebGPU在相应main/worker上下文实际请求高性能适配器，强制验证`fallback=false`并拒绝软件适配器。

`prepare.mjs`直接编译`src/preprocess.ts`并对64张固定RGBA执行产品预处理，生成官方基线使用的Float32 NCHW tensor。`paddle_reference.py`调用官方`model(inputs)`，只将官方NMS的`keep_top_k`设为本轮要求的100（原配置300），分数和NMS阈值保持0.01/0.7。

`browser.mjs`通过公共`dist/index.js`的`createSegmentation/load/run/dispose`执行wasm/webgpu × main/worker共256次64图推理，另测空白、真实JPEG Blob、非法输入、竞争、取消恢复、重复释放、缓存命中及隔离。每幅实例掩码保留原图ROI及行优先0/1游程， gzip归档保留完整结果和分段耗时。`compare.py`用pycocotools恢复COCO RLE并重算segm AP；高分匹配使用同类别框IoU最大总和一对一匹配，双方未匹配也失败；main/worker检查score>0.01的全部结果。

已有全部`*-results.json.gz`与GT时，只需执行`compare.py`即可复算，无需模型或GPU。脚本从实际返回值计算通过状态，不以脚本完成替代精度或生命周期通过。报告和归档位于`reports/2026-09-18-image-sdk`；未压缩JSON、tensor和日志均留在`.tmp`忽略目录。

`raw_samples.py`固定选择锁文件第1、22、43图的同输入ONNX四输出。`postprocess_benchmark.mjs`在score=.5/.01下比较独立全图实验参考与当前ROI实现：每个组合一轮预热、五轮交替顺序测量；先逐像素恢复原图并要求二值mask完全相同，再报告CPU后处理时间与返回掩码字节数。此三图Node实验不替代64图公共SDK浏览器耗时。

`diagnose_edges.py`读取严格匹配失败项，定位差异是否位于官方输出缺失的边缘；诊断绝不改变主验收门槛或状态。当前上游CPU后处理的`int(im_shape/scale_factor)`会将部分612尺寸截成611，原始官方RLE保持不变；COCO评测时仅将其作为左上ROI放回完整画布，缺失边缘补0。

首次浏览器脚本使用10ms定时器断言main/wasm取消，实测定时器在同步内核完成后才触发，历史失败报告保留为`browser-execution-initial.json`。当前脚本断言提交run后立即abort和恢复，另在Worker断言活动run定时取消；所有模式记录定时器与结果的实际时间。`node tests/acceptance.mjs --lifecycle-only`可在相同dist摘要下只补生命周期，保留已有256次推理归档；该参数要求已有`browser-execution.json`。
