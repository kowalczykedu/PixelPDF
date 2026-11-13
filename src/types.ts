export type FitMode = "contain" | "cover" | "stretch";
export type PageSize = "a4" | "a5" | "letter" | "legal" | "image";
export type Orientation = "auto" | "portrait" | "landscape";
export type Quality = "high" | "balanced" | "compact";
export type Theme = "rose-pine";
export type AppMode = "converter" | "reader";
export type ReaderZoomMode = "fit-width" | "fit-page" | "custom";
export type SortMode =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc"
  | "date-asc"
  | "date-desc";

export interface ImageItem {
  id: number;
  file: File;
  /** Lightweight thumbnail URL for fast DOM rendering */
  thumbUrl: string;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Natural width of the unrotated image */
  width: number;
  /** Natural height of the unrotated image */
  height: number;
  /** Whether dimensions/thumbnail have finished loading */
  loaded: boolean;
}

export interface Settings {
  fileName: string;
  pageSize: PageSize;
  orientation: Orientation;
  margin: number;
  fitMode: FitMode;
  quality: Quality;
  theme: Theme;
}

export interface WorkerPageInput {
  id: number;
  file: File;
  fileName: string;
  mimeType: string;
  rotation: number;
  width: number;
  height: number;
  /** Pre-rasterized buffer if the main thread had to decode (e.g. SVG) */
  preRasterizedJpeg?: ArrayBuffer;
}

export interface WorkerGenerateRequest {
  type: "generate";
  pages: WorkerPageInput[];
  settings: Settings;
}

export interface WorkerCancelRequest {
  type: "cancel";
}

export type WorkerRequest = WorkerGenerateRequest | WorkerCancelRequest;

export interface WorkerProgressMessage {
  type: "progress";
  current: number;
  total: number;
  message: string;
}

export interface WorkerSuccessMessage {
  type: "success";
  pdfBuffer: ArrayBuffer;
  pageCount: number;
}

export interface WorkerErrorMessage {
  type: "error";
  message: string;
}

export type WorkerResponse =
  | WorkerProgressMessage
  | WorkerSuccessMessage
  | WorkerErrorMessage;

export const PAGE_SIZES: Record<
  Exclude<PageSize, "image">,
  { width: number; height: number; label: string }
> = {
  a4: { width: 595.28, height: 841.89, label: "A4" },
  a5: { width: 419.53, height: 595.28, label: "A5" },
  letter: { width: 612, height: 792, label: "Carta / Letter" },
  legal: { width: 612, height: 1008, label: "Ofício / Legal" }
};

export const ACCEPTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".avif"
];

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
  "image/avif"
];

export const DEFAULT_SETTINGS: Settings = {
  fileName: "meu-documento",
  pageSize: "a4",
  orientation: "auto",
  margin: 24,
  fitMode: "contain",
  quality: "high",
  theme: "rose-pine"
};

export interface ReaderPageItem {
  id: number;
  sourceDocId: number;
  sourceFileName: string;
  /** 1-based page number in the source PDF */
  sourcePageNumber: number;
  /** Intrinsic PDF page rotation in clockwise degrees (0, 90, 180, 270) */
  intrinsicRotation: number;
  /** Extra clockwise rotation applied in the organizer (0, 90, 180, 270) */
  userRotation: number;
  /** Width in CSS points at 1x scale and intrinsic rotation */
  widthPt: number;
  /** Height in CSS points at 1x scale and intrinsic rotation */
  heightPt: number;
}

export interface MergeSourceInput {
  docId: number;
  fileName: string;
  bytes: ArrayBuffer;
}

export interface MergePageInput {
  sourceDocId: number;
  /** 0-based page index in the source PDF */
  sourcePageIndex: number;
  /** Additional clockwise rotation applied by user in degrees */
  deltaRotation: number;
}

export interface MergeWorkerRequest {
  type: "merge";
  sources: MergeSourceInput[];
  pages: MergePageInput[];
  fileName: string;
}

export type ReaderWorkerRequest = MergeWorkerRequest | WorkerCancelRequest;

export interface MergeWorkerProgressMessage {
  type: "progress";
  current: number;
  total: number;
  message: string;
}

export interface MergeWorkerSuccessMessage {
  type: "success";
  pdfBuffer: ArrayBuffer;
  pageCount: number;
}

export interface MergeWorkerErrorMessage {
  type: "error";
  message: string;
}

export type ReaderWorkerResponse =
  | MergeWorkerProgressMessage
  | MergeWorkerSuccessMessage
  | MergeWorkerErrorMessage;

