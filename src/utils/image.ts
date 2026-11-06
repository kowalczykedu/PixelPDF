import type { Quality } from "../types";
import { isSvgFile } from "./format";
import { qualityConfig } from "./layout";

const MAX_CONCURRENT_THUMBNAILS = 2;
let activeTasks = 0;
const taskQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeTasks < MAX_CONCURRENT_THUMBNAILS) {
    activeTasks++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    taskQueue.push(() => {
      activeTasks++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeTasks = Math.max(0, activeTasks - 1);
  const next = taskQueue.shift();
  if (next) {
    window.setTimeout(next, 4);
  }
}

export function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Não foi possível ler ${file.name}.`));
    };
    image.src = url;
  });
}

export async function createThumbnailAndDimensions(
  file: File,
  maxThumbSize = 180
): Promise<{ thumbUrl: string; width: number; height: number }> {
  await acquireSlot();
  try {
    // Fast path using createImageBitmap
    if ("createImageBitmap" in window && !isSvgFile(file)) {
      try {
        const bitmap = await createImageBitmap(file);
        const width = bitmap.width;
        const height = bitmap.height;

        // Small files don't need re-encoding
        if (Math.max(width, height) <= maxThumbSize || file.size <= 90 * 1024) {
          bitmap.close();
          return { thumbUrl: URL.createObjectURL(file), width, height };
        }

        const scale = maxThumbSize / Math.max(width, height);
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));

        if (typeof OffscreenCanvas !== "undefined") {
          const offscreen = new OffscreenCanvas(targetW, targetH);
          const ctx = offscreen.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(bitmap, 0, 0, targetW, targetH);
            bitmap.close();
            // JPEG encoding is 5-10x faster than WebP encoding
            const thumbBlob = await offscreen.convertToBlob({
              type: "image/jpeg",
              quality: 0.76
            });
            return {
              thumbUrl: URL.createObjectURL(thumbBlob),
              width,
              height
            };
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          bitmap.close();

          const thumbBlob = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, "image/jpeg", 0.76)
          );
          if (thumbBlob) {
            return {
              thumbUrl: URL.createObjectURL(thumbBlob),
              width,
              height
            };
          }
        } else {
          bitmap.close();
        }
        return { thumbUrl: URL.createObjectURL(file), width, height };
      } catch {
        // Fallback to HTMLImageElement below
      }
    }

    const image = await loadHtmlImage(file);
    const width = image.naturalWidth || image.width || 1000;
    const height = image.naturalHeight || image.height || 1400;

    if (
      isSvgFile(file) ||
      Math.max(width, height) <= maxThumbSize ||
      file.size <= 90 * 1024
    ) {
      return { thumbUrl: URL.createObjectURL(file), width, height };
    }

    const scale = maxThumbSize / Math.max(width, height);
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(image, 0, 0, targetW, targetH);
      const thumbBlob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.76)
      );
      if (thumbBlob) {
        return {
          thumbUrl: URL.createObjectURL(thumbBlob),
          width,
          height
        };
      }
    }

    return { thumbUrl: URL.createObjectURL(file), width, height };
  } finally {
    releaseSlot();
  }
}

export async function rasterizeImageOnMainThread(
  file: File,
  quality: Quality
): Promise<ArrayBuffer> {
  const image = await loadHtmlImage(file);
  const config = qualityConfig(quality);
  const naturalW = image.naturalWidth || image.width || 1000;
  const naturalH = image.naturalHeight || image.height || 1400;
  const scale = Math.min(1, config.maxDimension / Math.max(naturalW, naturalH));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalW * scale));
  canvas.height = Math.max(1, Math.round(naturalH * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas não suportado neste navegador.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const jpegBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", config.jpeg)
  );
  if (!jpegBlob) {
    throw new Error(`Não foi possível converter ${file.name}.`);
  }
  return jpegBlob.arrayBuffer();
}
