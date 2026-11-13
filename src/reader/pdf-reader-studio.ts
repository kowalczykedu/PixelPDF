import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import {
  type MergePageInput,
  type MergeSourceInput,
  type ReaderPageItem,
  type ReaderZoomMode
} from "../types";
import {
  formatBytes,
  isPdfUploadFile,
  pointsToMillimeters,
  safeFileName
} from "../utils/format";
import { ICONS } from "../utils/icons";
import { normalizeRotation } from "../utils/layout";
import { PdfMergeController } from "../pdf/pdf-merge-client";
import { loadPdfJs, openPdfFromBuffer } from "./pdfjs-loader";
import {
  PdfTextSearchIndex,
  applyTextLayerHighlights,
  type SearchMatch
} from "./pdf-search";

interface LoadedPdfSource {
  docId: number;
  fileName: string;
  fileSize: number;
  fingerprint: string;
  bytes: ArrayBuffer;
  pdfDoc: PDFDocumentProxy;
  encrypted: boolean;
}

interface ReaderSessionState {
  zoomMode: ReaderZoomMode;
  customScale: number;
  sidebarOpen: boolean;
  lastDocKey: string;
  lastPageIndex: number;
}

const READER_SESSION_KEY = "rootpdf-reader-session-v1";
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];
const MIN_SCALE = 0.35;
const MAX_SCALE = 3.0;

function readSavedSession(): ReaderSessionState {
  const defaults: ReaderSessionState = {
    zoomMode: "fit-width",
    customScale: 1,
    sidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 1040 : true,
    lastDocKey: "",
    lastPageIndex: 0
  };

  try {
    const raw = sessionStorage.getItem(READER_SESSION_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ReaderSessionState>;
    const validZoomModes: ReaderZoomMode[] = ["fit-width", "fit-page", "custom"];
    return {
      zoomMode: validZoomModes.includes(parsed.zoomMode as ReaderZoomMode)
        ? (parsed.zoomMode as ReaderZoomMode)
        : defaults.zoomMode,
      customScale:
        typeof parsed.customScale === "number" &&
        Number.isFinite(parsed.customScale)
          ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed.customScale))
          : defaults.customScale,
      sidebarOpen:
        typeof parsed.sidebarOpen === "boolean"
          ? parsed.sidebarOpen
          : defaults.sidebarOpen,
      lastDocKey:
        typeof parsed.lastDocKey === "string" ? parsed.lastDocKey : "",
      lastPageIndex:
        typeof parsed.lastPageIndex === "number" &&
        Number.isInteger(parsed.lastPageIndex) &&
        parsed.lastPageIndex >= 0
          ? parsed.lastPageIndex
          : 0
    };
  } catch {
    return defaults;
  }
}

export class PdfReaderStudio {
  private readonly host: HTMLElement;
  private isActive = false;
  private isExporting = false;

  private nextDocId = 1;
  private nextPageId = 1;
  private sources = new Map<number, LoadedPdfSource>();
  private pages: ReaderPageItem[] = [];
  private selectedPageId: number | null = null;

  private session: ReaderSessionState = readSavedSession();
  private lastComputedScale = 1;

  // Render & async cancellation control
  private renderVersion = 0;
  private activeRenderTask: RenderTask | null = null;
  private activeTextLayer: TextLayer | null = null;
  private renderedTextDivs: HTMLElement[] = [];
  private renderedTextStrings: string[] = [];

  // Search state
  private searchIndex = new PdfTextSearchIndex();
  private searchOpen = false;
  private searchToken = 0;
  private searchMatches: SearchMatch[] = [];
  private currentMatchIndex = -1;
  private searchDebounceTimer: number | null = null;

  // Thumbnail virtualization & DOM map
  private thumbElements = new Map<number, HTMLElement>();
  private thumbRenderKeys = new Map<number, string>();
  private thumbObserver: IntersectionObserver | null = null;
  private dragPageId: number | null = null;
  private currentDragOverThumb: HTMLElement | null = null;

  // Resize / fullscreen / wheel navigation
  private stageResizeObserver: ResizeObserver | null = null;
  private resizeRafPending = false;
  private progressHideTimer: number | null = null;
  private dropZoneTimer: number | null = null;
  private wheelDeltaAccum = 0;
  private wheelResetTimer: number | null = null;
  private lastWheelFlipTime = 0;
  private lastStageEdgeHitTime = 0;
  private pendingStageScrollEdge: "top" | "bottom" | null = null;

  // Merge controller
  private mergeController = new PdfMergeController();

  // Password prompt queue
  private passwordResolve: ((value: string | null) => void) | null = null;
  private passwordSubmitted = false;

  // DOM Elements
  private introSection!: HTMLElement;
  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private mergeInput!: HTMLInputElement;
  private workbench!: HTMLElement;
  private toggleThumbsBtn!: HTMLButtonElement;
  private pageCountBadge!: HTMLElement;
  private docCountBadge!: HTMLElement;
  private prevPageBtn!: HTMLButtonElement;
  private pageJumpInput!: HTMLInputElement;
  private totalPagesLabel!: HTMLElement;
  private nextPageBtn!: HTMLButtonElement;
  private zoomOutBtn!: HTMLButtonElement;
  private zoomSelect!: HTMLSelectElement;
  private zoomCustomOption!: HTMLOptionElement;
  private zoomInBtn!: HTMLButtonElement;
  private rotateLeftBtn!: HTMLButtonElement;
  private rotateRightBtn!: HTMLButtonElement;
  private searchToggleBtn!: HTMLButtonElement;
  private fullscreenBtn!: HTMLButtonElement;
  private fullscreenLabel!: HTMLElement;

  // Search bar
  private searchBar!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private searchClearBtn!: HTMLButtonElement;
  private searchCount!: HTMLElement;
  private searchPrevBtn!: HTMLButtonElement;
  private searchNextBtn!: HTMLButtonElement;
  private searchCloseBtn!: HTMLButtonElement;

  // Layout / Sidebar / Organizer
  private readerLayout!: HTMLElement;
  private sidebar!: HTMLElement;
  private thumbList!: HTMLElement;
  private reverseOrderBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private exportNameInput!: HTMLInputElement;
  private exportBtn!: HTMLButtonElement;
  private exportCancelBtn!: HTMLButtonElement;
  private exportProgressWrap!: HTMLElement;
  private exportProgressBar!: HTMLElement;
  private exportProgressText!: HTMLElement;
  private exportProgressPercent!: HTMLElement;
  private statusEl!: HTMLParagraphElement;
  private introStatusEl!: HTMLParagraphElement;

  // Stage
  private stage!: HTMLElement;
  private pageFrame!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private textLayerDiv!: HTMLDivElement;
  private loadingBadge!: HTMLElement;
  private pageMetaEl!: HTMLElement;

