import { PDFDocument, rgb, degrees } from "pdf-lib";
import "./style.css";

type FitMode = "contain" | "cover" | "stretch";
type PageSize = "a4" | "a5" | "letter" | "legal" | "image";
type Orientation = "auto" | "portrait" | "landscape";
type Quality = "high" | "balanced" | "compact";
type Theme = "dark" | "light";

type ImageItem = {
  id: number;
  file: File;
  url: string;
  rotation: number;
  width: number;
  height: number;
};

type Settings = {
  fileName: string;
  pageSize: PageSize;
  orientation: Orientation;
  margin: number;
  fitMode: FitMode;
  quality: Quality;
  theme: Theme;
};

const PAGE_SIZES: Record<Exclude<PageSize, "image">, { width: number; height: number; label: string }> = {
  a4: { width: 595.28, height: 841.89, label: "A4" },
  a5: { width: 419.53, height: 595.28, label: "A5" },
  letter: { width: 612, height: 792, label: "Carta / Letter" },
  legal: { width: 612, height: 1008, label: "Ofício / Legal" }
};

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg", ".avif"];
const ACCEPTED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/svg+xml", "image/avif"
];

const DEFAULT_SETTINGS: Settings = {
  fileName: "meu-documento",
  pageSize: "a4",
  orientation: "auto",
  margin: 24,
  fitMode: "contain",
  quality: "high",
  theme: "dark"
};

let nextId = 1;
let images: ImageItem[] = [];
let isGenerating = false;
let dragId: number | null = null;
let settings: Settings = loadSettings();

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Elemento #app não encontrado.");

