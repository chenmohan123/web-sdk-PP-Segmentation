// 从实际验收产物自动汇总Task4交接信息；不将证据完整性与数值通过混为一谈。
import { execFileSync } from 'node:child_process';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root,report } from './prepare.mjs';
const read=async name=>JSON.parse(await readFile(path.join(report,name),'utf8'));
const acceptance=await read('acceptance.json'),browser=await read('browser-execution.json'),benchmark=await read('postprocess-benchmark.json'),diagnosis=await read('edge-diagnosis.json');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const lines=['# Task4真实64图验收交接','',`本地提交：${commit}`,`状态：评估与归档完成；严格数值验收 **${acceptance.status}**。未执行远程写入。`,'','## 数值与生命周期','',`固定${acceptance.dataset.images}图、${acceptance.dataset.annotations}标注，score=.01/maxDetections=100，Paddle官方同产品tensor基线segm AP=${(acceptance.baseline.AP*100).toFixed(8)}%。`,''];
for(const [name,value] of Object.entries(acceptance.modes))lines.push(`- ${name}：AP ${(value.ap.AP*100).toFixed(8)}%，下降${value.apDropPercentagePoints.toFixed(8)}个百分点，>${.5}匹配${value.agreement.matched}项，最小maskIoU=${value.agreement.minMaskIoU}，公共run总耗时中位${value.timingsMs.totalMs.median.toFixed(2)}ms。`);
for(const [name,value] of Object.entries(acceptance.mainWorker))lines.push(`- ${name} main/worker：${value.matched}项，maskIoU最小${value.minMaskIoU}，分数最大差${value.maxScoreDelta}。`);
lines.push(`- 浏览器生命周期：${browser.status}，共${browser.lifecycle.reduce((sum,row)=>sum+row.tests.length,0)}项断言；原始定时取消失败历史保留browser-execution-initial.json，当前报告记录main WASM事件循环阻塞。`);
const edge=diagnosis.failures[0];
lines.push('',`唯一高分失败是图${edge.imageId}/classId${edge.classId}：官方尺寸${edge.officialMaskShape.join('×')}，完整原图${edge.originalImage.width}×${edge.originalImage.height}，${edge.differentPixelsOutsideOfficialExtent}个差异像素全部在官方裁掉边缘，共同区域差异${edge.differentPixelsInsideOfficialExtent}像素。未改变阈值、未排除该实例、未丢弃SDK正确前景；后续需独立决策官方尺寸语义。`,'','## 独立同raw性能对照','','一次预热、五次交替测量；Node三图六组，不等同全量浏览器性能。全部完整原图二值mask完全一致。','');
for(const row of benchmark.cases)lines.push(`- 图${row.imageId} score=${row.threshold}：参考${row.referenceMedianMs.toFixed(2)}ms → ROI ${row.optimizedMedianMs.toFixed(2)}ms；返回${row.fullMaskBytes} → ${row.roiMaskBytes}字节。`);
lines.push('','## 产物与验证','','- 报告reports/2026-09-18-image-sdk/README.md；四模式ROI RLE、官方RLE与匹配均gzip归档，可重算。','- scripts/evaluation提供精确预处理、官方基线、四模式公共SDK、pycocotools复算、尺寸诊断和同raw性能脚本；tests/acceptance.mjs为浏览器入口。','- evidence-integrity.json验证256次推理矩阵、源码/dist摘要、ROI长度与归档完整性；证据完整性通过不代表严格数值通过。','- 原始JSON/tensor/raw/log留在忽略目录.tmp/acceptance-20260918；未改产品源码、其他测试或docs。','- 最终compare.py按门槛返回退出码1；这是如实报告的严格mask一致性失败。');
const target=path.join(root,'.superpowers/sdd/2026-09-18-segmentation-image-sdk/task-4-report.md');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,lines.join('\n')+'\n');console.log(target);
