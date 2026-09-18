// 检查归档完整性与摘要来源；证据完整不等于严格数值验收通过。
import assert from 'node:assert/strict';
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { root,report,sha } from './prepare.mjs';
const json=async name=>JSON.parse(await readFile(path.join(report,name),'utf8'));
const lock=await json('dataset.lock.json'),acceptance=await json('acceptance.json'),browser=await json('browser-execution.json');
assert.equal(lock.cases.length,64);assert.equal(acceptance.dataset.annotations,716);assert.equal(browser.modes.length,4);
assert.equal(browser.sdkSha256,lock.sdkSha256);assert.equal(browser.workerSha256,lock.workerSha256);
for(const [name,hash] of Object.entries(lock.sourceSha256))assert.equal(sha(await readFile(path.join(root,name))),hash,'被测源码已改变：'+name);
for(const backend of ['wasm','webgpu'])for(const mode of ['main','worker']){
  const data=JSON.parse(gunzipSync(await readFile(path.join(report,`${backend}-${mode}-results.json.gz`))));
  assert.equal(data.results.length,64);assert.deepEqual(data.results.map(x=>x.imageId),lock.cases.map(x=>x.imageId));
  for(const row of data.results){assert.equal(row.runtime.actualBackend,backend);assert.equal(row.runtime.executionMode,mode);assert(row.instances.length<=100);for(const item of row.instances){assert(item.score>.01);assert.equal(item.mask.counts.reduce((a,b)=>a+b,0),item.mask.width*item.mask.height);}}
}
const strictPassed=Object.values(acceptance.modes).every(x=>x.passed)&&Object.values(acceptance.mainWorker).every(x=>x.passed)&&browser.status==='passed'&&acceptance.postprocessBenchmarkStatus==='passed';
assert.equal(acceptance.status,strictPassed?'passed':'failed');
const files=[];
for(const name of (await readdir(report,{withFileTypes:true})).filter(x=>x.isFile()).map(x=>x.name).sort()){
  if(name==='evidence-integrity.json')continue;
  const bytes=await readFile(path.join(report,name));files.push({name,bytes:bytes.length,sha256:sha(bytes)});
}
const result={verifiedAt:new Date().toISOString(),evidenceIntegrityStatus:'passed',strictAcceptanceStatus:acceptance.status,imagesPerMode:64,inferenceMatrixRuns:256,files};
await writeFile(path.join(report,'evidence-integrity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({evidenceIntegrityStatus:result.evidenceIntegrityStatus,strictAcceptanceStatus:result.strictAcceptanceStatus,files:files.length}));