app.innerHTML = `
  <div class="app-shell">
    <div class="glow glow-one"></div>
    <div class="glow glow-two"></div>

    <header class="topbar">
      <a class="brand" href="#" aria-label="Imagem para PDF">
        <span class="brand-mark"><span></span><span></span></span>
        <span><strong>PixelPDF</strong><small>Imagem → PDF</small></span>
      </a>
      <div class="topbar-actions">
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Alternar tema">
          <span class="theme-icon" aria-hidden="true">☾</span>
          <span id="themeToggleLabel">Tema claro</span>
        </button>
        <button id="aboutButton" class="top-link" type="button">Como funciona</button>
        <a class="github-link" href="https://github.com" target="_blank" rel="noreferrer">TypeScript + pdf-lib ↗</a>
      </div>
    </header>

    <main class="container">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow"><span class="status-dot"></span> Conversor 100% local</span>
          <h1>Transforme suas imagens<br><em>em um PDF impecável.</em></h1>
          <p>Organize páginas, ajuste o enquadramento e exporte tudo direto do navegador — sem upload para servidores.</p>
        </div>
        <div class="hero-stats">
          <div><strong id="heroCount">0</strong><span>páginas</span></div>
          <div><strong id="heroSize">0 B</strong><span>selecionado</span></div>
          <div><strong>0%</strong><span>upload</span></div>
        </div>
      </section>

      <section class="upload-card panel" id="dropZone">
        <div class="drop-inner">
          <div class="upload-icon-wrap"><div class="upload-icon">↥</div></div>
          <div class="drop-copy">
            <h2>Solte suas imagens aqui</h2>
            <p>JPG, PNG, WEBP, GIF, BMP, SVG e AVIF</p>
          </div>
          <label class="button primary" for="fileInput">Selecionar arquivos</label>
          <input id="fileInput" type="file" accept="image/*,.svg,.avif" multiple hidden />
        </div>
        <div class="drop-hint"><span>⌘</span> Você pode adicionar mais arquivos a qualquer momento</div>
      </section>

      <section class="toolbar panel">
        <div class="toolbar-left">
          <div class="file-summary"><span class="purple-pip"></span><strong id="imageCount">0 imagens</strong><span id="sizeCount">0 B</span></div>
        </div>
        <div class="toolbar-right">
          <label class="compact-field"><span>Ordenar</span><select id="sortSelect"><option value="manual">Manual</option><option value="name">Nome</option><option value="size">Tamanho</option></select></label>
          <button id="clearButton" class="button ghost" type="button" disabled>Limpar tudo</button>
        </div>
      </section>

      <section class="workspace">
        <div class="panel pages-panel">
          <div class="panel-header">
            <div><span class="section-kicker">01</span><div><h2>Suas páginas</h2><p>Arraste para reordenar</p></div></div>
            <span id="emptyBadge" class="badge">Vazio</span>
          </div>

          <div id="emptyState" class="empty-state">
            <div class="empty-visual"><div class="sheet sheet-back"></div><div class="sheet sheet-front">+</div></div>
            <h3>Nenhuma página ainda</h3>
            <p>Arraste imagens para a área acima ou use o botão de seleção.</p>
          </div>

          <div id="imageList" class="image-list" hidden></div>
        </div>

        <aside class="panel settings-panel">
          <div class="panel-header settings-title"><div><span class="section-kicker">02</span><div><h2>Exportação</h2><p>Configure seu PDF</p></div></div></div>

          <div class="settings-stack">
            <label class="field"><span>Nome do arquivo</span><div class="input-with-icon"><span>PDF</span><input id="fileName" type="text" maxlength="80" /></div></label>

            <div class="two-fields">
              <label class="field"><span>Tamanho</span><select id="pageSize">
                <option value="a4">A4</option><option value="a5">A5</option><option value="letter">Carta</option><option value="legal">Ofício</option><option value="image">Original</option>
              </select></label>
              <label class="field"><span>Orientação</span><select id="orientation">
                <option value="auto">Automática</option><option value="portrait">Retrato</option><option value="landscape">Paisagem</option>
              </select></label>
            </div>

            <div class="control-block">
              <div class="control-label"><span>Margem</span><strong id="marginValue">24 pt</strong></div>
              <input id="margin" class="range" type="range" min="0" max="60" step="2" />
            </div>

            <label class="field"><span>Enquadramento</span><select id="fitMode">
              <option value="contain">Conter — sem cortar</option><option value="cover">Preencher — pode cortar</option><option value="stretch">Esticar — ocupa tudo</option>
            </select></label>

            <label class="field"><span>Qualidade / tamanho</span><select id="quality">
              <option value="high">Alta — 90% JPEG</option><option value="balanced">Balanceada — 78% JPEG</option><option value="compact">Compacta — 60% JPEG</option>
            </select></label>

            <div class="feature-row">
              <div class="feature-icon">⌁</div><div><strong>Processamento local</strong><span>Seus arquivos não saem do navegador.</span></div>
            </div>

            <button id="generateButton" class="button generate-button" type="button" disabled><span>Gerar PDF</span><b>↗</b></button>
            <div id="progressWrap" class="progress-wrap" hidden><div class="progress-head"><span id="progressText">Preparando...</span><strong id="progressPercent">0%</strong></div><div class="progress-track"><div id="progressBar"></div></div></div>
            <p id="status" class="status" aria-live="polite"></p>
          </div>
        </aside>
      </section>

      <section class="tips-grid">
        <div class="tip"><span>01</span><div><strong>Formatos flexíveis</strong><p>Arquivos modernos e formatos tradicionais são rasterizados quando necessário.</p></div></div>
        <div class="tip"><span>02</span><div><strong>Ordem sob seu controle</strong><p>Use arrastar e soltar ou os controles ↑ ↓ em cada página.</p></div></div>
        <div class="tip"><span>03</span><div><strong>Sem upload</strong><p>A conversão acontece no seu dispositivo usando JavaScript.</p></div></div>
      </section>

      <footer><span>PixelPDF</span> • Projeto de estudo em TypeScript • <span>pdf-lib</span></footer>
    </main>
  </div>

  <dialog id="aboutDialog" class="about-dialog">
    <div class="dialog-card">
      <button id="closeDialog" class="dialog-close" type="button" aria-label="Fechar">×</button>
      <span class="eyebrow">Sobre o projeto</span>
      <h2>Como o PixelPDF funciona?</h2>
      <p>As imagens são carregadas no navegador, convertidas para um formato compatível quando necessário e inseridas em páginas PDF usando <strong>pdf-lib</strong>.</p>
      <div class="dialog-grid"><span>01</span><p><strong>Selecione</strong><br>Adicione uma ou várias imagens.</p><span>02</span><p><strong>Organize</strong><br>Reordene e gire páginas.</p><span>03</span><p><strong>Exporte</strong><br>Baixe o PDF pronto.</p></div>
    </div>
  </dialog>
`;

