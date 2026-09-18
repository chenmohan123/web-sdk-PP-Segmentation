import type { PixelImage } from "./types";
import { SegmentationError, checkAbort, wrapError } from "./errors";
import { validatePixels } from "./preprocess";
export async function readPixels(
  image: PixelImage | Blob,
  signal?: AbortSignal,
): Promise<PixelImage> {
  checkAbort(signal);
  if (!(typeof Blob !== "undefined" && image instanceof Blob)) {
    validatePixels(image as PixelImage);
    const p = image as PixelImage;
    return { width: p.width, height: p.height, data: new Uint8Array(p.data) };
  }
  if (typeof createImageBitmap !== "function")
    throw new SegmentationError("UNSUPPORTED", "当前环境不支持图片解码");
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(image, {
      imageOrientation: "from-image",
      premultiplyAlpha: "none",
    });
    checkAbort(signal);
    if (bitmap.width * bitmap.height > 16_777_216)
      throw new SegmentationError("INVALID_INPUT", "图片超过16777216像素上限");
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : typeof document !== "undefined"
          ? document.createElement("canvas")
          : undefined;
    if (!canvas)
      throw new SegmentationError("UNSUPPORTED", "当前环境没有图片画布");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new SegmentationError("UNSUPPORTED", "无法建立图片画布");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data,
    };
    validatePixels(result);
    checkAbort(signal);
    return result;
  } catch (error) {
    throw wrapError(error, "INVALID_INPUT", "图片解码失败");
  } finally {
    bitmap?.close();
  }
}
