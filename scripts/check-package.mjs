import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
// npm 自身计算文件清单，覆盖 files、忽略规则与嵌套目录。
const output = execFileSync(
  process.platform === "win32" ? "cmd.exe" : "npm",
  process.platform === "win32"
    ? ["/d", "/s", "/c", "npm pack --dry-run --json --ignore-scripts"]
    : ["pack", "--dry-run", "--json", "--ignore-scripts"],
  { cwd: root, encoding: "utf8" },
);
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
for (const file of files) {
  if (
    /\.(onnx|pdparams|tgz)$/i.test(file) ||
    !/^(dist\/|README(?:\.en)?\.md$|LICENSE$|NOTICE$|package\.json$)/.test(file)
  )
    throw new Error(`npm 产物包含非预期资源：${file}`);
}
for (const file of [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/inference.worker.js",
  "dist/ort.webgpu.bundle.min.mjs",
  "dist/ort-wasm-simd-threaded.asyncify.mjs",
  "dist/ort-wasm-simd-threaded.asyncify.wasm",
  "LICENSE",
  "NOTICE",
]) {
  if (!files.has(file)) throw new Error(`npm 产物缺少 ${file}`);
  await readFile(new URL(`../${file}`, import.meta.url));
}
console.log(
  `npm 产物检查通过：${files.size} 个文件，压缩后 ${pack.size} 字节；不含模型或开发数据。`,
);
