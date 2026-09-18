import type { PixelImage } from './types';
import { SegmentationError, wrapError } from './errors';

export function validatePixels(image:PixelImage):void {
  if (!image || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
    || image.width <= 0 || image.height <= 0 || image.width * image.height > 16777216
    || !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)
    || image.data.length !== image.width * image.height * 4) {
    throw new SegmentationError('INVALID_INPUT', '图片需要正整数尺寸、完整RGBA数据且不超过16777216像素');
  }
}

function cubic(x:number):number {
  x = Math.abs(x);
  return x <= 1 ? (1.25 * x - 2.25) * x * x + 1
    : x < 2 ? ((-0.75 * x + 3.75) * x - 6) * x + 3 : 0;
}

function cubicAxis(size:number) {
  const indices = new Int32Array(640 * 4), weights = new Float64Array(640 * 4);
  for (let x = 0; x < 640; x++) {
    const source = (x + 0.5) * size / 640 - 0.5, base = Math.floor(source);
    for (let k = 0; k < 4; k++) {
      indices[x * 4 + k] = Math.max(0, Math.min(size - 1, base + k - 1));
      weights[x * 4 + k] = cubic(source - (base + k - 1));
    }
  }
  return { indices, weights };
}

export function preprocess(image:PixelImage):Float32Array {
  validatePixels(image);
  try {
    const horizontal = cubicAxis(image.width), vertical = cubicAxis(image.height);
    const result = new Float32Array(3 * 640 * 640);
    // 只缓存当前四条水平插值扫描线，极宽/极高输入不产生整图浮点副本。
    const rows = Array.from({ length:4 }, () => new Float64Array(3 * 640));
    const rowIds = new Int32Array(4).fill(-1);
    for (let y = 0; y < 640; y++) {
      for (let k = 0; k < 4; k++) {
        const sourceY = vertical.indices[y * 4 + k], slot = sourceY % 4;
        if (rowIds[slot] === sourceY) continue;
        rowIds[slot] = sourceY;
        const row = rows[slot];
        for (let x = 0; x < 640; x++) for (let c = 0; c < 3; c++) {
          let value = 0;
          for (let j = 0; j < 4; j++) {
            const pixel = (sourceY * image.width + horizontal.indices[x * 4 + j]) * 4;
            const alpha = image.data[pixel + 3] / 255;
            value += (image.data[pixel + c] * alpha + 255 * (1 - alpha)) * horizontal.weights[x * 4 + j];
          }
          row[c * 640 + x] = value;
        }
      }
      for (let c = 0; c < 3; c++) for (let x = 0; x < 640; x++) {
        let value = 0;
        for (let k = 0; k < 4; k++) value += rows[vertical.indices[y * 4 + k] % 4][c * 640 + x] * vertical.weights[y * 4 + k];
        result[c * 409600 + y * 640 + x] = Math.min(255, Math.max(0, Math.round(value))) / 255;
      }
    }
    return result;
  } catch (error) { throw wrapError(error, 'OUT_OF_MEMORY', '预处理缓冲区分配失败'); }
}
