# PP-Segmentation 协作约定

文档、回复、注释和git提交使用中文；公开README和六组指南提供完整英文对应。
先读相邻门户`standards/v1/README.md`及受影响契约；SDK修改前后从门户运行sdk:check，保留实际失败与补救措施。pnpm命令加`--config.verify-deps-before-run=false --config.manage-package-manager-versions=false`。

当前为0.1.0-alpha.0本地开发阶段，首发候选PP-YOLOE_seg_s 640 FP32。模型SHA、来源证据与本地评估见相邻门户`reports/segmentation/2026-09-18-feasibility`。本轮不发布npm、Hub权重、远程仓库或Demo；不把本地模型URL当作正式分发证据。

SDK只做单帧实例分割，runtime框架无关；Demo延续Detection风格，中文默认，可切英文。门户整合、视频和摄像头不在此阶段。正式模型来源仅ModelScope/Hugging Face，默认ModelScope；本地测试经显式开发manifest提供模型，禁止生产构建携带ONNX。

保留用户和其他SDK代码。执行gh前使用宿主机GitHub CLI鉴权，退出时恢复环境。评估数据与模型留在忽略目录；不得把本轮桌面验证扩展成移动端、NPU或稳定发布承诺。
