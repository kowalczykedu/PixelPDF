import type {
  AcroFormFieldValue,
  CreatePdfPageInput,
  CreatePdfWorkerRequest,
  MergePageInput,
  MergeSourceInput,
  MergeWorkerRequest,
  OverlayAssetInput,
  ReaderWorkerResponse
} from "../types";

export interface MergePdfOptions {
  sources: MergeSourceInput[];
  pages: MergePageInput[];
  assets?: OverlayAssetInput[];
  formValuesByDoc?: Record<number, Record<string, AcroFormFieldValue>>;
  flattenOutput?: boolean;
  fileName: string;
  onProgress: (current: number, total: number, message: string) => void;
}

export interface CreatePdfOptions {
  pages: CreatePdfPageInput[];
  assets: OverlayAssetInput[];
  fileName: string;
  onProgress: (current: number, total: number, message: string) => void;
}

/**
 * Coordinates PDF merging/editing/creation in a background Web Worker, cloning
 * ArrayBuffers before transfer so the UI retains ownership of open assets.
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
    const {
      sources,
      pages,
      assets = [],
      formValuesByDoc,
      flattenOutput,
      fileName,
      onProgress
    } = options;
    this.cancelled = false;

    if (typeof Worker !== "undefined") {
      const clonedSources: MergeSourceInput[] = sources.map((src) => ({
        docId: src.docId,
        fileName: src.fileName,
        bytes: src.bytes.slice(0)
      }));
      const clonedAssets: OverlayAssetInput[] = assets.map((asset) => ({
        assetId: asset.assetId,
        mimeType: asset.mimeType,
        bytes: asset.bytes.slice(0)
      }));

      const transferables: Transferable[] = [
        ...clonedSources.map((src) => src.bytes),
        ...clonedAssets.map((asset) => asset.bytes)
      ];

      const request: MergeWorkerRequest = {
        type: "merge",
        sources: clonedSources,
        pages,
        assets: clonedAssets,
        formValuesByDoc,
        flattenOutput,
        fileName
      };

      return this.runWorkerTask(request, transferables, onProgress);
    }

    const { mergePdfDocuments } = await import("./pdf-merge-builder");
    return mergePdfDocuments(
      sources,
      pages,
      fileName,
      {
        onProgress,
        isCancelled: () => this.cancelled
      },
      { assets, formValuesByDoc, flattenOutput }
    );
  }

  public async create(options: CreatePdfOptions): Promise<ArrayBuffer> {
    const { pages, assets, fileName, onProgress } = options;
    this.cancelled = false;

    if (typeof Worker !== "undefined") {
      const clonedAssets: OverlayAssetInput[] = assets.map((asset) => ({
        assetId: asset.assetId,
        mimeType: asset.mimeType,
        bytes: asset.bytes.slice(0)
      }));
      const transferables: Transferable[] = clonedAssets.map((a) => a.bytes);
      const request: CreatePdfWorkerRequest = {
        type: "create",
        pages,
        assets: clonedAssets,
        fileName
      };

      return this.runWorkerTask(request, transferables, onProgress);
    }

    const { buildCreatedPdf } = await import("./pdf-creator-builder");
    return buildCreatedPdf({
      pages,
      assets,
      fileName,
      onProgress,
      isCancelled: () => this.cancelled
    });
  }

  private runWorkerTask(
    request: MergeWorkerRequest | CreatePdfWorkerRequest,
    transferables: Transferable[],
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

        worker.postMessage(request, transferables);
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
