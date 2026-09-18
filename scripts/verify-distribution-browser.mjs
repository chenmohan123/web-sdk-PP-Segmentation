// 生产构建验收：实际 Hub 下载、公共 SDK 四组合和显式失败不换源。
import { chromium } from "playwright";
import { preview } from "vite";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const model = JSON.parse(await readFile("models/model.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const report = "reports/2026-09-18-release-readiness";
const assets = {};
async function inventory(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await inventory(path);
    else {
      const data = await readFile(path);
      assets[path] = {
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      };
    }
  }
}
await inventory("dist");
await inventory("demo-dist");
const server = await preview({
  configFile: root + "demo/vite.config.ts",
  preview: { host: "127.0.0.1", port: 4191, strictPort: true },
});
const browser = await chromium.launch({ channel: "chromium", headless: true });
const errors = [],
  results = [];
const input = await readFile(
  "../web-sdk-PP-Detection/.tmp/phase2/dataset/images/000000010977.jpg",
);
try {
  for (const source of model.sources) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    const downloads = [];
    page.on("request", (request) => {
      if (request.url() === source.downloadUrl) downloads.push(request.url());
    });
    await page.goto("http://127.0.0.1:4191/", { waitUntil: "networkidle" });
    for (const backend of ["wasm", "webgpu"])
      for (const mode of ["main", "worker"]) {
        const result = await page.evaluate(
          async ({ model, source, backend, mode, bytes }) => {
            const api = await import(
              new URL("sdk/index.js", document.baseURI).href
            );
            const sdk = api.createSegmentation({
              model: { ...model, url: source.downloadUrl },
              backend,
              executionMode: mode,
              runtimeBaseUrl: new URL("sdk/", document.baseURI).href,
            });
            try {
              await sdk.load();
              const result = await sdk.run({
                image: new Blob([new Uint8Array(bytes)], {
                  type: "image/jpeg",
                }),
              });
              return {
                runtime: result.runtime,
                instances: result.instances.length,
                image: result.image,
                model: result.model,
                loadTimings: sdk.loadTimings,
                timings: result.timings,
              };
            } finally {
              await sdk.dispose();
            }
          },
          { model, source, backend, mode, bytes: [...input] },
        );
        assert(result.instances > 0);
        assert.equal(result.runtime.actualBackend, backend);
        assert.equal(result.runtime.executionMode, mode);
        assert.equal(result.model.sha256, model.sha256);
        results.push({
          source: source.kind,
          revision: source.revision,
          backend,
          mode,
          status: "passed",
          ...result,
        });
        console.log(
          `${source.kind}/${backend}/${mode}：${result.instances} 个实例`,
        );
      }
    assert.equal(
      downloads.length,
      1,
      "每源首轮实际下载，后续使用同源上下文缓存",
    );
    await context.close();
  }
  // 用全新缓存上下文制造选定来源错误，确保没有访问备用源。
  const context = await browser.newContext();
  const page = await context.newPage();
  const primary = model.sources.find((source) => source.kind === "modelscope");
  const alternative = model.sources.find(
    (source) => source.kind === "huggingface",
  );
  let alternateRequests = 0;
  page.on("request", (req) => {
    if (req.url() === alternative.downloadUrl) alternateRequests++;
  });
  await page.route(primary.downloadUrl, (route) => route.abort("failed"));
  await page.goto("http://127.0.0.1:4191/", { waitUntil: "networkidle" });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "验收图片.jpg",
      mimeType: "image/jpeg",
      buffer: input,
    });
  await page.getByRole("button", { name: "开始分割", exact: true }).click();
  await page.locator("[role=alert]").waitFor({ timeout: 60000 });
  assert.match(await page.locator("[role=alert]").innerText(), /DOWNLOAD/);
  assert.equal(alternateRequests, 0);
  await context.close();
  assert.deepEqual(errors, []);
  await writeFile(
    `${report}/release-acceptance.json`,
    JSON.stringify(
      {
        version: pkg.version,
        testedAt: new Date().toISOString(),
        browser: browser.version(),
        model,
        input: {
          bytes: input.length,
          sha256: createHash("sha256").update(input).digest("hex"),
        },
        assets,
        results,
        explicitSourceFailure: "passed",
        pageErrors: errors,
        status: "passed",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("双源生产构建浏览器验收通过。");
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
