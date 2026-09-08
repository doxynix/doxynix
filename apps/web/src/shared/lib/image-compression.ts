export type ImageCompressionOptions = {
  fileType?: "image/jpeg" | "image/png" | "image/webp";
  initialQuality?: number;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
};

export async function compressImage(
  file: Blob | File,
  options: ImageCompressionOptions = {},
): Promise<Blob> {
  const {
    fileType = "image/webp",
    initialQuality = 0.8,
    maxSizeMB = 0.1,
    maxWidthOrHeight = 512,
  } = options;

  let bitmap: ImageBitmap | HTMLImageElement;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      bitmap = await loadFallbackImage(file);
    }
  } else {
    bitmap = await loadFallbackImage(file);
  }

  const origWidth = bitmap.width;
  const origHeight = bitmap.height;

  const scale = Math.min(1, maxWidthOrHeight / Math.max(origWidth, origHeight));
  const targetWidth = Math.max(1, Math.round(origWidth * scale));
  const targetHeight = Math.max(1, Math.round(origHeight * scale));

  let blob: Blob | null = null;
  let currentQuality = initialQuality;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to acquire OffscreenCanvas 2D context");
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    blob = await canvas.convertToBlob({ quality: currentQuality, type: fileType });

    let attempts = 0;
    while (blob.size > maxSizeBytes && currentQuality > 0.4 && attempts < 2) {
      currentQuality -= 0.2;
      attempts++;
      blob = await canvas.convertToBlob({ quality: currentQuality, type: fileType });
    }
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to acquire Canvas 2D context");
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    blob = await canvasToBlob(canvas, fileType, currentQuality);

    let attempts = 0;
    while (blob.size > maxSizeBytes && currentQuality > 0.4 && attempts < 2) {
      currentQuality -= 0.2;
      attempts++;
      blob = await canvasToBlob(canvas, fileType, currentQuality);
    }
  }

  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  return blob;
}

function loadFallbackImage(file: Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error("HTMLCanvasElement toBlob returned null"));
        }
      },
      type,
      quality,
    );
  });
}
