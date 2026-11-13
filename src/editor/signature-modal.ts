import type { SavedSignature } from "../types";
import { escapeHtml } from "../utils/format";
import { ICONS } from "../utils/icons";
import {
  addSavedSignature,
  clearAllSavedSignatures,
  deleteSavedSignature,
  loadSavedSignatures,
  rasterizeSignatureUploadFile,
  renderTypedSignatureToPng,
  trimCanvasToSignaturePng,
  type TypedSignatureStyle
} from "./signature-store";

export type SignatureSelectCallback = (signature: {
  label: string;
  dataUrl: string;
  aspectRatio: number;
}) => void;

type PadTab = "draw" | "upload" | "type";

const INK_COLORS = [
  { label: "Preto cartório", value: "#111827" },
  { label: "Azul caneta", value: "#1d4ed8" },
  { label: "Bordô escuro", value: "#9f1239" },
  { label: "Grafite", value: "#334155" }
];

export class SignatureLibraryDialog {
  private readonly dialog: HTMLDialogElement;
  private activeTab: PadTab = "draw";
  private selectedColor = INK_COLORS[0].value;
  private strokeWidth = 3.2;
  private typedStyle: TypedSignatureStyle = "cursive";
  private uploadedDraft: { dataUrl: string; aspectRatio: number; label: string } | null = null;
  private confirmClearAll = false;
  private onPick: SignatureSelectCallback | null = null;

  // Drawing canvas state
  private drawCanvas!: HTMLCanvasElement;
  private drawCtx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private lastPt: { x: number; y: number } | null = null;
  private midPt: { x: number; y: number } | null = null;
  private hasDrawnInk = false;

  // Controls
  private tabButtons!: HTMLButtonElement[];
  private panelDraw!: HTMLElement;
  private panelUpload!: HTMLElement;
  private panelType!: HTMLElement;
  private uploadInput!: HTMLInputElement;
  private uploadPreviewWrap!: HTMLElement;
  private uploadPreviewImg!: HTMLImageElement;
  private typedInput!: HTMLInputElement;
  private typedPreviewImg!: HTMLImageElement;
  private typedEmptyHint!: HTMLElement;
  private labelInput!: HTMLInputElement;
  private saveCheck!: HTMLInputElement;
  private insertBtn!: HTMLButtonElement;
  private statusEl!: HTMLParagraphElement;
  private libraryGrid!: HTMLElement;
  private libraryEmptyEl!: HTMLElement;
  private clearAllBtn!: HTMLButtonElement;

  constructor(hostContainer: HTMLElement) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "about-dialog signature-dialog";
    this.dialog.setAttribute("aria-label", "Assinaturas locais e criação de rubrica");
    this.dialog.innerHTML = this.renderMarkup();
    hostContainer.appendChild(this.dialog);

