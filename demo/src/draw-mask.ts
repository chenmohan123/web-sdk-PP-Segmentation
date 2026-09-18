import type { SegmentationResult } from "../../src/types";
export function drawMask(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  result?: SegmentationResult,
  selected = -1,
  overlay = true,
): void {
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  if (!result || !overlay) return;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    colors = [
      [37, 99, 235],
      [14, 165, 130],
      [234, 88, 12],
      [147, 51, 234],
      [225, 29, 72],
    ];
  result.instances.forEach((instance, index) => {
    if (selected >= 0 && selected !== index) return;
    const { mask } = instance,
      color = colors[index % colors.length];
    for (let y = 0; y < mask.height; y++)
      for (let x = 0; x < mask.width; x++)
        if (mask.data[y * mask.width + x]) {
          const p = ((y + mask.y) * canvas.width + x + mask.x) * 4;
          for (let c = 0; c < 3; c++)
            pixels.data[p + c] = pixels.data[p + c] * 0.55 + color[c] * 0.45;
        }
  });
  ctx.putImageData(pixels, 0, 0);
  result.instances.forEach((instance, index) => {
    if (selected >= 0 && selected !== index) return;
    ctx.strokeStyle = `rgb(${colors[index % colors.length].join(",")})`;
    ctx.lineWidth = Math.max(1.5, canvas.width / 400);
    const b = instance.box;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
  });
}
