import type {
  ImageItem,
  Settings,
  WorkerPageInput,
  WorkerResponse
} from "../types";
import { isPngFile, isSvgFile } from "../utils/format";
import { rasterizeImageOnMainThread } from "../utils/image";

export interface GeneratePdfOptions {
  images: ImageItem[];
  settings: Settings;
  onProgress: (current: number, total: number, message: string) => void;
}

export class PdfGenerationController {
  private worker: Worker | null = null;
  private cancelled = false;
  private rejectCurrent: ((reason: Error) => void) | null = null;

  public cancel(): void {
    this.cancelled = true;
    if (this.worker) {
      try {
        this.worker.postMessage({ type: "cancel" });
      } catch {
        // Ignore postMessage errors before terminating
      }
      this.worker.terminate();
      this.worker = null;
    }
    if (this.rejectCurrent) {
      this.rejectCurrent(new Error("CANCELLED"));
      this.rejectCurrent = null;
    }
  }

  public async generate(options: GeneratePdfOptions): Promise<ArrayBuffer> {
    const { images, settings, onProgress } = options;
    this.cancelled = false;

    const canUseWorkerOffscreen =
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof createImageBitmap !== "undefined";

    // Prepare inputs; SVG files or browsers without OffscreenCanvas rasterize on main thread with yielding
    const workerPages: WorkerPageInput[] = [];

    for (let i = 0; i < images.length; i++) {
      if (this.cancelled) throw new Error("CANCELLED");

      const item = images[i];
      const needsMainThreadRaster =
        isSvgFile(item.file) ||
        (!canUseWorkerOffscreen &&
          !(isPngFile(item.file.name, item.file.type) && settings.quality === "high"));

      let preRasterizedJpeg: ArrayBuffer | undefined;
      if (needsMainThreadRaster) {
        onProgress(
          i,
          images.length,
          `Preparando ${i + 1} de ${images.length}: ${item.file.name}`
        );
        // Yield a frame so UI remains responsive
        await new Promise((r) => window.setTimeout(r, 0));
        if (this.cancelled) throw new Error("CANCELLED");
        preRasterizedJpeg = await rasterizeImageOnMainThread(
          item.file,
          settings.quality
        );
      }

      workerPages.push({
        id: item.id,
        file: item.file,
        fileName: item.file.name,
        mimeType: item.file.type,
        rotation: item.rotation,
        width: item.width,
        height: item.height,
        preRasterizedJpeg
      });
    }

    if (this.cancelled) throw new Error("CANCELLED");

    if (canUseWorkerOffscreen) {
      return this.runInWorker(workerPages, settings, onProgress);
    }

    // Fallback: lazy-load pdf-builder only when Worker/OffscreenCanvas is unavailable
    const { buildPdfDocument } = await import("./pdf-builder");
    return buildPdfDocument(workerPages, settings, {
      rasterizeToJpeg: async (pageItem, quality) => {
        await new Promise((r) => window.setTimeout(r, 0));
        return rasterizeImageOnMainThread(pageItem.file, quality);
      },
      onProgress,
      isCancelled: () => this.cancelled
    });
  }

  private runInWorker(
    pages: WorkerPageInput[],
    settings: Settings,
    onProgress: (current: number, total: number, message: string) => void
  ): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.rejectCurrent = reject;

      try {
        const worker = new Worker(
          new URL("./pdf.worker.ts", import.meta.url),
          { type: "module" }
        );
        this.worker = worker;

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const msg = event.data;
          if (msg.type === "progress") {
            onProgress(msg.current, msg.total, msg.message);
          } else if (msg.type === "success") {
            this.cleanupWorker();
            resolve(msg.pdfBuffer);
          } else if (msg.type === "error") {
            this.cleanupWorker();
            reject(new Error(msg.message));
          }
        };

        worker.onerror = (err) => {
          this.cleanupWorker();
          reject(
            new Error(err.message || "Falha inesperada no processador de PDF.")
          );
        };

        const transferables: Transferable[] = [];
        for (const p of pages) {
          if (p.preRasterizedJpeg) {
            transferables.push(p.preRasterizedJpeg);
          }
        }

        worker.postMessage(
          {
            type: "generate",
            pages,
            settings
          },
          transferables
        );
      } catch (err) {
        this.cleanupWorker();
        reject(
          err instanceof Error
            ? err
            : new Error("Não foi possível iniciar o Web Worker.")
        );
      }
    });
  }

  private cleanupWorker(): void {
    this.rejectCurrent = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
