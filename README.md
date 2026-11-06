# PixelPDF — Imagem → PDF

Aplicação web em **TypeScript + Vite + Web Worker + pdf-lib** para converter imagens em PDF diretamente no navegador, com processamento em segundo plano (zero travamentos), prévia fiel das páginas em tempo real, tema escuro/claro alternável e pronta para publicação no **GitHub Pages**.

## Sobre o projeto

O **PixelPDF** oferece uma forma rápida, fluida e privada de converter imagens para PDF **sem depender de servidores externos**. Toda a leitura, redimensionamento e montagem do arquivo PDF acontecem localmente no navegador do usuário, utilizando **Web Workers** e **OffscreenCanvas** para manter a interface sempre responsiva (60/120 FPS).

> **Privacidade:** nenhuma imagem é enviada para a internet. Todo o fluxo ocorre localmente na memória do seu navegador, tanto rodando na sua máquina quanto hospedado no GitHub Pages.

## Funcionalidades

- **Adição versátil de arquivos:**
  - Seleção múltipla de arquivos pelo botão.
  - Arrastar e soltar (*drag & drop*) na zona de upload.
  - **Colar da área de transferência (`Ctrl+V`)** ou pelo botão **Colar** (ideal para capturas de tela / *prints*).
  - Detecção automática de arquivos duplicados no upload.
- **Prévia fiel da folha e Modal de Inspeção:**
  - Cada miniatura simula em tempo real a **proporção exata da folha** (A4, A5, Carta, Ofício ou Original), a **orientação**, a **margem configurada** e o **modo de enquadramento** (*Conter*, *Preencher* ou *Esticar*).
  - **Modal de Zoom / Pré-visualização:** clique em qualquer miniatura (ou no botão 🔍) para inspecionar a página em alta definição, navegar entre páginas (`←` / `→` no teclado ou botões) e girar a imagem ao vivo.
- **Organização individual e em lote:**
  - Reordenação por *drag & drop* ou pelos botões `↑` `↓`.
  - **Duplicação individual** de qualquer página (`⧉`).
  - Rotação individual (`↶` `↷`) ou **rotação em lote de todas as páginas** de uma só vez.
  - **Inversão da ordem** de todas as páginas com 1 clique (`⇅ Inverter`).
  - **Ordenação avançada:** Manual, Nome (A → Z / Z → A), Tamanho (Maior / Menor) e Data (Antigos / Recentes).
- **Configurações completas de exportação:**
  - Formatos aceitos: `JPG/JPEG`, `PNG`, `WEBP`, `GIF`, `BMP`, `SVG` e `AVIF`.
  - Tamanhos de página: **A4**, **A5**, **Carta (Letter)**, **Ofício (Legal)** e **Original da imagem**.
  - Orientação **Automática** (respeita a rotação aplicada na imagem), **Retrato** e **Paisagem**.
  - Margem configurável de `0 pt` a `60 pt` com recorte (*clipping path*) exato no modo *Preencher*.
  - Enquadramento: **Conter** (sem cortar), **Preencher** (corta excedentes respeitando a margem) ou **Esticar**.
  - Qualidade **Alta** (preserva PNG nativo ou JPEG 90%), **Balanceada** (78%) ou **Compacta** (60%).
  - **Processamento em 2º plano (Web Worker)** com barra de progresso em tempo real e botão para **Cancelar geração** a qualquer instante.
  - Tema escuro por padrão e tema claro alternável, com preferências salvas automaticamente no `localStorage`.

## Como executar localmente

Dentro da pasta do projeto, execute:

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`).

## Build de produção

Para compilar o TypeScript e gerar a versão otimizada para produção na pasta `dist`:

```bash
npm run build
```

Para testar localmente o build de produção:

```bash
npm run preview
```

## Publicação no GitHub Pages

O projeto já inclui o workflow oficial de deploy automático em `.github/workflows/deploy.yml` e configuração de caminhos relativos no `vite.config.ts`:

1. Suba o repositório para o GitHub (branch `main`).
2. No GitHub, acesse **Settings → Pages** e em **Build and deployment → Source** selecione **GitHub Actions**.
3. A cada `git push` na branch `main`, o GitHub Actions executará `npm ci`, `npm run build` e publicará a pasta `dist` automaticamente.

## Estrutura do Projeto

```text
PixelPDF/
├── .github/
│   └── workflows/
│       └── deploy.yml         # Deploy automatizado para o GitHub Pages
├── public/
│   └── favicon.png
├── src/
│   ├── pdf/
│   │   ├── pdf-builder.ts     # Montagem do PDF, cálculo de enquadramento e clipping
│   │   ├── pdf-client.ts      # Controlador do Web Worker, fallback e cancelamento
│   │   └── pdf.worker.ts      # Web Worker com OffscreenCanvas para zero travamentos
│   ├── utils/
│   │   ├── format.ts          # Formatação de bytes, extensões, sanitização e unidades
│   │   ├── image.ts           # Fila assíncrona de miniaturas leves e leitura de dimensões
│   │   └── layout.ts          # Geometria compartilhada entre a prévia em tela e o PDF
│   ├── main.ts                # Interface, eventos, reconciliação cirúrgica do DOM e modais
│   ├── style.css              # Estilos responsivos (Dark/Light) com aceleração de GPU
│   ├── types.ts               # Tipagens e constantes globais
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

## Tecnologias

- **TypeScript** — tipagem estática e arquitetura modular.
- **Vite** — bundler com code-splitting automático e suporte nativo a Web Workers ES.
- **pdf-lib** — criação de documentos PDF e operadores gráficos vetoriais.
- **Web Workers + OffscreenCanvas** — processamento paralelo fora da thread principal.
- **HTML5 + CSS3** — interface responsiva sem dependências de frameworks pesados.
