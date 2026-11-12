import "./style.css";
import {
  DEFAULT_SETTINGS,
  PAGE_SIZES,
  type FitMode,
  type ImageItem,
  type Orientation,
  type PageSize,
  type Quality,
  type Settings,
  type SortMode,
  type Theme
} from "./types";
import {
  escapeHtml,
  formatBytes,
  getExtension,
  isAcceptedFile,
  pointsToMillimeters,
  safeFileName
} from "./utils/format";
import { createThumbnailAndDimensions } from "./utils/image";
import {
  getEffectiveMargin,
  getPageDimensions,
  normalizeRotation
} from "./utils/layout";
import { PdfGenerationController } from "./pdf/pdf-client";
import { initRootsBackground } from "./rootsAnimation";

const ICONS = {
  brandMark: `<svg viewBox="8 8 48 48" fill="none" aria-hidden="true"><defs><linearGradient id="bmRootDiag" x1="13" y1="13" x2="54" y2="54" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--purple)"/><stop offset="48%" stop-color="var(--purple-2)"/><stop offset="100%" stop-color="var(--foam)"/></linearGradient><linearGradient id="bmRootUpper" x1="14" y1="13" x2="54" y2="34" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--purple)"/><stop offset="50%" stop-color="var(--purple-2)"/><stop offset="100%" stop-color="var(--foam)"/></linearGradient><linearGradient id="bmRootLower" x1="13" y1="14" x2="36" y2="54" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--purple)"/><stop offset="50%" stop-color="var(--purple-2)"/><stop offset="100%" stop-color="var(--foam)"/></linearGradient><linearGradient id="bmRootCrown" x1="16" y1="16" x2="30" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--purple)"/><stop offset="100%" stop-color="var(--purple-2)"/></linearGradient><linearGradient id="bmRootTip" x1="20" y1="20" x2="54" y2="54" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--purple-2)"/><stop offset="100%" stop-color="var(--foam)"/></linearGradient></defs><path d="M12.0 17.8L14.1 18.8L16.2 20.1L18.4 21.7L20.6 23.5L22.9 25.5L25.3 27.7L27.7 29.9L30.3 32.3L32.8 34.7L35.5 37.2L38.2 39.7L41.0 42.2L43.8 44.7L46.8 47.1L49.7 49.5L52.8 51.8L53.2 51.2L50.3 48.7L47.6 46.2L44.9 43.5L42.3 40.8L39.8 38.1L37.4 35.4L35.0 32.6L32.7 30.0L30.5 27.3L28.4 24.7L26.3 22.2L24.4 19.8L22.4 17.5L20.5 15.3L18.7 13.2L17.0 11.2L16.3 10.8L15.5 10.7L14.6 10.9L13.7 11.3L12.8 11.9L12.1 12.7L11.5 13.6L11.2 14.6L11.1 15.6L11.2 16.5L11.5 17.2Z" fill="url(#bmRootDiag)"/><path d="M14.7 16.8L16.9 17.2L19.1 17.8L21.3 18.5L23.6 19.3L25.9 20.3L28.2 21.3L30.6 22.5L33.0 23.7L35.4 25.0L37.9 26.3L40.4 27.7L43.0 29.0L45.6 30.5L48.3 31.9L51.0 33.3L53.9 34.8L54.1 34.2L51.4 32.7L48.8 31.0L46.2 29.4L43.7 27.8L41.3 26.2L38.9 24.6L36.6 23.0L34.3 21.4L32.0 19.9L29.8 18.5L27.6 17.1L25.3 15.8L23.1 14.5L20.9 13.3L18.6 12.2L16.3 11.2L15.8 11.1L15.2 11.2L14.6 11.6L14.1 12.1L13.7 12.7L13.5 13.4L13.3 14.2L13.3 14.9L13.5 15.6L13.8 16.2L14.2 16.6Z" fill="url(#bmRootUpper)"/><path d="M16.3 15.8L18.1 15.4L19.9 15.2L21.8 15.0L23.8 15.0L25.9 15.1L28.0 15.3L30.2 15.5L32.4 15.8L34.7 16.2L37.0 16.6L39.4 17.1L41.7 17.6L44.1 18.0L46.6 18.5L49.0 19.0L51.4 19.5L51.6 18.9L49.1 18.3L46.7 17.7L44.4 17.1L42.0 16.4L39.7 15.8L37.4 15.1L35.1 14.5L32.8 13.9L30.6 13.4L28.4 12.9L26.2 12.5L24.1 12.2L21.9 11.9L19.8 11.8L17.7 11.7L15.7 11.8Z" fill="url(#bmRootUpper)"/><path d="M11.3 16.8L12.7 18.9L14.2 21.0L15.6 23.0L17.1 25.1L18.6 27.2L20.2 29.4L21.8 31.5L23.4 33.7L25.0 35.9L26.7 38.2L28.3 40.6L30.0 43.0L31.6 45.5L33.2 48.1L34.7 50.8L36.2 53.6L36.8 53.4L35.4 50.5L34.0 47.7L32.6 44.9L31.2 42.3L29.8 39.7L28.4 37.2L27.0 34.7L25.6 32.3L24.2 29.9L22.9 27.6L21.6 25.3L20.5 23.1L19.3 20.9L18.3 18.6L17.4 16.4L16.7 14.2L16.3 13.8L15.9 13.4L15.2 13.2L14.5 13.2L13.8 13.3L13.1 13.6L12.4 14.0L11.9 14.5L11.5 15.0L11.2 15.6L11.2 16.2Z" fill="url(#bmRootLower)"/><path d="M11.5 15.5L11.5 17.7L11.6 19.8L11.8 22.0L12.0 24.1L12.4 26.3L12.8 28.5L13.3 30.6L13.9 32.9L14.5 35.1L15.1 37.4L15.7 39.7L16.4 42.1L17.1 44.5L17.7 47.0L18.3 49.5L18.9 52.1L19.5 51.9L19.0 49.3L18.5 46.8L18.1 44.3L17.6 41.8L17.1 39.4L16.6 37.0L16.2 34.7L15.8 32.5L15.5 30.2L15.3 28.1L15.1 25.9L15.0 23.9L15.0 21.8L15.1 19.9L15.3 17.9L15.7 16.1Z" fill="url(#bmRootLower)"/><path d="M22.4 18.7L22.8 19.3L23.2 19.9L23.5 20.5L23.9 21.1L24.1 21.7L24.4 22.2L24.6 22.7L24.8 23.2L24.9 23.7L25.0 24.2L25.1 24.7L25.1 25.1L25.2 25.5L25.1 25.9L25.1 26.3L25.0 26.7L27.4 27.3L27.5 26.7L27.6 26.1L27.6 25.5L27.6 25.0L27.5 24.4L27.4 23.7L27.3 23.1L27.1 22.5L26.9 21.9L26.7 21.3L26.4 20.6L26.1 20.0L25.8 19.3L25.4 18.6L25.0 18.0L24.6 17.3Z" fill="url(#bmRootCrown)"/><path d="M17.7 24.5L18.4 25.0L19.1 25.5L19.8 25.9L20.4 26.2L21.1 26.6L21.7 26.9L22.4 27.1L23.0 27.4L23.6 27.5L24.2 27.7L24.8 27.8L25.4 27.9L26.0 28.0L26.5 28.0L27.1 28.0L27.6 27.9L27.4 25.7L27.0 25.7L26.6 25.7L26.1 25.6L25.7 25.6L25.2 25.5L24.7 25.4L24.3 25.3L23.8 25.1L23.2 24.9L22.7 24.7L22.2 24.4L21.6 24.1L21.1 23.8L20.5 23.4L19.9 23.0L19.3 22.5Z" fill="url(#bmRootCrown)"/><path d="M31.7 23.3L33.1 23.0L34.5 22.8L35.9 22.7L37.3 22.6L38.6 22.7L40.0 22.8L41.3 23.0L42.7 23.3L44.0 23.6L45.4 24.0L46.7 24.4L48.1 24.9L49.4 25.4L50.7 25.9L52.1 26.4L53.4 27.0L53.6 26.6L52.3 25.9L51.0 25.3L49.7 24.6L48.4 24.0L47.1 23.4L45.8 22.9L44.4 22.4L43.1 21.9L41.7 21.5L40.3 21.2L38.8 20.9L37.4 20.7L35.9 20.5L34.4 20.5L32.8 20.6L31.3 20.7Z" fill="url(#bmRootTip)"/><path d="M35.2 25.1L36.3 26.4L37.4 27.7L38.5 29.0L39.6 30.2L40.7 31.3L41.8 32.4L43.0 33.5L44.1 34.6L45.3 35.6L46.4 36.6L47.6 37.6L48.7 38.6L49.9 39.6L51.0 40.6L52.2 41.6L53.3 42.7L53.7 42.3L52.6 41.2L51.5 40.2L50.4 39.1L49.3 38.0L48.2 36.9L47.2 35.8L46.1 34.7L45.1 33.6L44.0 32.5L43.0 31.3L42.0 30.2L41.0 28.9L40.0 27.7L39.1 26.4L38.1 25.1L37.2 23.7Z" fill="url(#bmRootTip)"/><path d="M32.2 34.2L33.0 35.6L33.9 36.9L34.7 38.2L35.5 39.5L36.4 40.7L37.2 41.9L38.0 43.0L38.9 44.2L39.7 45.3L40.6 46.5L41.4 47.6L42.2 48.8L43.0 49.9L43.8 51.1L44.5 52.3L45.3 53.6L45.7 53.4L45.1 52.1L44.4 50.8L43.7 49.5L43.0 48.3L42.3 47.0L41.5 45.8L40.8 44.6L40.1 43.4L39.4 42.2L38.6 40.9L37.9 39.7L37.2 38.4L36.5 37.1L35.9 35.8L35.2 34.4L34.6 33.0Z" fill="url(#bmRootTip)"/><path d="M24.8 35.6L24.7 36.9L24.7 38.2L24.7 39.4L24.7 40.6L24.9 41.7L25.0 42.8L25.2 43.9L25.4 45.0L25.7 46.1L26.0 47.1L26.2 48.2L26.5 49.2L26.8 50.3L27.1 51.4L27.3 52.4L27.6 53.5L28.0 53.5L27.9 52.3L27.7 51.2L27.5 50.1L27.3 49.1L27.2 48.0L27.0 46.9L26.8 45.9L26.7 44.8L26.6 43.7L26.5 42.7L26.5 41.6L26.5 40.5L26.6 39.4L26.7 38.3L26.9 37.2L27.2 36.0Z" fill="url(#bmRootTip)"/><path d="M14.1 32.9L13.8 33.9L13.5 34.9L13.2 35.9L13.0 36.9L12.8 37.9L12.6 38.9L12.4 39.8L12.2 40.8L12.1 41.7L11.9 42.7L11.8 43.6L11.7 44.5L11.6 45.4L11.5 46.2L11.4 47.1L11.3 48.0L11.7 48.0L11.9 47.2L12.1 46.3L12.2 45.5L12.4 44.6L12.6 43.7L12.8 42.8L13.1 41.9L13.3 41.0L13.6 40.1L13.8 39.2L14.1 38.3L14.4 37.3L14.8 36.4L15.1 35.4L15.5 34.5L15.9 33.5Z" fill="url(#bmRootTip)"/><path d="M34.6 16.1L35.5 15.6L36.4 15.2L37.4 14.8L38.3 14.5L39.3 14.2L40.2 13.9L41.1 13.6L42.0 13.3L42.9 13.1L43.8 12.9L44.7 12.7L45.6 12.5L46.5 12.4L47.3 12.3L48.2 12.1L49.0 12.0L49.0 11.6L48.1 11.6L47.3 11.7L46.4 11.8L45.5 11.8L44.6 11.9L43.7 12.0L42.7 12.2L41.8 12.3L40.8 12.5L39.9 12.7L38.9 12.9L37.9 13.1L36.9 13.4L35.9 13.7L34.9 14.0L33.8 14.3Z" fill="url(#bmRootTip)"/><path d="M42.2 43.6L43.1 43.9L43.9 44.1L44.8 44.4L45.6 44.7L46.4 45.0L47.2 45.3L48.0 45.6L48.8 45.8L49.5 46.1L50.3 46.3L51.0 46.6L51.7 46.8L52.4 47.0L53.1 47.2L53.8 47.3L54.5 47.4L54.5 47.0L53.9 46.8L53.2 46.6L52.6 46.4L51.9 46.1L51.2 45.8L50.6 45.6L49.9 45.2L49.1 44.9L48.4 44.6L47.7 44.2L46.9 43.9L46.1 43.5L45.3 43.1L44.5 42.8L43.7 42.4L42.8 42.0Z" fill="url(#bmRootTip)"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
  uploadIllustration: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>`,
  folderPlus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  sort: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/></svg>`,
  rotateCcw: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  rotateCw: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
  arrowUpDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`,
  zoom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>`
} as const;

const SETTINGS_STORAGE_KEY = "rootpdf-settings";
const LEGACY_SETTINGS_STORAGE_KEY = "pixelpdf-settings";

let nextId = 1;
let pasteCounter = 1;
let images: ImageItem[] = [];
let isGenerating = false;
let dragId: number | null = null;
let currentDragOverEl: HTMLElement | null = null;
let currentSort: SortMode = "manual";
let settings: Settings = loadSettings();

// Map of ImageItem.id -> DOM element for surgical O(1) DOM updates
const itemElements = new Map<number, HTMLElement>();

// Preview Modal state
let previewItemId: number | null = null;
let previewFullResUrl: string | null = null;

// Web Worker PDF Controller
const pdfController = new PdfGenerationController();
let progressHideTimer: number | null = null;
let saveSettingsTimer: number | null = null;
let dropZoneStateTimer: number | null = null;
let rafPreviewPending = false;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Elemento #app não encontrado.");

app.innerHTML = `
  <div class="app-shell">
    <canvas id="rootsCanvas" class="roots-canvas" aria-hidden="true"></canvas>
    <div class="glow glow-one" aria-hidden="true"></div>
    <div class="glow glow-two" aria-hidden="true"></div>

    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#" aria-label="RootPDF — Seu Estúdio Local de PDF">
          <span class="brand-mark" aria-hidden="true">
            ${ICONS.brandMark}
          </span>
          <span class="brand-text">
            <strong>RootPDF</strong>
            <small>SEU ESTÚDIO LOCAL DE PDF</small>
          </span>
        </a>

        <div class="topbar-actions">
          <span class="privacy-pill" title="Todo o processamento ocorre localmente no seu dispositivo">
            <span class="status-dot" aria-hidden="true"></span>
            <span>100% Local &amp; Privado</span>
          </span>

          <button id="aboutButton" class="top-link" type="button">
            ${ICONS.info}
            <span>Como funciona</span>
          </button>

          <a class="github-link" href="https://github.com/kowalczykedu/RootPDF" target="_blank" rel="noreferrer" aria-label="Repositório no GitHub (abre em nova aba)">
            <span>GitHub</span>
            ${ICONS.external}
          </a>
        </div>
      </div>
    </header>

    <main class="container">
      <section class="hero" aria-label="Apresentação e resumo da sessão">
        <div class="hero-copy">
          <div class="eyebrow">
            <span class="status-dot" aria-hidden="true"></span>
            <span>100% no seu navegador · Sem filas nem uploads</span>
          </div>
          <h1>Seu estúdio local para <em>PDFs simples e privados.</em></h1>
          <p>Monte e organize suas páginas com prévia fiel em tempo real, ajuste margens e formato da folha e exporte tudo direto na sua máquina — sem cadastros e sem enviar arquivos para servidores externos.</p>
        </div>

        <div class="hero-stats" aria-label="Métricas dos arquivos selecionados">
          <div class="stat-card">
            <strong id="heroCount">0</strong>
            <span>Páginas</span>
          </div>
          <div class="stat-card">
            <strong id="heroSize">0 B</strong>
            <span>Volume total</span>
          </div>
          <div class="stat-card stat-card-accent">
            <strong>0%</strong>
            <span>Upload externo</span>
          </div>
        </div>
      </section>

      <section class="upload-card panel" id="dropZone" aria-label="Área de importação de imagens">
        <div class="drop-inner">
          <div class="upload-visual" aria-hidden="true">
            <div class="upload-icon-wrap">
              <div class="upload-icon">${ICONS.uploadIllustration}</div>
            </div>
          </div>

          <div class="drop-copy">
            <div class="drop-title-row">
              <h2>Arraste e solte suas imagens aqui</h2>
              <span class="multi-badge">Múltiplos arquivos</span>
            </div>
            <p>Selecione arquivos do seu dispositivo ou cole capturas da área de transferência com <kbd>Ctrl+V</kbd></p>
            <div class="format-pills" aria-label="Formatos de imagem compatíveis">
              <span class="format-pill">JPG</span>
              <span class="format-pill">PNG</span>
              <span class="format-pill">WEBP</span>
              <span class="format-pill">AVIF</span>
              <span class="format-pill">SVG</span>
              <span class="format-pill">GIF</span>
              <span class="format-pill">BMP</span>
            </div>
          </div>

          <div class="upload-actions">
            <label class="button primary" for="fileInput">
              ${ICONS.folderPlus}
              <span>Selecionar imagens</span>
            </label>
            <button id="pasteButton" class="button ghost" type="button" title="Colar imagem da área de transferência (Ctrl+V)">
              ${ICONS.clipboard}
              <span>Colar imagem</span>
            </button>
          </div>
          <input id="fileInput" type="file" accept="image/*,.svg,.avif" multiple hidden />
        </div>

        <div class="drop-hint">
          <span class="hint-icon" aria-hidden="true">${ICONS.shield}</span>
          <span>Você pode adicionar novos lotes de imagens ou pressionar <strong>Ctrl+V</strong> a qualquer momento</span>
        </div>
      </section>

      <section class="toolbar panel" aria-label="Controles de ordenação e ações em lote">
        <div class="toolbar-left">
          <div class="file-summary">
            <span class="purple-pip" aria-hidden="true"></span>
            <strong id="imageCount">0 imagens</strong>
            <span class="summary-divider" aria-hidden="true">•</span>
            <span id="sizeCount">0 B</span>
          </div>
          <label class="button ghost compact-btn add-more-btn" for="fileInput" title="Adicionar mais imagens à lista">
            ${ICONS.plus}
            <span>Adicionar</span>
          </label>
        </div>

        <div class="toolbar-right">
          <label class="compact-field">
            <span class="compact-field-label">
              ${ICONS.sort}
              <span>Ordenar</span>
            </span>
            <select id="sortSelect" aria-label="Critério de ordenação das páginas">
              <option value="manual">Manual (Arrastar)</option>
              <option value="name-asc">Nome (A → Z)</option>
              <option value="name-desc">Nome (Z → A)</option>
              <option value="size-desc">Tamanho (Maior)</option>
              <option value="size-asc">Tamanho (Menor)</option>
              <option value="date-asc">Data (Mais antigos)</option>
              <option value="date-desc">Data (Mais recentes)</option>
            </select>
          </label>

          <div class="batch-actions" role="group" aria-label="Ações em lote nas páginas">
            <button id="rotateAllLeftButton" class="button ghost icon-only" type="button" title="Girar todas as páginas 90° para a esquerda" aria-label="Girar todas as páginas 90 graus para a esquerda" disabled>
              ${ICONS.rotateCcw}
            </button>
            <button id="rotateAllRightButton" class="button ghost icon-only" type="button" title="Girar todas as páginas 90° para a direita" aria-label="Girar todas as páginas 90 graus para a direita" disabled>
              ${ICONS.rotateCw}
            </button>
            <button id="reverseOrderButton" class="button ghost compact-btn" type="button" title="Inverter a ordem de todas as páginas" disabled>
              ${ICONS.arrowUpDown}
              <span>Inverter</span>
            </button>
            <button id="clearButton" class="button ghost compact-btn danger-hover" type="button" title="Remover todas as páginas da lista" disabled>
              ${ICONS.trash}
              <span>Limpar tudo</span>
            </button>
          </div>
        </div>
      </section>

      <section class="workspace" aria-label="Área de trabalho de páginas e configurações">
        <div class="panel pages-panel">
          <div class="panel-header">
            <div class="panel-header-title">
              <span class="section-kicker" aria-hidden="true">01</span>
              <div>
                <h2>Mesa de Páginas</h2>
                <p>Arraste os cartões para reordenar · Clique na folha para inspecionar o corte</p>
              </div>
            </div>
            <span id="emptyBadge" class="badge">Vazio</span>
          </div>

          <div id="emptyState" class="empty-state">
            <div class="empty-visual" aria-hidden="true">
              <div class="sheet sheet-back"></div>
              <div class="sheet sheet-front">
                ${ICONS.plus}
              </div>
            </div>
            <h3>Nenhuma página adicionada</h3>
            <p>Arraste imagens para a área de importação acima, selecione arquivos do dispositivo ou pressione <strong>Ctrl+V</strong> para colar uma imagem.</p>
            <label class="button ghost compact-btn empty-cta" for="fileInput">
              ${ICONS.folderPlus}
              <span>Escolher imagens</span>
            </label>
          </div>

          <div id="imageList" class="image-list" role="list" aria-label="Lista de páginas do documento PDF" hidden></div>
        </div>

        <aside class="panel settings-panel" aria-label="Configurações de exportação do PDF">
          <div class="panel-header settings-title">
            <div class="panel-header-title">
              <span class="section-kicker" aria-hidden="true">02</span>
              <div>
                <h2>Exportação do PDF</h2>
                <p>Geometria da folha, margens e compressão</p>
              </div>
            </div>
          </div>

          <div class="settings-stack">
            <div class="settings-group">
              <label class="field">
                <span>Nome do documento</span>
                <div class="input-with-icon">
                  <span class="input-prefix" aria-hidden="true">
                    ${ICONS.fileText}
                    <b>PDF</b>
                  </span>
                  <input id="fileName" type="text" maxlength="80" placeholder="meu-documento" spellcheck="false" />
                </div>
              </label>
            </div>

            <div class="settings-group">
              <div class="two-fields">
                <label class="field">
                  <span>Tamanho da folha</span>
                  <select id="pageSize">
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="a5">A5 (148 × 210 mm)</option>
                    <option value="letter">Carta / Letter</option>
                    <option value="legal">Ofício / Legal</option>
                    <option value="image">Original da imagem</option>
                  </select>
                </label>

                <label class="field">
                  <span>Orientação</span>
                  <select id="orientation">
                    <option value="auto">Automática</option>
                    <option value="portrait">Retrato (Vertical)</option>
                    <option value="landscape">Paisagem (Horizontal)</option>
                  </select>
                </label>
              </div>

              <div class="control-block">
                <div class="control-label">
                  <span>Margem da página</span>
                  <strong id="marginValue">24 pt</strong>
                </div>
                <input id="margin" class="range" type="range" min="0" max="60" step="2" aria-label="Margem da página em pontos" />
                <div class="range-ticks" aria-hidden="true">
                  <span>0 pt (Sem borda)</span>
                  <span>30 pt</span>
                  <span>60 pt (Ampla)</span>
                </div>
              </div>

              <label class="field">
                <span>Modo de enquadramento</span>
                <select id="fitMode">
                  <option value="contain">Conter — imagem inteira sem cortes</option>
                  <option value="cover">Preencher — ocupa toda a área útil</option>
                  <option value="stretch">Esticar — força proporção da folha</option>
                </select>
              </label>
            </div>

            <div class="settings-group">
              <label class="field">
                <span>Qualidade e otimização</span>
                <select id="quality">
                  <option value="high">Alta — 90% JPEG / PNG sem perdas</option>
                  <option value="balanced">Balanceada — 78% JPEG (Recomendado)</option>
                  <option value="compact">Compacta — 60% JPEG (Menor arquivo)</option>
                </select>
              </label>
            </div>

            <div class="feature-row">
              <div class="feature-icon" aria-hidden="true">${ICONS.cpu}</div>
              <div>
                <strong>Motor Web Worker + OffscreenCanvas</strong>
                <span>Conversão isolada em segundo plano: interface a 60fps e 100% offline.</span>
              </div>
            </div>

            <div class="generate-actions">
              <button id="generateButton" class="button generate-button" type="button" disabled>
                <span class="generate-btn-copy">
                  <strong>Gerar e Baixar PDF</strong>
                  <small>Exportação imediata no navegador</small>
                </span>
                <b aria-hidden="true">${ICONS.download}</b>
              </button>

              <button id="cancelButton" class="button cancel-button" type="button" hidden>
                <span>Cancelar geração em andamento</span>
                <b aria-hidden="true">${ICONS.close}</b>
              </button>
            </div>

            <div id="progressWrap" class="progress-wrap" hidden>
              <div class="progress-head">
                <span id="progressText">Preparando...</span>
                <strong id="progressPercent">0%</strong>
              </div>
              <div class="progress-track">
                <div id="progressBar"></div>
              </div>
            </div>

            <p id="status" class="status" role="status" aria-live="polite"></p>
          </div>
        </aside>
      </section>

      <section class="tips-grid" aria-label="Diferenciais do RootPDF">
        <article class="tip">
          <span class="tip-icon" aria-hidden="true">${ICONS.layers}</span>
          <div>
            <strong>Simulação fiel da folha</strong>
            <p>Cada cartão exibe em tempo real a proporção exata do papel, margens, orientação e rotação antes de exportar.</p>
          </div>
        </article>
        <article class="tip">
          <span class="tip-icon" aria-hidden="true">${ICONS.sliders}</span>
          <div>
            <strong>Controle individual ou em lote</strong>
            <p>Inspecione com zoom, duplique páginas, gire itens individuais ou aplique rotações e ordenações em lote com 1 clique.</p>
          </div>
        </article>
        <article class="tip">
          <span class="tip-icon" aria-hidden="true">${ICONS.shield}</span>
          <div>
            <strong>Privacidade absoluta e zero filas</strong>
            <p>Seus documentos jamais saem do seu computador. Todo o processamento gráfico roda localmente via Web Workers.</p>
          </div>
        </article>
      </section>

      <footer class="app-footer">
        <div class="footer-inner">
          <span><strong>RootPDF</strong> — Seu Estúdio Local de PDF</span>
          <span class="footer-sep" aria-hidden="true">•</span>
          <span>TypeScript + Web Worker + <span>pdf-lib</span></span>
        </div>
      </footer>
    </main>
  </div>

  <dialog id="previewDialog" class="preview-dialog" aria-label="Inspeção ampliada da página">
    <div class="dialog-card preview-dialog-card">
      <div class="preview-dialog-header">
        <div>
          <span id="previewBadge" class="eyebrow">Página 01</span>
          <h2 id="previewTitle">Visualização da página</h2>
        </div>
        <button id="closePreviewDialog" class="dialog-close" type="button" aria-label="Fechar pré-visualização" title="Fechar (Esc)">
          ${ICONS.close}
        </button>
      </div>

      <div class="preview-stage">
        <div id="modalSheet" class="modal-page-sheet">
          <div id="modalSheetArea" class="modal-page-area">
            <img id="modalSheetImg" class="modal-page-img" alt="Pré-visualização da página no PDF" />
          </div>
        </div>
      </div>

      <p id="previewSpecs" class="preview-specs"></p>

      <div class="preview-dialog-toolbar">
        <div class="preview-nav-group">
          <button id="prevPageModal" class="button ghost compact-btn" type="button" title="Página anterior (Seta para a esquerda)">
            ${ICONS.chevronLeft}
            <span>Anterior</span>
          </button>
          <button id="nextPageModal" class="button ghost compact-btn" type="button" title="Próxima página (Seta para a direita)">
            <span>Próxima</span>
            ${ICONS.chevronRight}
          </button>
        </div>
        <div class="preview-action-group">
          <button id="rotateLeftModal" class="button ghost compact-btn" type="button" title="Girar 90° para a esquerda">
            ${ICONS.rotateCcw}
            <span>Girar esq.</span>
          </button>
          <button id="rotateRightModal" class="button ghost compact-btn" type="button" title="Girar 90° para a direita">
            ${ICONS.rotateCw}
            <span>Girar dir.</span>
          </button>
        </div>
      </div>
    </div>
  </dialog>

  <dialog id="aboutDialog" class="about-dialog" aria-label="Sobre o funcionamento do RootPDF">
    <div class="dialog-card">
      <button id="closeDialog" class="dialog-close" type="button" aria-label="Fechar janela sobre o projeto" title="Fechar (Esc)">
        ${ICONS.close}
      </button>
      <span class="eyebrow">Arquitetura &amp; Privacidade</span>
      <h2>Como o RootPDF funciona?</h2>
      <p>Tudo acontece no seu próprio navegador. Suas imagens são preparadas em segundo plano (via <strong>Web Worker</strong> e <strong>OffscreenCanvas</strong>) e montadas em páginas vetoriais com <strong>pdf-lib</strong>, mantendo a tela leve e os arquivos só com você.</p>
      <div class="dialog-grid">
        <span>01</span>
        <p><strong>Importe ou Cole com Rapidez</strong><br>Arraste múltiplos arquivos, selecione do dispositivo ou pressione <kbd>Ctrl+V</kbd> para colar capturas de tela.</p>
        <span>02</span>
        <p><strong>Diagramação Visual em Tempo Real</strong><br>Reordene, duplique, gire e clique em qualquer miniatura para inspecionar margens e cortes em alta resolução.</p>
        <span>03</span>
        <p><strong>Exportação Local Instantânea</strong><br>Gere PDFs otimizados diretamente no seu navegador, com total privacidade e zero envio de dados para a nuvem.</p>
      </div>
    </div>
  </dialog>
`;

const fileInput = getElement<HTMLInputElement>("fileInput");
const pasteButton = getElement<HTMLButtonElement>("pasteButton");
const dropZone = getElement<HTMLDivElement>("dropZone");
const imageList = getElement<HTMLDivElement>("imageList");
const emptyState = getElement<HTMLDivElement>("emptyState");
const imageCount = getElement<HTMLElement>("imageCount");
const sizeCount = getElement<HTMLElement>("sizeCount");
const heroCount = getElement<HTMLElement>("heroCount");
const heroSize = getElement<HTMLElement>("heroSize");
const emptyBadge = getElement<HTMLElement>("emptyBadge");
const clearButton = getElement<HTMLButtonElement>("clearButton");
const rotateAllLeftButton = getElement<HTMLButtonElement>("rotateAllLeftButton");
const rotateAllRightButton = getElement<HTMLButtonElement>("rotateAllRightButton");
const reverseOrderButton = getElement<HTMLButtonElement>("reverseOrderButton");
const generateButton = getElement<HTMLButtonElement>("generateButton");
const cancelButton = getElement<HTMLButtonElement>("cancelButton");
const status = getElement<HTMLParagraphElement>("status");
const fileNameInput = getElement<HTMLInputElement>("fileName");
const pageSizeInput = getElement<HTMLSelectElement>("pageSize");
const orientationInput = getElement<HTMLSelectElement>("orientation");
const marginInput = getElement<HTMLInputElement>("margin");
const marginValue = getElement<HTMLElement>("marginValue");
const fitModeInput = getElement<HTMLSelectElement>("fitMode");
const qualityInput = getElement<HTMLSelectElement>("quality");
const sortSelect = getElement<HTMLSelectElement>("sortSelect");
const progressWrap = getElement<HTMLDivElement>("progressWrap");
const progressBar = getElement<HTMLDivElement>("progressBar");
const progressText = getElement<HTMLElement>("progressText");
const progressPercent = getElement<HTMLElement>("progressPercent");
const aboutButton = getElement<HTMLButtonElement>("aboutButton");
const aboutDialog = getElement<HTMLDialogElement>("aboutDialog");
const closeDialog = getElement<HTMLButtonElement>("closeDialog");

// Preview Dialog elements
const previewDialog = getElement<HTMLDialogElement>("previewDialog");
const closePreviewDialog = getElement<HTMLButtonElement>("closePreviewDialog");
const previewBadge = getElement<HTMLElement>("previewBadge");
const previewTitle = getElement<HTMLElement>("previewTitle");
const previewSpecs = getElement<HTMLElement>("previewSpecs");
const modalSheet = getElement<HTMLDivElement>("modalSheet");
const modalSheetArea = getElement<HTMLDivElement>("modalSheetArea");
const modalSheetImg = getElement<HTMLImageElement>("modalSheetImg");
const prevPageModal = getElement<HTMLButtonElement>("prevPageModal");
const nextPageModal = getElement<HTMLButtonElement>("nextPageModal");
const rotateLeftModal = getElement<HTMLButtonElement>("rotateLeftModal");
const rotateRightModal = getElement<HTMLButtonElement>("rotateRightModal");

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado.`);
  return element as T;
}

