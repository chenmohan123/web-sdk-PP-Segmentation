import type { InstanceMask, RunOptions, SegmentationInstance } from './types';
import { checkAbort, SegmentationError, wrapError } from './errors';
import { COCO_LABELS } from './labels';

const ANCHORS = 8400, PLANE = 25600, MASK_BUDGET = 64 * 1024 * 1024;
interface Candidate { index:number; classId:number; score:number; x1:number; y1:number; x2:number; y2:number; area:number }
const clamp = (value:number, max:number) => Math.max(0, Math.min(max, value));
const emptyMask = ():InstanceMask => ({ x:0, y:0, width:0, height:0, data:new Uint8Array(0) });

function intersectionOverUnion(a:Candidate, b:Candidate):number {
  const overlap = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1))
    * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return overlap / Math.max(1e-12, a.area + b.area - overlap);
}

function select(values:Float32Array[], scoreThreshold:number, nmsThreshold:number, maxDetections:number):Candidate[] {
  const [boxes, scores] = values, all:Candidate[] = [];
  for (let classId = 0; classId < 80; classId++) {
    const candidates:Candidate[] = [];
    for (let index = 0; index < ANCHORS; index++) {
      const score = scores[classId * ANCHORS + index];
      if (score <= scoreThreshold) continue;
      const [x1, y1, x2, y2] = boxes.subarray(index * 4, index * 4 + 4);
      candidates.push({ index, classId, score, x1, y1, x2, y2, area:Math.max(0, x2-x1) * Math.max(0, y2-y1) });
    }
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    const kept:Candidate[] = [];
    for (let i = 0; i < Math.min(1000, candidates.length); i++) {
      const next = candidates[i];
      if (kept.every(previous => intersectionOverUnion(next, previous) <= nmsThreshold)) kept.push(next);
      // 单类多于最终上限的结果不可能进入全局前列。
      if (kept.length === maxDetections) break;
    }
    all.push(...kept);
  }
  return all.sort((a, b) => b.score-a.score || a.classId-b.classId || a.index-b.index).slice(0, maxDetections);
}

function linearAxis(sourceSize:number, targetSize:number) {
  const low = new Uint16Array(targetSize), high = new Uint16Array(targetSize), weight = new Float64Array(targetSize);
  for (let i = 0; i < targetSize; i++) {
    const source = clamp((i + 0.5) * sourceSize / targetSize - 0.5, sourceSize - 1);
    low[i] = Math.floor(source); high[i] = Math.min(low[i] + 1, sourceSize - 1); weight[i] = source - low[i];
  }
  return { low, high, weight };
}

