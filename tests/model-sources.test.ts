import { describe, expect, it } from "vitest";
import {
  resolveDemoModel,
  resolvePublishedModel,
} from "../demo/src/model-sources";

const sha256 = "a".repeat(64);
const baseModel = {
  id: "segmentation-fixture",
  version: "0.0.0-test",
  file: "fixture.onnx",
  bytes: 123,
  sha256,
  defaultSource: "modelscope",
};
const source = (kind: "modelscope" | "huggingface") => ({
  kind,
  repository: "example/segmentation-fixture",
  // 测试夹具只验证不可变格式，不代表真实发布 revision。
  revision: kind === "modelscope" ? "1".repeat(40) : "2".repeat(40),
  path: "models/fixture.onnx",
  downloadUrl:
    kind === "modelscope"
      ? `https://www.modelscope.cn/models/example/segmentation-fixture/resolve/${"1".repeat(40)}/models/fixture.onnx`
      : `https://huggingface.co/example/segmentation-fixture/resolve/${"2".repeat(40)}/models/fixture.onnx`,
  bytes: 123,
  sha256,
});

describe("Demo 模型来源解析", () => {
  it("空来源保留未发布事实，生产不可运行", () => {
    const result = resolvePublishedModel({ ...baseModel, sources: [] });
    expect(result).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" });
  });

  it("缺失数组、未知来源及错误摘要均明确拒绝", () => {
    expect(resolvePublishedModel(baseModel)).toEqual({
      ok: false,
      code: "INVALID_MODEL_SOURCES",
    });
    expect(
      resolvePublishedModel(
        { ...baseModel, sources: [source("modelscope")] },
        "custom",
      ),
    ).toEqual({ ok: false, code: "INVALID_SOURCE_SELECTION" });
    expect(
      resolvePublishedModel({
        ...baseModel,
        sources: [{ ...source("modelscope"), sha256: "b".repeat(64) }],
      }),
    ).toEqual({ ok: false, code: "INVALID_MODEL_SOURCE" });
  });

  it("拒绝来源重复、大小不一致及下载地址与声明不一致", () => {
    const modelscope = source("modelscope");
    for (const sources of [
      [modelscope, modelscope],
      [{ ...modelscope, bytes: 124 }],
      [{ ...modelscope, repository: "other/fixture" }],
      [{ ...modelscope, path: "other/fixture.onnx" }],
      [{ ...modelscope, revision: "3".repeat(40) }],
    ])
      expect(resolvePublishedModel({ ...baseModel, sources })).toEqual({
        ok: false,
        code: "INVALID_MODEL_SOURCE",
      });
  });

  it("拒绝错误Hub、凭据、查询片段及可变引用", () => {
    const modelscope = source("modelscope");
    const invalidUrls = [
      modelscope.downloadUrl.replace("www.modelscope.cn", "example.org"),
      modelscope.downloadUrl.replace("https://", "https://user:secret@"),
      `${modelscope.downloadUrl}?download=1`,
      `${modelscope.downloadUrl}#model`,
      modelscope.downloadUrl.replace("1".repeat(40), "main"),
      modelscope.downloadUrl.replace(
        "www.modelscope.cn/models",
        "huggingface.co",
      ),
    ];
    for (const downloadUrl of invalidUrls)
      expect(
        resolvePublishedModel({
          ...baseModel,
          sources: [{ ...modelscope, downloadUrl }],
        }),
      ).toEqual({ ok: false, code: "INVALID_MODEL_SOURCE" });
  });

  it("默认选择 ModelScope，显式选择 Hugging Face", () => {
    const sources = [source("huggingface"), source("modelscope")];
    const defaultResult = resolvePublishedModel({ ...baseModel, sources });
    const explicitResult = resolvePublishedModel(
      { ...baseModel, sources },
      "huggingface",
    );
    expect(defaultResult.ok && defaultResult.source.kind).toBe("modelscope");
    expect(explicitResult.ok && explicitResult.source.kind).toBe("huggingface");
    expect(explicitResult.ok && explicitResult.model).toMatchObject({
      id: baseModel.id,
      version: baseModel.version,
      url: source("huggingface").downloadUrl,
      bytes: baseModel.bytes,
      sha256,
    });
  });

  it("拒绝会被浏览器规范化的点路径段", () => {
    const valid = source("modelscope");
    for (const [repository, path] of [
      [valid.repository, "models/../fixture.onnx"],
      [valid.repository, "./fixture.onnx"],
      ["../fixture", valid.path],
    ]) {
      const downloadUrl = `https://www.modelscope.cn/models/${repository}/resolve/${valid.revision}/${path}`;
      expect(
        resolvePublishedModel({
          ...baseModel,
          sources: [{ ...valid, repository, path, downloadUrl }],
        }),
      ).toEqual({ ok: false, code: "INVALID_MODEL_SOURCE" });
    }
  });

  it("显式来源缺失时不自动回退到另一来源", () => {
    expect(
      resolvePublishedModel(
        { ...baseModel, sources: [source("modelscope")] },
        "huggingface",
      ),
    ).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" });
  });

  it("本地开发覆盖保持显式，生产仍受正式来源约束", () => {
    const unpublished = { ...baseModel, sources: [] };
    const local = resolveDemoModel(
      unpublished,
      "modelscope",
      true,
      "https://demo.example/app/",
    );
    expect(local.ok && local.mode).toBe("local");
    expect(local.ok && local.model.url).toBe(
      "https://demo.example/app/local-model/model.onnx",
    );
    expect(
      resolveDemoModel(
        unpublished,
        "modelscope",
        false,
        "https://demo.example/app/",
      ),
    ).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" });
  });
});
