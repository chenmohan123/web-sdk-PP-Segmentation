import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { preprocess, validatePixels } from "../src/preprocess";
import { postprocess, validateRunOptions } from "../src/postprocess";
import type { PixelImage, RunOptions } from "../src/types";

const N = 8400;
function outputs() {
  return [
    new Float32Array(N * 4),
    new Float32Array(N * 80),
    new Float32Array(N * 32),
    new Float32Array(32 * 160 * 160),
  ];
}
function candidate(
  values: Float32Array[],
  index: number,
  classId: number,
  score: number,
  box = [0, 0, 640, 640],
) {
  values[0].set(box, index * 4);
  values[1][classId * N + index] = score;
  values[2][index] = 1;
}

describe("像素预处理", () => {
  it.each([
    { width: 0, height: 1, data: new Uint8Array(0) },
    { width: 1.2, height: 1, data: new Uint8Array(4) },
    { width: 1, height: Infinity, data: new Uint8Array(4) },
    { width: 16777217, height: 1, data: new Uint8Array(4) },
    { width: 1, height: 1, data: new Uint8Array(5) },
    { width: 1, height: 1, data: new Float32Array(4) },
    null,
  ])("拒绝非法尺寸、缓冲区和超限输入 %j", (image) => {
    expect(() => validatePixels(image as PixelImage)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
  it("透明像素在缩放前合成白底且不改写调用方数据", () => {
    const data = new Uint8ClampedArray([17, 23, 99, 0]);
    const result = preprocess({ width: 1, height: 1, data });
    expect(result.length).toBe(3 * 640 * 640);
    expect(result.every((value) => value === 1)).toBe(true);
    expect(Array.from(data)).toEqual([17, 23, 99, 0]);
  });
  it("半透明颜色量化后按RGB的NCHW排列", () => {
    const result = preprocess({
      width: 1,
      height: 1,
      data: new Uint8Array([255, 0, 0, 128]),
    });
    expect(result[0]).toBe(1);
    expect(result[640 * 640]).toBeCloseTo(127 / 255, 7);
    expect(result[2 * 640 * 640]).toBeCloseTo(127 / 255, 7);
  });
  it("bicubic负旁瓣不同于双线性且钳制到uint8", () => {
    const result = preprocess({
      width: 4,
      height: 1,
      data: new Uint8Array([
        0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      ]),
    });
    // x=280对应源1.253125，A=-0.75的三次核得到58.627848，量化为59。
    expect(result[280]).toBeCloseTo(59 / 255, 7);
    expect(result[180]).toBe(0);
    expect(result[459]).toBe(1);
  });
});

describe("实例筛选与掩码恢复", () => {
  it("全零分数返回空数组", () =>
    expect(postprocess(outputs(), 2, 2, {})).toEqual([]));
  it("使用COCO连续类别，逐类NMS且严格排除阈值相等分数", () => {
    const values = outputs();
    values[3].fill(10, 0, 25600);
    candidate(values, 0, 0, 0.9);
    candidate(values, 1, 0, 0.8);
    candidate(values, 2, 79, 0.85);
    candidate(values, 3, 1, 0.5);
    const result = postprocess(values, 2, 2, {});
    expect(result.map((row) => [row.classId, row.label])).toEqual([
      [0, "person"],
      [79, "toothbrush"],
    ]);
    expect(result[0].mask).toMatchObject({ x: 0, y: 0, width: 2, height: 2 });
    expect(result[0].mask.data).toEqual(new Uint8Array([1, 1, 1, 1]));
    expect(postprocess(values, 2, 2, { maxDetections: 1 })).toHaveLength(1);
    expect(postprocess(values, 2, 2, { nmsThreshold: 1 })).toHaveLength(3);
  });
  it("独立2×2对角夹具保留两处掩码", () => {
    const values = outputs();
    candidate(values, 0, 2, 0.9);
    for (let y = 0; y < 160; y++)
      for (let x = 0; x < 160; x++)
        values[3][y * 160 + x] = x < 80 === y < 80 ? 10 : -10;
    expect(postprocess(values, 2, 2, {})[0].mask.data).toEqual(
      new Uint8Array([1, 0, 0, 1]),
    );
  });
  it("裁剪发生在640网格，ROI保留第二次插值产生的边缘", () => {
    const values = outputs();
    candidate(values, 0, 0, 0.9, [319.1, 0, 320.9, 640]);
    values[3].fill(10, 0, 25600);
    const result = postprocess(values, 1280, 2, {})[0];
    expect(result.mask).toMatchObject({ x: 640, y: 0, width: 2, height: 2 });
    expect(result.mask.data).toEqual(new Uint8Array([1, 1, 1, 1]));
  });
  it.each([
    {
      width: 6400,
      height: 1,
      box: [319.1, 0, 320.1, 640],
      mask: { x: 3200, y: 0, width: 10, height: 1 },
    },
    {
      width: 1,
      height: 6400,
      box: [0, 319.1, 640, 320.1],
      mask: { x: 0, y: 3200, width: 1, height: 10 },
    },
  ])("放大十倍时保留检测框外的插值前景 %j", ({ width, height, box, mask }) => {
    const values = outputs();
    candidate(values, 0, 0, 0.9, box);
    values[3].fill(10, 0, 25600);
    // 640网格只有第320列/行非零；十倍插值后3200..3209严格大于0.5。
    const result = postprocess(values, width, height, {})[0];
    expect(result.mask).toMatchObject(mask);
    expect(result.mask.data).toEqual(
      new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    );
  });
  it("空mask和越界框保留实例并钳制框", () => {
    const values = outputs();
    candidate(values, 0, 0, 0.9, [-10, -5, 650, 680]);
    const result = postprocess(values, 3, 4, {})[0];
    expect(result.box).toEqual({ x: 0, y: 0, width: 3, height: 4 });
    expect(result.mask).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      data: new Uint8Array(0),
    });
  });
  it.each([
    { scoreThreshold: -0.1 },
    { scoreThreshold: NaN },
    { nmsThreshold: 1.1 },
    { maxDetections: 0 },
    { maxDetections: 301 },
    { maxDetections: 1.1 },
  ])("拒绝非法运行选项 %j", (options) => {
    expect(() => validateRunOptions(options as RunOptions)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    expect(() =>
      postprocess(outputs(), 2, 2, options as RunOptions),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
  it("推理前参数校验接受默认值与闭区间边界", () => {
    expect(() => validateRunOptions({})).not.toThrow();
    expect(() =>
      validateRunOptions({
        scoreThreshold: 0,
        nmsThreshold: 1,
        maxDetections: 300,
      }),
    ).not.toThrow();
  });
  it("拒绝张量布局不符和非有限输出", () => {
    const values = outputs();
    values[1][0] = NaN;
    expect(() => postprocess(values, 2, 2, {})).toThrowError(
      expect.objectContaining({ code: "INFERENCE" }),
    );
    expect(() => postprocess([new Float32Array(4)], 2, 2, {})).toThrowError(
      expect.objectContaining({ code: "INFERENCE" }),
    );
  });
  it("返回mask累计超过64MiB时明确失败而非丢弃实例", () => {
    const values = outputs();
    values[3].fill(10, 0, 25600);
    for (let i = 0; i < 5; i++) candidate(values, i, i, 0.9);
    expect(() => postprocess(values, 4096, 4096, {})).toThrowError(
      expect.objectContaining({ code: "OUT_OF_MEMORY" }),
    );
  }, 15000);
  it("真实32通道夹具与归档官方mask一致", () => {
    const fixture = JSON.parse(
      gunzipSync(
        readFileSync(
          new URL("./fixtures/official-bottle.json.gz", import.meta.url),
        ),
      ).toString(),
    );
    const values = outputs();
    candidate(values, 0, fixture.classId, fixture.score, fixture.box640);
    for (let c = 0; c < 32; c++) {
      values[2][c * N] = fixture.coefficients[c];
      for (let y = 0; y < fixture.proto.height; y++) {
        const offset = (c * fixture.proto.height + y) * fixture.proto.width;
        values[3].set(
          fixture.prototypes.slice(offset, offset + fixture.proto.width),
          c * 25600 + (fixture.proto.y + y) * 160 + fixture.proto.x,
        );
      }
    }
    const result = postprocess(values, fixture.width, fixture.height, {})[0];
    expect(result.classId).toBe(39);
    expect(result.label).toBe("bottle");
    const actual = new Uint8Array(fixture.width * fixture.height);
    for (let y = 0; y < result.mask.height; y++)
      actual.set(
        result.mask.data.subarray(
          y * result.mask.width,
          (y + 1) * result.mask.width,
        ),
        (result.mask.y + y) * fixture.width + result.mask.x,
      );
    const expected = new Uint8Array(actual.length);
    for (const [start, length] of fixture.foregroundRuns)
      expected.fill(1, start, start + length);
    expect(actual).toEqual(expected);
  });
});
