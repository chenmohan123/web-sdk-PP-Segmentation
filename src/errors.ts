import type { SegmentationErrorCode } from "./types";
export class SegmentationError extends Error {
  constructor(
    public readonly code: SegmentationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SegmentationError";
  }
}
export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SegmentationError("ABORTED", "操作已取消");
}
export function wrapError(
  error: unknown,
  code: SegmentationErrorCode,
  message: string,
): SegmentationError {
  if (error instanceof SegmentationError) return error;
  if (error instanceof Error && error.name === "AbortError")
    return new SegmentationError("ABORTED", "操作已取消", { cause: error });
  if (
    error instanceof Error &&
    /out of memory|allocation failed|memory access out of bounds/i.test(
      error.message,
    )
  )
    return new SegmentationError("OUT_OF_MEMORY", "运行时内存不足", {
      cause: error,
    });
  return new SegmentationError(code, message, { cause: error });
}
