// 对照已归档四输出、实验全图恢复和Paddle官方mask；不重新推理模型。
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [archive, python, referenceModule] = process.argv.slice(2);
if (!archive || !python || !referenceModule) throw Error('参数：归档目录 Python解释器 实验postprocess.mjs');
const work = resolve('.tmp/numeric-reference');
mkdirSync(work, { recursive: true });
execFileSync(python, ['-c', `
from pathlib import Path
import sys
import numpy as np
for file in (Path(sys.argv[1])/'reference').glob('*.npz'):
    np.load(file)['masks'].astype(np.uint8).tofile(Path(sys.argv[2])/(file.stem+'.u8'))
`, archive, work]);
await build({ entryPoints:['src/postprocess.ts'], bundle:true, platform:'node', format:'esm', outfile:work+'/postprocess.mjs' });
const { postprocess } = await import(pathToFileURL(work+'/postprocess.mjs'));
const { selectInstances, recoverMasks } = await import(pathToFileURL(resolve(referenceModule)));
const cases = JSON.parse(readFileSync(archive+'/cases.json'));
const results = [];
for (const backend of ['wasm', 'webgpu']) for (const item of cases) {
  const values = Array.from({ length:4 }, (_, i) => {
    const bytes = readFileSync(`${archive}/browser-output/${backend}/${item.id}/raw${i}.f32`);
    return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  });
  const referenceStart = performance.now();
  const rows = selectInstances(values).slice(0, 100);
  const full = recoverMasks(values, rows, item.width, item.height), referenceMs = performance.now()-referenceStart;
  const started = performance.now(), actual = postprocess(values, item.width, item.height, {}), optimizedMs = performance.now()-started;
  const official = readFileSync(`${work}/${item.id}.u8`), pixels = item.width*item.height;
  let referenceMismatches = 0, minimumOfficialIoU = 1;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i].classId !== rows[i].label || actual[i].score !== rows[i].score) throw Error('类别或分数不匹配');
    const expanded = new Uint8Array(pixels), mask = actual[i].mask;
    for (let y = 0; y < mask.height; y++) expanded.set(mask.data.subarray(y*mask.width, (y+1)*mask.width), (y+mask.y)*item.width+mask.x);
    let intersection = 0, union = 0;
    for (let p = 0; p < pixels; p++) {
      if (expanded[p] !== full[i][p]) referenceMismatches++;
      if (expanded[p] && official[i*pixels+p]) intersection++;
      if (expanded[p] || official[i*pixels+p]) union++;
    }
    minimumOfficialIoU = Math.min(minimumOfficialIoU, union ? intersection/union : 1);
  }
  if (actual.length !== rows.length || referenceMismatches || minimumOfficialIoU < 0.99) throw Error(JSON.stringify({ backend, id:item.id, referenceMismatches, minimumOfficialIoU }));
  results.push({ backend, id:item.id, instances:actual.length, referenceMs, optimizedMs,
    referenceBytes:full.reduce((sum, mask) => sum+mask.length, 0), roiBytes:actual.reduce((sum, row) => sum+row.mask.data.length, 0), referenceMismatches, minimumOfficialIoU });
}
mkdirSync('reports/2026-09-18-image-sdk', { recursive:true });
writeFileSync('reports/2026-09-18-image-sdk/numeric.json', JSON.stringify({ date:new Date().toISOString(),
  environment:{ node:process.version, platform:process.platform, architecture:process.arch },
  scope:'归档浏览器四输出的Node后处理比较；单次耗时仅作观察，不代表浏览器端到端性能或COCO AP。', results }, null, 2)+'\n');
console.log(JSON.stringify({ comparisons:results.length, instances:results.reduce((sum, row) => sum+row.instances, 0), minimumOfficialIoU:Math.min(...results.map(row => row.minimumOfficialIoU)), referenceMismatches:results.reduce((sum, row) => sum+row.referenceMismatches, 0) }));