const fileInput = getElement<HTMLInputElement>("fileInput");
const dropZone = getElement<HTMLDivElement>("dropZone");
const imageList = getElement<HTMLDivElement>("imageList");
const emptyState = getElement<HTMLDivElement>("emptyState");
const imageCount = getElement<HTMLElement>("imageCount");
const sizeCount = getElement<HTMLElement>("sizeCount");
const heroCount = getElement<HTMLElement>("heroCount");
const heroSize = getElement<HTMLElement>("heroSize");
const emptyBadge = getElement<HTMLElement>("emptyBadge");
const clearButton = getElement<HTMLButtonElement>("clearButton");
const generateButton = getElement<HTMLButtonElement>("generateButton");
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
const themeToggle = getElement<HTMLButtonElement>("themeToggle");
const themeToggleLabel = getElement<HTMLElement>("themeToggleLabel");

applyTheme();

fileNameInput.value = settings.fileName;
pageSizeInput.value = settings.pageSize;
orientationInput.value = settings.orientation;
marginInput.value = String(settings.margin);
fitModeInput.value = settings.fitMode;
qualityInput.value = settings.quality;

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  themeToggleLabel.textContent = settings.theme === "dark" ? "Tema claro" : "Tema escuro";
  themeToggle.setAttribute("aria-label", settings.theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  const icon = themeToggle.querySelector<HTMLElement>(".theme-icon");
  if (icon) icon.textContent = settings.theme === "dark" ? "☀" : "☾";

  const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.content = settings.theme === "dark" ? "#09070e" : "#f3efff";
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado.`);
  return element as T;
}

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem("pixelpdf-settings") ?? "null") as Partial<Settings> | null;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem("pixelpdf-settings", JSON.stringify(settings));
}

function setStatus(message: string, type: "info" | "success" | "error" = "info") {
  status.textContent = message;
  status.dataset.type = type;
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXTENSIONS.includes(getExtension(file.name));
}

function addFiles(fileList: FileList | File[]) {
  const candidates = Array.from(fileList);
  const valid = candidates.filter(isAcceptedFile);
  const rejected = candidates.filter((file) => !isAcceptedFile(file));

  const fingerprints = new Set(images.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
  const newFiles = valid.filter((file) => {
    const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
    if (fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    return true;
  });

  for (const file of newFiles) {
    const url = URL.createObjectURL(file);
    images.push({ id: nextId++, file, url, rotation: 0, width: 0, height: 0 });
  }

  if (newFiles.length) {
    setStatus(`${newFiles.length} arquivo(s) adicionado(s).`, "success");
    void hydrateDimensions(newFiles.length);
  } else if (valid.length) {
    setStatus("Esses arquivos já estão na lista.", "info");
  } else if (rejected.length) {
    setStatus("Nenhum formato compatível foi encontrado.", "error");
  }

  if (rejected.length) console.warn("Arquivos ignorados:", rejected.map((file) => file.name));
  render();
}

async function hydrateDimensions(expectedNewFiles: number) {
  const pending = images.filter((item) => item.width === 0).slice(-expectedNewFiles);
  await Promise.all(pending.map(async (item) => {
    try {
      const image = await loadImage(item.file);
      item.width = image.naturalWidth;
      item.height = image.naturalHeight;
    } catch {
      item.width = 0;
      item.height = 0;
    }
  }));
  render();
}

function moveImage(id: number, direction: -1 | 1) {
  const index = images.findIndex((image) => image.id === id);
  const newIndex = index + direction;
  if (index < 0 || newIndex < 0 || newIndex >= images.length) return;
  [images[index], images[newIndex]] = [images[newIndex], images[index]];
  render();
}

function removeImage(id: number) {
  const index = images.findIndex((image) => image.id === id);
  if (index === -1) return;
  URL.revokeObjectURL(images[index].url);
  images.splice(index, 1);
  render();
  setStatus("Página removida.");
}

function rotateImage(id: number, amount: number) {
  const item = images.find((image) => image.id === id);
  if (!item) return;
  item.rotation = (item.rotation + amount + 360) % 360;
  render();
}

function clearImages() {
  images.forEach((image) => URL.revokeObjectURL(image.url));
  images = [];
  render();
  setStatus("Lista limpa.");
}

function sortImages(mode: string) {
  if (mode === "name") images.sort((a, b) => a.file.name.localeCompare(b.file.name, "pt-BR", { numeric: true }));
  if (mode === "size") images.sort((a, b) => b.file.size - a.file.size);
  render();
}

function render() {
  imageList.innerHTML = "";
  const totalBytes = images.reduce((sum, image) => sum + image.file.size, 0);
  const label = images.length === 1 ? "imagem" : "imagens";
  imageCount.textContent = `${images.length} ${label}`;
  sizeCount.textContent = formatBytes(totalBytes);
  heroCount.textContent = String(images.length);
  heroSize.textContent = formatBytes(totalBytes);
  emptyBadge.textContent = images.length ? `${images.length} ${label}` : "Vazio";
  emptyBadge.classList.toggle("has-items", images.length > 0);
  clearButton.disabled = images.length === 0;
  generateButton.disabled = images.length === 0 || isGenerating;
  emptyState.hidden = images.length > 0;
  imageList.hidden = images.length === 0;
  marginValue.textContent = `${settings.margin} pt`;

  images.forEach((image, index) => {
    const item = document.createElement("article");
    item.className = "image-item";
    item.draggable = true;
    item.dataset.id = String(image.id);
    const dimensions = image.width && image.height ? `${image.width} × ${image.height}` : "Dimensões —";
    const extension = getExtension(image.file.name).replace(".", "").toUpperCase() || "IMG";

    item.innerHTML = `
      <div class="drag-handle" title="Arrastar">⠿</div>
      <div class="page-thumb-wrap"><span class="page-number">${String(index + 1).padStart(2, "0")}</span><img src="${image.url}" alt="Prévia de ${escapeHtml(image.file.name)}" style="transform:rotate(${image.rotation}deg)" /></div>
      <div class="image-meta"><strong title="${escapeHtml(image.file.name)}">${escapeHtml(image.file.name)}</strong><span>${extension} · ${formatBytes(image.file.size)} · ${dimensions}</span></div>
      <div class="item-actions">
        <button class="icon-button" data-action="rotateLeft" data-id="${image.id}" type="button" title="Girar 90° para a esquerda">↶</button>
        <button class="icon-button" data-action="rotateRight" data-id="${image.id}" type="button" title="Girar 90° para a direita">↷</button>
        <button class="icon-button" data-action="up" data-id="${image.id}" type="button" title="Mover para cima" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-button" data-action="down" data-id="${image.id}" type="button" title="Mover para baixo" ${index === images.length - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-button danger" data-action="remove" data-id="${image.id}" type="button" title="Remover">×</button>
      </div>
    `;
    imageList.appendChild(item);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Não foi possível ler ${file.name}.`)); };
    image.src = url;
  });
}

