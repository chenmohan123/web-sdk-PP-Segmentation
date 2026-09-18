import { chromium } from "playwright";
import { createServer, preview } from "vite";
import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../", import.meta.url));
const image =
  process.env.SDK_TEST_IMAGE ??
  fileURLToPath(
    new URL(
      "../../web-sdk-PP-Detection/.tmp/phase2/dataset/images/000000010977.jpg",
      import.meta.url,
    ),
  );
await access(image);
const evidence = pathToFileURL(
  resolve(
    root,
    process.env.SDK_UI_EVIDENCE_DIR ??
      "reports/2026-09-18-release-readiness/ui",
  ) + sep,
);
await mkdir(evidence, { recursive: true });
const base = process.env.SDK_DEMO_BASE_URL ?? "http://127.0.0.1:4188/";
const browser = await chromium.launch({ channel: "chromium", headless: true });
const errors = [],
  results = [];
const previewOnly = process.argv.includes("--preview-only");
async function checkInvalidPreviews(page) {
  const failures = [];
  const oversizedPng = await page.evaluate(async () => {
    // 仅用于构造测试输入；产品预览不得为此输入分配大画布。
    const fixture = document.createElement("canvas");
    fixture.width = 4097;
    fixture.height = 4096;
    const blob = await new Promise((resolve) =>
      fixture.toBlob(resolve, "image/png"),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.evaluate(() => {
    window.previewCanvasSizes = [];
    window.previewCanvasDescriptors = {};
    for (const dimension of ["width", "height"]) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        dimension,
      );
      window.previewCanvasDescriptors[dimension] = descriptor;
      Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
        ...descriptor,
        set(value) {
          descriptor.set.call(this, value);
          if (this.isConnected)
            window.previewCanvasSizes.push([this.width, this.height]);
        },
      });
    }
  });
  try {
    for (const [name, buffer, message, englishMessage, screenshot] of [
      [
        "损坏图片.png",
        Buffer.from([0x89, 0x50]),
        /无法解码/,
        /Cannot decode/,
        "invalid-preview.png",
      ],
      [
        "超像素图片.png",
        Buffer.from(oversizedPng),
        /16,777,216/,
        /exceeds.*pixel limit/,
        "oversized-preview.png",
      ],
    ]) {
      await page.locator("input[type=file]").setInputFiles(image);
      await page.waitForFunction(() => {
        const preview = document.querySelector("canvas");
        return (
          preview &&
          preview.width > 0 &&
          preview.height > 0 &&
          preview
            .getContext("2d")
            .getImageData(0, 0, preview.width, preview.height)
            .data.some((value, index) => index % 4 === 3 && value > 0)
        );
      });
      await page.getByRole("button", { name: "开始分割", exact: true }).click();
      await page
        .locator("[role=status][data-state=success]")
        .waitFor({ timeout: 60000 });
      assert(
        (await page.locator(".result-list button").count()) > 0,
        "无效输入测试前必须先有真实分割结果",
      );
      await page.evaluate(() => {
        window.previewCanvasSizes = [];
      });
      await page
        .locator("input[type=file]")
        .setInputFiles({ name, mimeType: "image/png", buffer });
      await page
        .locator("[role=status][data-state=error]")
        .waitFor({ timeout: 3000 })
        .catch(() => {});
      const snapshot = await page.evaluate(() => ({
        stalePixels: Array.from(document.querySelectorAll("canvas")).some(
          (preview) =>
            preview.width > 0 &&
            preview.height > 0 &&
            preview
              .getContext("2d")
              .getImageData(0, 0, preview.width, preview.height)
              .data.some((value, index) => index % 4 === 3 && value > 0),
        ),
        canvasSizes: window.previewCanvasSizes,
      }));
      const alert = await page.locator("[role=alert]").allTextContents();
      const runDisabled = await page
        .getByRole("button", { name: "开始分割", exact: true })
        .isDisabled();
      for (const [passed, reason] of [
        [!snapshot.stalePixels, "无效图片仍显示旧画布或已绘制超限输入"],
        [
          alert.some(
            (text) => /INVALID_INPUT/.test(text) && message.test(text),
          ),
          "缺少稳定错误码和中文提示",
        ],
        [runDisabled, "无效图片仍允许开始分割"],
        [
          snapshot.canvasSizes.every(
            ([width, height]) => width * height <= 16777216,
          ),
          "拒绝前已分配超像素产品画布",
        ],
        [
          (await page.locator(".result-list button").count()) === 0,
          "无效图片仍显示旧分割结果",
        ],
      ])
        if (!passed) failures.push(`${name}：${reason}`);
      console.log(
        JSON.stringify({
          输入: name,
          运行禁用: runDisabled,
          提示: alert,
          ...snapshot,
        }),
      );
      if (runDisabled && alert.length) {
        await page
          .getByRole("button", { name: "English", exact: true })
          .click();
        const english = await page.locator("[role=alert]").innerText();
        if (!/INVALID_INPUT/.test(english) || !englishMessage.test(english))
          failures.push(`${name}：缺少英文提示`);
        await page.getByRole("button", { name: "中文", exact: true }).click();
      }
      await page.screenshot({
        path: fileURLToPath(new URL(screenshot, evidence)),
        fullPage: true,
      });
    }
  } finally {
    await page.evaluate(() => {
      for (const [dimension, descriptor] of Object.entries(
        window.previewCanvasDescriptors,
      ))
        Object.defineProperty(
          HTMLCanvasElement.prototype,
          dimension,
          descriptor,
        );
    });
  }
  assert.deepEqual(failures, [], "图片预览必须在绘制前拒绝无效输入");
  await page.locator("input[type=file]").setInputFiles(image);
  await page.getByRole("button", { name: "开始分割", exact: true }).click();
  await page
    .locator("[role=status][data-state=success]")
    .waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "开始分割", exact: true }).waitFor();
  assert(
    (await page.locator(".result-list button").count()) > 0,
    "有效图片恢复后缺少真实分割结果",
  );
}
let vanilla, production;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  assert.equal(await page.locator("img").count(), 0);
  if (previewOnly) {
    await checkInvalidPreviews(page);
    assert.deepEqual(errors, []);
    console.log("预览回归通过：损坏图片、超像素图片、有效图片恢复并真实运行。");
  } else {
    for (const backend of ["wasm", "webgpu"])
      for (const mode of ["main", "worker"]) {
        await page
          .getByRole("group", { name: "运行后端" })
          .getByRole("button", {
            name: backend === "webgpu" ? "GPU" : "CPU",
            exact: true,
          })
          .click();
        await page
          .getByRole("group", { name: "执行模式" })
          .getByRole("button", {
            name: mode === "worker" ? "Worker" : "主线程",
            exact: true,
          })
          .click();
        await page.locator("input[type=file]").setInputFiles(image);
        await page
          .getByRole("button", { name: "开始分割", exact: true })
          .click();
        await page
          .locator("[role=status][data-state=success]")
          .waitFor({ timeout: 60000 });
        await page
          .getByRole("button", { name: "开始分割", exact: true })
          .waitFor();
        const count = await page.locator(".result-list button").count();
        assert(count > 0, `${backend}/${mode} 缺少实例`);
        const canvas = page.locator("canvas");
        assert(await canvas.evaluate((el) => el.width > 0 && el.height > 0));
        const position = () =>
          canvas.evaluate((el) => ({
            top: el.getBoundingClientRect().top + scrollY,
            left: el.getBoundingClientRect().left + scrollX,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
            pixelWidth: el.width,
            pixelHeight: el.height,
          }));
        const before = await position();
        await page.locator(".result-list button").first().click();
        assert.deepEqual(await position(), before, "选择实例导致画布移动");
        await page
          .getByRole("button", { name: "全部实例", exact: true })
          .click();
        assert.deepEqual(await position(), before);
        await page
          .getByRole("checkbox", { name: "显示掩码", exact: true })
          .click();
        assert.deepEqual(await position(), before, "切换掩码导致画布移动");
        await page
          .getByRole("checkbox", { name: "显示掩码", exact: true })
          .click();
        await page
          .getByRole("button", { name: "English", exact: true })
          .click();
        assert.deepEqual(await position(), before, "中英切换导致画布移动");
        await page.getByRole("button", { name: "中文", exact: true }).click();
        await page.locator(".cache-section summary").click();
        assert.match(
          await page.locator("[data-sdk-cache-usage]").innerText(),
          /36.27 MB/,
        );
        await page.locator(".cache-section summary").click();
        results.push({
          backend,
          mode,
          instances: count,
          selectionStable: true,
        });
      }
    await checkInvalidPreviews(page);
    await page.screenshot({
      path: fileURLToPath(new URL("desktop.png", evidence)),
      fullPage: true,
    });
    await page.getByText("模型与运行信息", { exact: true }).click();
    const verification = page.locator("[data-sdk-verification]");
    assert.equal(await verification.isVisible(), true);
    const matrix = await verification.innerText();
    for (const expected of [
      "2026-09-18",
      "Windows 11 10.0.26200",
      "Chromium 153.0.8010.12",
      "i5-10400F",
      "RTX 5060 Ti",
      "WASM",
      "WebGPU",
      "main + Worker",
    ])
      assert(matrix.includes(expected), `环境矩阵缺少 ${expected}`);
    await page.screenshot({
      path: fileURLToPath(new URL("runtime-information.png", evidence)),
      fullPage: true,
    });
    await page.getByText("模型与运行信息", { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "English", exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(
      await page
        .getByRole("heading", { name: "Instance segmentation", exact: true })
        .count(),
      1,
    );
    assert.equal(
      await page.locator(".result-list button").count(),
      results.at(-1).instances,
      "语言切换丢失结果",
    );
    assert(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      "390px横向溢出",
    );
    await page.screenshot({
      path: fileURLToPath(new URL("mobile-layout.png", evidence)),
      fullPage: true,
    });
    await page.getByRole("button", { name: "中文", exact: true }).click();
    // 清理和重置后，取消的旧操作不能覆盖新输入。
    await page.locator(".cache-section summary").click();
    await page.locator("[data-sdk-cache-clear=current]").click();
    await page.getByText("缓存已清理", { exact: true }).waitFor();
    assert.match(
      await page.locator("[data-sdk-cache-usage]").innerText(),
      /0.00 MB/,
    );
    let releaseDownload;
    const downloadGate = new Promise((resolve) => {
      releaseDownload = resolve;
    });
    await page.route("**/local-model/model.onnx", async (route) => {
      await downloadGate;
      await route.continue().catch(() => {});
    });
    await page.getByRole("button", { name: "开始分割", exact: true }).click();
    await page.locator("[data-state=downloading]").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByText("已取消", { exact: true }).waitFor();
    const bytes = Buffer.from([0x89, 0x50]);
    await page.locator("input[type=file]").setInputFiles({
      name: "旧图片.png",
      mimeType: "image/png",
      buffer: bytes,
    });
    await page.locator("input[type=file]").setInputFiles(image);
    releaseDownload();
    await page.unroute("**/local-model/model.onnx");
    assert.match(
      await page.locator(".viewer-toolbar").innerText(),
      /000000010977.jpg/,
    );
    assert.equal(await page.locator(".result-list button").count(), 0);
    await page.getByRole("button", { name: "开始分割", exact: true }).click();
    await page
      .locator("[role=status][data-state=success]")
      .waitFor({ timeout: 60000 });
    await page.getByRole("button", { name: "开始分割", exact: true }).waitFor();
    await page.locator("[data-sdk-cache-clear=all]").click();
    await page.getByText("缓存已清理", { exact: true }).waitFor();
    assert.match(
      await page.locator("[data-sdk-cache-usage]").innerText(),
      /0.00 MB/,
    );
    await page.getByRole("button", { name: "重置", exact: true }).click();
    assert.equal(await page.locator("canvas").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "开始分割", exact: true })
        .isDisabled(),
      true,
    );
    // Vanilla 示例只消费构建后的公共API。
    vanilla = await createServer({
      configFile: root + "demo/vite.config.ts",
      mode: "vanilla",
      server: { port: 4189, host: "127.0.0.1", strictPort: true },
    });
    await vanilla.listen();
    await page.goto("http://127.0.0.1:4189/", { waitUntil: "networkidle" });
    await page.locator("input[type=file]").setInputFiles(image);
    await page.getByRole("button", { name: "开始分割", exact: true }).click();
    await page.getByText(/分割完成：\d+ 个实例/).waitFor({ timeout: 60000 });
    assert(await page.locator("canvas").evaluate((el) => el.width > 0));
    // 正式构建使用已发布来源，不携带或请求本地模型。
    production = await preview({
      configFile: root + "demo/vite.config.ts",
      preview: { port: 4190, host: "127.0.0.1", strictPort: true },
    });
    const modelRequests = [];
    page.on("request", (req) => {
      if (req.url().includes("/local-model/")) modelRequests.push(req.url());
    });
    await page.goto("http://127.0.0.1:4190/", { waitUntil: "networkidle" });
    await page.locator("input[type=file]").setInputFiles(image);
    assert.equal(
      await page
        .getByRole("button", { name: "开始分割", exact: true })
        .isDisabled(),
      false,
    );
    assert.deepEqual(modelRequests, []);
    assert.deepEqual(errors, []);
    await writeFile(
      new URL("summary.json", evidence),
      JSON.stringify(
        {
          date: new Date().toISOString(),
          browser: browser.version(),
          matrix: results,
          language: true,
          viewport390: true,
          cancelRecovery: true,
          replaceImage: true,
          invalidPreview: true,
          oversizedPreview: true,
          previewRecovery: true,
          overlayStable: true,
          languageStable: true,
          verificationMatrix: true,
          cacheClear: true,
          vanilla: true,
          productionSourceAvailable: true,
          pageErrors: errors,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Demo 验收通过：四组合、真实图片、选择/掩码/中英不跳动、390px、无效预览拒绝与恢复、取消/换图恢复、缓存、Vanilla、生产来源可用。",
    );
  }
} finally {
  await browser.close();
  await vanilla?.close();
  await new Promise((resolve) =>
    production ? production.httpServer.close(resolve) : resolve(),
  );
}
