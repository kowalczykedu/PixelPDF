import { PAGE_SIZES, type FitMode, type Quality, type Settings } from "../types";

export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function getRotatedDimensions(
  width: number,
  height: number,
  rotation: number
): [number, number] {
  const norm = normalizeRotation(rotation);
  return norm === 90 || norm === 270 ? [height, width] : [width, height];
}

export function getPageDimensions(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
  settings: Pick<Settings, "pageSize" | "orientation">
): [number, number] {
  const safeW = naturalWidth > 0 ? naturalWidth : 1000;
  const safeH = naturalHeight > 0 ? naturalHeight : 1400;
  const [rotatedW, rotatedH] = getRotatedDimensions(safeW, safeH, rotation);

  if (settings.pageSize === "image") {
    const scale = 0.75;
    return [Math.max(1, rotatedW * scale), Math.max(1, rotatedH * scale)];
  }

  const base = PAGE_SIZES[settings.pageSize];
  const minSide = Math.min(base.width, base.height);
  const maxSide = Math.max(base.width, base.height);

  if (settings.orientation === "portrait") {
    return [minSide, maxSide];
  }
  if (settings.orientation === "landscape") {
    return [maxSide, minSide];
  }

  // "auto": match the rotated image's orientation
  const isImageLandscape = rotatedW > rotatedH;
  return isImageLandscape ? [maxSide, minSide] : [minSide, maxSide];
}

export function getEffectiveMargin(
  settings: Pick<Settings, "pageSize" | "margin">,
  pageWidth: number,
  pageHeight: number
): number {
  if (settings.pageSize === "image") return 0;
  const maxAllowed = Math.max(0, Math.min(pageWidth, pageHeight) / 2 - 4);
  return Math.min(Math.max(0, settings.margin), maxAllowed);
}

export function qualityConfig(quality: Quality): {
  jpeg: number;
  maxDimension: number;
} {
  if (quality === "compact") return { jpeg: 0.6, maxDimension: 2200 };
  if (quality === "balanced") return { jpeg: 0.78, maxDimension: 3200 };
  return { jpeg: 0.9, maxDimension: 5000 };
}

export interface PdfDrawPlacement {
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  /** Counter-clockwise angle in degrees expected by pdf-lib (Y-up coordinate system) */
  pdfRotationDegrees: number;
  clipX: number;
  clipY: number;
  clipW: number;
  clipH: number;
  needsClip: boolean;
}

/**
 * Computes exact PDF coordinates and rotation angle.
 * Note: UI rotation is clockwise (90 = right, 270 = left), whereas PDF coordinate space
 * has Y pointing UP, meaning positive angles in pdf-lib rotate counter-clockwise.
 */
export function computePdfDrawPlacement(
  sourceW: number,
  sourceH: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  fitMode: FitMode,
  clockwiseRotation: number
): PdfDrawPlacement {
  const normalizedClockwise = normalizeRotation(clockwiseRotation);
  const [rotatedW, rotatedH] = getRotatedDimensions(
    sourceW,
    sourceH,
    normalizedClockwise
  );

  const areaW = Math.max(1, pageWidth - margin * 2);
  const areaH = Math.max(1, pageHeight - margin * 2);

  let renderedW: number;
  let renderedH: number;

  if (fitMode === "stretch") {
    renderedW = areaW;
    renderedH = areaH;
  } else {
    const scale =
      fitMode === "cover"
        ? Math.max(areaW / rotatedW, areaH / rotatedH)
        : Math.min(areaW / rotatedW, areaH / rotatedH);

    renderedW = rotatedW * scale;
    renderedH = rotatedH * scale;
  }

  const targetX = margin + (areaW - renderedW) / 2;
  const targetY = margin + (areaH - renderedH) / 2;

  const scaleX = renderedW / rotatedW;
  const scaleY = renderedH / rotatedH;

  const drawWidth = sourceW * scaleX;
  const drawHeight = sourceH * scaleY;

  let drawX = targetX;
  let drawY = targetY;
  let pdfRotationDegrees = 0;

  switch (normalizedClockwise) {
    case 90:
      // 90° clockwise (right) = -90° (or 270°) counter-clockwise in PDF Y-up space
      drawX = targetX;
      drawY = targetY + renderedH;
      pdfRotationDegrees = -90;
      break;
    case 180:
      drawX = targetX + renderedW;
      drawY = targetY + renderedH;
      pdfRotationDegrees = 180;
      break;
    case 270:
      // 270° clockwise (90° left) = +90° counter-clockwise in PDF Y-up space
      drawX = targetX + renderedW;
      drawY = targetY;
      pdfRotationDegrees = 90;
      break;
    case 0:
    default:
      drawX = targetX;
      drawY = targetY;
      pdfRotationDegrees = 0;
      break;
  }

  return {
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    pdfRotationDegrees,
    clipX: margin,
    clipY: margin,
    clipW: areaW,
    clipH: areaH,
    needsClip: fitMode === "cover"
  };
}
