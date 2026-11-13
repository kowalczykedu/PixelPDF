import "./style.css";
import {
  DEFAULT_SETTINGS,
  PAGE_SIZES,
  type AppMode,
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
  isPdfUploadFile,
  pointsToMillimeters,
  safeFileName
} from "./utils/format";
import { ICONS } from "./utils/icons";
import { createThumbnailAndDimensions } from "./utils/image";
import {
  getEffectiveMargin,
  getPageDimensions,
  normalizeRotation
} from "./utils/layout";
import { PdfGenerationController } from "./pdf/pdf-client";
import { initRootsBackground } from "./rootsAnimation";
import type { PdfCreatorStudio } from "./creator/pdf-creator-studio";
import type { PdfReaderStudio } from "./reader/pdf-reader-studio";

const SETTINGS_STORAGE_KEY = "rootpdf-settings";
const LEGACY_SETTINGS_STORAGE_KEY = "pixelpdf-settings";
const ACTIVE_MODE_STORAGE_KEY = "rootpdf-active-mode";

let activeMode: AppMode = loadActiveMode();
let readerStudio: PdfReaderStudio | null = null;
let readerStudioPromise: Promise<PdfReaderStudio> | null = null;
let creatorStudio: PdfCreatorStudio | null = null;
let creatorStudioPromise: Promise<PdfCreatorStudio> | null = null;

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
      <nav class="studio-tabs-wrap" aria-label="Ferramentas do RootPDF">
        <div class="studio-tabs" role="tablist" aria-label="Modo de trabalho">
          <button
            id="tabConverter"
            class="studio-tab is-active"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="converterPanel"
            data-mode="converter"
          >
            ${ICONS.images}
            <span>Imagem → PDF</span>
          </button>
          <button
            id="tabReader"
            class="studio-tab"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="readerPanel"
            data-mode="reader"
            tabindex="-1"
          >
            ${ICONS.bookOpen}
            <span>Leitor &amp; Editor</span>
          </button>
          <button
            id="tabCreator"
            class="studio-tab"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="creatorPanel"
            data-mode="creator"
            tabindex="-1"
          >
            ${ICONS.filePlus}
            <span>Criar PDF</span>
          </button>
        </div>
      </nav>

      <div id="converterPanel" class="mode-panel" role="tabpanel" aria-labelledby="tabConverter">
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
      </div>

      <div id="readerPanel" class="mode-panel" role="tabpanel" aria-labelledby="tabReader" hidden></div>
      <div id="creatorPanel" class="mode-panel" role="tabpanel" aria-labelledby="tabCreator" hidden></div>

      <footer class="app-footer">
        <div class="footer-inner">
          <span><strong>RootPDF</strong> — Seu Estúdio Local de PDF</span>
          <span class="footer-sep" aria-hidden="true">•</span>
          <span>TypeScript + Web Worker + <span>pdf-lib</span> + <span>PDF.js</span></span>
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
      <p>Tudo acontece no seu próprio navegador. Imagens viram PDFs em segundo plano (via <strong>Web Worker</strong> e <strong>OffscreenCanvas</strong>), e você também pode ler, assinar, preencher formulários, editar em camadas ou criar novos PDFs localmente com <strong>PDF.js</strong> e <strong>pdf-lib</strong>.</p>
      <div class="dialog-grid">
        <span>01</span>
        <p><strong>Imagem → PDF com Rapidez</strong><br>Arraste múltiplos arquivos, selecione do dispositivo ou pressione <kbd>Ctrl+V</kbd> para colar capturas e montar páginas configuráveis.</p>
        <span>02</span>
        <p><strong>Leitor, Assinatura &amp; Edição</strong><br>Abra PDFs multi-página com busca (<kbd>Ctrl+F</kbd>), assinatura desenhada/enviada/salva localmente, formulários, cobertura e reordenação.</p>
        <span>03</span>
        <p><strong>Criar PDF do Zero</strong><br>Monte novos documentos combinando blocos de texto formatado, imagens e assinaturas, com rascunho salvo no navegador.</p>
      </div>
    </div>
  </dialog>
