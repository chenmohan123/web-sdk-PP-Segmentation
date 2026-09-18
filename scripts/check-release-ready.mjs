// 只读检查真实发布回执及当前产物；不生成或补写通过标记。
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { parse } from "yaml";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const report = "reports/2026-09-18-release-readiness";
const pkg = await json("package.json");
const model = await json("models/model.json");
const manifest = parse(await readFile("sdk-manifest.yaml", "utf8"));
assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
if (process.env.RELEASE_TAG)
  assert.equal(
    process.env.RELEASE_TAG,
    `v${pkg.version}`,
    "发布标签与包版本不一致",
  );
assert.equal(manifest.package.version, pkg.version);
assert.equal(manifest.model.version, model.version);
assert.equal(model.status, "stable");
assert.equal(model.defaultSource, "modelscope");
assert.deepEqual(model.sources.map((x) => x.kind).sort(), [
  "huggingface",
  "modelscope",
]);
assert.deepEqual(manifest.model.variants[0].sources, model.sources);
const distribution = await json(`${report}/distribution-weights-verified.json`);
assert.equal(distribution.status, "passed");
for (const source of model.sources) {
  assert.match(source.revision, /^[a-f0-9]{40,64}$/);
  assert.equal(source.bytes, model.bytes);
  assert.equal(source.sha256, model.sha256);
  assert.equal(source.repository, "chenmohan/web-sdk-pp-segmentation");
  assert(
    !source.path.split("/").some((part) => ["..", ".", ""].includes(part)),
  );
  const prefix =
    source.kind === "modelscope"
      ? "https://www.modelscope.cn/models"
      : "https://huggingface.co";
  assert.equal(
    source.downloadUrl,
    `${prefix}/${source.repository}/resolve/${source.revision}/${source.path}`,
  );
  assert(
    distribution.results.some(
      (x) =>
        x.source === source.kind &&
        x.url === source.downloadUrl &&
        x.revision === source.revision &&
        x.bytes === model.bytes &&
        x.sha256 === model.sha256 &&
        x.passed,
    ),
  );
}
for (const dir of [
  "reports/2026-09-18-image-sdk",
  "reports/2026-09-18-original-size",
]) {
  const index = await json(`${dir}/evidence-integrity.json`);
  for (const entry of index.files) {
    const data = await readFile(`${dir}/${entry.name}`);
    assert.equal(data.length, entry.bytes);
    assert.equal(hash(data), entry.sha256);
  }
}
const reuse = await json(
  "reports/2026-09-18-original-size/reuse-integrity.json",
);
for (const [path, expected] of Object.entries(reuse.sourceSha256))
  assert.equal(
    hash(await readFile(path)),
    expected,
    `数值验收源码改变：${path}`,
  );
assert.equal(hash(await readFile("dist/index.js")), reuse.sdkSha256);
assert.equal(
  hash(await readFile("dist/inference.worker.js")),
  reuse.workerSha256,
);
const quality = await json("reports/2026-09-18-original-size/acceptance.json");
assert.equal(quality.status, "passed");
for (const entry of Object.values(quality.modes)) {
  const result = entry.originalSizeReference;
  assert.equal(result.passed, true);
  assert(result.apDropPercentagePoints <= 0.5);
  assert(result.agreement.minMaskIoU >= 0.99);
  assert.equal(result.agreement.matched, 423);
  assert.deepEqual(result.agreement.unmatched, []);
}
const acceptance = await json(`${report}/release-acceptance.json`);
assert.equal(acceptance.status, "passed");
assert.equal(acceptance.version, pkg.version);
assert.deepEqual(acceptance.model, model);
const assets = {};
async function inventory(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await inventory(path);
    else {
      const data = await readFile(path);
      assets[path] = { bytes: data.length, sha256: hash(data) };
    }
  }
}
await inventory("dist");
await inventory("demo-dist");
assert.deepEqual(assets, acceptance.assets, "当前构建与生产浏览器验收不一致");
const expected = new Set(
  model.sources.flatMap((source) =>
    ["wasm", "webgpu"].flatMap((backend) =>
      ["main", "worker"].map((mode) => `${source.kind}/${backend}/${mode}`),
    ),
  ),
);
for (const result of acceptance.results) {
  assert(expected.delete(`${result.source}/${result.backend}/${result.mode}`));
  assert.equal(result.status, "passed");
  assert(result.instances > 0);
  assert.equal(result.runtime.actualBackend, result.backend);
  assert.equal(result.runtime.executionMode, result.mode);
  assert.equal(result.model.sha256, model.sha256);
  assert.equal(
    result.revision,
    model.sources.find((x) => x.kind === result.source).revision,
  );
}
assert.equal(expected.size, 0);
assert.equal(acceptance.explicitSourceFailure, "passed");
assert.deepEqual(acceptance.pageErrors, []);
console.log(
  "发布检查通过：版本、双源、冻结质量证据、当前产物与八组合浏览器回执一致。",
);
