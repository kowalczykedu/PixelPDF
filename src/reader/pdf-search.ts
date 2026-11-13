import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReaderPageItem } from "../types";

export interface PageTextSegment {
  /** Index of the corresponding element in TextLayer.textDivs */
  itemIndex: number;
  startOffset: number;
  endOffset: number;
}

export interface PageTextIndex {
  normalizedText: string;
  rawText: string;
  segments: PageTextSegment[];
}

export interface SearchMatch {
  pageId: number;
  pageOrderIndex: number;
  startOffset: number;
  endOffset: number;
  segments: { itemIndex: number; start: number; end: number }[];
}

function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase("pt-BR");
}

/**
 * Builds and caches searchable text + span offsets for individual PDF pages,
 * keeping search responsive across large documents via periodic yielding.
 */
export class PdfTextSearchIndex {
  private cache = new Map<string, PageTextIndex>();

  public clearForSource(sourceDocId: number): void {
    const prefix = `${sourceDocId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public clearAll(): void {
    this.cache.clear();
  }

  public async getPageIndex(
    pdfDoc: PDFDocumentProxy,
    sourceDocId: number,
    sourcePageNumber: number
  ): Promise<PageTextIndex> {
    const key = `${sourceDocId}:${sourcePageNumber}`;
    const existing = this.cache.get(key);
    if (existing) return existing;

    const page = await pdfDoc.getPage(sourcePageNumber);
    const content = await page.getTextContent();

    const parts: string[] = [];
    const segments: PageTextSegment[] = [];
    let cursor = 0;

    // TextLayer creates one textDiv entry per item with `.str` (matching indices)
    let textItemIndex = 0;
    for (const rawItem of content.items) {
      if (!("str" in rawItem)) continue;

      const str = rawItem.str;
      if (str.length > 0) {
        parts.push(str);
        segments.push({
          itemIndex: textItemIndex,
          startOffset: cursor,
          endOffset: cursor + str.length
        });
        cursor += str.length;
      }

      if (rawItem.hasEOL) {
        parts.push("\n");
        cursor += 1;
      }

      textItemIndex += 1;
    }

    const rawText = parts.join("");
    const index: PageTextIndex = {
      rawText,
      normalizedText: normalizeForSearch(rawText),
      segments
    };
    this.cache.set(key, index);
    return index;
  }

  public async searchPages(
    pages: ReaderPageItem[],
    getDoc: (sourceDocId: number) => PDFDocumentProxy | undefined,
    query: string,
    isCancelled: () => boolean
  ): Promise<SearchMatch[]> {
    const cleanQuery = normalizeForSearch(query.trim());
    if (!cleanQuery || pages.length === 0) return [];

    const matches: SearchMatch[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      if (isCancelled()) return [];

      const pageItem = pages[pageIdx];
      const doc = getDoc(pageItem.sourceDocId);
      if (!doc) continue;

      const pageIndex = await this.getPageIndex(
        doc,
        pageItem.sourceDocId,
        pageItem.sourcePageNumber
      );

      if (isCancelled()) return [];

      const haystack = pageIndex.normalizedText;
      let pos = 0;

      while (pos <= haystack.length - cleanQuery.length) {
        const foundAt = haystack.indexOf(cleanQuery, pos);
        if (foundAt === -1) break;

        const matchStart = foundAt;
        const matchEnd = foundAt + cleanQuery.length;
        const overlappingSegments: {
          itemIndex: number;
          start: number;
          end: number;
        }[] = [];

        for (const seg of pageIndex.segments) {
          if (seg.endOffset <= matchStart) continue;
          if (seg.startOffset >= matchEnd) break;

          overlappingSegments.push({
            itemIndex: seg.itemIndex,
            start: Math.max(0, matchStart - seg.startOffset),
            end: Math.min(
              seg.endOffset - seg.startOffset,
              matchEnd - seg.startOffset
            )
          });
        }

        matches.push({
          pageId: pageItem.id,
          pageOrderIndex: pageIdx,
          startOffset: matchStart,
          endOffset: matchEnd,
          segments: overlappingSegments
        });

        pos = foundAt + Math.max(1, cleanQuery.length);
      }

      // Yield periodically so large multi-hundred page PDFs don't stall UI input
      if ((pageIdx + 1) % 6 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    return matches;
  }
}

/**
 * Highlights matched character ranges inside rendered TextLayer textDivs using
 * zero-layout-shift <mark> elements. Restores clean text on each re-run.
 */
export function applyTextLayerHighlights(
  textDivs: HTMLElement[],
  rawItemStrings: string[],
  pageMatches: SearchMatch[],
  activeMatch: SearchMatch | null
): HTMLElement | null {
  let activeElement: HTMLElement | null = null;

  // Map itemIndex -> sorted highlight slices
  const highlightsBySpan = new Map<
    number,
    { start: number; end: number; isCurrent: boolean }[]
  >();

  for (const match of pageMatches) {
    const isCurrent =
      activeMatch !== null &&
      activeMatch.pageId === match.pageId &&
      activeMatch.startOffset === match.startOffset;

    for (const seg of match.segments) {
      let list = highlightsBySpan.get(seg.itemIndex);
      if (!list) {
        list = [];
        highlightsBySpan.set(seg.itemIndex, list);
      }
      list.push({ start: seg.start, end: seg.end, isCurrent });
    }
  }

  for (let i = 0; i < textDivs.length; i++) {
    const div = textDivs[i];
    const originalText = rawItemStrings[i] ?? div.textContent ?? "";
    const slices = highlightsBySpan.get(i);

    if (!slices || slices.length === 0) {
      if (div.querySelector("mark.pdf-search-match")) {
        div.textContent = originalText;
      }
      continue;
    }

    slices.sort((a, b) => a.start - b.start);

    const frag = document.createDocumentFragment();
    let cursor = 0;

    for (const slice of slices) {
      const safeStart = Math.max(cursor, Math.min(slice.start, originalText.length));
      const safeEnd = Math.max(safeStart, Math.min(slice.end, originalText.length));

      if (safeStart > cursor) {
        frag.appendChild(
          document.createTextNode(originalText.slice(cursor, safeStart))
        );
      }

      if (safeEnd > safeStart) {
        const mark = document.createElement("mark");
        mark.className = slice.isCurrent
          ? "pdf-search-match pdf-search-current"
          : "pdf-search-match";
        mark.textContent = originalText.slice(safeStart, safeEnd);
        frag.appendChild(mark);
        if (slice.isCurrent && !activeElement) {
          activeElement = mark;
        }
      }

      cursor = safeEnd;
    }

    if (cursor < originalText.length) {
      frag.appendChild(document.createTextNode(originalText.slice(cursor)));
    }

    div.textContent = "";
    div.appendChild(frag);
  }

  return activeElement;
}

