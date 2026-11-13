import type {
  MergePageInput,
  MergeSourceInput,
  ReaderWorkerResponse
} from "../types";

export interface MergePdfOptions {
  sources: MergeSourceInput[];
  pages: MergePageInput[];
  fileName: string;
  onProgress: (current: number, total: number, message: string) => void;
}

/**
 * Coordinates PDF merging/exporting in a background Web Worker, cloning source
 * ArrayBuffers before transfer so the open reader retains ownership of its documents.
 */
export class PdfMergeController {
  private worker: Worker | null = null;
  private cancelled = false;
  private rejectCurrent: ((reason: Error) => void) | null = null;

  public cancel(): void {
    this.cancelled = true;
    if (this.worker) {
      try {
        this.worker.postMessage({ type: "cancel" });
      } catch {
        // Ignore postMessage failures right before termination
      }
      this.worker.terminate();
      this.worker = null;
    }
    if (this.rejectCurrent) {
      this.rejectCurrent(new Error("CANCELLED"));
      this.rejectCurrent = null;
    }
  }

  public async merge(options: MergePdfOptions): Promise<ArrayBuffer> {
    const { sources, pages, fileName, onProgress } = options;
    this.cancelled = false;

    if (typeof Worker !== "undefined") {
      return this.runInWorker(sources, pages, fileName, onProgress);
    }

    const { mergePdfDocuments } = await import("./pdf-merge-builder");
    return mergePdfDocuments(sources, pages, fileName, {
      onProgress,
      isCancelled: () => this.cancelled
    });
  }

  private runInWorker(
    sources: MergeSourceInput[],
    pages: MergePageInput[],
    fileName: string,
    onProgress: (current: number, total: number, message: string) => void
  ): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.rejectCurrent = reject;

      try {
        const worker = new Worker(
          new URL("./pdf-merge.worker.ts", import.meta.url),
          { type: "module" }
        );
        this.worker = worker;

        worker.onmessage = (event: MessageEvent<ReaderWorkerResponse>) => {
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
            new Error(err.message || "Falha inesperada ao exportar o PDF.")
          );
        };

        const clonedSources: MergeSourceInput[] = sources.map((src) => ({
          docId: src.docId,
          fileName: src.fileName,
          bytes: src.bytes.slice(0)
        }));
        const transferables: Transferable[] = clonedSources.map(
          (src) => src.bytes
        );

        worker.postMessage(
          {
            type: "merge",
            sources: clonedSources,
            pages,
            fileName
          },
          transferables
        );
      } catch (err) {
        this.cleanupWorker();
        reject(
          err instanceof Error
            ? err
            : new Error("Não foi possível iniciar o Web Worker de exportação.")
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