function loadSettings(): Settings {
  try {
    let raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
      if (raw) {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, raw);
          localStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
        } catch {
          // Ignore storage quota errors during migration
        }
      }
    }
    if (!raw) return { ...DEFAULT_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Settings>;

    const validPageSizes: PageSize[] = ["a4", "a5", "letter", "legal", "image"];
    const validOrientations: Orientation[] = ["auto", "portrait", "landscape"];
    const validFitModes: FitMode[] = ["contain", "cover", "stretch"];
    const validQualities: Quality[] = ["high", "balanced", "compact"];

    return {
      fileName:
        typeof saved.fileName === "string"
          ? saved.fileName
          : DEFAULT_SETTINGS.fileName,
      pageSize: validPageSizes.includes(saved.pageSize as PageSize)
        ? (saved.pageSize as PageSize)
        : DEFAULT_SETTINGS.pageSize,
      orientation: validOrientations.includes(saved.orientation as Orientation)
        ? (saved.orientation as Orientation)
        : DEFAULT_SETTINGS.orientation,
      margin:
        typeof saved.margin === "number" &&
        Number.isFinite(saved.margin) &&
        saved.margin >= 0 &&
        saved.margin <= 60
          ? saved.margin
          : DEFAULT_SETTINGS.margin,
      fitMode: validFitModes.includes(saved.fitMode as FitMode)
        ? (saved.fitMode as FitMode)
        : DEFAULT_SETTINGS.fitMode,
      quality: validQualities.includes(saved.quality as Quality)
        ? (saved.quality as Quality)
        : DEFAULT_SETTINGS.quality,
      theme: "rose-pine"
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function scheduleSaveSettings(): void {
  if (saveSettingsTimer !== null) {
    window.clearTimeout(saveSettingsTimer);
  }
  saveSettingsTimer = window.setTimeout(() => {
    saveSettingsTimer = null;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, 180);
}

function applyTheme(): void {
  document.documentElement.dataset.theme = "rose-pine";
  const metaThemeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (metaThemeColor) {
    metaThemeColor.content = "#191724";
  }
}

function syncSettingsControls(): void {
  fileNameInput.value = settings.fileName;
  pageSizeInput.value = settings.pageSize;
  orientationInput.value = settings.orientation;
  marginInput.value = String(settings.margin);
  fitModeInput.value = settings.fitMode;
  qualityInput.value = settings.quality;

  const isOriginalSize = settings.pageSize === "image";
  marginInput.disabled = isOriginalSize;
  orientationInput.disabled = isOriginalSize;
  fitModeInput.disabled = isOriginalSize;

  const min = Number(marginInput.min) || 0;
  const max = Number(marginInput.max) || 60;
  const effectiveMargin = isOriginalSize ? 0 : settings.margin;
  const percent = ((effectiveMargin - min) / (max - min)) * 100;
  marginInput.style.setProperty("--range", `${percent}%`);
  marginValue.textContent = isOriginalSize
    ? "0 pt (Original)"
    : `${settings.margin} pt`;
}

function flashDropZoneState(state: "success" | "error"): void {
  if (dropZoneStateTimer !== null) {
    window.clearTimeout(dropZoneStateTimer);
  }
  dropZone.dataset.importState = state;
  dropZoneStateTimer = window.setTimeout(() => {
    delete dropZone.dataset.importState;
    dropZoneStateTimer = null;
  }, 2400);
}

function setStatus(
  message: string,
  type: "info" | "success" | "error" = "info"
): void {
  status.textContent = message;
  status.dataset.type = type;
}

function formatPageBadgeLabel(image: ImageItem): string {
  const [pageW, pageH] = getPageDimensions(
    image.width,
    image.height,
    image.rotation,
    settings
  );
  if (settings.pageSize === "image") {
    return "Original";
  }
  const sizeLabel = PAGE_SIZES[settings.pageSize].label.split(" / ")[0];
  const orientLabel = pageW > pageH ? "Paisagem" : "Retrato";
  return `${sizeLabel} ${orientLabel}`;
}

function applySheetPreviewStyles(
  image: ImageItem,
  sheetEl: HTMLElement,
  areaEl: HTMLElement,
  imgEl: HTMLImageElement,
  maxBoxW: number,
  maxBoxH: number
): void {
  const [pageW, pageH] = getPageDimensions(
    image.width,
    image.height,
    image.rotation,
    settings
  );
  const margin = getEffectiveMargin(settings, pageW, pageH);
  const areaW = Math.max(1, pageW - margin * 2);
  const areaH = Math.max(1, pageH - margin * 2);

  const scale = Math.min(maxBoxW / pageW, maxBoxH / pageH);
  const sheetPxW = Math.max(18, Math.round(pageW * scale));
  const sheetPxH = Math.max(18, Math.round(pageH * scale));

  sheetEl.style.width = `${sheetPxW}px`;
  sheetEl.style.height = `${sheetPxH}px`;

  const marginPctX = (margin / pageW) * 100;
  const marginPctY = (margin / pageH) * 100;
  const areaPctW = (areaW / pageW) * 100;
  const areaPctH = (areaH / pageH) * 100;

  areaEl.style.left = `${marginPctX.toFixed(2)}%`;
  areaEl.style.top = `${marginPctY.toFixed(2)}%`;
  areaEl.style.width = `${areaPctW.toFixed(2)}%`;
  areaEl.style.height = `${areaPctH.toFixed(2)}%`;
  areaEl.classList.toggle("has-margin", margin > 0);

  const normRot = normalizeRotation(image.rotation);
  const isRotated90 = normRot === 90 || normRot === 270;
  const imgWidthPct = isRotated90 ? (areaH / areaW) * 100 : 100;
  const imgHeightPct = isRotated90 ? (areaW / areaH) * 100 : 100;

  imgEl.style.width = `${imgWidthPct.toFixed(3)}%`;
  imgEl.style.height = `${imgHeightPct.toFixed(3)}%`;
  imgEl.style.objectFit =
    settings.fitMode === "stretch" ? "fill" : settings.fitMode;
  imgEl.style.transform = `translate(-50%, -50%) rotate(${normRot}deg)`;
}

function updateItemMetaAndPreview(image: ImageItem): void {
  const el = itemElements.get(image.id);
  if (!el) return;

  const sheetEl = el.querySelector<HTMLElement>(".page-sheet");
  const areaEl = el.querySelector<HTMLElement>(".page-sheet-area");
  const imgEl = el.querySelector<HTMLImageElement>(".page-sheet-img");
  if (sheetEl && areaEl && imgEl) {
    if (image.thumbUrl && imgEl.getAttribute("src") !== image.thumbUrl) {
      imgEl.src = image.thumbUrl;
      imgEl.hidden = false;
    }
    applySheetPreviewStyles(image, sheetEl, areaEl, imgEl, 76, 60);
  }

  const submetaEl = el.querySelector<HTMLElement>(".image-submeta");
  if (submetaEl) {
    const dimensions =
      image.width && image.height
        ? `${image.width} × ${image.height}`
        : "Carregando...";
    const extension =
      getExtension(image.file.name).replace(".", "").toUpperCase() || "IMG";
    const pageInfo = formatPageBadgeLabel(image);
    const normRot = normalizeRotation(image.rotation);
    const rotInfo =
      normRot === 90
        ? " · 90° ↷"
        : normRot === 270
          ? " · 90° ↶"
          : normRot === 180
            ? " · 180°"
            : "";
    submetaEl.innerHTML = `<span class="meta-badge">${escapeHtml(extension)}</span><span class="meta-sep"> · </span><span>${escapeHtml(formatBytes(image.file.size))}</span><span class="meta-sep"> · </span><span>${escapeHtml(dimensions)}</span><span class="meta-sep"> · </span><span class="meta-page">${escapeHtml(pageInfo + rotInfo)}</span>`;
  }

  if (previewItemId === image.id && previewDialog.open) {
    updatePreviewModalContent();
  }
}

function scheduleAllPreviewsUpdate(): void {
  if (rafPreviewPending) return;
  rafPreviewPending = true;
  window.requestAnimationFrame(() => {
    rafPreviewPending = false;
    for (const image of images) {
      updateItemMetaAndPreview(image);
    }
  });
}

function createItemElement(image: ImageItem, index: number): HTMLElement {
  const item = document.createElement("article");
  item.className = "image-item";
  item.setAttribute("role", "listitem");
  item.draggable = true;
  item.dataset.id = String(image.id);

  const safeName = escapeHtml(image.file.name);

  item.innerHTML = `
    <div class="drag-handle" title="Arraste para reordenar esta página" aria-hidden="true">
      ${ICONS.grip}
    </div>
    <button class="page-thumb-wrap" type="button" data-action="preview" data-id="${image.id}" title="Clique para inspecionar a página em tamanho ampliado" aria-label="Ampliar prévia de ${safeName}">
      <span class="page-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="page-sheet">
        <span class="page-sheet-area">
          <img class="page-sheet-img" ${image.thumbUrl ? `src="${image.thumbUrl}"` : "hidden"} alt="Prévia de ${safeName}" decoding="async" />
        </span>
      </span>
      <span class="thumb-zoom-hint" aria-hidden="true">${ICONS.zoom}</span>
    </button>
    <div class="image-meta">
      <strong class="image-title" title="${safeName}">${safeName}</strong>
      <span class="image-submeta"></span>
    </div>
    <div class="item-actions" role="group" aria-label="Ações para ${safeName}">
      <button class="icon-button" data-action="preview" data-id="${image.id}" type="button" title="Inspecionar página ampliada" aria-label="Inspecionar página ampliada">
        ${ICONS.zoom}
      </button>
      <button class="icon-button" data-action="duplicate" data-id="${image.id}" type="button" title="Duplicar página" aria-label="Duplicar página">
        ${ICONS.copy}
      </button>
      <button class="icon-button" data-action="rotateLeft" data-id="${image.id}" type="button" title="Girar 90° para a esquerda" aria-label="Girar 90 graus para a esquerda">
        ${ICONS.rotateCcw}
      </button>
      <button class="icon-button" data-action="rotateRight" data-id="${image.id}" type="button" title="Girar 90° para a direita" aria-label="Girar 90 graus para a direita">
        ${ICONS.rotateCw}
      </button>
      <button class="icon-button" data-action="up" data-id="${image.id}" type="button" title="Mover página para cima" aria-label="Mover página para cima">
        ${ICONS.arrowUp}
      </button>
      <button class="icon-button" data-action="down" data-id="${image.id}" type="button" title="Mover página para baixo" aria-label="Mover página para baixo">
        ${ICONS.arrowDown}
      </button>
      <button class="icon-button danger" data-action="remove" data-id="${image.id}" type="button" title="Remover página" aria-label="Remover página">
        ${ICONS.trash}
      </button>
    </div>
  `;

  itemElements.set(image.id, item);
  updateItemMetaAndPreview(image);
  return item;
}

function syncDom(): void {
  const totalBytes = images.reduce((sum, image) => sum + image.file.size, 0);
  const count = images.length;
  const label = count === 1 ? "imagem" : "imagens";

  imageCount.textContent = `${count} ${label}`;
  sizeCount.textContent = formatBytes(totalBytes);
  heroCount.textContent = String(count);
  heroSize.textContent = formatBytes(totalBytes);
  emptyBadge.textContent = count ? `${count} ${label}` : "Vazio";
  emptyBadge.classList.toggle("has-items", count > 0);
  dropZone.classList.toggle("has-files", count > 0);

  const hasItems = count > 0;
  clearButton.disabled = !hasItems || isGenerating;
  rotateAllLeftButton.disabled = !hasItems || isGenerating;
  rotateAllRightButton.disabled = !hasItems || isGenerating;
  reverseOrderButton.disabled = count < 2 || isGenerating;
  generateButton.disabled = !hasItems || isGenerating;

  emptyState.hidden = hasItems;
  imageList.hidden = !hasItems;

  // Remove stale DOM elements
  const activeIds = new Set(images.map((item) => item.id));
  for (const [id, el] of itemElements.entries()) {
    if (!activeIds.has(id)) {
      el.remove();
      itemElements.delete(id);
    }
  }

  // Reconcile DOM order & per-index controls without recreating existing elements
  images.forEach((image, index) => {
    let el = itemElements.get(image.id);
    if (!el) {
      el = createItemElement(image, index);
    }

    const currentChildAtPos = imageList.children[index];
    if (currentChildAtPos !== el) {
      imageList.insertBefore(el, currentChildAtPos ?? null);
    }

    const pageNumEl = el.querySelector<HTMLElement>(".page-number");
    if (pageNumEl) {
      const formattedNum = String(index + 1).padStart(2, "0");
      if (pageNumEl.textContent !== formattedNum) {
        pageNumEl.textContent = formattedNum;
      }
    }

    const upBtn = el.querySelector<HTMLButtonElement>('button[data-action="up"]');
    const downBtn = el.querySelector<HTMLButtonElement>('button[data-action="down"]');
    if (upBtn) upBtn.disabled = index === 0 || isGenerating;
    if (downBtn) downBtn.disabled = index === count - 1 || isGenerating;
  });

  if (previewDialog.open) {
    updatePreviewModalContent();
  }
}

function setManualSortIndicator(): void {
  if (currentSort !== "manual") {
    currentSort = "manual";
    sortSelect.value = "manual";
  }
}

function addFiles(
  fileList: FileList | File[],
  options: { allowDuplicates?: boolean; sourceLabel?: string } = {}
): void {
  const candidates = Array.from(fileList);
  if (!candidates.length) return;

  const valid = candidates.filter(isAcceptedFile);
  const rejected = candidates.filter((file) => !isAcceptedFile(file));

  const fingerprints = new Set(
    images.map(
      (item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`
    )
  );

  const newFiles = options.allowDuplicates
    ? valid
    : valid.filter((file) => {
        const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
        if (fingerprints.has(fingerprint)) return false;
        fingerprints.add(fingerprint);
        return true;
      });

  const addedItems: ImageItem[] = [];

  for (const file of newFiles) {
    const newItem: ImageItem = {
      id: nextId++,
      file,
      thumbUrl: "",
      rotation: 0,
      width: 0,
      height: 0,
      loaded: false
    };
    images.push(newItem);
    addedItems.push(newItem);
  }

  if (addedItems.length > 0) {
    if (currentSort !== "manual") {
      applySortInPlace(currentSort);
    }
    const prefix = options.sourceLabel ? `${options.sourceLabel}: ` : "";
    setStatus(
      `${prefix}${addedItems.length} arquivo(s) adicionado(s).`,
      "success"
    );
    flashDropZoneState("success");
    syncDom();
    void hydrateItemsAsync(addedItems);
  } else if (valid.length > 0) {
    setStatus("Esses arquivos já estão na lista.", "info");
  } else if (rejected.length > 0) {
    setStatus("Nenhum formato de imagem compatível foi encontrado.", "error");
    flashDropZoneState("error");
  }

  if (rejected.length > 0) {
    console.warn(
      "Arquivos ignorados:",
      rejected.map((file) => file.name)
    );
  }
}

async function hydrateItemsAsync(itemsToHydrate: ImageItem[]): Promise<void> {
  await Promise.all(
    itemsToHydrate.map(async (item) => {
      try {
        const result = await createThumbnailAndDimensions(item.file);
        // Check if item is still in the list
        if (!images.some((existing) => existing.id === item.id)) {
          URL.revokeObjectURL(result.thumbUrl);
          return;
        }
        item.thumbUrl = result.thumbUrl;
        item.width = result.width;
        item.height = result.height;
        item.loaded = true;
        updateItemMetaAndPreview(item);
      } catch {
        item.loaded = true;
        updateItemMetaAndPreview(item);
      }
    })
  );
}

function revokeThumbIfUnused(url: string): void {
  if (!url) return;
  const stillUsed = images.some((item) => item.thumbUrl === url);
  if (!stillUsed) {
    URL.revokeObjectURL(url);
  }
}

function moveImage(id: number, direction: -1 | 1): void {
  const index = images.findIndex((image) => image.id === id);
  const newIndex = index + direction;
  if (index < 0 || newIndex < 0 || newIndex >= images.length) return;
  [images[index], images[newIndex]] = [images[newIndex], images[index]];
  setManualSortIndicator();
  syncDom();
}

function duplicateImage(id: number): void {
  const index = images.findIndex((image) => image.id === id);
  if (index === -1) return;
  const source = images[index];

  // Reuse the already-generated thumbnail URL (reference-counted on removal)
  const copy: ImageItem = {
    id: nextId++,
    file: source.file,
    thumbUrl: source.thumbUrl,
    rotation: source.rotation,
    width: source.width,
    height: source.height,
    loaded: source.loaded
  };

  images.splice(index + 1, 0, copy);
  setManualSortIndicator();
  syncDom();
  setStatus(`Página "${source.file.name}" duplicada.`, "success");
  if (!copy.loaded) {
    void hydrateItemsAsync([copy]);
  }
}

function removeImage(id: number): void {
  const index = images.findIndex((image) => image.id === id);
  if (index === -1) return;
  const [removed] = images.splice(index, 1);
  revokeThumbIfUnused(removed.thumbUrl);

  const el = itemElements.get(id);
  if (el) {
    el.remove();
    itemElements.delete(id);
  }

  if (previewItemId === id) {
    if (images.length > 0) {
      const nextPreviewIndex = Math.min(index, images.length - 1);
      openPreviewModal(images[nextPreviewIndex].id);
    } else {
      closePreviewModal();
    }
  }

  syncDom();
  setStatus("Página removida.");
}

function rotateImage(id: number, amount: number): void {
  const item = images.find((image) => image.id === id);
  if (!item) return;
  item.rotation = normalizeRotation(item.rotation + amount);
  updateItemMetaAndPreview(item);
}

function rotateAllImages(amount: number): void {
  if (!images.length) return;
  for (const item of images) {
    item.rotation = normalizeRotation(item.rotation + amount);
  }
  scheduleAllPreviewsUpdate();
  setStatus(
    `Todas as ${images.length} páginas foram giradas em ${amount > 0 ? "90° para a direita" : "90° para a esquerda"}.`,
    "info"
  );
}

function reverseImagesOrder(): void {
  if (images.length < 2) return;
  images.reverse();
  setManualSortIndicator();
  syncDom();
  setStatus("Ordem das páginas invertida.", "info");
}

function clearImages(): void {
  closePreviewModal();
  const uniqueUrls = new Set(images.map((img) => img.thumbUrl).filter(Boolean));
  uniqueUrls.forEach((url) => URL.revokeObjectURL(url));
  images = [];
  itemElements.clear();
  imageList.innerHTML = "";
  syncDom();
  setStatus("Lista limpa.");
}

function applySortInPlace(mode: SortMode): void {
  if (mode === "name-asc") {
    images.sort((a, b) =>
      a.file.name.localeCompare(b.file.name, "pt-BR", { numeric: true })
    );
  } else if (mode === "name-desc") {
    images.sort((a, b) =>
      b.file.name.localeCompare(a.file.name, "pt-BR", { numeric: true })
    );
  } else if (mode === "size-desc") {
    images.sort((a, b) => b.file.size - a.file.size);
  } else if (mode === "size-asc") {
    images.sort((a, b) => a.file.size - b.file.size);
  } else if (mode === "date-asc") {
    images.sort((a, b) => a.file.lastModified - b.file.lastModified);
  } else if (mode === "date-desc") {
    images.sort((a, b) => b.file.lastModified - a.file.lastModified);
  }
}

function sortImages(mode: SortMode): void {
  currentSort = mode;
  if (mode === "manual") return;
  applySortInPlace(mode);
  syncDom();
  setStatus("Páginas reordenadas.", "info");
}

// --- Preview / Lightbox Modal ---

function revokePreviewFullRes(): void {
  if (previewFullResUrl) {
    URL.revokeObjectURL(previewFullResUrl);
    previewFullResUrl = null;
  }
}

function openPreviewModal(id: number): void {
  const index = images.findIndex((item) => item.id === id);
  if (index === -1) return;

  if (previewItemId !== id) {
    revokePreviewFullRes();
    previewItemId = id;
    previewFullResUrl = URL.createObjectURL(images[index].file);
  }

  updatePreviewModalContent();
  if (!previewDialog.open) {
    previewDialog.showModal();
  }
}

function closePreviewModal(): void {
  revokePreviewFullRes();
  previewItemId = null;
  if (previewDialog.open) {
    previewDialog.close();
  }
}

function updatePreviewModalContent(): void {
  if (previewItemId === null) return;
  const index = images.findIndex((item) => item.id === previewItemId);
  if (index === -1) {
    closePreviewModal();
    return;
  }

  const item = images[index];
  const srcToUse = previewFullResUrl || item.thumbUrl;
  if (srcToUse && modalSheetImg.getAttribute("src") !== srcToUse) {
    modalSheetImg.src = srcToUse;
  }

  applySheetPreviewStyles(
    item,
    modalSheet,
    modalSheetArea,
    modalSheetImg,
    380,
    380
  );

  previewBadge.textContent = `Página ${String(index + 1).padStart(2, "0")} de ${String(images.length).padStart(2, "0")}`;
  previewTitle.textContent = item.file.name;

  const [pageW, pageH] = getPageDimensions(
    item.width,
    item.height,
    item.rotation,
    settings
  );
  const effectiveMargin = getEffectiveMargin(settings, pageW, pageH);
  const mmW = pointsToMillimeters(pageW);
  const mmH = pointsToMillimeters(pageH);
  const fitLabels: Record<FitMode, string> = {
    contain: "Conter (sem corte)",
    cover: "Preencher (corte nas bordas)",
    stretch: "Esticar"
  };

  previewSpecs.textContent = `${formatPageBadgeLabel(item)} (${mmW} × ${mmH} mm) · Margem ${effectiveMargin} pt · ${fitLabels[settings.fitMode]} · Rotação ${normalizeRotation(item.rotation)}°`;

  prevPageModal.disabled = index === 0;
  nextPageModal.disabled = index === images.length - 1;
}

function navigatePreviewModal(delta: -1 | 1): void {
  if (previewItemId === null) return;
  const index = images.findIndex((item) => item.id === previewItemId);
  const target = images[index + delta];
  if (target) {
    openPreviewModal(target.id);
  }
}

// --- PDF Generation & Cancellation ---

function updateProgress(current: number, total: number, message: string): void {
  const safeTotal = Math.max(1, total);
  const percent = Math.min(100, Math.round((current / safeTotal) * 100));
  progressBar.style.width = `${percent}%`;
  progressText.textContent = message;
  progressPercent.textContent = `${percent}%`;
}

async function generatePdf(): Promise<void> {
  if (!images.length || isGenerating) return;

  if (progressHideTimer !== null) {
    window.clearTimeout(progressHideTimer);
    progressHideTimer = null;
  }

  isGenerating = true;
  cancelButton.hidden = false;
  progressWrap.hidden = false;
  syncDom();

  updateProgress(0, images.length, "Iniciando processador PDF...");
  setStatus("Gerando PDF em segundo plano...", "info");

  try {
    const pdfBuffer = await pdfController.generate({
      images,
      settings: {
        ...settings,
        fileName: fileNameInput.value.trim() || "meu-documento"
      },
      onProgress: updateProgress
    });

    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `${safeFileName(fileNameInput.value)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    setStatus(
      `PDF gerado com sucesso (${images.length} ${images.length === 1 ? "página" : "páginas"}, ${formatBytes(pdfBuffer.byteLength)}).`,
      "success"
    );
    updateProgress(images.length, images.length, "PDF pronto para uso!");
  } catch (error) {
    if (error instanceof Error && error.message === "CANCELLED") {
      setStatus("Geração do PDF cancelada.", "info");
      progressWrap.hidden = true;
    } else {
      console.error(error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao gerar o PDF.",
        "error"
      );
    }
  } finally {
    isGenerating = false;
    cancelButton.hidden = true;
    syncDom();
    if (!progressWrap.hidden) {
      progressHideTimer = window.setTimeout(() => {
        progressWrap.hidden = true;
      }, 2000);
    }
  }
}

function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): void {
  settings[key] = value;
  scheduleSaveSettings();
  if (key === "theme") {
    applyTheme();
    return;
  }
  syncSettingsControls();
  scheduleAllPreviewsUpdate();
}

// --- Clipboard Paste Support ---

function extractFilesFromClipboardData(
  clipboardData: DataTransfer | null
): File[] {
  if (!clipboardData) return [];
  const extracted: File[] = [];

  if (clipboardData.items) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && isAcceptedFile(file)) {
          extracted.push(normalizeClipboardFile(file));
        }
      }
    }
  }

  if (extracted.length === 0 && clipboardData.files?.length) {
    for (const file of Array.from(clipboardData.files)) {
      if (isAcceptedFile(file)) {
        extracted.push(normalizeClipboardFile(file));
      }
    }
  }

  return extracted;
}

function normalizeClipboardFile(file: File): File {
  if (/^image\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
    const ext = getExtension(file.name) || ".png";
    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
    const customName = `captura-${stamp}-${pasteCounter++}${ext}`;
    return new File([file], customName, {
      type: file.type,
      lastModified: Date.now()
    });
  }
  return file;
}

async function handlePasteButtonClick(): Promise<void> {
  if (!navigator.clipboard?.read) {
    setStatus(
      "Pressione Ctrl+V (ou Cmd+V) no teclado para colar imagens.",
      "info"
    );
    return;
  }

  try {
    const clipboardItems = await navigator.clipboard.read();
    const files: File[] = [];

    for (const item of clipboardItems) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        const ext = imageType.split("/")[1]?.replace("jpeg", "jpg") || "png";
        const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
        const file = new File(
          [blob],
          `colado-${stamp}-${pasteCounter++}.${ext}`,
          {
            type: imageType,
            lastModified: Date.now()
          }
        );
        files.push(file);
      }
    }

    if (files.length > 0) {
      addFiles(files, {
        allowDuplicates: true,
        sourceLabel: "Área de transferência"
      });
    } else {
      setStatus(
        "Nenhuma imagem encontrada na área de transferência. Use Ctrl+V após copiar uma imagem.",
        "info"
      );
    }
  } catch {
    setStatus(
      "Pressione Ctrl+V diretamente na página para colar a imagem copiada.",
      "info"
    );
  }
}

