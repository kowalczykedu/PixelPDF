import type { SavedSignature, SignatureKind } from "../types";
import { nextAssetId } from "./image-asset-helper";

const SIGNATURES_STORAGE_KEY = "rootpdf-signatures";
const MAX_SAVED_SIGNATURES = 24;

export type TypedSignatureStyle = "cursive" | "serif" | "mono";

export function loadSavedSignatures(): SavedSignature[] {
  try {
    const raw = localStorage.getItem(SIGNATURES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedSignature =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        typeof entry.dataUrl === "string" &&
        entry.dataUrl.startsWith("data:image/png") &&
        typeof entry.aspectRatio === "number" &&
        Number.isFinite(entry.aspectRatio) &&
        entry.aspectRatio > 0
    );
  } catch {
    return [];
  }
}

function persistSignatures(list: SavedSignature[]): string | null {
  try {
    localStorage.setItem(SIGNATURES_STORAGE_KEY, JSON.stringify(list));
    return null;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "QuotaExceededError") {
      return "Limite de armazenamento local atingido. Remova assinaturas antigas para salvar novas.";
    }
    return "Não foi possível salvar a assinatura no armazenamento local.";
  }
}

export function addSavedSignature(input: {
  label: string;
  kind: SignatureKind;
  dataUrl: string;
  aspectRatio: number;
}): { signatures: SavedSignature[]; item: SavedSignature; error?: string } {
  const existing = loadSavedSignatures();
  const item: SavedSignature = {
    id: nextAssetId("sig"),
    label: input.label.trim() || "Assinatura",
    kind: input.kind,
    dataUrl: input.dataUrl,
    aspectRatio: Math.max(0.3, Math.min(12, input.aspectRatio)),
    createdAt: Date.now()
  };

  const next = [item, ...existing].slice(0, MAX_SAVED_SIGNATURES);
  const error = persistSignatures(next);
  return { signatures: error ? existing : next, item, error: error ?? undefined };
}

export function deleteSavedSignature(id: string): SavedSignature[] {
  const next = loadSavedSignatures().filter((s) => s.id !== id);
  persistSignatures(next);
  return next;
}

export function clearAllSavedSignatures(): SavedSignature[] {
  try {
    localStorage.removeItem(SIGNATURES_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
  return [];
}

/**
 * Crops empty transparent borders around a drawn/rendered signature canvas
 * and outputs a crisp transparent PNG with natural aspect ratio.
 */
export function trimCanvasToSignaturePng(
  sourceCanvas: HTMLCanvasElement,
  paddingPx = 12
): { dataUrl: string; aspectRatio: number; hasInk: boolean } {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx || w === 0 || h === 0) {
    return { dataUrl: "", aspectRatio: 3, hasInk: false };
  }

  const imageData = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w * 4;
    for (let x = 0; x < w; x++) {
      const alpha = imageData[rowOffset + x * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { dataUrl: "", aspectRatio: 3, hasInk: false };
  }

  const cropX = Math.max(0, minX - paddingPx);
  const cropY = Math.max(0, minY - paddingPx);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + paddingPx * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + paddingPx * 2);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = Math.max(1, cropW);
  outCanvas.height = Math.max(1, cropH);
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) {
    return { dataUrl: "", aspectRatio: 3, hasInk: false };
  }
  outCtx.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return {
    dataUrl: outCanvas.toDataURL("image/png"),
    aspectRatio: cropW / Math.max(1, cropH),
    hasInk: true
  };
}

export function renderTypedSignatureToPng(
  rawText: string,
  style: TypedSignatureStyle,
  color: string
): { dataUrl: string; aspectRatio: number; hasInk: boolean } {
  const text = rawText.trim();
  if (!text) {
    return { dataUrl: "", aspectRatio: 3, hasInk: false };
  }

  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 280;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: "", aspectRatio: 3, hasInk: false };
  }

  let fontSpec = 'italic 86px "Brush Script MT", "Segoe Script", "Apple Chancery", cursive';
  if (style === "serif") {
    fontSpec = 'italic 74px Georgia, "Times New Roman", serif';
  } else if (style === "mono") {
    fontSpec = '700 58px "Space Mono", ui-monospace, monospace';
  }

  ctx.font = fontSpec;
  const measured = ctx.measureText(text).width;
  if (measured > 880) {
    const scaleDown = 880 / measured;
    const baseSize = style === "mono" ? 58 : style === "serif" ? 74 : 86;
    const nextSize = Math.max(24, Math.floor(baseSize * scaleDown));
    if (style === "cursive") {
      fontSpec = `italic ${nextSize}px "Brush Script MT", "Segoe Script", "Apple Chancery", cursive`;
    } else if (style === "serif") {
      fontSpec = `italic ${nextSize}px Georgia, "Times New Roman", serif`;
    } else {
      fontSpec = `700 ${nextSize}px "Space Mono", ui-monospace, monospace`;
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontSpec;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  return trimCanvasToSignaturePng(canvas, 14);
}

export async function rasterizeSignatureUploadFile(
  file: File
): Promise<{ dataUrl: string; aspectRatio: number; label: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error("Não foi possível carregar a imagem da assinatura."));
      el.src = objectUrl;
    });

    const natW = Math.max(1, img.naturalWidth || img.width || 600);
    const natH = Math.max(1, img.naturalHeight || img.height || 200);
    const maxW = 840;
    const scale = Math.min(1, maxW / Math.max(natW, natH));
    const targetW = Math.max(1, Math.round(natW * scale));
    const targetH = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Contexto Canvas 2D indisponível.");
    }
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/png");
    const label = file.name.replace(/\.[^.]+$/, "") || "Assinatura";
    return {
      dataUrl,
      aspectRatio: targetW / Math.max(1, targetH),
      label
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