function getPageSize(item: ImageItem): [number, number] {
  if (settings.pageSize === "image") {
    const width = item.width || 1000;
    const height = item.height || 1400;
    const scale = 0.75;
    return [width * scale, height * scale];
  }

  const base = PAGE_SIZES[settings.pageSize];
  if (settings.orientation === "portrait") return [Math.min(base.width, base.height), Math.max(base.width, base.height)];
  if (settings.orientation === "landscape") return [Math.max(base.width, base.height), Math.min(base.width, base.height)];

  const imageLandscape = (item.width || 1) > (item.height || 1);
  const pageLandscape = base.width > base.height;
  return imageLandscape === pageLandscape ? [base.width, base.height] : [base.height, base.width];
}

function getRotatedDimensions(width: number, height: number, rotation: number): [number, number] {
  return rotation % 180 === 0 ? [width, height] : [height, width];
}

function drawFitImage(
  page: ReturnType<PDFDocument["addPage"]>,
  embedded: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  fitMode: FitMode,
  rotation: number
) {
  const [sourceW, sourceH] = getRotatedDimensions(embedded.width, embedded.height, rotation);
  const areaW = Math.max(1, pageWidth - margin * 2);
  const areaH = Math.max(1, pageHeight - margin * 2);

  if (fitMode === "stretch") {
    page.drawImage(embedded, { x: margin, y: margin, width: areaW, height: areaH, rotate: degrees(rotation) });
    return;
  }

  const scale = fitMode === "cover"
    ? Math.max(areaW / sourceW, areaH / sourceH)
    : Math.min(areaW / sourceW, areaH / sourceH);

  const width = sourceW * scale;
  const height = sourceH * scale;
  const x = margin + (areaW - width) / 2;
  const y = margin + (areaH - height) / 2;

  page.drawImage(embedded, { x, y, width, height, rotate: degrees(rotation) });
}

