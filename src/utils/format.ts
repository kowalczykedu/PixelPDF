import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME } from "../types";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character] ?? character
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function isAcceptedFile(file: File): boolean {
  return (
    ACCEPTED_MIME.includes(file.type) ||
    ACCEPTED_EXTENSIONS.includes(getExtension(file.name))
  );
}

export function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || getExtension(file.name) === ".svg";
}

export function isPngFile(fileName: string, mimeType: string): boolean {
  return mimeType === "image/png" || getExtension(fileName) === ".png";
}

export function safeFileName(name: string): string {
  return (name.trim() || "meu-documento")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.pdf$/i, "");
}

export function pointsToMillimeters(pt: number): number {
  return Math.round(pt * 0.352778);
}

