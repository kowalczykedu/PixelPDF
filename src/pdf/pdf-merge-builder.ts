import { PDFDocument, degrees } from "pdf-lib";
import type {
  AcroFormFieldValue,
  MergePageInput,
  MergeSourceInput,
  OverlayAssetInput
} from "../types";
import { normalizeRotation } from "../utils/layout";
import { applyAcroFormValues } from "./pdf-acroform-helper";
import {
  PdfAssetCache,
  PdfFontCache,
  drawPageOverlays,
  getPageEffectiveBox
} from "./pdf-overlay-renderer";

export interface MergePdfCallbacks {
  onProgress: (current: number, total: number, message: string) => void;
  isCancelled: () => boolean;
}

export interface MergePdfExtraOptions {
  assets?: OverlayAssetInput[];
  formValuesByDoc?: Record<number, Record<string, AcroFormFieldValue>>;
  flattenOutput?: boolean;
}

function finalizeBytes(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/**
 * Combines, reorders, duplicates, rotates, stamps layered edits/signatures,
 * and saves AcroForm values from one or more source PDFs entirely inside
 * browser/worker memory using pdf-lib.
 */
export async function mergePdfDocuments(
  sources: MergeSourceInput[],
  pages: MergePageInput[],
  fileName: string,
  callbacks: MergePdfCallbacks,
  extra: MergePdfExtraOptions = {}
): Promise<ArrayBuffer> {
  const { onProgress, isCancelled } = callbacks;
  const { assets = [], formValuesByDoc = {}, flattenOutput = false } = extra;

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
          `O arquivo "${src.fileName}" possui criptografia e não pode ser editado/reorganizado no navegador.`
        );
      }
      throw new Error(
        `Não foi possível ler "${src.fileName}" para exportação.`
      );
    }

    completedSteps += 1;
    onProgress(completedSteps, totalSteps, `Origem carregada: ${src.fileName}`);
  }

  const title = fileName.trim() || "documento-organizado";
  const singleSource = sources.length === 1 ? sources[0] : null;
  const uniqueSingleIndices = singleSource
    ? new Set(
        pages
          .filter((p) => p.sourceDocId === singleSource.docId)
          .map((p) => p.sourcePageIndex)
      )
    : null;
  const canEditInPlace =
    singleSource !== null &&
    !flattenOutput &&
    uniqueSingleIndices !== null &&
    uniqueSingleIndices.size === pages.length;

  // Preserve live AcroForms & outlines when editing a single non-duplicated document
  if (canEditInPlace && singleSource && uniqueSingleIndices) {
    const doc = loadedDocs.get(singleSource.docId);
    if (!doc) {
      throw new Error(
        `Documento de origem "${singleSource.fileName}" indisponível.`
      );
    }

    applyAcroFormValues(doc, formValuesByDoc[singleSource.docId], false);

    const desiredPages = pages.map((item) => doc.getPage(item.sourcePageIndex));
    for (let idx = doc.getPageCount() - 1; idx >= 0; idx--) {
      if (!uniqueSingleIndices.has(idx)) {
        doc.removePage(idx);
      }
    }

    for (let targetIdx = 0; targetIdx < desiredPages.length; targetIdx++) {
      const desired = desiredPages[targetIdx];
      const currentIdx = doc.getPages().indexOf(desired);
      if (currentIdx !== -1 && currentIdx !== targetIdx) {
        doc.removePage(currentIdx);
        doc.insertPage(targetIdx, desired);
      }
    }

    const fontCache = new PdfFontCache(doc);
    const assetCache = new PdfAssetCache(doc, assets);

    for (let index = 0; index < pages.length; index++) {
      if (isCancelled()) throw new Error("CANCELLED");

      const item = pages[index];
      const page = desiredPages[index];
      const intrinsicRotation = page.getRotation().angle ?? 0;
      const finalRotation = normalizeRotation(
        intrinsicRotation + item.deltaRotation
      );
      page.setRotation(degrees(finalRotation));

      if (item.overlays && item.overlays.length > 0) {
        await drawPageOverlays({
          page,
          cropBox: getPageEffectiveBox(page),
          totalRotation: finalRotation,
          overlays: item.overlays,
          fontCache,
          assetCache
        });
      }

      completedSteps += 1;
      onProgress(
        completedSteps,
        totalSteps,
        `Aplicando edições na página ${index + 1} de ${pages.length}...`
      );
    }

    if (isCancelled()) throw new Error("CANCELLED");

    doc.setTitle(title);
    doc.setCreator("RootPDF • TypeScript + pdf-lib");
    doc.setProducer("RootPDF");
    onProgress(totalSteps, totalSteps, "Finalizando documento PDF...");

    const pdfBytes = await doc.save();
    return finalizeBytes(pdfBytes);
  }

  // Multi-source merge, duplicated pages, or explicit flatten: flatten forms before copyPages
  for (const [docId, doc] of loadedDocs.entries()) {
    applyAcroFormValues(doc, formValuesByDoc[docId], true);
  }

  const outputPdf = await PDFDocument.create();
  outputPdf.setTitle(title);
  outputPdf.setCreator("RootPDF • TypeScript + pdf-lib");
  outputPdf.setProducer("RootPDF");
  outputPdf.setSubject("PDF editado e organizado localmente no RootPDF");

  const fontCache = new PdfFontCache(outputPdf);
  const assetCache = new PdfAssetCache(outputPdf, assets);

  for (let index = 0; index < pages.length; index++) {
    if (isCancelled()) throw new Error("CANCELLED");

    const item = pages[index];
    const sourceDoc = loadedDocs.get(item.sourceDocId);
    if (!sourceDoc) {
      throw new Error(
        `Documento de origem (${item.sourceDocId}) indisponível na exportação.`
      );
    }

    const [copiedPage] = await outputPdf.copyPages(sourceDoc, [
      item.sourcePageIndex
    ]);

    const intrinsicRotation = copiedPage.getRotation().angle ?? 0;
    const finalRotation = normalizeRotation(
      intrinsicRotation + item.deltaRotation
    );
    copiedPage.setRotation(degrees(finalRotation));
    outputPdf.addPage(copiedPage);

    if (item.overlays && item.overlays.length > 0) {
      await drawPageOverlays({
        page: copiedPage,
        cropBox: getPageEffectiveBox(copiedPage),
        totalRotation: finalRotation,
        overlays: item.overlays,
        fontCache,
        assetCache
      });
    }

    completedSteps += 1;
    onProgress(
      completedSteps,
      totalSteps,
      `Processando página ${index + 1} de ${pages.length}...`
    );
  }

  if (isCancelled()) throw new Error("CANCELLED");

  onProgress(totalSteps, totalSteps, "Finalizando arquivo PDF...");

  const pdfBytes = await outputPdf.save();
  return finalizeBytes(pdfBytes);
}
