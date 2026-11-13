import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

export type PdfJsModule = typeof import("pdfjs-dist");

let cachedPdfJsPromise: Promise<PdfJsModule> | null = null;

/**
 * Lazily loads pdfjs-dist and configures its dedicated module worker asset
 * compatible with both dev server and static subpath builds (GitHub Pages).
 */
export async function loadPdfJs(): Promise<PdfJsModule> {
  if (!cachedPdfJsPromise) {
    cachedPdfJsPromise = (async () => {
      const [pdfjs, workerAsset] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerAsset.default;
      return pdfjs;
    })().catch((err) => {
      cachedPdfJsPromise = null;
      throw err;
    });
  }
  return cachedPdfJsPromise;
}

export interface OpenPdfResult {
  pdfDoc: PDFDocumentProxy;
  usedPassword: boolean;
}

export type PasswordPromptFn = (isRetry: boolean) => Promise<string | null>;

/**
 * Opens an in-memory PDF buffer with pdfjs-dist, handling encrypted PDFs via an
 * accessible password prompt callback and translating low-level errors to PT-BR.
 */
export async function openPdfFromBuffer(
  bytes: ArrayBuffer,
  fileName: string,
  requestPassword: PasswordPromptFn
): Promise<OpenPdfResult> {
  const pdfjs = await loadPdfJs();

  // Pass a cloned Uint8Array because pdfjs transfers ownership to its Worker
  const loadingTask: PDFDocumentLoadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    verbosity: pdfjs.VerbosityLevel.ERRORS
  });

  let usedPassword = false;
  let userCancelledPassword = false;

  loadingTask.onPassword = (
    updatePassword: (password: string) => void,
    reason: number
  ) => {
    const isRetry = reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD;
    usedPassword = true;
    void requestPassword(isRetry).then((password) => {
      if (password === null) {
        userCancelledPassword = true;
        void loadingTask.destroy();
      } else {
        updatePassword(password);
      }
    });
  };

  try {
    const pdfDoc = await loadingTask.promise;
    return { pdfDoc, usedPassword };
  } catch (error) {
    if (userCancelledPassword) {
      throw new Error(`Abertura de "${fileName}" cancelada (senha necessária).`);
    }

    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : String(error);

    if (
      name === "InvalidPDFException" ||
      /invalid pdf|pdf header/i.test(message)
    ) {
      throw new Error(
        `O arquivo "${fileName}" não é um PDF válido ou está corrompido.`
      );
    }

    if (name === "PasswordException") {
      throw new Error(
        `Não foi possível desbloquear "${fileName}" com a senha informada.`
      );
    }

    if (name === "MissingPDFException") {
      throw new Error(`Não foi possível ler os dados de "${fileName}".`);
    }

    throw new Error(
      `Falha ao abrir "${fileName}": o arquivo pode estar danificado ou usar um formato não suportado.`
    );
  }
}

