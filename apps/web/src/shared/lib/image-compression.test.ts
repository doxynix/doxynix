import { describe, expect, it, vi } from "vitest";

import {
  compressWithRetries,
  computeTargetDimensions,
  shouldRetryCompression,
} from "@/shared/lib/image-compression";

describe("shared/lib/image-compression:computeTargetDimensions", () => {
  it("downscales large images to fit the max dimension", () => {
    expect(computeTargetDimensions(2000, 1000, 512)).toEqual({ height: 256, width: 512 });
  });

  it("never upscales images smaller than the max dimension", () => {
    expect(computeTargetDimensions(100, 100, 512)).toEqual({ height: 100, width: 100 });
  });

  it("keeps a minimum size of 1px", () => {
    expect(computeTargetDimensions(3, 2000, 512)).toEqual({ height: 512, width: 1 });
  });

  it("scales by the larger dimension", () => {
    expect(computeTargetDimensions(500, 1000, 250)).toEqual({ height: 250, width: 125 });
  });
});

describe("shared/lib/image-compression:shouldRetryCompression", () => {
  it("retries while the blob is too large", () => {
    expect(shouldRetryCompression(100, 50, 0.8, 0)).toBe(true);
  });

  it("stops once the blob fits", () => {
    expect(shouldRetryCompression(40, 50, 0.8, 0)).toBe(false);
  });

  it("stops at the quality floor", () => {
    expect(shouldRetryCompression(100, 50, 0.4, 0)).toBe(false);
  });

  it("stops after two attempts", () => {
    expect(shouldRetryCompression(100, 50, 0.8, 2)).toBe(false);
  });
});

describe("shared/lib/image-compression:compressWithRetries", () => {
  it("encodes once when the first attempt already fits", async () => {
    const toBlob = vi.fn(async () => ({ size: 10 }) as Blob);

    const blob = await compressWithRetries(toBlob, 0.8, 50);

    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(0.8);
    expect(blob.size).toBe(10);
  });

  it("reduces quality until the blob fits", async () => {
    const sizesByQuality: Record<number, number> = { 0.6: 40, 0.8: 80 };
    const toBlob = vi.fn(
      async (quality: number) =>
        ({ size: sizesByQuality[Number(quality.toFixed(2))] ?? 0 }) as Blob,
    );

    const blob = await compressWithRetries(toBlob, 0.8, 50);

    const qualities = (toBlob.mock.calls as number[][]).map((call) => Number(call[0]!.toFixed(2)));
    expect(qualities).toEqual([0.8, 0.6]);
    expect(blob.size).toBe(40);
  });

  it("stops after the quality floor or attempt limit", async () => {
    const toBlob = vi.fn(async () => ({ size: 100 }) as Blob);

    const blob = await compressWithRetries(toBlob, 0.8, 50);

    const qualities = (toBlob.mock.calls as number[][]).map((call) => Number(call[0]!.toFixed(2)));
    expect(qualities).toEqual([0.8, 0.6, 0.4]);
    expect(blob.size).toBe(100);
  });
});
