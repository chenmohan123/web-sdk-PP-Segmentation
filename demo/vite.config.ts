import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
export default defineConfig(({ command, mode }) => ({
  root: path.join(root, mode === "vanilla" ? "examples/vanilla" : "demo"),
  base: "./",
  publicDir: false,
  define: { __LOCAL_MODEL__: JSON.stringify(command === "serve") },
  plugins: [
    {
      name: "segmentation-assets",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
          // 白名单开发资源；本地模型不复制到生产目录。
          const file =
            pathname === "/local-model/model.onnx"
              ? path.join(root, ".tmp/model.onnx")
              : /^\/sdk\/[a-zA-Z0-9_.-]+$/.test(pathname)
                ? path.join(root, "demo/public", pathname)
                : undefined;
          if (!file) return next();
          try {
            const mime = pathname.endsWith(".wasm")
              ? "application/wasm"
              : /\.(js|mjs)$/.test(pathname)
                ? "text/javascript"
                : "application/octet-stream";
            res.setHeader("Content-Type", mime);
            res.end(await readFile(file));
          } catch {
            res.statusCode = 404;
            res.end("本地模型或SDK尚未准备");
          }
        });
      },
      async closeBundle() {
        if (command === "build") {
          await mkdir(path.join(root, "demo-dist/sdk"), { recursive: true });
          await cp(
            path.join(root, "demo/public/sdk"),
            path.join(root, "demo-dist/sdk"),
            { recursive: true },
          );
        }
      },
    },
  ],
  build: { outDir: "../demo-dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 4188, strictPort: true },
  preview: { host: "127.0.0.1", port: 4188, strictPort: true },
}));