  // Password Dialog
  private passwordDialog!: HTMLDialogElement;
  private passwordFileEl!: HTMLElement;
  private passwordErrorEl!: HTMLElement;
  private passwordForm!: HTMLFormElement;
  private passwordInput!: HTMLInputElement;
  private passwordCancelBtn!: HTMLButtonElement;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderMarkup();
    this.bindElements();
    this.setupObservers();
    this.bindEvents();
    this.syncControls();
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (active && this.pages.length > 0) {
      window.requestAnimationFrame(() => {
        void this.renderSelectedPage();
      });
    }
  }

  public hasLoadedDocument(): boolean {
    return this.pages.length > 0;
  }

  public isModalOpen(): boolean {
    return this.passwordDialog.open;
  }

  public async openExternalFiles(files: FileList | File[]): Promise<void> {
    const mode = this.pages.length > 0 ? "append" : "replace";
    await this.handleFileSelection(files, mode);
  }

  private renderMarkup(): void {
    this.host.innerHTML = `
      <div id="readerIntroSection" class="reader-intro">
        <section class="hero reader-hero" aria-label="Leitor e organizador local de PDF">
          <div class="hero-copy">
            <div class="eyebrow">
              <span class="status-dot" aria-hidden="true"></span>
              <span>Leitura, busca e mesclagem 100% no navegador</span>
            </div>
            <h1>Leia, pesquise e organize <em>seus PDFs localmente.</em></h1>
            <p>Abra documentos multi-página com seleção e busca de texto (<kbd>Ctrl+F</kbd>), ajuste zoom e tela cheia, combine vários arquivos, gire ou reordene páginas e baixe o PDF final direto do seu dispositivo.</p>
          </div>
          <div class="hero-stats reader-stats" aria-label="Recursos do leitor">
            <div class="stat-card">
              <strong>Ctrl+F</strong>
              <span>Busca no texto</span>
            </div>
            <div class="stat-card">
              <strong>Mesclar</strong>
              <span>Múltiplos PDFs</span>
            </div>
            <div class="stat-card stat-card-accent">
              <strong>0%</strong>
              <span>Upload externo</span>
            </div>
          </div>
        </section>

        <section class="upload-card panel" id="readerDropZone" aria-label="Área de importação de arquivos PDF">
          <div class="drop-inner">
            <div class="upload-visual" aria-hidden="true">
              <div class="upload-icon-wrap">
                <div class="upload-icon">${ICONS.bookOpen}</div>
              </div>
            </div>

            <div class="drop-copy">
              <div class="drop-title-row">
                <h2>Arraste e solte seus arquivos PDF aqui</h2>
                <span class="multi-badge">1 ou mais PDFs</span>
              </div>
              <p>Carregue documentos para leitura em alta nitidez, extração de texto e organização de páginas — tudo na memória local.</p>
              <div class="format-pills" aria-label="Recursos disponíveis no módulo">
                <span class="format-pill">PDF</span>
                <span class="format-pill">Miniaturas</span>
                <span class="format-pill">Seleção de texto</span>
                <span class="format-pill">Mesclar &amp; Girar</span>
              </div>
            </div>

            <div class="upload-actions">
              <label class="button primary" for="readerFileInput">
                ${ICONS.folderPlus}
                <span>Abrir PDF(s)</span>
              </label>
            </div>
            <input id="readerFileInput" type="file" accept=".pdf,application/pdf" multiple hidden />
          </div>

          <div class="drop-hint">
            <span class="hint-icon" aria-hidden="true">${ICONS.shield}</span>
            <span>PDFs protegidos por senha solicitam desbloqueio local · Nenhum arquivo sai da sua máquina</span>
          </div>
        </section>

        <p id="readerIntroStatus" class="status reader-intro-status" role="status" aria-live="polite"></p>
      </div>

      <section id="readerWorkbench" class="reader-workbench" aria-label="Área de leitura e organização de PDF" hidden>
        <div class="reader-toolbar panel" role="toolbar" aria-label="Controles do leitor de PDF">
          <div class="reader-toolbar-group">
            <button id="toggleThumbnailsBtn" class="button ghost compact-btn" type="button" aria-expanded="true" aria-controls="readerSidebar" title="Mostrar ou ocultar painel de páginas e organizador">
              ${ICONS.panelLeft}
              <span>Páginas &amp; Organizar</span>
            </button>
            <div class="file-summary reader-summary">
              <span class="purple-pip" aria-hidden="true"></span>
              <strong id="readerPageCountBadge">0 páginas</strong>
              <span class="summary-divider" aria-hidden="true">•</span>
              <span id="readerDocCountBadge">0 PDFs</span>
            </div>
          </div>

          <div class="reader-toolbar-group reader-nav-controls">
            <button id="readerPrevPageBtn" class="button ghost icon-only" type="button" aria-label="Página anterior" title="Página anterior (←)">
              ${ICONS.chevronLeft}
            </button>
            <label class="reader-jump-field">
              <input id="readerPageJumpInput" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Ir para o número da página" title="Digite o número da página e pressione Enter" />
              <span id="readerTotalPagesLabel" class="reader-total-pages">/ 0</span>
            </label>
            <button id="readerNextPageBtn" class="button ghost icon-only" type="button" aria-label="Próxima página" title="Próxima página (→)">
              ${ICONS.chevronRight}
            </button>

            <span class="toolbar-sep" aria-hidden="true"></span>

            <button id="readerZoomOutBtn" class="button ghost icon-only" type="button" aria-label="Diminuir zoom" title="Diminuir zoom (-)">
              ${ICONS.zoomOut}
            </button>
            <select id="readerZoomSelect" class="reader-zoom-select" aria-label="Nível de zoom da página">
              <option value="fit-width">Ajustar largura</option>
              <option value="fit-page">Ajustar página</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
              <option value="2.5">250%</option>
              <option id="readerZoomCustomOpt" value="custom" hidden>100%</option>
            </select>
            <button id="readerZoomInBtn" class="button ghost icon-only" type="button" aria-label="Aumentar zoom" title="Aumentar zoom (+)">
              ${ICONS.zoom}
            </button>
          </div>

          <div class="reader-toolbar-group reader-tool-actions">
            <button id="readerRotateLeftBtn" class="button ghost icon-only" type="button" aria-label="Girar página atual 90 graus para a esquerda" title="Girar página atual 90° à esquerda">
              ${ICONS.rotateCcw}
            </button>
            <button id="readerRotateRightBtn" class="button ghost icon-only" type="button" aria-label="Girar página atual 90 graus para a direita" title="Girar página atual 90° à direita">
              ${ICONS.rotateCw}
            </button>
            <button id="readerSearchToggleBtn" class="button ghost compact-btn" type="button" aria-expanded="false" aria-controls="readerSearchBar" title="Buscar texto no PDF (Ctrl+F)">
              ${ICONS.search}
              <span>Buscar</span>
            </button>
            <button id="readerFullscreenBtn" class="button ghost compact-btn" type="button" aria-pressed="false" title="Alternar modo tela cheia">
              <span class="fs-icon">${ICONS.maximize}</span>
              <span id="readerFullscreenLabel">Tela cheia</span>
            </button>
          </div>
        </div>

        <div id="readerSearchBar" class="reader-search-bar panel" role="search" aria-label="Busca de texto no documento PDF" hidden>
          <div class="reader-search-input-wrap">
            <span class="search-prefix-icon" aria-hidden="true">${ICONS.search}</span>
            <input id="readerSearchInput" type="search" placeholder="Buscar texto no PDF..." aria-label="Texto para buscar no PDF" autocomplete="off" spellcheck="false" />
            <button id="readerSearchClearBtn" class="reader-search-clear" type="button" aria-label="Limpar texto da busca" title="Limpar busca" hidden>
              ${ICONS.close}
            </button>
          </div>
          <span id="readerSearchCount" class="reader-search-count" aria-live="polite">0 resultados</span>
          <div class="reader-search-actions">
            <button id="readerSearchPrevBtn" class="button ghost icon-only" type="button" aria-label="Ocorrência anterior" title="Ocorrência anterior (Shift+Enter)" disabled>
              ${ICONS.arrowUp}
            </button>
            <button id="readerSearchNextBtn" class="button ghost icon-only" type="button" aria-label="Próxima ocorrência" title="Próxima ocorrência (Enter)" disabled>
              ${ICONS.arrowDown}
            </button>
            <button id="readerSearchCloseBtn" class="button ghost icon-only" type="button" aria-label="Fechar busca" title="Fechar busca (Esc)">
              ${ICONS.close}
            </button>
          </div>
        </div>

        <div id="readerLayout" class="reader-layout">
          <aside id="readerSidebar" class="panel reader-sidebar" aria-label="Miniaturas e organizador de páginas">
            <div class="panel-header reader-sidebar-header">
              <div class="panel-header-title">
                <span class="section-kicker" aria-hidden="true">PDF</span>
                <div>
                  <h2>Páginas</h2>
                  <p>Arraste ou use as ações para organizar</p>
                </div>
              </div>
            </div>

            <div class="reader-sidebar-actions">
              <label class="button ghost compact-btn" for="readerMergeInput" title="Adicionar outro PDF para ler ou mesclar páginas">
                ${ICONS.plus}
                <span>Mesclar PDF</span>
              </label>
              <input id="readerMergeInput" type="file" accept=".pdf,application/pdf" multiple hidden />

              <button id="readerReverseBtn" class="button ghost compact-btn" type="button" title="Inverter a ordem de todas as páginas">
                ${ICONS.arrowUpDown}
                <span>Inverter</span>
              </button>

              <button id="readerClearBtn" class="button ghost compact-btn danger-hover" type="button" title="Fechar todos os PDFs abertos">
                ${ICONS.trash}
                <span>Fechar</span>
              </button>
            </div>

            <div id="readerThumbList" class="reader-thumb-list" role="list" aria-label="Lista de páginas do documento"></div>

            <div class="reader-export-box">
              <label class="field">
                <span>Arquivo de saída</span>
                <div class="input-with-icon">
                  <span class="input-prefix" aria-hidden="true">
                    ${ICONS.fileText}
                    <b>PDF</b>
                  </span>
                  <input id="readerExportName" type="text" maxlength="80" placeholder="documento-organizado" spellcheck="false" />
                </div>
              </label>

              <div id="readerExportProgress" class="progress-wrap" hidden>
                <div class="progress-head">
                  <span id="readerExportProgressText">Exportando PDF...</span>
                  <strong id="readerExportProgressPercent">0%</strong>
                </div>
                <div class="progress-track">
                  <div id="readerExportProgressBar" class="progress-bar"></div>
                </div>
              </div>

              <div class="action-buttons">
                <button id="readerExportBtn" class="button primary generate-button" type="button">
                  ${ICONS.download}
                  <span>Exportar PDF organizado</span>
                </button>
                <button id="readerExportCancelBtn" class="button ghost danger-hover" type="button" hidden>
                  ${ICONS.close}
                  <span>Cancelar</span>
                </button>
              </div>

              <p id="readerStatus" class="status" role="status" aria-live="polite"></p>
            </div>
          </aside>

          <section class="panel reader-stage-panel" aria-label="Visualização da página do PDF">
            <div id="readerStage" class="reader-stage" tabindex="0" aria-label="Folha do PDF em visualização">
              <div id="readerPageFrame" class="pdf-page-frame">
                <canvas id="readerCanvas" class="pdf-render-canvas"></canvas>
                <div id="readerTextLayer" class="textLayer"></div>
              </div>
              <div id="readerLoadingBadge" class="reader-loading-badge" hidden>Renderizando página...</div>
            </div>

            <div class="reader-stage-footer">
              <span id="readerPageMeta" class="reader-page-meta">—</span>
              <span class="reader-stage-hint">Role o scroll ou use ←/→ para navegar · Solte outro .pdf aqui para mesclar</span>
            </div>
          </section>
        </div>
      </section>

      <dialog id="pdfPasswordDialog" class="about-dialog password-dialog" aria-label="PDF protegido por senha">
        <div class="dialog-card">
          <button id="pdfPasswordCancelIcon" class="dialog-close" type="button" aria-label="Cancelar abertura do PDF" title="Cancelar (Esc)">
            ${ICONS.close}
          </button>
          <span class="eyebrow">${ICONS.lock} Documento Protegido</span>
          <h2>Digite a senha do PDF</h2>
          <p>O arquivo <strong id="pdfPasswordFileName">documento.pdf</strong> exige uma senha para ser aberto localmente.</p>
          <p id="pdfPasswordError" class="password-error" role="alert" hidden>Senha incorreta. Tente novamente.</p>
          <form id="pdfPasswordForm" class="password-form">
            <label class="field">
              <span>Senha do documento</span>
              <input id="pdfPasswordInput" type="password" autocomplete="current-password" required placeholder="Informe a senha..." />
            </label>
            <div class="password-actions">
              <button id="pdfPasswordCancelBtn" class="button ghost" type="button">Cancelar</button>
              <button class="button primary" type="submit">Desbloquear PDF</button>
            </div>
          </form>
        </div>
      </dialog>
    `;
  }

  private el<T extends HTMLElement>(id: string): T {
    const found = this.host.querySelector<T>(`#${id}`);
    if (!found) {
      throw new Error(`Elemento do leitor #${id} não encontrado.`);
    }
    return found;
  }

  private bindElements(): void {
    this.introSection = this.el("readerIntroSection");
    this.dropZone = this.el("readerDropZone");
    this.fileInput = this.el("readerFileInput");
    this.mergeInput = this.el("readerMergeInput");
    this.workbench = this.el("readerWorkbench");
    this.toggleThumbsBtn = this.el("toggleThumbnailsBtn");
    this.pageCountBadge = this.el("readerPageCountBadge");
    this.docCountBadge = this.el("readerDocCountBadge");
    this.prevPageBtn = this.el("readerPrevPageBtn");
    this.pageJumpInput = this.el("readerPageJumpInput");
    this.totalPagesLabel = this.el("readerTotalPagesLabel");
    this.nextPageBtn = this.el("readerNextPageBtn");
    this.zoomOutBtn = this.el("readerZoomOutBtn");
    this.zoomSelect = this.el("readerZoomSelect");
    this.zoomCustomOption = this.el("readerZoomCustomOpt");
    this.zoomInBtn = this.el("readerZoomInBtn");
    this.rotateLeftBtn = this.el("readerRotateLeftBtn");
    this.rotateRightBtn = this.el("readerRotateRightBtn");
    this.searchToggleBtn = this.el("readerSearchToggleBtn");
    this.fullscreenBtn = this.el("readerFullscreenBtn");
    this.fullscreenLabel = this.el("readerFullscreenLabel");

    this.searchBar = this.el("readerSearchBar");
    this.searchInput = this.el("readerSearchInput");
    this.searchClearBtn = this.el("readerSearchClearBtn");
    this.searchCount = this.el("readerSearchCount");
    this.searchPrevBtn = this.el("readerSearchPrevBtn");
    this.searchNextBtn = this.el("readerSearchNextBtn");
    this.searchCloseBtn = this.el("readerSearchCloseBtn");

    this.readerLayout = this.el("readerLayout");
    this.sidebar = this.el("readerSidebar");
    this.thumbList = this.el("readerThumbList");
    this.reverseOrderBtn = this.el("readerReverseBtn");
    this.clearBtn = this.el("readerClearBtn");
    this.exportNameInput = this.el("readerExportName");
    this.exportBtn = this.el("readerExportBtn");
    this.exportCancelBtn = this.el("readerExportCancelBtn");
    this.exportProgressWrap = this.el("readerExportProgress");
    this.exportProgressBar = this.el("readerExportProgressBar");
    this.exportProgressText = this.el("readerExportProgressText");
    this.exportProgressPercent = this.el("readerExportProgressPercent");
    this.statusEl = this.el("readerStatus");
    this.introStatusEl = this.el("readerIntroStatus");

    this.stage = this.el("readerStage");
    this.pageFrame = this.el("readerPageFrame");
    this.canvas = this.el("readerCanvas");
    this.textLayerDiv = this.el("readerTextLayer");
    this.loadingBadge = this.el("readerLoadingBadge");
    this.pageMetaEl = this.el("readerPageMeta");

    this.passwordDialog = this.el("pdfPasswordDialog");
    this.passwordFileEl = this.el("pdfPasswordFileName");
    this.passwordErrorEl = this.el("pdfPasswordError");
    this.passwordForm = this.el("pdfPasswordForm");
    this.passwordInput = this.el("pdfPasswordInput");
    this.passwordCancelBtn = this.el("pdfPasswordCancelBtn");
  }

  private setupObservers(): void {
    this.thumbObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const card = entry.target as HTMLElement;
          const pageId = Number(card.dataset.pageId);
          const item = this.pages.find((p) => p.id === pageId);
          if (item) {
            void this.renderThumbnail(item, card);
          }
        }
      },
      {
        root: this.thumbList,
        rootMargin: "220px 0px"
      }
    );

    if (typeof ResizeObserver !== "undefined") {
      this.stageResizeObserver = new ResizeObserver(() => {
        if (
          !this.isActive ||
          this.pages.length === 0 ||
          this.session.zoomMode === "custom"
        ) {
          return;
        }
        if (this.resizeRafPending) return;
        this.resizeRafPending = true;
        window.requestAnimationFrame(() => {
          this.resizeRafPending = false;
          void this.recheckAutoFitScale();
        });
      });
      this.stageResizeObserver.observe(this.stage);
    }
  }

  private bindEvents(): void {
    this.fileInput.addEventListener("change", () => {
      if (this.fileInput.files?.length) {
        void this.handleFileSelection(this.fileInput.files, "replace");
      }
      this.fileInput.value = "";
    });

    this.mergeInput.addEventListener("change", () => {
      if (this.mergeInput.files?.length) {
        void this.handleFileSelection(this.mergeInput.files, "append");
      }
      this.mergeInput.value = "";
    });

    this.setupExternalFileDrop(this.dropZone, "replace");
    this.setupExternalFileDrop(this.workbench, "append");

    this.toggleThumbsBtn.addEventListener("click", () => {
      this.session.sidebarOpen = !this.session.sidebarOpen;
      this.saveSession();
      this.syncSidebarVisibility();
    });

    this.prevPageBtn.addEventListener("click", () => this.stepPage(-1));
    this.nextPageBtn.addEventListener("click", () => this.stepPage(1));

    this.pageJumpInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.commitPageJump();
        this.pageJumpInput.blur();
      }
    });
    this.pageJumpInput.addEventListener("blur", () => this.commitPageJump());

    this.zoomOutBtn.addEventListener("click", () => this.stepZoom(-1));
    this.zoomInBtn.addEventListener("click", () => this.stepZoom(1));
    this.zoomSelect.addEventListener("change", () => {
      const value = this.zoomSelect.value;
      if (value === "fit-width" || value === "fit-page") {
        this.session.zoomMode = value;
      } else if (value !== "custom") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          this.session.zoomMode = "custom";
          this.session.customScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, numeric)
          );
        }
      }
      this.saveSession();
      this.syncZoomSelect();
      void this.renderSelectedPage();
    });

    this.rotateLeftBtn.addEventListener("click", () => {
      if (this.selectedPageId !== null) {
        this.rotatePage(this.selectedPageId, -90);
      }
    });
    this.rotateRightBtn.addEventListener("click", () => {
      if (this.selectedPageId !== null) {
        this.rotatePage(this.selectedPageId, 90);
      }
    });

    // Search controls
    this.searchToggleBtn.addEventListener("click", () =>
      this.toggleSearchBar(!this.searchOpen)
    );
    this.searchCloseBtn.addEventListener("click", () =>
      this.toggleSearchBar(false)
    );
    this.searchInput.addEventListener("input", () => {
      this.searchClearBtn.hidden = this.searchInput.value.length === 0;
      if (this.searchDebounceTimer !== null) {
        window.clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = window.setTimeout(() => {
        void this.executeSearch();
      }, 180);
    });
    this.searchClearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.searchClearBtn.hidden = true;
      if (this.searchDebounceTimer !== null) {
        window.clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = null;
      }
      this.searchInput.focus();
      void this.executeSearch();
    });
    this.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.navigateSearchMatch(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.toggleSearchBar(false);
      }
    });
    this.searchPrevBtn.addEventListener("click", () =>
      this.navigateSearchMatch(-1)
    );
    this.searchNextBtn.addEventListener("click", () =>
      this.navigateSearchMatch(1)
    );

    // Fullscreen
    this.fullscreenBtn.addEventListener("click", () =>
      void this.toggleFullscreen()
    );
    document.addEventListener("fullscreenchange", () => {
      this.syncFullscreenState();
    });

    // Organizer actions
    this.reverseOrderBtn.addEventListener("click", () =>
      this.reversePagesOrder()
    );
    this.clearBtn.addEventListener("click", () => void this.clearAllDocuments());
    this.exportBtn.addEventListener("click", () => void this.exportMergedPdf());
    this.exportCancelBtn.addEventListener("click", () =>
      this.mergeController.cancel()
    );

    // Thumb list delegated click & drag-and-drop reorder
    this.thumbList.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const actionBtn = target.closest<HTMLElement>("[data-thumb-action]");
      const card = target.closest<HTMLElement>(".reader-thumb-card");
      if (!card) return;
      const pageId = Number(card.dataset.pageId);

      if (actionBtn) {
        event.stopPropagation();
        const action = actionBtn.dataset.thumbAction;
        if (action === "up") this.movePage(pageId, -1);
        if (action === "down") this.movePage(pageId, 1);
        if (action === "rotate") this.rotatePage(pageId, 90);
        if (action === "duplicate") this.duplicatePage(pageId);
        if (action === "remove") this.removePage(pageId);
        return;
      }

      this.selectPageById(pageId);
      if (window.innerWidth <= 680 && this.session.sidebarOpen) {
        this.session.sidebarOpen = false;
        this.saveSession();
        this.syncSidebarVisibility();
      }
    });

    // Mouse-wheel / trackpad page navigation inside the stage
    this.stage.addEventListener(
      "wheel",
      (event: WheelEvent) => this.handleStageWheel(event),
      { passive: false }
    );

    this.thumbList.addEventListener("dragstart", (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(
        ".reader-thumb-card"
      );
      if (!card || this.isExporting) return;
      this.dragPageId = Number(card.dataset.pageId);
      card.classList.add("dragging-item");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(this.dragPageId));
      }
    });

    this.thumbList.addEventListener("dragend", (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(
        ".reader-thumb-card"
      );
      card?.classList.remove("dragging-item");
      this.dragPageId = null;
      if (this.currentDragOverThumb) {
        this.currentDragOverThumb.classList.remove("drag-over");
        this.currentDragOverThumb = null;
      }
    });

    this.thumbList.addEventListener("dragover", (event) => {
      if (this.dragPageId === null) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        ".reader-thumb-card"
      );
      if (!target || Number(target.dataset.pageId) === this.dragPageId) {
        if (this.currentDragOverThumb) {
          this.currentDragOverThumb.classList.remove("drag-over");
          this.currentDragOverThumb = null;
        }
        return;
      }
      if (this.currentDragOverThumb !== target) {
        this.currentDragOverThumb?.classList.remove("drag-over");
        target.classList.add("drag-over");
        this.currentDragOverThumb = target;
      }
    });

    this.thumbList.addEventListener("drop", (event) => {
      if (this.dragPageId === null) return;
      event.preventDefault();
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        ".reader-thumb-card"
      );
      if (this.currentDragOverThumb) {
        this.currentDragOverThumb.classList.remove("drag-over");
        this.currentDragOverThumb = null;
      }
      if (!target) {
        this.dragPageId = null;
        return;
      }

      const targetId = Number(target.dataset.pageId);
      const from = this.pages.findIndex((p) => p.id === this.dragPageId);
      const to = this.pages.findIndex((p) => p.id === targetId);
      this.dragPageId = null;
      if (from === -1 || to === -1 || from === to) return;

      const [moved] = this.pages.splice(from, 1);
      this.pages.splice(to, 0, moved);
      this.syncThumbListDom();
      this.syncControls();
      this.setStatus("Página reposicionada.", "info");
    });

    // Global keyboard shortcuts scoped to active Reader tab
    window.addEventListener("keydown", (event) => this.handleKeydown(event));

    // Password dialog events
    this.passwordForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = this.passwordInput.value;
      if (!value) return;
      this.passwordSubmitted = true;
      const resolver = this.passwordResolve;
      this.passwordResolve = null;
      this.passwordDialog.close();
      resolver?.(value);
    });

    const cancelPassword = () => {
      if (this.passwordDialog.open) {
        this.passwordDialog.close();
      }
      if (this.passwordResolve) {
        const resolver = this.passwordResolve;
        this.passwordResolve = null;
        resolver(null);
      }
    };

    this.passwordCancelBtn.addEventListener("click", cancelPassword);
    this.el("pdfPasswordCancelIcon").addEventListener("click", cancelPassword);
    this.passwordDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancelPassword();
    });
    this.passwordDialog.addEventListener("close", () => {
      if (!this.passwordSubmitted && this.passwordResolve) {
        const resolver = this.passwordResolve;
        this.passwordResolve = null;
        resolver(null);
      }
    });
  }

  private setupExternalFileDrop(
    zone: HTMLElement,
    mode: "replace" | "append"
  ): void {
    for (const evt of ["dragenter", "dragover"] as const) {
      zone.addEventListener(evt, (event) => {
        if (this.dragPageId !== null) return;
        const dt = event.dataTransfer;
        if (!dt || !Array.from(dt.types).includes("Files")) return;
        event.preventDefault();
        zone.classList.add("dragging");
      });
    }

    zone.addEventListener("dragleave", (event) => {
      const related = event.relatedTarget as Node | null;
      if (!related || !zone.contains(related)) {
        zone.classList.remove("dragging");
      }
    });

    zone.addEventListener("drop", (event) => {
      if (this.dragPageId !== null) return;
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      event.preventDefault();
      zone.classList.remove("dragging");
      void this.handleFileSelection(files, mode);
    });
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.isActive || this.pages.length === 0) return;
    if (this.passwordDialog.open) return;

    // Intercept Ctrl+F / Cmd+F inside active reader workspace
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      this.toggleSearchBar(true);
      return;
    }

    if (event.key === "Escape" && this.searchOpen) {
      event.preventDefault();
      this.toggleSearchBar(false);
      this.stage.focus();
      return;
    }

    const activeEl = document.activeElement;
    const isTypingInField =
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl instanceof HTMLSelectElement;

    if (isTypingInField) return;

    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      this.stepPage(-1);
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      this.stepPage(1);
    } else if (
      event.key === "+" ||
      event.key === "=" ||
      ((event.ctrlKey || event.metaKey) && event.key === "=")
    ) {
      event.preventDefault();
      this.stepZoom(1);
    } else if (
      event.key === "-" ||
      ((event.ctrlKey || event.metaKey) && event.key === "-")
    ) {
      event.preventDefault();
      this.stepZoom(-1);
    }
  }

  private promptForPdfPassword(
    fileName: string,
    isRetry: boolean
  ): Promise<string | null> {
    if (document.fullscreenElement === this.workbench) {
      void document.exitFullscreen().catch(() => {});
    }
    this.workbench.classList.remove("is-fullscreen");

    this.passwordFileEl.textContent = fileName;
    this.passwordErrorEl.hidden = !isRetry;
    this.passwordInput.value = "";
    this.passwordSubmitted = false;

    if (!this.passwordDialog.open) {
      this.passwordDialog.showModal();
    }
    window.requestAnimationFrame(() => this.passwordInput.focus());

    return new Promise<string | null>((resolve) => {
      this.passwordResolve = resolve;
    });
  }

  private flashDropZoneState(state: "success" | "error"): void {
    if (this.dropZoneTimer !== null) {
      window.clearTimeout(this.dropZoneTimer);
    }
    this.dropZone.dataset.importState = state;
    this.dropZoneTimer = window.setTimeout(() => {
      delete this.dropZone.dataset.importState;
      this.dropZoneTimer = null;
    }, 2400);
  }

  private setStatus(
    message: string,
    type: "info" | "success" | "error" = "info"
  ): void {
    this.statusEl.textContent = message;
    this.statusEl.dataset.type = type;
    this.introStatusEl.textContent = message;
    this.introStatusEl.dataset.type = type;
  }

  private saveSession(): void {
    try {
      sessionStorage.setItem(READER_SESSION_KEY, JSON.stringify(this.session));
    } catch {
      // Ignore storage failures
    }
  }

  private async handleFileSelection(
    fileList: FileList | File[],
    mode: "replace" | "append"
  ): Promise<void> {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const pdfFiles = incoming.filter(isPdfUploadFile);
    const rejectedCount = incoming.length - pdfFiles.length;

    if (pdfFiles.length === 0) {
      this.flashDropZoneState("error");
      this.setStatus(
        "Selecione apenas arquivos no formato .pdf para abrir no leitor.",
        "error"
      );
      return;
    }

    if (mode === "replace" && this.pages.length > 0) {
      await this.clearAllDocuments();
    }

    this.setStatus(
      `Abrindo ${pdfFiles.length === 1 ? pdfFiles[0].name : `${pdfFiles.length} arquivos PDF`}...`,
      "info"
    );

    const isFreshSession = this.pages.length === 0;
    let addedPagesCount = 0;
    let addedDocsCount = 0;
    const errors: string[] = [];

    for (const file of pdfFiles) {
      if (file.size === 0) {
        errors.push(`O arquivo "${file.name}" está vazio.`);
        continue;
      }

      try {
        const bytes = await file.arrayBuffer();
        const { pdfDoc, usedPassword } = await openPdfFromBuffer(
          bytes,
          file.name,
          (isRetry) => this.promptForPdfPassword(file.name, isRetry)
        );

        const docId = this.nextDocId++;
        const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
        const source: LoadedPdfSource = {
          docId,
          fileName: file.name,
          fileSize: file.size,
          fingerprint,
          bytes,
          pdfDoc,
          encrypted: usedPassword
        };
        this.sources.set(docId, source);
        addedDocsCount += 1;

        for (let p = 1; p <= pdfDoc.numPages; p++) {
          this.pages.push({
            id: this.nextPageId++,
            sourceDocId: docId,
            sourceFileName: file.name,
            sourcePageNumber: p,
            intrinsicRotation: 0,
            userRotation: 0,
            widthPt: 0,
            heightPt: 0
          });
          addedPagesCount += 1;
        }
      } catch (err) {
        errors.push(
          err instanceof Error
            ? err.message
            : `Não foi possível abrir "${file.name}".`
        );
      }
    }

    if (addedDocsCount === 0) {
      this.flashDropZoneState("error");
      this.setStatus(
        errors[0] || "Nenhum PDF válido pôde ser aberto.",
        "error"
      );
      return;
    }

    this.flashDropZoneState("success");

    if (isFreshSession) {
      const firstSource = this.sources.values().next().value as
        | LoadedPdfSource
        | undefined;
      if (firstSource) {
        const defaultName = firstSource.fileName.replace(/\.pdf$/i, "");
        if (this.sources.size > 1) {
          this.exportNameInput.value = `${defaultName}-mesclado`;
        } else {
          this.exportNameInput.value = `${defaultName}-rootpdf`;
        }
      }

      let initialIndex = 0;
      if (
        firstSource &&
        this.session.lastDocKey === firstSource.fingerprint &&
        this.session.lastPageIndex < this.pages.length
      ) {
        initialIndex = this.session.lastPageIndex;
      } else if (firstSource) {
        this.session.lastDocKey = firstSource.fingerprint;
        this.session.lastPageIndex = 0;
        this.saveSession();
      }
      this.selectedPageId = this.pages[initialIndex]?.id ?? null;
    }

    this.syncThumbListDom();
    this.syncControls();
    void this.renderSelectedPage();

    if (this.searchOpen && this.searchInput.value.trim()) {
      void this.executeSearch();
    }

    const warnings: string[] = [];
    if (rejectedCount > 0) {
      warnings.push(
        `${rejectedCount} arquivo(s) ignorado(s) por não serem PDF.`
      );
    }
    if (errors.length > 0) {
      warnings.push(errors.join(" "));
    }

    const summaryMsg =
      addedDocsCount === 1
        ? `${addedPagesCount} ${addedPagesCount === 1 ? "página carregada" : "páginas carregadas"}.`
        : `${addedDocsCount} PDFs carregados (${addedPagesCount} páginas).`;

    this.setStatus(
      warnings.length > 0 ? `${summaryMsg} ${warnings.join(" ")}` : summaryMsg,
      warnings.length > 0 ? "error" : "success"
    );
  }

  private getSelectedPageIndex(): number {
    if (this.selectedPageId === null) return -1;
    return this.pages.findIndex((p) => p.id === this.selectedPageId);
  }

  private selectPageByIndex(index: number): void {
    const safeIdx = Math.max(0, Math.min(this.pages.length - 1, index));
    const item = this.pages[safeIdx];
    if (!item) return;

    this.selectedPageId = item.id;
    this.session.lastPageIndex = safeIdx;
    this.saveSession();

    this.syncControls();
    this.scrollThumbIntoView(item.id);
    void this.renderSelectedPage();
  }

  private selectPageById(pageId: number): void {
    const idx = this.pages.findIndex((p) => p.id === pageId);
    if (idx !== -1) {
      this.selectPageByIndex(idx);
    }
  }

  private stepPage(delta: number): void {
    if (this.pages.length === 0) return;
    const currentIdx = Math.max(0, this.getSelectedPageIndex());
    this.selectPageByIndex(currentIdx + delta);
  }

  private commitPageJump(): void {
    if (this.pages.length === 0) return;
    const raw = parseInt(this.pageJumpInput.value.trim(), 10);
    if (!Number.isFinite(raw) || Number.isNaN(raw)) {
      this.pageJumpInput.value = String(this.getSelectedPageIndex() + 1);
      return;
    }
    this.selectPageByIndex(raw - 1);
  }

  private stepZoom(direction: -1 | 1): void {
    const current = this.lastComputedScale || this.session.customScale || 1;
    let nextScale: number;

    if (direction > 0) {
      const nextPreset = ZOOM_PRESETS.find((z) => z > current + 0.04);
      nextScale = nextPreset ?? Math.min(MAX_SCALE, current + 0.25);
    } else {
      const prevPreset = [...ZOOM_PRESETS]
        .reverse()
        .find((z) => z < current - 0.04);
      nextScale = prevPreset ?? Math.max(MIN_SCALE, current - 0.25);
    }

    this.session.zoomMode = "custom";
    this.session.customScale = Number(nextScale.toFixed(2));
    this.saveSession();
    this.syncZoomSelect();
    void this.renderSelectedPage();
  }

  private movePage(pageId: number, direction: -1 | 1): void {
    const idx = this.pages.findIndex((p) => p.id === pageId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= this.pages.length) return;
    [this.pages[idx], this.pages[targetIdx]] = [
      this.pages[targetIdx],
      this.pages[idx]
    ];
    this.syncThumbListDom();
    this.syncControls();
    if (this.searchOpen && this.searchInput.value.trim()) {
      void this.executeSearch();
    }
  }

  private rotatePage(pageId: number, delta: number): void {
    const item = this.pages.find((p) => p.id === pageId);
    if (!item) return;
    item.userRotation = normalizeRotation(item.userRotation + delta);
    this.thumbRenderKeys.delete(pageId);

    const card = this.thumbElements.get(pageId);
    if (card) {
      this.updateThumbCardBadges(item, card, this.pages.indexOf(item));
      void this.renderThumbnail(item, card);
    }

    if (this.selectedPageId === pageId) {
      void this.renderSelectedPage();
    }
  }

  private duplicatePage(pageId: number): void {
    const idx = this.pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const src = this.pages[idx];
    const copy: ReaderPageItem = {
      ...src,
      id: this.nextPageId++
    };
    this.pages.splice(idx + 1, 0, copy);
    this.syncThumbListDom();
    this.syncControls();
    this.setStatus(`Página ${idx + 1} duplicada.`, "info");
    if (this.searchOpen && this.searchInput.value.trim()) {
      void this.executeSearch();
    }
  }

  private removePage(pageId: number): void {
    if (this.pages.length <= 1) {
      void this.clearAllDocuments();
      return;
    }

    const idx = this.pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;

    this.pages.splice(idx, 1);
    const card = this.thumbElements.get(pageId);
    if (card) {
      this.thumbObserver?.unobserve(card);
      card.remove();
      this.thumbElements.delete(pageId);
      this.thumbRenderKeys.delete(pageId);
    }

    if (this.selectedPageId === pageId) {
      const nextIdx = Math.min(idx, this.pages.length - 1);
      this.selectedPageId = this.pages[nextIdx]?.id ?? null;
      this.session.lastPageIndex = Math.max(0, nextIdx);
      this.saveSession();
    }

    this.syncThumbListDom();
    this.syncControls();
    void this.renderSelectedPage();
    this.setStatus("Página removida da fila de organização.", "info");

    if (this.searchOpen && this.searchInput.value.trim()) {
      void this.executeSearch();
    }
  }

  private reversePagesOrder(): void {
    if (this.pages.length < 2) return;
    this.pages.reverse();
    this.syncThumbListDom();
    this.syncControls();
    this.setStatus("Ordem das páginas invertida.", "info");
    if (this.searchOpen && this.searchInput.value.trim()) {
      void this.executeSearch();
    }
  }

  private async clearAllDocuments(): Promise<void> {
    this.cancelActiveRender();
    this.searchToken++;
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.toggleSearchBar(false);
    this.searchIndex.clearAll();

    for (const src of this.sources.values()) {
      try {
        await src.pdfDoc.loadingTask.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }

    this.sources.clear();
    this.pages = [];
    this.selectedPageId = null;

    for (const card of this.thumbElements.values()) {
      this.thumbObserver?.unobserve(card);
    }
    this.thumbElements.clear();
    this.thumbRenderKeys.clear();
    this.thumbList.innerHTML = "";
    this.textLayerDiv.innerHTML = "";
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.pageMetaEl.textContent = "—";

    if (document.fullscreenElement === this.workbench) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore fullscreen exit failure
      }
    }

    this.syncControls();
    this.setStatus("");
  }

  private cancelActiveRender(): void {
    if (this.activeRenderTask) {
      try {
        this.activeRenderTask.cancel();
      } catch {
        // Ignore
      }
      this.activeRenderTask = null;
    }
    if (this.activeTextLayer) {
      try {
        this.activeTextLayer.cancel();
      } catch {
        // Ignore
      }
      this.activeTextLayer = null;
    }
  }

  private handleStageWheel(event: WheelEvent): void {
    if (!this.isActive || this.pages.length <= 1 || this.passwordDialog.open) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (Math.abs(event.deltaY) < 4) return;

    const currentIdx = this.getSelectedPageIndex();
    if (currentIdx === -1) return;

    const direction: -1 | 1 = event.deltaY > 0 ? 1 : -1;
    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= this.pages.length) return;

    const maxScrollTop = Math.max(
      0,
      this.stage.scrollHeight - this.stage.clientHeight
    );
    const hasVerticalOverflow = maxScrollTop > 2;
    const atTopEdge = this.stage.scrollTop <= 2;
    const atBottomEdge = this.stage.scrollTop >= maxScrollTop - 2;
    const atBoundary = direction > 0 ? atBottomEdge : atTopEdge;

    if (!atBoundary) {
      this.wheelDeltaAccum = 0;
      this.lastStageEdgeHitTime = performance.now();
      return;
    }

    const now = performance.now();
    // When scrolling within an overflowing page, pause briefly at the edge before flipping
    if (hasVerticalOverflow && now - this.lastStageEdgeHitTime < 180) {
      return;
    }

    event.preventDefault();

    if (now - this.lastWheelFlipTime < 280) {
      return;
    }

    if (
      this.wheelDeltaAccum !== 0 &&
      Math.sign(this.wheelDeltaAccum) !== direction
    ) {
      this.wheelDeltaAccum = 0;
    }
    this.wheelDeltaAccum += event.deltaY;

    if (this.wheelResetTimer !== null) {
      window.clearTimeout(this.wheelResetTimer);
    }
    this.wheelResetTimer = window.setTimeout(() => {
      this.wheelDeltaAccum = 0;
      this.wheelResetTimer = null;
    }, 200);

    if (Math.abs(this.wheelDeltaAccum) < 32) {
      return;
    }

    this.wheelDeltaAccum = 0;
    this.lastWheelFlipTime = now;
    this.lastStageEdgeHitTime = now;
    this.pendingStageScrollEdge = direction > 0 ? "top" : "bottom";
    this.stepPage(direction);
  }

  private computeTargetScale(
    baseWidth: number,
    baseHeight: number
  ): number {
    if (this.session.zoomMode === "custom") {
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.session.customScale));
    }

    const horizontalPad = window.innerWidth <= 680 ? 32 : 64;
    const verticalPad = window.innerWidth <= 680 ? 32 : 56;
    const availW = Math.max(240, this.stage.clientWidth - horizontalPad);
    const availH = Math.max(260, this.stage.clientHeight - verticalPad);

    if (this.session.zoomMode === "fit-page") {
      const fitScale = Math.min(availW / baseWidth, availH / baseHeight);
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
    }

    // fit-width
    const widthScale = availW / baseWidth;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, widthScale));
  }

  private async recheckAutoFitScale(): Promise<void> {
    const item = this.pages.find((p) => p.id === this.selectedPageId);
    if (!item || !item.widthPt || !item.heightPt) return;

    const nextScale = this.computeTargetScale(item.widthPt, item.heightPt);
    if (Math.abs(nextScale - this.lastComputedScale) > 0.025) {
      await this.renderSelectedPage();
    }
  }

  private async renderSelectedPage(): Promise<void> {
    if (this.selectedPageId === null) return;
    const item = this.pages.find((p) => p.id === this.selectedPageId);
    if (!item) return;

    const source = this.sources.get(item.sourceDocId);
    if (!source) return;

    const myVersion = ++this.renderVersion;
    this.cancelActiveRender();
    this.loadingBadge.hidden = false;

    try {
      const pdfjs = await loadPdfJs();
      if (myVersion !== this.renderVersion) return;

      const page = await source.pdfDoc.getPage(item.sourcePageNumber);
      if (myVersion !== this.renderVersion) return;

      const totalRotation = normalizeRotation(page.rotate + item.userRotation);
      item.intrinsicRotation = page.rotate;

      const baseViewport = page.getViewport({
        scale: 1,
        rotation: totalRotation
      });
      item.widthPt = baseViewport.width;
      item.heightPt = baseViewport.height;

      const scale = this.computeTargetScale(
        baseViewport.width,
        baseViewport.height
      );
      this.lastComputedScale = scale;

      const viewport = page.getViewport({
        scale,
        rotation: totalRotation
      });

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const cssW = Math.max(1, Math.floor(viewport.width));
      const cssH = Math.max(1, Math.floor(viewport.height));

      this.canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
      this.canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;

      this.pageFrame.style.width = `${cssW}px`;
      this.pageFrame.style.height = `${cssH}px`;
      this.pageFrame.style.setProperty("--scale-factor", String(viewport.scale));
      this.pageFrame.style.setProperty("--user-unit", "1");
      this.pageFrame.style.setProperty(
        "--total-scale-factor",
        String(viewport.scale)
      );
      this.pageFrame.style.setProperty("--scale-round-x", "1px");
      this.pageFrame.style.setProperty("--scale-round-y", "1px");

      this.textLayerDiv.innerHTML = "";
      this.renderedTextDivs = [];
      this.renderedTextStrings = [];

      const renderTask = page.render({
        canvas: this.canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
      });
      this.activeRenderTask = renderTask;

      await renderTask.promise;
      if (myVersion !== this.renderVersion) return;
      this.activeRenderTask = null;

      // Render crisp selectable text layer above the canvas
      const textContent = await page.getTextContent();
      if (myVersion !== this.renderVersion) return;

      const textLayer = new pdfjs.TextLayer({
        textContentSource: textContent,
        container: this.textLayerDiv,
        viewport
      });
      this.activeTextLayer = textLayer;
      await textLayer.render();
      if (myVersion !== this.renderVersion) return;
      this.activeTextLayer = null;

      this.renderedTextDivs = textLayer.textDivs;
      this.renderedTextStrings = textLayer.textContentItemsStr;

      if (this.pendingStageScrollEdge) {
        const edge = this.pendingStageScrollEdge;
        this.pendingStageScrollEdge = null;
        this.stage.scrollTop =
          edge === "top"
            ? 0
            : Math.max(0, this.stage.scrollHeight - this.stage.clientHeight);
      }

      this.applyActiveSearchHighlights(true);

      const pageOrderIdx = this.pages.indexOf(item);
      const mmW = pointsToMillimeters(baseViewport.width);
      const mmH = pointsToMillimeters(baseViewport.height);
      const zoomPct = Math.round(scale * 100);
      this.pageMetaEl.textContent = `Página ${pageOrderIdx + 1} de ${this.pages.length} · ${mmW} × ${mmH} mm · Zoom ${zoomPct}% · ${item.sourceFileName} (pág. ${item.sourcePageNumber})`;
      this.syncZoomSelect();
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (
        name !== "RenderingCancelledException" &&
        name !== "AbortException"
      ) {
        console.error(error);
        this.setStatus("Erro ao renderizar esta página do PDF.", "error");
      }
    } finally {
      if (myVersion === this.renderVersion) {
        this.loadingBadge.hidden = true;
      }
    }
  }

  private async renderThumbnail(
    item: ReaderPageItem,
    card: HTMLElement
  ): Promise<void> {
    const source = this.sources.get(item.sourceDocId);
    const thumbCanvas = card.querySelector<HTMLCanvasElement>(
      ".reader-thumb-canvas"
    );
    if (!source || !thumbCanvas) return;

    const cacheKey = `${item.sourceDocId}:${item.sourcePageNumber}:${item.userRotation}`;
    if (this.thumbRenderKeys.get(item.id) === cacheKey) {
      return;
    }

    try {
      const page = await source.pdfDoc.getPage(item.sourcePageNumber);
      if (!card.isConnected) return;

      const exactRot = normalizeRotation(page.rotate + item.userRotation);
      item.intrinsicRotation = page.rotate;

      const unitViewport = page.getViewport({ scale: 1, rotation: exactRot });
      item.widthPt = unitViewport.width;
      item.heightPt = unitViewport.height;

      const thumbScale = Math.min(130 / unitViewport.width, 150 / unitViewport.height);
      const viewport = page.getViewport({
        scale: Math.max(0.12, thumbScale),
        rotation: exactRot
      });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(1, Math.round(viewport.width));
      const cssH = Math.max(1, Math.round(viewport.height));

      thumbCanvas.width = Math.max(1, Math.round(viewport.width * dpr));
      thumbCanvas.height = Math.max(1, Math.round(viewport.height * dpr));
      thumbCanvas.style.width = `${cssW}px`;
      thumbCanvas.style.height = `${cssH}px`;

      await page.render({
        canvas: thumbCanvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
      }).promise;

      if (!card.isConnected) return;
      this.thumbRenderKeys.set(item.id, cacheKey);
      card.classList.add("is-rendered");
    } catch {
      // Ignore transient thumbnail cancellation/unmount
    }
  }

  private createThumbCard(item: ReaderPageItem): HTMLElement {
    const card = document.createElement("div");
    card.className = "reader-thumb-card";
    card.setAttribute("role", "listitem");
    card.setAttribute("draggable", "true");
    card.dataset.pageId = String(item.id);

    card.innerHTML = `
      <div class="reader-thumb-top">
        <span class="drag-handle" aria-hidden="true">${ICONS.grip}</span>
        <button type="button" class="reader-thumb-select" title="Exibir esta página" aria-label="Exibir página">
          <div class="reader-thumb-canvas-wrap">
            <canvas class="reader-thumb-canvas"></canvas>
          </div>
        </button>
      </div>
      <div class="reader-thumb-footer">
        <div class="reader-thumb-meta">
          <strong class="reader-thumb-num"></strong>
          <span class="reader-thumb-source"></span>
        </div>
        <div class="reader-thumb-actions">
          <button type="button" class="icon-button" data-thumb-action="up" aria-label="Mover página para cima" title="Mover para cima">${ICONS.arrowUp}</button>
          <button type="button" class="icon-button" data-thumb-action="down" aria-label="Mover página para baixo" title="Mover para baixo">${ICONS.arrowDown}</button>
          <button type="button" class="icon-button" data-thumb-action="rotate" aria-label="Girar página 90 graus para a direita" title="Girar 90°">${ICONS.rotateCw}</button>
          <button type="button" class="icon-button" data-thumb-action="duplicate" aria-label="Duplicar página" title="Duplicar página">${ICONS.copy}</button>
          <button type="button" class="icon-button danger" data-thumb-action="remove" aria-label="Remover página" title="Remover página">${ICONS.trash}</button>
        </div>
      </div>
    `;

    this.thumbObserver?.observe(card);
    return card;
  }

  private updateThumbCardBadges(
    item: ReaderPageItem,
    card: HTMLElement,
    index: number
  ): void {
    const selectBtn = card.querySelector<HTMLButtonElement>(".reader-thumb-select");
    const numEl = card.querySelector<HTMLElement>(".reader-thumb-num");
    const srcEl = card.querySelector<HTMLElement>(".reader-thumb-source");
    const upBtn = card.querySelector<HTMLButtonElement>(
      '[data-thumb-action="up"]'
    );
    const downBtn = card.querySelector<HTMLButtonElement>(
      '[data-thumb-action="down"]'
    );

    const pageLabel = `Página ${String(index + 1).padStart(2, "0")}`;
    if (selectBtn) {
      selectBtn.setAttribute(
        "aria-label",
        `Exibir ${pageLabel} (${item.sourceFileName})`
      );
    }
    if (numEl) {
      const rotBadge =
        item.userRotation !== 0 ? ` · ${item.userRotation}°` : "";
      numEl.textContent = `Pág. ${String(index + 1).padStart(2, "0")}${rotBadge}`;
    }
    if (srcEl) {
      srcEl.textContent =
        this.sources.size > 1
          ? `${item.sourceFileName} · #${item.sourcePageNumber}`
          : `Origem pág. ${item.sourcePageNumber}`;
      srcEl.title = `${item.sourceFileName} (página original ${item.sourcePageNumber})`;
    }
    if (upBtn) upBtn.disabled = index === 0 || this.isExporting;
    if (downBtn)
      downBtn.disabled = index === this.pages.length - 1 || this.isExporting;

    const isSelected = item.id === this.selectedPageId;
    card.classList.toggle("is-active", isSelected);
    card.setAttribute("aria-current", isSelected ? "page" : "false");
  }

  private syncThumbListDom(): void {
    const activeIds = new Set(this.pages.map((p) => p.id));

    for (const [id, el] of this.thumbElements.entries()) {
      if (!activeIds.has(id)) {
        this.thumbObserver?.unobserve(el);
        el.remove();
        this.thumbElements.delete(id);
        this.thumbRenderKeys.delete(id);
      }
    }

    for (let i = 0; i < this.pages.length; i++) {
      const item = this.pages[i];
      let card = this.thumbElements.get(item.id);
      if (!card) {
        card = this.createThumbCard(item);
        this.thumbElements.set(item.id, card);
      }

      const currentAtIndex = this.thumbList.children[i];
      if (currentAtIndex !== card) {
        this.thumbList.insertBefore(card, currentAtIndex ?? null);
      }

      this.updateThumbCardBadges(item, card, i);
    }
  }

  private scrollThumbIntoView(pageId: number): void {
    const card = this.thumbElements.get(pageId);
    if (!card || !this.session.sidebarOpen) return;
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  private syncThumbSelectionAndActions(): void {
    for (let i = 0; i < this.pages.length; i++) {
      const item = this.pages[i];
      const card = this.thumbElements.get(item.id);
      if (card) {
        this.updateThumbCardBadges(item, card, i);
      }
    }
  }

  private syncSidebarVisibility(): void {
    this.readerLayout.classList.toggle(
      "sidebar-collapsed",
      !this.session.sidebarOpen
    );
    this.sidebar.hidden = !this.session.sidebarOpen;
    this.toggleThumbsBtn.setAttribute(
      "aria-expanded",
      String(this.session.sidebarOpen)
    );
    if (this.pages.length > 0 && this.session.zoomMode !== "custom") {
      window.requestAnimationFrame(() => void this.recheckAutoFitScale());
    }
  }

  private syncZoomSelect(): void {
    if (
      this.session.zoomMode === "fit-width" ||
      this.session.zoomMode === "fit-page"
    ) {
      this.zoomCustomOption.hidden = true;
      this.zoomSelect.value = this.session.zoomMode;
      return;
    }

    const matchPreset = ZOOM_PRESETS.find(
      (z) => Math.abs(z - this.session.customScale) < 0.005
    );
    if (matchPreset !== undefined) {
      this.zoomCustomOption.hidden = true;
      this.zoomSelect.value = String(matchPreset);
    } else {
      const pct = Math.round(this.session.customScale * 100);
      this.zoomCustomOption.textContent = `${pct}%`;
      this.zoomCustomOption.hidden = false;
      this.zoomSelect.value = "custom";
    }
  }

  private syncFullscreenState(): void {
    const isFs = document.fullscreenElement === this.workbench;
    this.workbench.classList.toggle("is-fullscreen", isFs);
    this.fullscreenBtn.setAttribute("aria-pressed", String(isFs));
    this.fullscreenLabel.textContent = isFs ? "Sair tela cheia" : "Tela cheia";
    const iconWrap = this.fullscreenBtn.querySelector(".fs-icon");
    if (iconWrap) {
      iconWrap.innerHTML = isFs ? ICONS.minimize : ICONS.maximize;
    }
    if (this.pages.length > 0 && this.session.zoomMode !== "custom") {
      window.requestAnimationFrame(() => void this.recheckAutoFitScale());
    }
  }

  private async toggleFullscreen(): Promise<void> {
    if (!this.workbench) return;
    if (document.fullscreenElement === this.workbench) {
      try {
        await document.exitFullscreen();
      } catch {
        this.workbench.classList.remove("is-fullscreen");
      }
      return;
    }

    try {
      await this.workbench.requestFullscreen();
    } catch {
      // Fallback CSS fullscreen class if Fullscreen API is unavailable in embedded frame
      const next = !this.workbench.classList.contains("is-fullscreen");
      this.workbench.classList.toggle("is-fullscreen", next);
      this.fullscreenBtn.setAttribute("aria-pressed", String(next));
      this.fullscreenLabel.textContent = next
        ? "Sair tela cheia"
        : "Tela cheia";
      void this.recheckAutoFitScale();
    }
  }

  private syncControls(): void {
    const hasPages = this.pages.length > 0;
    this.introSection.hidden = hasPages;
    this.workbench.hidden = !hasPages;

    const total = this.pages.length;
    const currentIdx = hasPages ? Math.max(0, this.getSelectedPageIndex()) : -1;

    this.pageCountBadge.textContent = `${total} ${total === 1 ? "página" : "páginas"}`;
    const activeDocIds = new Set(this.pages.map((p) => p.sourceDocId));
    const docCount = activeDocIds.size;
    this.docCountBadge.textContent = `${docCount} ${docCount === 1 ? "PDF" : "PDFs"}`;

    this.prevPageBtn.disabled = !hasPages || currentIdx <= 0;
    this.nextPageBtn.disabled = !hasPages || currentIdx >= total - 1;
    this.pageJumpInput.disabled = !hasPages;
    this.pageJumpInput.value = hasPages ? String(currentIdx + 1) : "0";
    this.totalPagesLabel.textContent = `/ ${total}`;

    this.zoomOutBtn.disabled = !hasPages;
    this.zoomInBtn.disabled = !hasPages;
    this.zoomSelect.disabled = !hasPages;
    this.rotateLeftBtn.disabled = !hasPages || this.isExporting;
    this.rotateRightBtn.disabled = !hasPages || this.isExporting;
    this.searchToggleBtn.disabled = !hasPages;
    this.fullscreenBtn.disabled = !hasPages;
    this.reverseOrderBtn.disabled = total < 2 || this.isExporting;
    this.clearBtn.disabled = !hasPages || this.isExporting;
    this.exportBtn.disabled = !hasPages || this.isExporting;

    this.syncSidebarVisibility();
    this.syncZoomSelect();
    this.syncThumbSelectionAndActions();
  }

  // --- Search (Ctrl+F) ---

  private toggleSearchBar(open: boolean): void {
    this.searchOpen = open;
    this.searchBar.hidden = !open;
    this.searchToggleBtn.setAttribute("aria-expanded", String(open));

    if (open) {
      this.searchClearBtn.hidden = this.searchInput.value.length === 0;
      window.requestAnimationFrame(() => {
        this.searchInput.focus();
        this.searchInput.select();
      });
      if (this.searchInput.value.trim()) {
        void this.executeSearch();
      }
    } else {
      this.searchToken++;
      this.searchMatches = [];
      this.currentMatchIndex = -1;
      this.applyActiveSearchHighlights(false);
    }
  }

  private async executeSearch(): Promise<void> {
    const query = this.searchInput.value.trim();
    const myToken = ++this.searchToken;

    if (!query) {
      this.searchMatches = [];
      this.currentMatchIndex = -1;
      this.searchCount.textContent = "0 resultados";
      this.searchPrevBtn.disabled = true;
      this.searchNextBtn.disabled = true;
      this.applyActiveSearchHighlights(false);
      return;
    }

    this.searchCount.textContent = "Buscando...";

    const matches = await this.searchIndex.searchPages(
      this.pages,
      (docId) => this.sources.get(docId)?.pdfDoc,
      query,
      () => myToken !== this.searchToken
    );

    if (myToken !== this.searchToken) return;

    this.searchMatches = matches;
    this.searchPrevBtn.disabled = matches.length === 0;
    this.searchNextBtn.disabled = matches.length === 0;

    if (matches.length === 0) {
      this.currentMatchIndex = -1;
      this.searchCount.textContent = "0 resultados";
      this.applyActiveSearchHighlights(false);
      return;
    }

    // Prefer first match on or after currently viewed page
    const currentOrderIdx = Math.max(0, this.getSelectedPageIndex());
    const preferredIdx = matches.findIndex(
      (m) => m.pageOrderIndex >= currentOrderIdx
    );
    this.jumpToSearchMatch(preferredIdx === -1 ? 0 : preferredIdx);
  }

  private navigateSearchMatch(delta: -1 | 1): void {
    if (this.searchMatches.length === 0) return;
    const total = this.searchMatches.length;
    const nextIdx =
      this.currentMatchIndex === -1
        ? 0
        : (this.currentMatchIndex + delta + total) % total;
    this.jumpToSearchMatch(nextIdx);
  }

  private jumpToSearchMatch(matchIndex: number): void {
    const match = this.searchMatches[matchIndex];
    if (!match) return;

    this.currentMatchIndex = matchIndex;
    this.searchCount.textContent = `${matchIndex + 1} de ${this.searchMatches.length}`;

    if (this.selectedPageId !== match.pageId) {
      this.selectPageById(match.pageId);
    } else {
      this.applyActiveSearchHighlights(true);
    }
  }

  private applyActiveSearchHighlights(scrollToActive: boolean): void {
    if (this.renderedTextDivs.length === 0 || this.selectedPageId === null) {
      return;
    }

    const pageMatches = this.searchMatches.filter(
      (m) => m.pageId === this.selectedPageId
    );
    const activeMatch =
      this.currentMatchIndex >= 0
        ? (this.searchMatches[this.currentMatchIndex] ?? null)
        : null;

    const activeEl = applyTextLayerHighlights(
      this.renderedTextDivs,
      this.renderedTextStrings,
      pageMatches,
      activeMatch
    );

    if (scrollToActive && activeEl) {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      activeEl.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: reducedMotion ? "auto" : "smooth"
      });
    }
  }

  // --- Export / Merge ---

  private updateExportProgress(
    current: number,
    total: number,
    message: string
  ): void {
    const safeTotal = Math.max(1, total);
    const pct = Math.min(100, Math.round((current / safeTotal) * 100));
    this.exportProgressBar.style.width = `${pct}%`;
    this.exportProgressText.textContent = message;
    this.exportProgressPercent.textContent = `${pct}%`;
  }

  private async exportMergedPdf(): Promise<void> {
    if (this.pages.length === 0 || this.isExporting) return;

    if (this.progressHideTimer !== null) {
      window.clearTimeout(this.progressHideTimer);
      this.progressHideTimer = null;
    }

    this.isExporting = true;
    this.exportCancelBtn.hidden = false;
    this.exportProgressWrap.hidden = false;
    this.syncControls();

    const usedDocIds = new Set(this.pages.map((p) => p.sourceDocId));
    const activeSources: MergeSourceInput[] = [];

    for (const docId of usedDocIds) {
      const src = this.sources.get(docId);
      if (src) {
        activeSources.push({
          docId: src.docId,
          fileName: src.fileName,
          bytes: src.bytes
        });
      }
    }

    const mergePages: MergePageInput[] = this.pages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageNumber - 1,
      deltaRotation: p.userRotation
    }));

    const outName = safeFileName(
      this.exportNameInput.value || "documento-organizado"
    );

    this.updateExportProgress(0, mergePages.length + activeSources.length, "Preparando exportação...");
    this.setStatus("Montando PDF organizado em segundo plano...", "info");

    try {
      const pdfBuffer = await this.mergeController.merge({
        sources: activeSources,
        pages: mergePages,
        fileName: outName,
        onProgress: (c, t, m) => this.updateExportProgress(c, t, m)
      });

      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${outName}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      this.setStatus(
        `PDF "${outName}.pdf" exportado (${this.pages.length} páginas, ${formatBytes(pdfBuffer.byteLength)}).`,
        "success"
      );
      this.updateExportProgress(1, 1, "PDF organizado pronto!");
    } catch (error) {
      if (error instanceof Error && error.message === "CANCELLED") {
        this.setStatus("Exportação cancelada.", "info");
        this.exportProgressWrap.hidden = true;
      } else {
        console.error(error);
        this.setStatus(
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao exportar o PDF organizado.",
          "error"
        );
      }
    } finally {
      this.isExporting = false;
      this.exportCancelBtn.hidden = true;
      this.syncControls();
      if (!this.exportProgressWrap.hidden) {
        this.progressHideTimer = window.setTimeout(() => {
          this.exportProgressWrap.hidden = true;
        }, 2000);
      }
    }
  }
}
