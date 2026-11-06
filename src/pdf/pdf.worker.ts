import type {
  Quality,
  WorkerPageInput,
  WorkerRequest,
  WorkerResponse
} from "../types";
import { qualityConfig } from "../utils/layout";
import { buildPdfDocument } from "./pdf-builder";

let cancelled = false;

async function rasterizeInWorker(
  item: WorkerPageInput,
  quality: Quality
): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
    throw new Error("OffscreenCanvas indisponível no Worker.");
  }

  const bitmap = await createImageBitmap(item.file);
  try {
    const config = qualityConfig(quality);
    const naturalW = bitmap.width || item.width || 1000;
    const naturalH = bitmap.height || item.height || 1400;
    const scale = Math.min(1, config.maxDimension / Math.max(naturalW, naturalH));

    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = new OffscreenCanvas(targetW, targetH);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Contexto 2D indisponível no OffscreenCanvas.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetW, targetH);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: config.jpeg
    });
    return blob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}

function post(message: WorkerResponse, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    self.postMessage(message, { transfer });
  } else {
    self.postMessage(message);
  }
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;

  if (data.type === "cancel") {
    cancelled = true;
    return;
  }

  if (data.type === "generate") {
    cancelled = false;
    try {
      const pdfBuffer = await buildPdfDocument(data.pages, data.settings, {
        rasterizeToJpeg: rasterizeInWorker,
        onProgress: (current, total, message) => {
          post({ type: "progress", current, total, message });
        },
        isCancelled: () => cancelled
      });

      post(
        {
          type: "success",
          pdfBuffer,
          pageCount: data.pages.length
        },
        [pdfBuffer]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao gerar o PDF.";
      post({ type: "error", message });
    }
  }
});