function recover(values:Float32Array[], row:Candidate, width:number, height:number,
  logits:Float64Array, probability:Float32Array, crop:Float32Array, axis:ReturnType<typeof linearAxis>, remaining:number):InstanceMask {
  const left = clamp(Math.ceil(row.x1), 640), top = clamp(Math.ceil(row.y1), 640);
  const right = clamp(Math.ceil(row.x2), 640), bottom = clamp(Math.ceil(row.y2), 640);
  if (left >= right || top >= bottom) return emptyMask();
  logits.fill(0); crop.fill(0);
  // 通道外循环连续读取原型，避免逐像素跨32个大平面的随机访问。
  for (let c = 0; c < 32; c++) {
    const coefficient = values[2][c * ANCHORS + row.index];
    if (coefficient === 0) continue;
    const offset = c * PLANE;
    for (let p = 0; p < PLANE; p++) logits[p] += coefficient * values[3][offset + p];
  }
  for (let p = 0; p < PLANE; p++) probability[p] = 1 / (1 + Math.exp(-Math.max(-80, Math.min(80, logits[p]))));
  // 保留160→640浮点量化，再裁剪；只计算裁剪内的640像素。
  for (let y = top; y < bottom; y++) {
    const y0 = axis.low[y] * 160, y1 = axis.high[y] * 160, fy = axis.weight[y];
    for (let x = left; x < right; x++) {
      const x0 = axis.low[x], x1 = axis.high[x], fx = axis.weight[x];
      const a = probability[y0+x0] * (1-fx) + probability[y0+x1] * fx;
      const b = probability[y1+x0] * (1-fx) + probability[y1+x1] * fx;
      crop[y*640+x] = a * (1-fy) + b * fy;
    }
  }
  // 第二次插值可能跨过框边缘，先取包含完整插值支撑的范围，再收紧二值ROI。
  const xStart = clamp(Math.floor((left-1) * width/640), width), xEnd = clamp(Math.ceil((right+1)*width/640), width);
  const yStart = clamp(Math.floor((top-1)*height/640), height), yEnd = clamp(Math.ceil((bottom+1)*height/640), height);
  const scanWidth = xEnd-xStart, temporary = new Uint8Array(scanWidth * (yEnd-yStart));
  let minX = xEnd, minY = yEnd, maxX = -1, maxY = -1;
  for (let y = yStart; y < yEnd; y++) {
    const sy = clamp((y+0.5)*640/height-0.5, 639), y0 = Math.floor(sy), y1 = Math.min(639, y0+1), fy = sy-y0;
    for (let x = xStart; x < xEnd; x++) {
      const sx = clamp((x+0.5)*640/width-0.5, 639), x0 = Math.floor(sx), x1 = Math.min(639, x0+1), fx = sx-x0;
      const a = crop[y0*640+x0]*(1-fx)+crop[y0*640+x1]*fx;
      const b = crop[y1*640+x0]*(1-fx)+crop[y1*640+x1]*fx;
      if (Math.fround(a*(1-fy)+b*fy) > 0.5) {
        temporary[(y-yStart)*scanWidth+x-xStart] = 1;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return emptyMask();
  // 有前景时，ROI边界与原图中的检测框一致，框内插值为0的像素也要保留。
  // 这样宿主可用 mask.x/y 与 box 对齐，不需要猜测紧致前景的偏移。
  const roiLeft = clamp(Math.floor(row.x1 * width / 640), width);
  const roiTop = clamp(Math.floor(row.y1 * height / 640), height);
  const roiRight = clamp(Math.ceil(row.x2 * width / 640), width);
  const roiBottom = clamp(Math.ceil(row.y2 * height / 640), height);
  const roiWidth = roiRight-roiLeft, roiHeight = roiBottom-roiTop;
  if (roiWidth*roiHeight > remaining) throw new SegmentationError('OUT_OF_MEMORY', '返回掩码累计超过64MiB');
  const data = new Uint8Array(roiWidth*roiHeight);
  for (let y = 0; y < roiHeight; y++) {
    const sourceY = roiTop + y;
    if (sourceY < yStart || sourceY >= yEnd) continue;
    const start = (sourceY-yStart)*scanWidth + Math.max(0, roiLeft-xStart);
    const sourceX = Math.max(roiLeft, xStart);
    const copyWidth = Math.min(roiRight, xEnd)-sourceX;
    if (copyWidth > 0) data.set(temporary.subarray(start, start+copyWidth), y*roiWidth+sourceX-roiLeft);
  }
  return { x:roiLeft, y:roiTop, width:roiWidth, height:roiHeight, data };
}

export function postprocess(values:Float32Array[], width:number, height:number, options:RunOptions = {}):SegmentationInstance[] {
  const scoreThreshold = options.scoreThreshold ?? 0.5, nmsThreshold = options.nmsThreshold ?? 0.7, maxDetections = options.maxDetections ?? 100;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width*height > 16777216
    || !Number.isFinite(scoreThreshold) || scoreThreshold < 0 || scoreThreshold > 1
    || !Number.isFinite(nmsThreshold) || nmsThreshold < 0 || nmsThreshold > 1
    || !Number.isInteger(maxDetections) || maxDetections < 1 || maxDetections > 300) {
    throw new SegmentationError('INVALID_INPUT', '图片尺寸或分割阈值、数量上限无效');
  }
  checkAbort(options.signal);
  const lengths = [ANCHORS*4, ANCHORS*80, ANCHORS*32, 32*PLANE];
  if (!Array.isArray(values) || values.length !== 4 || values.some((value, i) => !(value instanceof Float32Array) || value.length !== lengths[i])) {
    throw new SegmentationError('INFERENCE', '模型输出布局与固定分割头不符');
  }
  for (const value of values) for (let i = 0; i < value.length; i++) {
    if (!Number.isFinite(value[i])) throw new SegmentationError('INFERENCE', '模型输出包含非有限数值');
  }
  try {
    const selected = select(values, scoreThreshold, nmsThreshold, maxDetections);
    if (!selected.length) return [];
    const logits = new Float64Array(PLANE), probability = new Float32Array(PLANE), crop = new Float32Array(640*640);
    const axis = linearAxis(160, 640), results:SegmentationInstance[] = [];
    let bytes = 0;
    for (const row of selected) {
      checkAbort(options.signal);
      const mask = recover(values, row, width, height, logits, probability, crop, axis, MASK_BUDGET-bytes);
      bytes += mask.data.length;
      const x = clamp(row.x1*width/640, width), y = clamp(row.y1*height/640, height);
      results.push({ classId:row.classId, label:COCO_LABELS[row.classId], score:row.score,
        box:{ x, y, width:Math.max(0, clamp(row.x2*width/640, width)-x), height:Math.max(0, clamp(row.y2*height/640, height)-y) }, mask });
    }
    return results;
  } catch (error) { throw wrapError(error, 'OUT_OF_MEMORY', '掩码缓冲区分配失败'); }
}
