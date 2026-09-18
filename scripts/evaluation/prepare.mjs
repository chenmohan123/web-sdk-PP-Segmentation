// 使用产品预处理生成官方基线输入，并冻结本次浏览器验收资产。
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export const root = path.resolve(import.meta.dirname, '../..');
export const work = path.join(root, '.tmp/acceptance-20260918');
export const dataset = path.resolve(root, '../web-sdk-PP-Detection/.tmp/phase2/dataset');
export const report = path.join(root, 'reports/2026-09-18-image-sdk');
export const sha = data => createHash('sha256').update(data).digest('hex');
if (process.argv[1] === import.meta.filename) {
  await mkdir(path.join(work, 'inputs'), { recursive:true });
  await mkdir(report, { recursive:true });
  await build({ entryPoints:[path.join(root,'src/preprocess.ts')], bundle:true, platform:'node', format:'esm', outfile:path.join(work,'preprocess.mjs') });
  const { preprocess } = await import(pathToFileURL(path.join(work,'preprocess.mjs')).href);
  const cases = JSON.parse(await readFile(path.join(dataset,'images.lock.json'),'utf8'));
  if(cases.length!==64) throw new Error('固定数据必须为64张');
  for(const item of cases) {
    const pixels=await readFile(path.join(dataset,'rgba',item.filename+'.rgba'));
    if(pixels.length!==item.width*item.height*4) throw new Error('RGBA尺寸错误');
    const tensor=preprocess({width:item.width,height:item.height,data:new Uint8Array(pixels)});
    const bytes=Buffer.from(tensor.buffer);
    await writeFile(path.join(work,'inputs',item.imageId+'.f32'),bytes);
    item.rgbaSha256=sha(pixels); item.tensorSha256=sha(bytes);
  }
  await cp(path.join(root,'dist'),path.join(work,'dist'),{recursive:true});
  const sourceSha256={};
  for(const name of await readdir(path.join(root,'src'))) if(name.endsWith('.ts')) sourceSha256['src/'+name]=sha(await readFile(path.join(root,'src',name)));
  const evidence={ createdAt:new Date().toISOString(), sourceSha256, preprocessing:'产品src/preprocess.ts编译后直接运行；固定浏览器RGBA；RGB bicubic A=-0.75，640×640，uint8量化，Float32 NCHW /255',
    preprocessSha256:sha(await readFile(path.join(root,'src/preprocess.ts'))), sdkSha256:sha(await readFile(path.join(work,'dist/index.js'))), workerSha256:sha(await readFile(path.join(work,'dist/inference.worker.js'))), annotationsSha256:sha(await readFile(path.join(dataset,'annotations.json'))), cases };
  await writeFile(path.join(report,'dataset.lock.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log('已生成64张同输入tensor及冻结dist');
}
