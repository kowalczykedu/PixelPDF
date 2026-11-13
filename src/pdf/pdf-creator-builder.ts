import { PDFDocument, rgb } from "pdf-lib";
import { PAGE_SIZES, type CreatePdfPageInput, type OverlayAssetInput } from "../types";
import { parseHexRgb } from "../utils/layout";
import {
  PdfAssetCache,
  PdfFontCache,
  drawPageOverlays,
  getPageEffectiveBox
} from "./pdf-overlay-renderer";

export interface BuildCreatedPdfParams {
  pages: CreatePdfPageInput[];
  assets: OverlayAssetInput[];
  fileName: string;
  onProgress: (current: number, total: number, message: string) => void;
  isCancelled: () => boolean;
}

/**
 * Generates a brand-new multi-page PDF document from composed text and image blocks.
 */
export async function buildCreatedPdf(
  params: BuildCreatedPdfParams
): Promise<ArrayBuffer> {
  const { pages, assets, fileName, onProgress, isCancelled } = params;

  if (pages.length === 0) {
    throw new Error("Adicione ao menos uma página antes de gerar o PDF.");
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(fileName || "Novo Documento");
  pdfDoc.setCreator("RootPDF • Estúdio Local de PDF");
  pdfDoc.setProducer("pdf-lib (Execução Local)");

  const fontCache = new PdfFontCache(pdfDoc);
  const assetCache = new PdfAssetCache(pdfDoc, assets);
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    if (isCancelled()) {
      throw new Error("CANCELLED");
    }

    const pageSpec = pages[i];
    const sizeSpec = PAGE_SIZES[pageSpec.pageSize] ?? PAGE_SIZES.a4;
    const baseW = sizeSpec.width;
    const baseH = sizeSpec.height;
    const widthPt =
      pageSpec.orientation === "landscape"
        ? Math.max(baseW, baseH)
        : Math.min(baseW, baseH);
    const heightPt =
      pageSpec.orientation === "landscape"
        ? Math.min(baseW, baseH)
        : Math.max(baseW, baseH);

    const page = pdfDoc.addPage([widthPt, heightPt]);

    if (
      pageSpec.backgroundColor &&
      pageSpec.backgroundColor.toLowerCase() !== "#ffffff"
    ) {
      const bg = parseHexRgb(pageSpec.backgroundColor);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: widthPt,
        height: heightPt,
        color: rgb(bg.r, bg.g, bg.b)
      });
    }

    const box = getPageEffectiveBox(page);
    await drawPageOverlays({
      page,
      cropBox: box,
      totalRotation: 0,
      overlays: pageSpec.blocks,
      fontCache,
      assetCache
    });

    onProgress(i + 1, total, `Montando página ${i + 1} de ${total}...`);
  }

  if (isCancelled()) {
    throw new Error("CANCELLED");
  }

  onProgress(total, total, "Finalizando documento PDF...");
  const bytes = await pdfDoc.save();
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}
