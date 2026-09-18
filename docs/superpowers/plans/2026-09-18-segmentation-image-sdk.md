# PP-Segmentation 图片版实施计划

2026-09-18 执行记录：四项本地实施与评估任务已完成，工程审查及验证通过。严格模型质量结论仍为 failed（1个官方边缘裁剪差异），未进入稳定或远程发布；勾选表示计划操作已执行，不表示质量门槛全部通过。见 `reports/2026-09-18-image-sdk/`。

> 执行者：按superpowers:subagent-driven-development完成独立任务和审查；常规可逆操作持续执行，不重复询问已批准范围。

**目标：** 交付本地可运行的独立实例分割图片SDK与Demo，以及可复算桌面验收证据。

**架构：** 框架无关TypeScript runtime管理下载、缓存、完整性和生命周期；ORT与数值后处理置于main/Worker引擎；React只负责工作台交互。

**技术栈：** TypeScript5.9.3、ORT Web1.27.0、Vitest、Playwright1.63.0、React、Vite、Python Paddle/COCO评估。

**设计依据：** [图片版设计](../../design/2026-09-18-image-sdk.md)。

## 全局约束

- 首发固定PP-YOLOE_seg_s 640 FP32，36,265,193字节，SHA256 `d418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334`。
- 最多16,777,216输入像素、64MiB返回mask、默认100/上限300实例；score>0.5、逐类NMS0.7，AP运行score0.01。
- 单SDK只做实例分割；中文文档/注释/提交，公开README及六指南提供英文对应；门户组合和远程发布不在本轮。
- Node>=22.12.0，独立分支codex/segmentation-image-sdk；pnpm使用项目约定的两个config参数。

### Task 1: 数值处理与掩码输出

文件：`src/preprocess.ts`、`src/postprocess.ts`、`src/labels.ts`、`tests/segmentation.test.ts`，测试夹具放`tests/fixtures/`。

接口：消费`src/types.ts`中的PixelImage/RunOptions/SegmentationInstance；产出`preprocess(image):Float32Array`及`postprocess(values:Float32Array[],width:number,height:number,options:RunOptions):SegmentationInstance[]`。

- [x] 先写输入越界/透明白底/COCO类别/NMS重叠/零输出/内存预算失败测试，以及从官方实验输出提取的小型固定mask夹具。执行`pnpm test tests/segmentation.test.ts`确认缺失功能失败。
- [x] 实现bicubic预处理、逐类NMS及顺序不变的两次插值恢复；利用索引表和每实例中间缓冲复用，以ROI返回结果。禁止用被测函数生成expected。
- [x] 手工期望示例：`expect(result[0].mask.data).toEqual(new Uint8Array([1,0,0,1]))`对应独立2×2掩码夹具；错误输入需`toMatchObject({code:'INVALID_INPUT'})`，预算超限需`OUT_OF_MEMORY`。
- [x] 完成单测并使用本地真实四输出对照已归档官方mask，记录性能。审查通过后提交此任务文件。

### Task 2: runtime、Worker与构建

文件：`src/types.ts`、`runtime.ts`、`engine.ts`、`inference.worker.ts`、`cache.ts`、`image.ts`、`ort.ts`、`errors.ts`、`index.ts`、`scripts/build.mjs`、`tests/runtime.test.ts`、`tests/cache.test.ts`、`tests/worker.test.ts`。

接口：实现设计中`createSegmentation`以及`getCacheUsage/clearModelCache/clearAllModelCaches`；engine消费Task1函数，返回CoreResult。Worker协议`load/run`带request id，成功回result，失败回code/message，返回mask.buffer进入transfer列表。

- [x] 写失败用例覆盖`run`在load前报NOT_LOADED、重复并发报BUSY、坏摘要报INTEGRITY、调用者像素buffer仍可读、abort无陈旧成功、dispose幂等。
- [x] 复用本组织TinyPose已验证的通用下载/缓存/生命周期设计并保留归因，不复制姿态推理；接入Task1和四个ONNX输出的维度检查。
- [x] 使用`runtime.run({image},{signal})`行为测试，验证两种线程模式资源所有权；回传`runtimeVersion`和分段耗时。
- [x] 执行单测、`pnpm typecheck`、`pnpm build`，生成SDK、声明与ORT静态资产；产物不包含ONNX。

### Task 3: 独立图片Demo和接入文档

文件：`demo/src/App.tsx`、`style.css`、`draw-mask.ts`、`demo/vite.config.ts`、`examples/vanilla`、`examples/react`、`README.md`、`README.en.md`、`docs/{zh-CN,en}/*.md`、`sdk-manifest.yaml`、`.github/workflows/ci.yml`。

接口：Demo仅导入构建好的公共SDK；load/run/dispose和cache操作按Task2接口；模型元数据来自`models/model.json`。开发server固定`/local-model/model.onnx`读取忽略目录的模型；生产禁止此路由，未分发时禁用检测。

- [x] 先准备浏览器交互验收断言：`expect(await page.locator('canvas').count()).toBeGreaterThan(0)`在上传且真实推理成功后执行；清理/取消后结果状态不能被旧任务覆盖。局部模板与文档无需机械测试。
- [x] 依据共享UI tokens和Detection结构实现紧凑工作台、固定结果工具栏、中英切换及信息折叠。
- [x] 完整编写本地运行/API/兼容/排障/隐私部署/性能文档，清楚标alpha、未发布来源与正式链接规划。CI运行test/typecheck/build/build:demo；发布workflow仅验证，不提前上传。
- [x] 构建Demo并进行桌面/390px实际操作；语义选择及布局测试与真实模型验收一起归档。

### Task 4: 扩大质量、性能和生命周期验收

文件：`scripts/evaluation/prepare.py`、`reference.py`、`tests/browser.mjs`、`scripts/evaluation/compare.py`、`reports/2026-09-18-image-sdk/`。

接口：通过公开`createSegmentation`运行64个固定RGBA输入并存储ROI masks与timings；将每幅原始像素按SDK预处理重建成同输入官方参考，COCOeval使用segm类型与100 maxDets。

- [x] 固定图集、GT、权重和代码摘要，分别标出source一致性/同输入一致性/GT精度与性能，保留Raw结果供复算。
- [x] 浏览器运行CPU/GPU×main/Worker并检查空白、Blob、取消恢复、输入替换、并发、释放和缓存。每组合以相同输入记录模型/实际后端/模式与日期。
- [x] 执行官方/SDK mask AP比较及score>0.5 maskIoU门槛；单独比较旧参考后处理与优化后的性能，不能由文件大小推导速度。
- [x] 运行SDK标准检查、单测、类型、两种构建、打包检查、浏览器smoke、差异检查；完成独立代码审查并修复问题。
- [x] 报告本地实现完成及真实未完成的远程发布事项，更新门户规划链接，保留旧评估快照。