// --- Event Listeners ---

applyTheme();
syncSettingsControls();
syncDom();

const rootsCanvas = document.querySelector<HTMLCanvasElement>("#rootsCanvas");
if (rootsCanvas) {
  initRootsBackground(rootsCanvas);
}

fileInput.addEventListener("change", () => {
  if (fileInput.files?.length) addFiles(fileInput.files);
  fileInput.value = "";
});

pasteButton.addEventListener("click", () => {
  void handlePasteButtonClick();
});

window.addEventListener("paste", (event: ClipboardEvent) => {
  const pastedFiles = extractFilesFromClipboardData(event.clipboardData);
  if (pastedFiles.length > 0) {
    event.preventDefault();
    addFiles(pastedFiles, {
      allowDuplicates: true,
      sourceLabel: "Colado com Ctrl+V"
    });
  }
});

for (const eventName of ["dragenter", "dragover"] as const) {
  dropZone.addEventListener(eventName, (event) => {
    if (dragId !== null) return;
    event.preventDefault();
    if (!dropZone.classList.contains("dragging")) {
      dropZone.classList.add("dragging");
    }
  });
}

dropZone.addEventListener("dragleave", (event) => {
  const related = event.relatedTarget as Node | null;
  if (!related || !dropZone.contains(related)) {
    dropZone.classList.remove("dragging");
  }
});

