export interface NormalizedImageAsset {
  assetId: string;
  fileName: string;
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg";
  bytes: ArrayBuffer;
  width: number;
  height: number;
}

let assetCounter = 1;

export function nextAssetId(prefix = "asset"): string {
  return `${prefix}-${Date.now().toString(36)}-${(assetCounter++).toString(36)}`;
}

export function dataUrlToAssetBytes(dataUrl: string): {
  mimeType: "image/png" | "image/jpeg";
  bytes: ArrayBuffer;
} {
  const match = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Formato de imagem em memória inválido para exportação PDF.");
  }

  const rawMime = match[1].toLowerCase();
  const mimeType: "image/png" | "image/jpeg" =
    rawMime === "image/png" ? "image/png" : "image/jpeg";

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { mimeType, bytes: bytes.buffer };
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao ler os bytes da imagem."));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao carregar imagem."));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Não foi possível decodificar a imagem selecionada."));
    img.src = src;
  });
}

/**
 * Decodes PNG, JPEG, WEBP, AVIF, GIF, BMP, or SVG files locally in the browser
 * into PDF-ready PNG/JPEG bytes + Data URL preserving alpha channels.
 */
export async function normalizeImageFileToAsset(
  file: File,
  maxDimension = 1800
): Promise<NormalizedImageAsset> {
  const isJpeg =
    file.type === "image/jpeg" || /\.(jpe?g)$/i.test(file.name);
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const naturalW = Math.max(1, img.naturalWidth || img.width || 600);
    const naturalH = Math.max(1, img.naturalHeight || img.height || 400);

    // Keep native PNG/JPEG untouched if reasonably bounded so quality and alpha stay verbatim
    if ((isJpeg || isPng) && naturalW <= maxDimension && naturalH <= maxDimension) {
      const [bytes, dataUrl] = await Promise.all([
        file.arrayBuffer(),
        readBlobAsDataUrl(file)
      ]);
      return {
        assetId: nextAssetId("img"),
        fileName: file.name,
        dataUrl,
        mimeType: isPng ? "image/png" : "image/jpeg",
        bytes,
        width: naturalW,
        height: naturalH
      };
    }

    const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Contexto Canvas 2D indisponível para converter a imagem.");
    }
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const outMime: "image/png" | "image/jpeg" = isJpeg ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Falha ao converter imagem para o PDF."));
        },
        outMime,
        isJpeg ? 0.92 : undefined
      );
    });

    const [bytes, dataUrl] = await Promise.all([
      blob.arrayBuffer(),
      readBlobAsDataUrl(blob)
    ]);

    return {
      assetId: nextAssetId("img"),
      fileName: file.name,
      dataUrl,
      mimeType: outMime,
      bytes,
      width: targetW,
      height: targetH
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

