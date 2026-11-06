import {
  PDFDocument,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb
} from "pdf-lib";
import type { Quality, Settings, WorkerPageInput } from "../types";
import { isPngFile } from "../utils/format";
import {
  computePdfDrawPlacement,
  getEffectiveMargin,
  getPageDimensions
} from "../utils/layout";

export interface BuildPdfCallbacks {
  rasterizeToJpeg: (
    item: WorkerPageInput,
    quality: Quality
  ) => Promise<ArrayBuffer>;
  onProgress: (current: number, total: number, message: string) => void;
  isCancelled: () => boolean;
}

export async function buildPdfDocument(
  pages: WorkerPageInput[],
  settings: Settings,
  callbacks: BuildPdfCallbacks
): Promise<ArrayBuffer> {
  const { rasterizeToJpeg, onProgress, isCancelled } = callbacks;

  const pdf = await PDFDocument.create();
  pdf.setTitle(settings.fileName.trim() || "Meu documento");
  pdf.setCreator("PixelPDF • TypeScript + pdf-lib");
  pdf.setProducer("PixelPDF");
  pdf.setSubject("PDF criado a partir de imagens");

  for (let index = 0; index < pages.length; index++) {
    if (isCancelled()) {
      throw new Error("CANCELLED");
    }

    const item = pages[index];
    onProgress(
      index,
      pages.length,
      `Processando ${index + 1} de ${pages.length}: ${item.fileName}`
    );

    let embedded: Awaited<ReturnType<PDFDocument["embedJpg"]>>;

    if (item.preRasterizedJpeg) {
      embedded = await pdf.embedJpg(item.preRasterizedJpeg);
    } else if (
      isPngFile(item.fileName, item.mimeType) &&
      settings.quality === "high"
    ) {
      try {
        const pngBuffer = await item.file.arrayBuffer();
        embedded = await pdf.embedPng(pngBuffer);
      } catch {
        const jpegBuffer = await rasterizeToJpeg(item, settings.quality);
        embedded = await pdf.embedJpg(jpegBuffer);
      }
    } else {
      const jpegBuffer = await rasterizeToJpeg(item, settings.quality);
      embedded = await pdf.embedJpg(jpegBuffer);
    }

    if (isCancelled()) {
      throw new Error("CANCELLED");
    }

    const naturalW = item.width || embedded.width;
    const naturalH = item.height || embedded.height;

    const [pageWidth, pageHeight] = getPageDimensions(
      naturalW,
      naturalH,
      item.rotation,
      settings
    );
    const effectiveMargin = getEffectiveMargin(settings, pageWidth, pageHeight);

    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1)
    });

    const placement = computePdfDrawPlacement(
      embedded.width,
      embedded.height,
      pageWidth,
      pageHeight,
      effectiveMargin,
      settings.fitMode,
      item.rotation
    );

    if (placement.needsClip) {
      page.pushOperators(
        pushGraphicsState(),
        rectangle(
          placement.clipX,
          placement.clipY,
          placement.clipW,
          placement.clipH
        ),
        clip(),
        endPath()
      );
    }

    page.drawImage(embedded, {
      x: placement.drawX,
      y: placement.drawY,
      width: placement.drawWidth,
      height: placement.drawHeight,
      rotate: degrees(placement.pdfRotationDegrees)
    });

    if (placement.needsClip) {
      page.pushOperators(popGraphicsState());
    }

    onProgress(index + 1, pages.length, `Página ${index + 1} concluída`);
  }

  if (isCancelled()) {
    throw new Error("CANCELLED");
  }

  onProgress(pages.length, pages.length, "Finalizando arquivo PDF...");

  const pdfBytes = await pdf.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return pdfBuffer;
}