dropZone.addEventListener("drop", (event) => {
  if (dragId !== null) return;
  event.preventDefault();
  dropZone.classList.remove("dragging");
  if (event.dataTransfer?.files?.length) {
    addFiles(event.dataTransfer.files);
  }
});

imageList.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]"
  );
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === "preview") openPreviewModal(id);
  if (action === "duplicate") duplicateImage(id);
  if (action === "up") moveImage(id, -1);
  if (action === "down") moveImage(id, 1);
  if (action === "remove") removeImage(id);
  if (action === "rotateLeft") rotateImage(id, -90);
  if (action === "rotateRight") rotateImage(id, 90);
});

imageList.addEventListener("dragstart", (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>(
    ".image-item"
  );
  if (!item || isGenerating) return;
  dragId = Number(item.dataset.id);
  item.classList.add("dragging-item");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(dragId));
  }
});

imageList.addEventListener("dragend", (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>(
    ".image-item"
  );
  item?.classList.remove("dragging-item");
  dragId = null;
  if (currentDragOverEl) {
    currentDragOverEl.classList.remove("drag-over");
    currentDragOverEl = null;
  }
});

imageList.addEventListener("dragover", (event) => {
  if (dragId === null) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".image-item"
  );
  if (!target || Number(target.dataset.id) === dragId) {
    if (currentDragOverEl) {
      currentDragOverEl.classList.remove("drag-over");
      currentDragOverEl = null;
    }
    return;
  }
  if (currentDragOverEl !== target) {
    currentDragOverEl?.classList.remove("drag-over");
    target.classList.add("drag-over");
    currentDragOverEl = target;
  }
});

