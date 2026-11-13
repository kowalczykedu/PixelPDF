import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts
} from "pdf-lib";
import type { AcroFormFieldValue } from "../types";
import { sanitizeWinAnsiText } from "../utils/layout";

/**
 * Applies modified AcroForm field values to a loaded pdf-lib document and
 * optionally flattens the form into static page content streams.
 */
export function applyAcroFormValues(
  pdfDoc: PDFDocument,
  values: Record<string, AcroFormFieldValue> | undefined,
  flatten: boolean
): void {
  const hasEdits = values && Object.keys(values).length > 0;
  if (!hasEdits && !flatten) return;

  let form;
  try {
    form = pdfDoc.getForm();
  } catch {
    return;
  }

  let fields;
  try {
    fields = form.getFields();
  } catch {
    return;
  }

  if (fields.length === 0) return;

  try {
    if (form.hasXFA() && hasEdits) {
      form.deleteXFA();
    }
  } catch {
    // Ignore XFA cleanup failures
  }

  if (values) {
    for (const [fieldName, rawValue] of Object.entries(values)) {
      let field;
      try {
        field = form.getFieldMaybe(fieldName);
      } catch {
        continue;
      }
      if (!field) continue;

      try {
        if (field instanceof PDFTextField) {
          const textVal = sanitizeWinAnsiText(String(rawValue ?? "")).text;
          field.setText(textVal);
        } else if (field instanceof PDFCheckBox) {
          if (rawValue === true || rawValue === "Yes" || rawValue === "On") {
            field.check();
          } else {
            field.uncheck();
          }
        } else if (field instanceof PDFDropdown) {
          const opt = String(rawValue ?? "");
          if (opt.length > 0) {
            field.select(opt);
          } else {
            field.clear();
          }
        } else if (field instanceof PDFRadioGroup) {
          const opt = String(rawValue ?? "");
          if (opt.length > 0) {
            field.select(opt);
          } else {
            field.clear();
          }
        } else if (field instanceof PDFOptionList) {
          const opt = String(rawValue ?? "");
          if (opt.length > 0) {
            field.select(opt);
          } else {
            field.clear();
          }
        }
      } catch {
        // Ignore single malformed/incompatible field so export keeps going
      }
    }
  }

  try {
    const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
  } catch {
    // Some legacy forms declare missing font dicts on select widgets; still attempt flatten
  }

  if (flatten) {
    try {
      form.flatten({ updateFieldAppearances: false });
    } catch {
      // Fallback: ignore if PDF has malformed AcroForm widgets
    }
  }
}

