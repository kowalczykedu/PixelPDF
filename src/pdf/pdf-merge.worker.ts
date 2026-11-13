import type { ReaderWorkerRequest, ReaderWorkerResponse } from "../types";
import { mergePdfDocuments } from "./pdf-merge-builder";

let cancelled = false;

function post(message: ReaderWorkerResponse, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    self.postMessage(message, { transfer });
  } else {
    self.postMessage(message);
  }
}

self.addEventListener(
  "message",
  async (event: MessageEvent<ReaderWorkerRequest>) => {
    const data = event.data;

    if (data.type === "cancel") {
      cancelled = true;
      return;
    }

    if (data.type === "merge") {
      cancelled = false;
      try {
        const pdfBuffer = await mergePdfDocuments(
          data.sources,
          data.pages,
          data.fileName,
          {
            onProgress: (current, total, message) => {
              post({ type: "progress", current, total, message });
            },
            isCancelled: () => cancelled
          }
        );

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
          error instanceof Error ? error.message : "Erro ao exportar o PDF.";
        post({ type: "error", message });
      }
    }
  }
);

