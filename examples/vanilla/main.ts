import metadata from "../../models/model.json";
import type { Segmentation } from "../../src/types";
declare const __LOCAL_MODEL__: boolean;
type Api = typeof import("../../src/index");
const input = document.querySelector("input")!;
const button = document.querySelector("button")!;
const status = document.querySelector("[role=status]")!;
const canvas = document.querySelector("canvas")!;
let sdk: Segmentation | undefined;
input.onchange = () => {
  button.disabled = !input.files?.length || !__LOCAL_MODEL__;
};
button.onclick = async () => {
  const file = input.files?.[0];
  if (!file || sdk || !__LOCAL_MODEL__) return;
  input.disabled = button.disabled = true;
  status.textContent = "正在加载模型";
  let bitmap: ImageBitmap | undefined;
  try {
    const api: Api = await import(
      /* @vite-ignore */ new URL("sdk/index.js", document.baseURI).href
    );
    sdk = api.createSegmentation({
      model: {
        ...metadata,
        url: new URL("local-model/model.onnx", document.baseURI).href,
      },
      backend: "wasm",
      executionMode: "worker",
      runtimeBaseUrl: new URL("sdk/", document.baseURI).href,
    });
    await sdk.load();
    status.textContent = "正在分割";
    const result = await sdk.run({ image: file });
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (const { mask } of result.instances) {
      for (let y = 0; y < mask.height; y++)
        for (let x = 0; x < mask.width; x++) {
          if (!mask.data[y * mask.width + x]) continue;
          const p = ((y + mask.y) * canvas.width + x + mask.x) * 4;
          pixels.data[p] = Math.round(pixels.data[p] * 0.5);
          pixels.data[p + 1] = Math.round(pixels.data[p + 1] * 0.5 + 110);
          pixels.data[p + 2] = Math.round(pixels.data[p + 2] * 0.5 + 70);
        }
    }
    context.putImageData(pixels, 0, 0);
    status.textContent = `分割完成：${result.instances.length} 个实例`;
  } catch (error) {
    status.textContent = `${(error as { code?: string }).code ?? "ERROR"}：${(error as Error).message}`;
  } finally {
    bitmap?.close();
    await sdk?.dispose().catch(() => {});
    sdk = undefined;
    input.disabled = false;
    button.disabled = !input.files?.length;
  }
};
window.addEventListener("pagehide", () => {
  void sdk?.dispose().catch(() => {});
});
