import type { PDFPageProxy } from "pdfjs-dist";
import type { AcroFormWidgetInfo, EditorTextAlign } from "../types";
import { pdfRectToViewerNorm, type PdfBoxRect } from "../utils/layout";

interface RawPdfJsAnnotation {
  id?: string;
  subtype?: string;
  rect?: [number, number, number, number];
  fieldName?: string;
  fieldType?: string;
  fieldValue?: unknown;
  defaultFieldValue?: unknown;
  multiLine?: boolean;
  readOnly?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  checkBox?: boolean;
  multiSelect?: boolean;
  buttonValue?: string;
  exportValue?: string;
  maxLen?: number | null;
  textAlignment?: number | null;
  defaultAppearanceData?: {
    fontSize?: number;
    fontColor?: Uint8ClampedArray | number[];
  };
  options?: Array<{ exportValue?: string; displayValue?: string }>;
}

function rgbArrayToHex(color?: Uint8ClampedArray | number[]): string {
  if (!color || color.length < 3) return "#111827";
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;
}

function mapTextAlign(code: number | null | undefined): EditorTextAlign {
  if (code === 1) return "center";
  if (code === 2) return "right";
  return "left";
}

/**
 * Extracts interactive AcroForm fields on a rendered PDF.js page and maps their
 * rectangles into normalized [0..1] viewer coordinates aligned with the active rotation.
 */
export async function extractAcroFormWidgets(
  page: PDFPageProxy,
  totalRotation: number
): Promise<AcroFormWidgetInfo[]> {
  let rawList: RawPdfJsAnnotation[];
  try {
    rawList = (await page.getAnnotations({ intent: "display" })) as RawPdfJsAnnotation[];
  } catch {
    return [];
  }

  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const view = page.view;
  const cropBox: PdfBoxRect = {
    x: view[0] ?? 0,
    y: view[1] ?? 0,
    width: Math.max(1, (view[2] ?? 612) - (view[0] ?? 0)),
    height: Math.max(1, (view[3] ?? 792) - (view[1] ?? 0))
  };

  const widgets: AcroFormWidgetInfo[] = [];

  for (let idx = 0; idx < rawList.length; idx++) {
    const annot = rawList[idx];
    if (annot.subtype !== "Widget") continue;
    if (!annot.fieldName || !Array.isArray(annot.rect) || annot.rect.length < 4) {
      continue;
    }
    if (annot.pushButton) continue;

    const fieldTypeCode = annot.fieldType;
    if (fieldTypeCode !== "Tx" && fieldTypeCode !== "Btn" && fieldTypeCode !== "Ch") {
      continue;
    }

    const norm = pdfRectToViewerNorm(annot.rect, cropBox, totalRotation);
    const widgetId = annot.id || `widget-${annot.fieldName}-${idx}`;

    if (fieldTypeCode === "Tx") {
      const rawVal = annot.fieldValue ?? annot.defaultFieldValue ?? "";
      const fontSize =
        annot.defaultAppearanceData?.fontSize &&
        annot.defaultAppearanceData.fontSize > 0
          ? annot.defaultAppearanceData.fontSize
          : 11;

      widgets.push({
        widgetId,
        fieldName: annot.fieldName,
        fieldType: "text",
        ...norm,
        multiline: Boolean(annot.multiLine),
        maxLen:
          typeof annot.maxLen === "number" && annot.maxLen > 0
            ? annot.maxLen
            : null,
        align: mapTextAlign(annot.textAlignment),
        fontSizePt: fontSize,
        textColor: rgbArrayToHex(annot.defaultAppearanceData?.fontColor),
        options: [],
        exportValue: "",
        defaultValue: typeof rawVal === "string" ? rawVal : String(rawVal ?? ""),
        readOnly: Boolean(annot.readOnly)
      });
      continue;
    }

    if (fieldTypeCode === "Btn") {
      if (annot.radioButton) {
        const exportValue = annot.buttonValue || annot.exportValue || "Yes";
        const rawVal = String(annot.fieldValue ?? "");
        widgets.push({
          widgetId,
          fieldName: annot.fieldName,
          fieldType: "radio",
          ...norm,
          multiline: false,
          maxLen: null,
          align: "center",
          fontSizePt: 11,
          textColor: "#111827",
          options: [],
          exportValue,
          defaultValue: rawVal,
          readOnly: Boolean(annot.readOnly)
        });
      } else {
        const rawVal = annot.fieldValue;
        const checked =
          rawVal !== undefined &&
          rawVal !== null &&
          rawVal !== "" &&
          rawVal !== "Off" &&
          rawVal !== false;
        widgets.push({
          widgetId,
          fieldName: annot.fieldName,
          fieldType: "checkbox",
          ...norm,
          multiline: false,
          maxLen: null,
          align: "center",
          fontSizePt: 11,
          textColor: "#111827",
          options: [],
          exportValue: annot.exportValue || "Yes",
          defaultValue: checked,
          readOnly: Boolean(annot.readOnly)
        });
      }
      continue;
    }

    if (fieldTypeCode === "Ch") {
      const options = Array.isArray(annot.options)
        ? annot.options.map((opt) => ({
            exportValue: opt.exportValue ?? opt.displayValue ?? "",
            displayValue: opt.displayValue ?? opt.exportValue ?? ""
          }))
        : [];
      const currentVal = Array.isArray(annot.fieldValue)
        ? String(annot.fieldValue[0] ?? "")
        : String(annot.fieldValue ?? annot.defaultFieldValue ?? "");

      widgets.push({
        widgetId,
        fieldName: annot.fieldName,
        fieldType: "select",
        ...norm,
        multiline: false,
        maxLen: null,
        align: mapTextAlign(annot.textAlignment),
        fontSizePt: annot.defaultAppearanceData?.fontSize || 11,
        textColor: rgbArrayToHex(annot.defaultAppearanceData?.fontColor),
        options,
        exportValue: "",
        defaultValue: currentVal,
        readOnly: Boolean(annot.readOnly)
      });
    }
  }

  return widgets;
}

