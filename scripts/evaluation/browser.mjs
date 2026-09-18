// 公共dist SDK四模式验收；独立随机端口、显式资源白名单，顺序执行避免争用。
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { root, work, dataset, report, sha } from './prepare.mjs';

const lock=JSON.parse(await readFile(path.join(report,'dataset.lock.json'),'utf8'));
const metadata=JSON.parse(await readFile(path.join(root,'models/model.json'),'utf8'));
const lifecycleOnly=process.argv.includes('--lifecycle-only');
const prior=lifecycleOnly?JSON.parse(await readFile(path.join(report,'browser-execution.json'),'utf8')):null;
if(prior)assert.equal(prior.sdkSha256,lock.sdkSha256,'生命周期补测必须与256次推理使用同一dist');
const modelPath=path.join(root,'.tmp/model.onnx');
assert.equal(sha(await readFile(modelPath)),metadata.sha256);
assert.equal(sha(await readFile(path.join(work,'dist/index.js'))),lock.sdkSha256);
const assets=new Map([['/model.onnx',modelPath]]);
for(const name of await readdir(path.join(work,'dist'))) if(/\.(js|mjs|wasm)$/.test(name)) assets.set('/sdk/'+name,path.join(work,'dist',name));
for(const item of lock.cases) {
  assets.set('/rgba/'+item.imageId,path.join(dataset,'rgba',item.filename+'.rgba'));
  assets.set('/images/'+item.imageId,path.join(dataset,'images',item.filename));
}
const requests=[];
const gpuProbe=`const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('无WebGPU适配器');const info=adapter.info;const gpu={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,fallback:adapter.isFallbackAdapter??info.isFallbackAdapter};if(gpu.fallback!==false||/swiftshader|software|warp|llvmpipe/i.test(JSON.stringify(gpu)))throw new Error('拒绝软件或无法证明的适配器');`;
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1'), pathname=url.pathname;
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><meta charset="utf-8"><title>64图公共SDK验收</title>');return;}
    if(pathname==='/gpu-probe.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(gpuProbe+'postMessage(gpu);');return;}
    const file=assets.get(pathname);if(!file){res.writeHead(404).end();return;}
    if(pathname==='/model.onnx') requests.push({at:new Date().toISOString(),query:url.search});
    const mime=/\.(m?js)$/.test(pathname)?'text/javascript':pathname.endsWith('.wasm')?'application/wasm':pathname.startsWith('/images/')?'image/jpeg':'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'Content-Length':(await stat(file)).size,'Cache-Control':'no-store'});createReadStream(file).pipe(res);
  } catch(error){res.writeHead(500).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chromium',headless:true});
const context=await browser.newContext();
const execution={status:'failed',verifiedAt:new Date().toISOString(),environment:{browser:browser.version(),os:os.release(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ort:'1.27.0',headless:true},sdkSha256:lock.sdkSha256,workerSha256:lock.workerSha256,model:metadata,runOptions:{scoreThreshold:.01,nmsThreshold:.7,maxDetections:100},modes:[],lifecycle:[]};
if(prior)execution.lifecycleRerun={dataRunVerifiedAt:prior.verifiedAt,reason:'首轮wasm-main的10ms定时器未能在同步内核期间触发；保留初轮报告，补测确定触发的公共API取消及定时器时间观测',initialEvidence:'browser-execution-initial.json'};
try {
 for(const backend of ['wasm','webgpu']) for(const executionMode of ['main','worker']) {
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(origin);
  const setup=await page.evaluate(async({backend,executionMode,metadata,gpuProbe})=>{
    window.api=await import('/sdk/index.js');
    window.model={id:metadata.id,version:metadata.version,url:location.origin+'/model.onnx',bytes:metadata.bytes,sha256:metadata.sha256};
    window.options={backend,executionMode,model:window.model,runtimeBaseUrl:location.origin+'/sdk/'};
    let gpu=null;
    if(backend==='webgpu') {
      if(executionMode==='worker') gpu=await new Promise((resolve,reject)=>{const worker=new Worker('/gpu-probe.js',{type:'module'});worker.onmessage=event=>{resolve(event.data);worker.terminate();};worker.onerror=event=>{reject(new Error(event.message));worker.terminate();};});
      else gpu=await (new Function('return (async()=>{'+gpuProbe+'return gpu;})()'))();
    }
    window.sdk=window.api.createSegmentation(window.options);
    window.pixels=async item=>({width:item.width,height:item.height,data:new Uint8Array(await(await fetch('/rgba/'+item.imageId)).arrayBuffer())});
    window.pack=result=>({...result,instances:result.instances.map(instance=>{
      const {data,...mask}=instance.mask;let previous=0,length=0;const counts=[];
      for(const value of data){if(value!==0&&value!==1)throw new Error('mask非二值');if(value===previous)length++;else{counts.push(length);length=1;previous=value;}}counts.push(length);
      return {...instance,mask:{...mask,counts,encoding:'row-major-alternating-zero-one'}};
    })});
    const progress=[];await window.sdk.load({onProgress:event=>progress.push(event)});
    return {gpu,loadTimings:window.sdk.loadTimings,capabilities:window.sdk.capabilities,progress};
  },{backend,executionMode,metadata,gpuProbe});
  const mode={backend,executionMode,...setup,results:[]};
  for(const item of lifecycleOnly?[]:lock.cases) {
    const result=await page.evaluate(async item=>{
      const image=await window.pixels(item),before=image.data.byteLength;
      const result=await window.sdk.run({image},{scoreThreshold:.01,nmsThreshold:.7,maxDetections:100});
      if(image.data.byteLength!==before)throw new Error('调用者RGBA buffer被分离');
      if(result.instances.length>100||result.instances.some(x=>x.score<=.01))throw new Error('输出阈值/数量错误');
      if(Object.values(result.timings).some(x=>!Number.isFinite(x)||x<0))throw new Error('耗时错误');
      return {imageId:item.imageId,...window.pack(result)};
    },item);
    assert.equal(result.runtime.actualBackend,backend);assert.equal(result.runtime.executionMode,executionMode);
    mode.results.push(result);console.log(JSON.stringify({backend,executionMode,imageId:item.imageId,instances:result.instances.length,timings:result.timings}));
  }
  if(!lifecycleOnly){
    await mkdir(path.join(work,'raw'),{recursive:true});
    await writeFile(path.join(work,'raw',`${backend}-${executionMode}.json`),JSON.stringify(mode));
    await writeFile(path.join(report,`${backend}-${executionMode}-results.json.gz`),gzipSync(JSON.stringify(mode)));
  }
  const lifecycle=await page.evaluate(async item=>{
    const tests=[],observations=[];
    const check=(name,passed,detail)=>tests.push({name,passed,detail});
    const code=async(fn)=>{try{await fn();return 'NO_ERROR';}catch(error){return error.code??String(error);}};
    const image=await window.pixels(item);
    const blank=await window.sdk.run({image:{width:640,height:480,data:new Uint8Array(640*480*4).fill(255)}});
    check('空白图默认阈值',blank.instances.length===0,{instances:blank.instances.length});
    const blob=await(await fetch('/images/'+item.imageId)).blob();
    const blobResult=await window.sdk.run({image:blob});
    check('真实JPEG Blob',blob instanceof Blob&&blobResult.image.width===item.width&&blobResult.image.height===item.height&&blobResult.instances.length>0,{bytes:blob.size,instances:blobResult.instances.length,timings:blobResult.timings});
    const invalid=await code(()=>window.sdk.run({image:{width:0,height:1,data:new Uint8Array(4)}}));
    check('非法像素输入',invalid==='INVALID_INPUT',{code:invalid});
    const invalidOptions=await code(()=>window.sdk.run({image},{scoreThreshold:-1}));
    check('非法阈值',invalidOptions==='INVALID_INPUT',{code:invalidOptions});
    const active=window.sdk.run({image});
    const busy=await code(()=>window.sdk.run({image}));await active;
    check('并发run BUSY',busy==='BUSY',{code:busy});
    const controller=new AbortController();
    const pending=window.sdk.run({image},{signal:controller.signal});controller.abort();
    const aborted=await code(()=>pending);const recovered=await window.sdk.run({image});
    check('提交run后立即取消及恢复',aborted==='ABORTED'&&recovered.instances.length>0,{code:aborted,recovered:recovered.instances.length});
    const timerController=new AbortController(),timerStart=performance.now();let firedAt=null;
    const timed=window.sdk.run({image},{signal:timerController.signal});setTimeout(()=>{firedAt=performance.now()-timerStart;timerController.abort();},10);
    const timedCode=await code(()=>timed),settledAt=performance.now()-timerStart;
    await new Promise(resolve=>setTimeout(resolve,20));
    observations.push({name:'10ms定时器取消与主线程阻塞观测',code:timedCode,firedAt,settledAt,signalObservedBeforeResult:firedAt<=settledAt});
    if(window.options.executionMode==='worker')check('Worker活动run定时取消及恢复',timedCode==='ABORTED'&&(await window.sdk.run({image})).instances.length>0,{code:timedCode,firedAt,settledAt});
    const info=await window.api.getModelCacheInfo(window.model);
    check('真实IndexedDB模型缓存',info.entries===1&&info.bytes===window.model.bytes,info);
    await window.sdk.dispose();await window.sdk.dispose();
    const disposed=await code(()=>window.sdk.run({image}));
    check('重复dispose及禁止复用',disposed==='DISPOSED',{code:disposed});
    const cached=window.api.createSegmentation(window.options);await cached.load();
    check('缓存命中再次校验',cached.loadTimings.modelDownloadMs===0&&cached.loadTimings.integrityMs>0,{...cached.loadTimings});await cached.dispose();
    const unloaded=window.api.createSegmentation(window.options);
    const notLoaded=await code(()=>unloaded.run({image}));
    check('未load禁止run',notLoaded==='NOT_LOADED',{code:notLoaded});
    const loadAbort=new AbortController();loadAbort.abort();
    const preAborted=await code(()=>unloaded.load({signal:loadAbort.signal}));await unloaded.load();
    check('load预取消及恢复',preAborted==='ABORTED',{code:preAborted});await unloaded.dispose();
    const disposing=window.api.createSegmentation(window.options);await disposing.load();
    const inFlight=disposing.run({image});const disposal=disposing.dispose();
    const disposeCode=await code(()=>inFlight);await disposing.dispose();
    await disposal;check('提交run后dispose取消及重复释放',disposeCode==='ABORTED',{code:disposeCode});
    return {tests,observations};
  },lock.cases[0]);
  execution.lifecycle.push({backend,executionMode,...lifecycle});
  execution.modes.push(lifecycleOnly?{...prior.modes.find(x=>x.backend===backend&&x.executionMode===executionMode),lifecycleSetup:setup,lifecycleErrors:errors}:{backend,executionMode,...setup,images:mode.results.length,errors});
  await page.close();
 }
 const page=await context.newPage();await page.goto(origin);
 execution.cacheIsolation=await page.evaluate(async metadata=>{
   const api=await import('/sdk/index.js'),model={id:metadata.id,version:metadata.version,url:location.origin+'/model.onnx',bytes:metadata.bytes,sha256:metadata.sha256};
   const current=await api.getModelCacheInfo(model),other=await api.getModelCacheInfo({...model,version:'other-version'});
   await api.clearCurrentModelCache({...model,version:'other-version'});const preserved=await api.getModelCacheInfo(model);
   await api.clearCurrentModelCache(model);const cleared=await api.getModelCacheInfo(model);await api.clearAllModelCache();
   return {passed:current.entries===1&&other.entries===0&&preserved.entries===1&&cleared.entries===0,current,other,preserved,cleared};
 },metadata);await page.close();
 execution.status=execution.modes.length===4&&execution.modes.every(x=>x.images===64&&!x.errors.length&&!(x.lifecycleErrors??[]).length)&&execution.lifecycle.every(x=>x.tests.every(y=>y.passed))&&execution.cacheIsolation.passed?'passed':'failed';
} catch(error){execution.error=String(error.stack??error);console.error(error);}
finally {
 execution.modelRequests=requests;
 await writeFile(path.join(report,'browser-execution.json'),JSON.stringify(execution,null,2)+'\n');
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
if(execution.status!=='passed')process.exitCode=1;