function qualityConfig(): { jpeg: number; maxDimension: number } {
  if (settings.quality === "compact") return { jpeg: 0.6, maxDimension: 2200 };
  if (settings.quality === "balanced") return { jpeg: 0.78, maxDimension: 3200 };
  return { jpeg: 0.9, maxDimension: 5000 };
}

async function fileToPdfImage(file: File, pdf: PDFDocument): Promise<Awaited<ReturnType<PDFDocument["embedJpg"]>>> {
  const ext = getExtension(file.name);
  const rawPng = file.type === "image/png" || ext === ".png";

  if (rawPng && settings.quality === "high") {
    return pdf.embedPng(await file.arrayBuffer());
  }

  const image = await loadImage(file);
  const config = qualityConfig();
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  const scale = Math.min(1, config.maxDimension / Math.max(naturalW, naturalH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalW * scale));
  canvas.height = Math.max(1, Math.round(naturalH * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas não suportado neste navegador.");

  // Fundo branco evita artefatos de transparência ao gerar JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", config.jpeg));
  if (!jpegBlob) throw new Error(`Não foi possível converter ${file.name}.`);
  return pdf.embedJpg(await jpegBlob.arrayBuffer());
}

function safeFileName(name: string): string {
  return (name.trim() || "meu-documento").replace(/[\\/:*?"<>|]/g, "-").replace(/\.pdf$/i, "");
}

function updateProgress(current: number, total: number, message: string) {
  const percent = Math.round((current / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = message;
  progressPercent.textContent = `${percent}%`;
}

async function generatePdf() {
  if (!images.length || isGenerating) return;
  isGenerating = true;
  generateButton.disabled = true;
  progressWrap.hidden = false;
  updateProgress(0, images.length, "Preparando páginas...");
  setStatus("Processando imagens...", "info");

  try {
    const pdf = await PDFDocument.create();
    pdf.setTitle(fileNameInput.value.trim() || "Meu documento");
    pdf.setCreator("PixelPDF • TypeScript + pdf-lib");
    pdf.setProducer("PixelPDF");
    pdf.setSubject("PDF criado a partir de imagens");

    for (let index = 0; index < images.length; index++) {
      const item = images[index];
      updateProgress(index, images.length, `Processando ${index + 1} de ${images.length}: ${item.file.name}`);
      const embedded = await fileToPdfImage(item.file, pdf);
      let [pageWidth, pageHeight] = getPageSize(item);
      if (settings.pageSize === "image") {
        [pageWidth, pageHeight] = getRotatedDimensions(pageWidth, pageHeight, item.rotation);
      }
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
      drawFitImage(page, embedded, pageWidth, pageHeight, settings.pageSize === "image" ? 0 : settings.margin, settings.fitMode, item.rotation);
      updateProgress(index + 1, images.length, `Página ${index + 1} concluída`);
    }

    const pdfBytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `${safeFileName(fileNameInput.value)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
    setStatus(`PDF gerado com ${images.length} página(s).`, "success");
    updateProgress(images.length, images.length, "PDF pronto para uso");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Ocorreu um erro ao gerar o PDF.", "error");
  } finally {
    isGenerating = false;
    generateButton.disabled = images.length === 0;
    window.setTimeout(() => { progressWrap.hidden = true; }, 1800);
  }
}

function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  saveSettings();
  if (key === "theme") applyTheme();
  render();
}

fileInput.addEventListener("change", () => {
  if (fileInput.files) addFiles(fileInput.files);
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"] as const) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

dropZone.addEventListener("dragleave", (event) => {
  if (event.target === dropZone) dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
});

imageList.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  if (action === "up") moveImage(id, -1);
  if (action === "down") moveImage(id, 1);
  if (action === "remove") removeImage(id);
  if (action === "rotateLeft") rotateImage(id, -90);
  if (action === "rotateRight") rotateImage(id, 90);
});

imageList.addEventListener("dragstart", (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>(".image-item");
  if (!item) return;
  dragId = Number(item.dataset.id);
  item.classList.add("dragging-item");
  event.dataTransfer?.setData("text/plain", String(dragId));
});

imageList.addEventListener("dragend", (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>(".image-item");
  item?.classList.remove("dragging-item");
  dragId = null;
  document.querySelectorAll(".image-item.drag-over").forEach((el) => el.classList.remove("drag-over"));
});

imageList.addEventListener("dragover", (event) => {
  event.preventDefault();
  const target = (event.target as HTMLElement).closest<HTMLElement>(".image-item");
  if (!target || dragId === null) return;
  document.querySelectorAll(".image-item.drag-over").forEach((el) => el.classList.remove("drag-over"));
  target.classList.add("drag-over");
});

imageList.addEventListener("drop", (event) => {
  event.preventDefault();
  const target = (event.target as HTMLElement).closest<HTMLElement>(".image-item");
  if (!target || dragId === null) return;
  const targetId = Number(target.dataset.id);
  const from = images.findIndex((item) => item.id === dragId);
  const to = images.findIndex((item) => item.id === targetId);
  if (from === -1 || to === -1 || from === to) return;
  const [moved] = images.splice(from, 1);
  images.splice(to, 0, moved);
  dragId = null;
  render();
});

clearButton.addEventListener("click", clearImages);
generateButton.addEventListener("click", () => void generatePdf());
sortSelect.addEventListener("change", () => sortImages(sortSelect.value));

fileNameInput.addEventListener("input", () => { settings.fileName = fileNameInput.value; saveSettings(); });
pageSizeInput.addEventListener("change", () => updateSetting("pageSize", pageSizeInput.value as PageSize));
orientationInput.addEventListener("change", () => updateSetting("orientation", orientationInput.value as Orientation));
marginInput.addEventListener("input", () => updateSetting("margin", Number(marginInput.value)));
fitModeInput.addEventListener("change", () => updateSetting("fitMode", fitModeInput.value as FitMode));
qualityInput.addEventListener("change", () => updateSetting("quality", qualityInput.value as Quality));

themeToggle.addEventListener("click", () => {
  updateSetting("theme", settings.theme === "dark" ? "light" : "dark");
  setStatus(`Tema ${settings.theme === "dark" ? "escuro" : "claro"} ativado.`);
});

aboutButton.addEventListener("click", () => aboutDialog.showModal());
closeDialog.addEventListener("click", () => aboutDialog.close());
aboutDialog.addEventListener("click", (event) => {
  if (event.target === aboutDialog) aboutDialog.close();
});

render();
