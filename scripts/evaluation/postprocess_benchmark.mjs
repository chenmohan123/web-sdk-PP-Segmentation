// 三图同raw对照；一轮预热，五轮交替测量，校验完整原图mask后再报告。
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import { build } from 'esbuild';
import { root,work,report,sha } from './prepare.mjs';
import { reference } from './reference-postprocess.mjs';
await build({entryPoints:[path.join(root,'src/postprocess.ts')],bundle:true,platform:'node',format:'esm',outfile:path.join(work,'postprocess.mjs')});
const {postprocess}=await import(pathToFileURL(path.join(work,'postprocess.mjs')).href);
const cases=JSON.parse(await readFile(path.join(work,'raw-samples.json'),'utf8'));
const result={status:'failed',verifiedAt:new Date().toISOString(),environment:{node:process.version,cpu:os.cpus()[0].model,os:os.release()},scope:'固定序列第1、22、43图；独立Node环境，仅CPU后处理；不等于64图浏览器平均性能或FPS',warmups:1,repetitions:5,sourceSha256:sha(await readFile(path.join(root,'src/postprocess.ts'))),referenceSha256:sha(await readFile(path.join(root,'scripts/evaluation/reference-postprocess.mjs'))),cases:[]};
const median=list=>[...list].sort((a,b)=>a-b)[Math.floor(list.length/2)];
for(const item of cases) {
  const values=[];
  for(let i=0;i<4;i++){const bytes=await readFile(path.join(work,'raw-samples',String(item.imageId),i+'.f32'));assert.equal(sha(bytes),item.rawOutputs[i].sha256);values.push(new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));}
  for(const threshold of [.5,.01]) {
    const full=reference(values,item.width,item.height,threshold),roi=postprocess(values,item.width,item.height,{scoreThreshold:threshold,maxDetections:100});
    assert.equal(full.length,roi.length);let minMaskIoU=1;
    for(let i=0;i<roi.length;i++) {
      assert.equal(full[i].classId,roi[i].classId);assert.equal(full[i].score,roi[i].score);
      const mask=roi[i].mask;let intersection=0,union=0;
      for(let y=0;y<item.height;y++)for(let x=0;x<item.width;x++){
        const a=full[i].mask[y*item.width+x],b=x>=mask.x&&x<mask.x+mask.width&&y>=mask.y&&y<mask.y+mask.height?mask.data[(y-mask.y)*mask.width+x-mask.x]:0;intersection+=a&&b?1:0;union+=a||b?1:0;
      }
      const iou=union?intersection/union:1;minMaskIoU=Math.min(minMaskIoU,iou);assert.equal(iou,1,'同raw的全部原图二值mask必须完全相等');
    }
    const referenceMs=[],optimizedMs=[];
    for(let repeat=0;repeat<5;repeat++) {
      const functions=repeat%2?[['optimized',()=>postprocess(values,item.width,item.height,{scoreThreshold:threshold,maxDetections:100})],['reference',()=>reference(values,item.width,item.height,threshold)]]:[['reference',()=>reference(values,item.width,item.height,threshold)],['optimized',()=>postprocess(values,item.width,item.height,{scoreThreshold:threshold,maxDetections:100})]];
      for(const [name,fn] of functions){const start=performance.now();fn();(name==='reference'?referenceMs:optimizedMs).push(performance.now()-start);}
    }
    const entry={imageId:item.imageId,width:item.width,height:item.height,threshold,instances:roi.length,minMaskIoU,referenceMs,optimizedMs,referenceMedianMs:median(referenceMs),optimizedMedianMs:median(optimizedMs),speedup:median(referenceMs)/median(optimizedMs),fullMaskBytes:full.reduce((sum,row)=>sum+row.mask.length,0),roiMaskBytes:roi.reduce((sum,row)=>sum+row.mask.data.length,0),rawOutputs:item.rawOutputs};
    result.cases.push(entry);console.log(JSON.stringify(entry));
  }
}
result.status='passed';await writeFile(path.join(report,'postprocess-benchmark.json'),JSON.stringify(result,null,2)+'\n');
