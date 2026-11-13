import { PDFDocument, degrees } from "pdf-lib";
import type { MergePageInput, MergeSourceInput } from "../types";
import { normalizeRotation } from "../utils/layout";

export interface MergePdfCallbacks {
  onProgress: (current: number, total: number, message: string) => void;
  isCancelled: () => boolean;
}

/**
 * Combines, reorders, duplicates, and rotates pages from one or more source PDFs
 * entirely inside browser/worker memory using pdf-lib.
 */
export async function mergePdfDocuments(
  sources: MergeSourceInput[],
  pages: MergePageInput[],
  fileName: string,
  callbacks: MergePdfCallbacks
): Promise<ArrayBuffer> {
  const { onProgress, isCancelled } = callbacks;

  if (pages.length === 0) {
    throw new Error("Nenhuma página selecionada para exportar.");
  }

  const totalSteps = sources.length + pages.length;
  let completedSteps = 0;

  const loadedDocs = new Map<number, PDFDocument>();

  for (const src of sources) {
    if (isCancelled()) throw new Error("CANCELLED");

    onProgress(
      completedSteps,
      totalSteps,
      `Carregando origem: ${src.fileName}`
    );

    try {
      const doc = await PDFDocument.load(src.bytes, {
        updateMetadata: false
      });
      loadedDocs.set(src.docId, doc);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/encrypt/i.test(msg)) {
        throw new Error(
          `O arquivo "${src.fileName}" possui criptografia e não pode ser reorganizado/exportado no navegador.`
        );
      }
      throw new Error(
        `Não foi possível ler "${src.fileName}" para exportação.`
      );
    }

    completedSteps += 1;
    onProgress(completedSteps, totalSteps, `Origem carregada: ${src.fileName}`);
  }

  const outputPdf = await PDFDocument.create();
  outputPdf.setTitle(fileName.trim() || "documento-organizado");
  outputPdf.setCreator("RootPDF • TypeScript + pdf-lib");
  outputPdf.setProducer("RootPDF");
  outputPdf.setSubject("PDF organizado localmente no RootPDF");

  // Copy page-by-page so arbitrary cross-document ordering, duplicates, and progress updates remain exact
  for (let index = 0; index < pages.length; index++) {
    if (isCancelled()) throw new Error("CANCELLED");

    const item = pages[index];
    const sourceDoc = loadedDocs.get(item.sourceDocId);
    if (!sourceDoc) {
      throw new Error("Documento de origem não encontrado para a página.");
    }

    const [copiedPage] = await outputPdf.copyPages(sourceDoc, [
      item.sourcePageIndex
    ]);

    // PDF page /Rotate dictionary entry uses clockwise degrees (matching UI/PDF.js)
    const intrinsicRotation = copiedPage.getRotation().angle ?? 0;
    const finalRotation = normalizeRotation(
      intrinsicRotation + item.deltaRotation
    );
    copiedPage.setRotation(degrees(finalRotation));
    outputPdf.addPage(copiedPage);

    completedSteps += 1;
    onProgress(
      completedSteps,
      totalSteps,
      `Montando página ${index + 1} de ${pages.length}...`
    );
  }

  if (isCancelled()) throw new Error("CANCELLED");

  onProgress(totalSteps, totalSteps, "Finalizando arquivo PDF...");

  const pdfBytes = await outputPdf.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return pdfBuffer;
}