imageList.addEventListener("drop", (event) => {
  if (dragId === null) return;
  event.preventDefault();
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".image-item"
  );
  if (currentDragOverEl) {
    currentDragOverEl.classList.remove("drag-over");
    currentDragOverEl = null;
  }

  if (!target) {
    dragId = null;
    return;
  }

  const targetId = Number(target.dataset.id);
  const from = images.findIndex((item) => item.id === dragId);
  const to = images.findIndex((item) => item.id === targetId);
  dragId = null;

  if (from === -1 || to === -1 || from === to) return;
  const [moved] = images.splice(from, 1);
  images.splice(to, 0, moved);
  setManualSortIndicator();
  syncDom();
});

clearButton.addEventListener("click", clearImages);
rotateAllLeftButton.addEventListener("click", () => rotateAllImages(-90));
rotateAllRightButton.addEventListener("click", () => rotateAllImages(90));
reverseOrderButton.addEventListener("click", reverseImagesOrder);

generateButton.addEventListener("click", () => void generatePdf());
cancelButton.addEventListener("click", () => pdfController.cancel());

sortSelect.addEventListener("change", () =>
  sortImages(sortSelect.value as SortMode)
);

fileNameInput.addEventListener("input", () => {
  settings.fileName = fileNameInput.value;
  scheduleSaveSettings();
});
pageSizeInput.addEventListener("change", () =>
  updateSetting("pageSize", pageSizeInput.value as PageSize)
);
orientationInput.addEventListener("change", () =>
  updateSetting("orientation", orientationInput.value as Orientation)
);
marginInput.addEventListener("input", () =>
  updateSetting("margin", Number(marginInput.value))
);
fitModeInput.addEventListener("change", () =>
  updateSetting("fitMode", fitModeInput.value as FitMode)
);
qualityInput.addEventListener("change", () =>
  updateSetting("quality", qualityInput.value as Quality)
);

// Preview Modal controls
closePreviewDialog.addEventListener("click", closePreviewModal);
previewDialog.addEventListener("close", () => {
  revokePreviewFullRes();
  previewItemId = null;
});
previewDialog.addEventListener("click", (event) => {
  if (event.target === previewDialog) closePreviewModal();
});
prevPageModal.addEventListener("click", () => navigatePreviewModal(-1));
nextPageModal.addEventListener("click", () => navigatePreviewModal(1));
rotateLeftModal.addEventListener("click", () => {
  if (previewItemId !== null) rotateImage(previewItemId, -90);
});
rotateRightModal.addEventListener("click", () => {
  if (previewItemId !== null) rotateImage(previewItemId, 90);
});

window.addEventListener("keydown", (event) => {
  if (!previewDialog.open) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    navigatePreviewModal(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    navigatePreviewModal(1);
  }
});

// About Dialog controls
aboutButton.addEventListener("click", () => aboutDialog.showModal());
closeDialog.addEventListener("click", () => aboutDialog.close());
aboutDialog.addEventListener("click", (event) => {
  if (event.target === aboutDialog) aboutDialog.close();
});