`;

const tabConverter = getElement<HTMLButtonElement>("tabConverter");
const tabReader = getElement<HTMLButtonElement>("tabReader");
const tabCreator = getElement<HTMLButtonElement>("tabCreator");
const converterPanel = getElement<HTMLDivElement>("converterPanel");
const readerPanel = getElement<HTMLDivElement>("readerPanel");
const creatorPanel = getElement<HTMLDivElement>("creatorPanel");
const studioTabList = tabConverter.closest<HTMLElement>("[role='tablist']");
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

function loadActiveMode(): AppMode {
  try {
    const saved = sessionStorage.getItem(ACTIVE_MODE_STORAGE_KEY);
    if (saved === "converter" || saved === "reader" || saved === "creator") {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return "converter";
}

function saveActiveMode(mode: AppMode): void {
  try {
    sessionStorage.setItem(ACTIVE_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage access errors
  }
}

async function ensureReaderStudio(): Promise<PdfReaderStudio> {
  if (readerStudio) return readerStudio;
  if (!readerStudioPromise) {
    readerPanel.innerHTML = `
      <div class="panel reader-loading-panel" role="status" aria-live="polite">
        <span class="status-dot" aria-hidden="true"></span>
        <span>Carregando Leitor &amp; Organizador de PDF...</span>
      </div>
    `;
    readerStudioPromise = import("./reader/pdf-reader-studio")
      .then(({ PdfReaderStudio: StudioClass }) => {
        const instance = new StudioClass(readerPanel);
        readerStudio = instance;
        return instance;
      })
      .catch((error) => {
        readerStudioPromise = null;
        throw error;
      });
  }
  return readerStudioPromise;
}

async function ensureCreatorStudio(): Promise<PdfCreatorStudio> {
  if (creatorStudio) return creatorStudio;
  if (!creatorStudioPromise) {
    creatorPanel.innerHTML = `
      <div class="panel reader-loading-panel" role="status" aria-live="polite">
        <span class="status-dot" aria-hidden="true"></span>
        <span>Carregando Compositor de PDF...</span>
      </div>
    `;
    creatorStudioPromise = import("./creator/pdf-creator-studio")
      .then(({ PdfCreatorStudio: StudioClass }) => {
        const instance = new StudioClass(creatorPanel, {
          onOpenPdfInReader: (file) => {
            void switchMode("reader", [file]);
          }
        });
        creatorStudio = instance;
        return instance;
      })
      .catch((error) => {
        creatorStudioPromise = null;
        throw error;
      });
  }
  return creatorStudioPromise;
}

async function switchMode(
  mode: AppMode,
  initialPdfFiles?: File[]
): Promise<void> {
  if (mode !== "converter" && previewDialog.open) {
    closePreviewModal();
  }

  activeMode = mode;
  saveActiveMode(mode);

  const isConverter = mode === "converter";
  const isReader = mode === "reader";
  const isCreator = mode === "creator";

  tabConverter.classList.toggle("is-active", isConverter);
  tabConverter.setAttribute("aria-selected", String(isConverter));
  tabConverter.tabIndex = isConverter ? 0 : -1;

  tabReader.classList.toggle("is-active", isReader);
  tabReader.setAttribute("aria-selected", String(isReader));
  tabReader.tabIndex = isReader ? 0 : -1;

  tabCreator.classList.toggle("is-active", isCreator);
  tabCreator.setAttribute("aria-selected", String(isCreator));
  tabCreator.tabIndex = isCreator ? 0 : -1;

  converterPanel.hidden = !isConverter;
  readerPanel.hidden = !isReader;
  creatorPanel.hidden = !isCreator;

  readerStudio?.setActive(isReader);
  creatorStudio?.setActive(isCreator);

  if (isConverter) {
    return;
  }

  if (isReader) {
    try {
      const studio = await ensureReaderStudio();
      if (activeMode !== "reader") {
        studio.setActive(false);
        return;
      }
      studio.setActive(true);
      if (initialPdfFiles && initialPdfFiles.length > 0) {
        await studio.openExternalFiles(initialPdfFiles);
      }
    } catch (error) {
      console.error("Erro ao inicializar o Leitor & Editor:", error);
      readerPanel.innerHTML = `
        <div class="panel reader-loading-panel is-error" role="alert">
          <span>Não foi possível carregar o módulo de leitura de PDF. Recarregue a página e tente novamente.</span>
        </div>
      `;
    }
    return;
  }

  if (isCreator) {
    try {
      const studio = await ensureCreatorStudio();
      if (activeMode !== "creator") {
        studio.setActive(false);
        return;
      }
      studio.setActive(true);
    } catch (error) {
      console.error("Erro ao inicializar o Compositor de PDF:", error);
      creatorPanel.innerHTML = `
        <div class="panel reader-loading-panel is-error" role="alert">
          <span>Não foi possível carregar o módulo de criação de PDF. Recarregue a página e tente novamente.</span>
        </div>
      `;
    }
  }
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

  const pdfCandidates = candidates.filter(isPdfUploadFile);
  const nonPdfCandidates = candidates.filter((file) => !isPdfUploadFile(file));

  if (pdfCandidates.length > 0 && nonPdfCandidates.length === 0) {
    setStatus(
      "Arquivo(s) PDF detectado(s). Abrindo no Leitor & Organizador...",
      "info"
    );
    void switchMode("reader", pdfCandidates);
    return;
  }

  const valid = nonPdfCandidates.filter(isAcceptedFile);
  const rejected = nonPdfCandidates.filter((file) => !isAcceptedFile(file));

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
    const pdfNotice =
      pdfCandidates.length > 0
        ? ` (${pdfCandidates.length} PDF encaminhado(s) para o Leitor & Organizador)`
        : "";
    setStatus(
      `${prefix}${addedItems.length} arquivo(s) adicionado(s).${pdfNotice}`,
      "success"
    );
    flashDropZoneState("success");
    syncDom();
    void hydrateItemsAsync(addedItems);
    if (pdfCandidates.length > 0) {
      void ensureReaderStudio().then((studio) =>
        studio.openExternalFiles(pdfCandidates)
      );
    }
  } else if (valid.length > 0) {
    setStatus("Esses arquivos já estão na lista.", "info");
    if (pdfCandidates.length > 0) {
      void ensureReaderStudio().then((studio) =>
        studio.openExternalFiles(pdfCandidates)
      );
    }
  } else if (pdfCandidates.length > 0) {
    setStatus(
      "Arquivo(s) PDF detectado(s). Abrindo no Leitor & Organizador...",
      "info"
    );
    void switchMode("reader", pdfCandidates);
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
if (activeMode === "reader" || activeMode === "creator") {
  void switchMode(activeMode);
}

tabConverter.addEventListener("click", () => {
  void switchMode("converter");
});

tabReader.addEventListener("click", () => {
  void switchMode("reader");
});

tabCreator.addEventListener("click", () => {
  void switchMode("creator");
});

studioTabList?.addEventListener("keydown", (event: KeyboardEvent) => {
  const tabs = [tabConverter, tabReader, tabCreator];
  const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (currentIndex === -1) return;

  let nextIndex = -1;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  }

  if (nextIndex !== -1) {
    event.preventDefault();
    const targetTab = tabs[nextIndex];
    targetTab.focus();
    const modes: AppMode[] = ["converter", "reader", "creator"];
    void switchMode(modes[nextIndex] ?? "converter");
  }
});

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
  if (activeMode !== "converter") return;
  if (aboutDialog.open || previewDialog.open) return;
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