    this.cacheRefs();
    this.bindEvents();
    this.renderLibrary();
  }

  public open(callback: SignatureSelectCallback): void {
    this.onPick = callback;
    this.confirmClearAll = false;
    this.syncClearAllLabel();
    this.setStatus("", "info");
    this.renderLibrary();
    if (!this.dialog.open) {
      this.dialog.showModal();
    }
    this.resizeDrawCanvas();
  }

  public close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
    this.onPick = null;
  }

  public isOpen(): boolean {
    return this.dialog.open;
  }

  private renderMarkup(): string {
    return `
      <div class="dialog-card signature-dialog-card">
        <div class="preview-dialog-header">
          <div>
            <span class="eyebrow">${ICONS.signature} Estúdio de Assinatura</span>
            <h2>Criar ou escolher assinatura</h2>
          </div>
          <button id="sigModalClose" class="dialog-close" type="button" aria-label="Fechar janela de assinaturas" title="Fechar (Esc)">
            ${ICONS.close}
          </button>
        </div>

        <p class="sig-privacy-note">Suas assinaturas ficam salvas apenas no armazenamento local (<code>localStorage</code>) deste navegador.</p>

        <div class="sig-modal-tabs" role="tablist" aria-label="Modo de criação de assinatura">
          <button type="button" class="sig-tab is-active" role="tab" aria-selected="true" data-sig-tab="draw">
            ${ICONS.penTool}
            <span>Desenhar</span>
          </button>
          <button type="button" class="sig-tab" role="tab" aria-selected="false" tabindex="-1" data-sig-tab="upload">
            ${ICONS.imagePlus}
            <span>Enviar imagem</span>
          </button>
          <button type="button" class="sig-tab" role="tab" aria-selected="false" tabindex="-1" data-sig-tab="type">
            ${ICONS.typeText}
            <span>Digitar</span>
          </button>
        </div>

        <section id="sigPanelDraw" class="sig-tab-panel" role="tabpanel">
          <div class="sig-pad-controls">
            <div class="sig-color-group" role="group" aria-label="Cor da tinta">
              ${INK_COLORS.map(
                (c, i) => `
                <button type="button" class="sig-swatch ${i === 0 ? "is-active" : ""}" data-sig-color="${c.value}" aria-label="${c.label}" title="${c.label}" style="--swatch:${c.value}"></button>
              `
              ).join("")}
            </div>
            <label class="sig-stroke-label" for="sigStrokeSelect">
              <span>Traço</span>
              <select id="sigStrokeSelect">
                <option value="2">Fino</option>
                <option value="3.2" selected>Médio</option>
                <option value="5">Forte</option>
              </select>
            </label>
            <button id="sigPadClearBtn" class="button ghost compact-btn" type="button">
              ${ICONS.eraser}
              <span>Limpar</span>
            </button>
          </div>

          <div class="sig-canvas-stage">
            <canvas id="sigDrawCanvas" class="sig-draw-canvas" aria-label="Área para desenhar sua assinatura com mouse ou toque"></canvas>
            <span class="sig-baseline-hint" aria-hidden="true">Assine sobre a linha guia</span>
          </div>
        </section>

        <section id="sigPanelUpload" class="sig-tab-panel" role="tabpanel" hidden>
          <div class="sig-upload-box">
            <label class="button secondary" for="sigUploadInput">
              ${ICONS.imagePlus}
              <span>Escolher PNG, JPG ou SVG</span>
            </label>
            <input id="sigUploadInput" type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" hidden />
            <p class="sig-upload-hint">Imagens PNG ou SVG com fundo transparente funcionam melhor sobre contratos e documentos.</p>
          </div>
          <div id="sigUploadPreviewWrap" class="sig-checker-preview" hidden>
            <img id="sigUploadPreviewImg" alt="Prévia da assinatura enviada" />
          </div>
        </section>

        <section id="sigPanelType" class="sig-tab-panel" role="tabpanel" hidden>
          <div class="sig-type-controls">
            <label class="field sig-typed-field" for="sigTypedInput">
              <span>Nome para assinatura</span>
              <input id="sigTypedInput" type="text" maxlength="64" placeholder="Ex.: Maria Clara Silva" autocomplete="off" />
            </label>
            <div class="sig-type-styles" role="group" aria-label="Estilo tipográfico">
              <button type="button" class="button ghost compact-btn is-selected" data-typed-style="cursive">Manuscrita</button>
              <button type="button" class="button ghost compact-btn" data-typed-style="serif">Formal</button>
              <button type="button" class="button ghost compact-btn" data-typed-style="mono">Rubrica</button>
            </div>
            <div class="sig-color-group" role="group" aria-label="Cor da assinatura digitada">
              ${INK_COLORS.map(
                (c, i) => `
                <button type="button" class="sig-swatch ${i === 0 ? "is-active" : ""}" data-typed-color="${c.value}" aria-label="${c.label}" title="${c.label}" style="--swatch:${c.value}"></button>
              `
              ).join("")}
            </div>
          </div>
          <div class="sig-checker-preview sig-typed-preview-box">
            <img id="sigTypedPreviewImg" alt="Prévia da assinatura digitada" hidden />
            <span id="sigTypedEmptyHint" class="sig-typed-empty">Digite seu nome acima para visualizar</span>
          </div>
        </section>

        <div class="sig-insert-bar">
          <div class="sig-save-opts">
            <label class="sig-check-row" for="sigSaveToLibCheck">
              <input id="sigSaveToLibCheck" type="checkbox" checked />
              <span>Salvar na biblioteca local</span>
            </label>
            <label class="sig-label-inline" for="sigLabelInput">
              <span class="sr-only">Rótulo da assinatura</span>
              <input id="sigLabelInput" type="text" maxlength="36" placeholder="Rótulo opcional (ex.: Completa)" />
            </label>
          </div>
          <button id="sigInsertBtn" class="button primary" type="button">
            ${ICONS.signature}
            <span>Inserir na página</span>
          </button>
        </div>

        <p id="sigModalStatus" class="status" role="status" aria-live="polite"></p>

        <div class="sig-library-section">
          <div class="sig-library-head">
            <h3>Assinaturas salvas</h3>
            <button id="sigClearAllBtn" class="button ghost compact-btn danger-hover" type="button" hidden>
              ${ICONS.trash}
              <span>Limpar todas</span>
            </button>
          </div>
          <div id="sigLibraryEmpty" class="sig-library-empty">Nenhuma assinatura salva neste navegador ainda.</div>
          <div id="sigLibraryGrid" class="sig-library-grid" role="list"></div>
        </div>
      </div>
    `;
  }

  private q<T extends HTMLElement>(selector: string): T {
    const el = this.dialog.querySelector<T>(selector);
    if (!el) throw new Error(`Elemento ${selector} não encontrado no modal de assinatura.`);
    return el;
  }

  private cacheRefs(): void {
    this.tabButtons = Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-sig-tab]"));
    this.panelDraw = this.q("#sigPanelDraw");
    this.panelUpload = this.q("#sigPanelUpload");
    this.panelType = this.q("#sigPanelType");
    this.drawCanvas = this.q("#sigDrawCanvas");
    this.uploadInput = this.q("#sigUploadInput");
    this.uploadPreviewWrap = this.q("#sigUploadPreviewWrap");
    this.uploadPreviewImg = this.q("#sigUploadPreviewImg");
    this.typedInput = this.q("#sigTypedInput");
    this.typedPreviewImg = this.q("#sigTypedPreviewImg");
    this.typedEmptyHint = this.q("#sigTypedEmptyHint");
    this.labelInput = this.q("#sigLabelInput");
    this.saveCheck = this.q("#sigSaveToLibCheck");
    this.insertBtn = this.q("#sigInsertBtn");
    this.statusEl = this.q("#sigModalStatus");
    this.libraryGrid = this.q("#sigLibraryGrid");
    this.libraryEmptyEl = this.q("#sigLibraryEmpty");
    this.clearAllBtn = this.q("#sigClearAllBtn");
  }

  private bindEvents(): void {
    this.q("#sigModalClose").addEventListener("click", () => this.close());
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.close();
    });

    for (const btn of this.tabButtons) {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.sigTab as PadTab;
        this.switchTab(tab);
      });
    }

    // Ink color swatches
    for (const btn of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-sig-color]"))) {
      btn.addEventListener("click", () => {
        this.selectedColor = btn.dataset.sigColor || INK_COLORS[0].value;
        this.syncColorSwatches();
      });
    }
    for (const btn of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-typed-color]"))) {
      btn.addEventListener("click", () => {
        this.selectedColor = btn.dataset.typedColor || INK_COLORS[0].value;
        this.syncColorSwatches();
        this.updateTypedPreview();
      });
    }

    const strokeSelect = this.q<HTMLSelectElement>("#sigStrokeSelect");
    strokeSelect.addEventListener("change", () => {
      this.strokeWidth = Number(strokeSelect.value) || 3.2;
    });

    this.q("#sigPadClearBtn").addEventListener("click", () => this.clearDrawCanvas());

    // Smooth freehand canvas drawing
    this.drawCanvas.addEventListener("pointerdown", (e) => this.startStroke(e));
    this.drawCanvas.addEventListener("pointermove", (e) => this.moveStroke(e));
    this.drawCanvas.addEventListener("pointerup", () => this.endStroke());
    this.drawCanvas.addEventListener("pointercancel", () => this.endStroke());

    // Upload image tab
    this.uploadInput.addEventListener("change", () => {
      const file = this.uploadInput.files?.[0];
      if (!file) return;
      this.uploadInput.value = "";
      void rasterizeSignatureUploadFile(file)
        .then((res) => {
          this.uploadedDraft = res;
          this.uploadPreviewImg.src = res.dataUrl;
          this.uploadPreviewWrap.hidden = false;
          if (!this.labelInput.value.trim()) {
            this.labelInput.value = res.label.slice(0, 32);
          }
          this.setStatus(`Assinatura "${res.label}" pronta para inserir.`, "success");
        })
        .catch((err) => {
          this.setStatus(
            err instanceof Error ? err.message : "Falha ao carregar imagem.",
            "error"
          );
        });
    });

    // Typed signature controls
    this.typedInput.addEventListener("input", () => this.updateTypedPreview());
    for (const btn of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-typed-style]"))) {
      btn.addEventListener("click", () => {
        this.typedStyle = (btn.dataset.typedStyle as TypedSignatureStyle) || "cursive";
        for (const peer of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-typed-style]"))) {
          peer.classList.toggle("is-selected", peer === btn);
        }
        this.updateTypedPreview();
      });
    }

    this.insertBtn.addEventListener("click", () => this.commitCurrentSignature());

    this.clearAllBtn.addEventListener("click", () => {
      if (!this.confirmClearAll) {
        this.confirmClearAll = true;
        this.syncClearAllLabel();
        window.setTimeout(() => {
          this.confirmClearAll = false;
          this.syncClearAllLabel();
        }, 3500);
        return;
      }
      clearAllSavedSignatures();
      this.confirmClearAll = false;
      this.syncClearAllLabel();
      this.renderLibrary();
      this.setStatus("Biblioteca local de assinaturas limpa.", "info");
    });

    this.libraryGrid.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const deleteBtn = target.closest<HTMLButtonElement>("[data-sig-delete]");
      if (deleteBtn) {
        const id = deleteBtn.dataset.sigDelete;
        if (id) {
          deleteSavedSignature(id);
          this.renderLibrary();
          this.setStatus("Assinatura removida da biblioteca.", "info");
        }
        return;
      }

      const useBtn = target.closest<HTMLElement>("[data-sig-use]");
      if (useBtn) {
        const id = useBtn.dataset.sigUse;
        const found = loadSavedSignatures().find((s) => s.id === id);
        if (found && this.onPick) {
          const cb = this.onPick;
          this.close();
          cb({
            label: found.label,
            dataUrl: found.dataUrl,
            aspectRatio: found.aspectRatio
          });
        }
      }
    });
  }

  private switchTab(tab: PadTab): void {
    this.activeTab = tab;
    for (const btn of this.tabButtons) {
      const isSelected = btn.dataset.sigTab === tab;
      btn.classList.toggle("is-active", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
      btn.tabIndex = isSelected ? 0 : -1;
    }
    this.panelDraw.hidden = tab !== "draw";
    this.panelUpload.hidden = tab !== "upload";
    this.panelType.hidden = tab !== "type";
    this.setStatus("", "info");

    if (tab === "draw") {
      this.resizeDrawCanvas();
    } else if (tab === "type") {
      this.typedInput.focus();
    }
  }

  private syncColorSwatches(): void {
    for (const btn of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-sig-color], [data-typed-color]"))) {
      const val = btn.dataset.sigColor || btn.dataset.typedColor;
      btn.classList.toggle("is-active", val === this.selectedColor);
    }
  }

  private resizeDrawCanvas(): void {
    const rect = this.drawCanvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width || 540));
    const h = Math.max(150, Math.floor(rect.height || 180));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (
      this.drawCanvas.width === Math.floor(w * dpr) &&
      this.drawCanvas.height === Math.floor(h * dpr)
    ) {
      return;
    }

    // Preserve ink only if nothing was drawn yet, start fresh crisp backing store
    this.drawCanvas.width = Math.floor(w * dpr);
    this.drawCanvas.height = Math.floor(h * dpr);
    const ctx = this.drawCanvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawCtx = ctx;
      this.hasDrawnInk = false;
    }
  }

  private getCanvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.drawCanvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private startStroke(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    this.resizeDrawCanvas();
    if (!this.drawCtx) return;

    this.drawCanvas.setPointerCapture(event.pointerId);
    const pt = this.getCanvasPoint(event);
    this.isDrawing = true;
    this.hasDrawnInk = true;
    this.lastPt = pt;
    this.midPt = pt;

    this.drawCtx.fillStyle = this.selectedColor;
    this.drawCtx.beginPath();
    this.drawCtx.arc(pt.x, pt.y, this.strokeWidth / 2, 0, Math.PI * 2);
    this.drawCtx.fill();
  }

  private moveStroke(event: PointerEvent): void {
    if (!this.isDrawing || !this.drawCtx || !this.lastPt || !this.midPt) return;

    const pt = this.getCanvasPoint(event);
    const nextMid = {
      x: (this.lastPt.x + pt.x) / 2,
      y: (this.lastPt.y + pt.y) / 2
    };

    this.drawCtx.strokeStyle = this.selectedColor;
    this.drawCtx.lineWidth = this.strokeWidth;
    this.drawCtx.lineCap = "round";
    this.drawCtx.lineJoin = "round";
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(this.midPt.x, this.midPt.y);
    this.drawCtx.quadraticCurveTo(this.lastPt.x, this.lastPt.y, nextMid.x, nextMid.y);
    this.drawCtx.stroke();

    this.lastPt = pt;
    this.midPt = nextMid;
  }

  private endStroke(): void {
    if (!this.isDrawing || !this.drawCtx || !this.lastPt || !this.midPt) return;
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(this.midPt.x, this.midPt.y);
    this.drawCtx.lineTo(this.lastPt.x, this.lastPt.y);
    this.drawCtx.stroke();
    this.isDrawing = false;
    this.lastPt = null;
    this.midPt = null;
  }

  private clearDrawCanvas(): void {
    if (!this.drawCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.drawCtx.save();
    this.drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    this.drawCtx.restore();
    this.drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hasDrawnInk = false;
  }

  private updateTypedPreview(): void {
    const val = this.typedInput.value;
    const res = renderTypedSignatureToPng(val, this.typedStyle, this.selectedColor);
    if (!res.hasInk) {
      this.typedPreviewImg.hidden = true;
      this.typedPreviewImg.removeAttribute("src");
      this.typedEmptyHint.hidden = false;
      return;
    }
    this.typedPreviewImg.src = res.dataUrl;
    this.typedPreviewImg.hidden = false;
    this.typedEmptyHint.hidden = true;
  }

  private commitCurrentSignature(): void {
    let dataUrl = "";
    let aspectRatio = 3;
    let defaultLabel = "Assinatura";

    if (this.activeTab === "draw") {
      if (!this.hasDrawnInk) {
        this.setStatus("Desenhe sua assinatura no quadro antes de inserir.", "error");
        return;
      }
      const trimmed = trimCanvasToSignaturePng(this.drawCanvas, 14);
      if (!trimmed.hasInk) {
        this.setStatus("Desenhe sua assinatura no quadro antes de inserir.", "error");
        return;
      }
      dataUrl = trimmed.dataUrl;
      aspectRatio = trimmed.aspectRatio;
      defaultLabel = "Assinatura desenhada";
    } else if (this.activeTab === "upload") {
      if (!this.uploadedDraft) {
        this.setStatus("Envie uma imagem de assinatura antes de inserir.", "error");
        return;
      }
      dataUrl = this.uploadedDraft.dataUrl;
      aspectRatio = this.uploadedDraft.aspectRatio;
      defaultLabel = this.uploadedDraft.label;
    } else {
      const typed = renderTypedSignatureToPng(
        this.typedInput.value,
        this.typedStyle,
        this.selectedColor
      );
      if (!typed.hasInk) {
        this.setStatus("Digite um nome para gerar a assinatura.", "error");
        this.typedInput.focus();
        return;
      }
      dataUrl = typed.dataUrl;
      aspectRatio = typed.aspectRatio;
      defaultLabel = this.typedInput.value.trim().slice(0, 32);
    }

    const label = this.labelInput.value.trim() || defaultLabel;

    if (this.saveCheck.checked) {
      const saved = addSavedSignature({
        label,
        kind: this.activeTab,
        dataUrl,
        aspectRatio
      });
      if (saved.error) {
        this.setStatus(saved.error, "error");
      }
      this.renderLibrary();
    }

    if (this.onPick) {
      const cb = this.onPick;
      this.close();
      cb({ label, dataUrl, aspectRatio });
    }
  }

  private renderLibrary(): void {
    const items: SavedSignature[] = loadSavedSignatures();
    const isEmpty = items.length === 0;
    this.libraryEmptyEl.hidden = !isEmpty;
    this.clearAllBtn.hidden = isEmpty;

    if (isEmpty) {
      this.libraryGrid.innerHTML = "";
      return;
    }

    this.libraryGrid.innerHTML = items
      .map(
        (sig) => `
      <div class="sig-card" role="listitem">
        <button type="button" class="sig-card-use" data-sig-use="${escapeHtml(sig.id)}" aria-label="Inserir assinatura ${escapeHtml(sig.label)}" title="Inserir na página atual">
          <div class="sig-card-thumb">
            <img src="${sig.dataUrl}" alt="${escapeHtml(sig.label)}" />
          </div>
          <span class="sig-card-name">${escapeHtml(sig.label)}</span>
        </button>
        <button type="button" class="icon-button danger sig-card-delete" data-sig-delete="${escapeHtml(sig.id)}" aria-label="Excluir assinatura ${escapeHtml(sig.label)}" title="Excluir">
          ${ICONS.trash}
        </button>
      </div>
    `
      )
      .join("");
  }

  private syncClearAllLabel(): void {
    const span = this.clearAllBtn.querySelector("span");
    if (span) {
      span.textContent = this.confirmClearAll ? "Confirmar limpeza" : "Limpar todas";
    }
  }

  private setStatus(msg: string, type: "info" | "success" | "error"): void {
    this.statusEl.textContent = msg;
    this.statusEl.dataset.type = type;
  }
}

