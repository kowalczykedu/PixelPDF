# PixelPDF — Estúdio de Imagem para PDF

Aplicação web moderna desenvolvida em **TypeScript + Vite + Web Worker + pdf-lib** para converter imagens em arquivos PDF de alta precisão diretamente no navegador. O processamento ocorre 100% no lado do cliente (sem envio para servidores externos), com prévia fiel das páginas em tempo real, identidade visual exclusiva **Rosé Pine**, tipografia **Space Mono**, animação procedural botânica em Canvas 2D e pronta para publicação no **GitHub Pages**.

---

## Sobre o Projeto

O **PixelPDF** foi projetado para oferecer uma experiência fluida, profissional e absolutamente privada de conversão de imagens em documentos PDF. Ao contrário de ferramentas convencionais que enviam seus arquivos para servidores de terceiros, o PixelPDF realiza toda a decodificação, enquadramento geométrico, compressão e montagem do PDF na memória do seu próprio navegador.

O processamento pesado é delegado a um **Web Worker** dedicado com suporte a **OffscreenCanvas**, garantindo que a interface permaneça sempre responsiva (60/120 FPS), sem travamentos mesmo durante a conversão de dezenas de arquivos pesados.

> 🔒 **Privacidade Absoluta:** nenhuma imagem trafega pela rede. Todo o processamento ocorre localmente no seu dispositivo.

---

## Identidade Visual & Design System

A aplicação conta com uma identidade visual moderna inspirada no tema **Rosé Pine** com foco em precisão técnica e legibilidade:

- **Paleta de Cores Rosé Pine (Exclusiva e Padrão):**
  - **Fundo Base:** `#191724` e `#12101b` (palco profundo da folha)
  - **Superfícies:** `#1f1d2e` (painéis) e `#26233a` (cartões e destaques)
  - **Acentos Principais:** Rose (`#ebbcba`), Iris (`#c4a7e7`) e Foam (`#9ccfd8`)
  - **Status Semânticos:** Pine (`#31748f` — sucesso) e Love (`#eb6f92` — perigo/remoção)
- **Tipografia Técnica Space Mono:**
  - Toda a interface utiliza a família de fontes monospace **Space Mono**, proporcionando um visual nítido, contemporâneo e padronizado para controles, métricas e leituras de arquivos.
- **Raízes Botânicas Procedurais (Canvas 2D):**
  - Ao carregar a página, uma rede orgânica de raízes é gerada proceduralmente a partir do logotipo no canto superior esquerdo, ramificando-se elegantemente pela diagonal da tela.
  - Conta com colo de raiz maciço, pontes de entrelaçamento proximal (anastomose) e milhares de radículas capilares afiladas até `0.15px`.
  - Padrão único a cada abertura da aplicação.
  - Ao finalizar a animação de crescimento (~2.9s), o loop de renderização é encerrado (**0% de uso de CPU/GPU**), estabilizando a rede como uma textura ambiente sutil no fundo (`opacity: 0.14`).
  - Respeita nativamente a preferência do usuário via `@media (prefers-reduced-motion: reduce)`.
- **Acessibilidade & Ergonomia:**
  - Em conformidade com as diretrizes **WCAG 2.2 AA**, com anéis de foco visíveis (`:focus-visible`), ícones 100% vetoriais SVG (sem emojis em botões) e contraste auditado.

---

## Funcionalidades

### 1. Adição e Importação de Arquivos
- **Formatos Suportados:** `JPG/JPEG`, `PNG`, `WEBP`, `GIF`, `BMP`, `SVG` e `AVIF`.
- **Seleção Múltipla:** Importação de vários arquivos simultaneamente pelo botão de seleção.
- **Arrastar e Soltar (*Drag & Drop*):** Área de soltura responsiva com estados visuais claros para arquivos válidos e inválidos.
- **Colar da Área de Transferência (`Ctrl+V`):** Cole capturas de tela e recortes instantaneamente, seja pelo atalho global de teclado ou pelo botão dedicado na barra de ferramentas.
- **Filtro de Duplicatas:** Detecção e alerta inteligente ao tentar adicionar arquivos já presentes na mesa.

### 2. Mesa de Páginas & Prévia Fiel em Tempo Real
- **Simulação Fiel da Folha:** Cada cartão simula fielmente a proporção da página escolhida (A4, A5, Carta, Ofício ou Original da imagem), orientação, margens calibradas em pontos e o enquadramento configurado.
- **Inspeção em Alta Resolução (Modal de Zoom):** Clique em qualquer miniatura para abrir o visualizador ampliado, com navegação rápida entre páginas por teclado (`←` / `→`) e rotação instantânea.
- **Virtualização CSS Leve:** Renderização rápida de miniaturas assíncronas utilizando `content-visibility: auto` para garantir rolagem suave mesmo com centenas de imagens.

### 3. Organização & Manipulação de Páginas
- **Reordenação Flexível:** Arraste e solte cartões para reordenar livremente ou utilize os botões direcionais `↑` / `↓`.
- **Duplicação Individual:** Clone qualquer página com 1 clique mantendo sua rotação e resolução original.
- **Rotação Precisa:** Gire páginas individualmente em 90° (`↶` / `↷`) ou aplique rotação em lote para todas as páginas de uma só vez.
- **Inversão da Ordem:** Inverta toda a sequência de páginas com um único clique.
- **Critérios de Ordenação Automática:**
  - Manual (Arrastar livremente)
  - Nome (A → Z / Z → A)
  - Tamanho de Arquivo (Maior / Menor)
  - Data de Modificação (Mais antigos / Mais recentes)

### 4. Configurações Avançadas de Exportação
- **Nome do Arquivo:** Customizável, com sanitização automática de caracteres ilegais.
- **Tamanhos de Página:**
  - **A4** (210 × 297 mm)
  - **A5** (148 × 210 mm)
  - **Carta / Letter** (8.5 × 11 pol)
  - **Ofício / Legal** (8.5 × 14 pol)
  - **Original da Imagem** (cria a folha nas dimensões exatas de cada imagem)
- **Orientação:**
  - **Automática** (detecta automaticamente com base na rotação e proporção de cada folha)
  - **Retrato** (vertical forçado)
  - **Paisagem** (horizontal forçado)
- **Margem Customizável:** Controle deslizante de `0 pt` a `60 pt` com recorte (*clipping path*) exato no modo preencher.
- **Modos de Enquadramento:**
  - **Conter (*Contain*):** Preserva a imagem inteira sem cortes, ajustando-a à área útil da folha.
  - **Preencher (*Cover*):** Preenche toda a área útil recortando proporcionalmente os excessos.
  - **Esticar (*Stretch*):** Ajusta a imagem exatamente aos limites da folha.
- **Perfis de Qualidade:**
  - **Alta:** Preserva PNG nativo ou comprime JPEG com 90% de qualidade.
  - **Balanceada:** Compressão balanceada a 78% (ótimo equilíbrio peso/nitidez).
  - **Compacta:** Compressão otimizada a 60% para PDFs leves e fáceis de compartilhar por e-mail.
- **Controle de Execução:** Barra de progresso com feedback visual página a página e botão para **Cancelar Geração** a qualquer momento.

---

## Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- `npm`, `pnpm` ou `yarn`

### Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/kowalczykedu/PixelPDF.git
cd PixelPDF

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Abra o endereço indicado no terminal (normalmente `http://localhost:5173`) no seu navegador.

---

## Build de Produção

Para gerar o pacote estático otimizado na pasta `dist/`:

```bash
npm run build
```

Para visualizar localmente o resultado do build de produção:

```bash
npm run preview
```

---

## Publicação no GitHub Pages

O projeto já possui configuração completa de caminhos relativos no [`vite.config.ts`](file:///c:/Users/duduk/Documents/PixelPDF/vite.config.ts) e o pipeline de CI/CD automatizado em [`.github/workflows/deploy.yml`](file:///c:/Users/duduk/Documents/PixelPDF/.github/workflows/deploy.yml):

1. Envie suas alterações para a branch `main` do GitHub.
2. No repositório, acesse **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. A cada novo commit na `main`, o GitHub Actions compilará e publicará a aplicação automaticamente.

---

## Estrutura do Projeto

```text
PixelPDF/
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD automatizado para publicação no GitHub Pages
├── public/
│   └── favicon.png            # Favicon com paleta Rosé Pine
├── src/
│   ├── pdf/
│   │   ├── pdf-builder.ts     # Montagem do PDF, cálculo de enquadramento e clipping
│   │   ├── pdf-client.ts      # Cliente de mensageria com o Web Worker e cancelamento
│   │   └── pdf.worker.ts      # Web Worker com OffscreenCanvas para zero travamento
│   ├── utils/
│   │   ├── format.ts          # Formatação de bytes, sanitização e conversão de unidades
│   │   ├── image.ts           # Geração assíncrona de miniaturas e metadados
│   │   └── layout.ts          # Cálculos geométricos compartilhados entre prévia e PDF
│   ├── main.ts                # Inicialização, reconciliação de DOM e interações
│   ├── rootsAnimation.ts      # Motor procedural de raízes botânicas em Canvas 2D
│   ├── style.css              # Tokens e design system Rosé Pine, layout responsivo
│   ├── types.ts               # Tipagens TypeScript e constantes da aplicação
│   └── vite-env.d.ts
├── index.html                 # Ponto de entrada HTML com fonte Space Mono
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

---

## Tecnologias Utilizadas

- **[TypeScript](https://www.typescriptlang.org/)** — Tipagem estática rigorosa e código modular.
- **[Vite](https://vitejs.dev/)** — Ferramenta de build rápida com empacotamento otimizado e suporte nativo a Web Workers.
- **[pdf-lib](https://pdf-lib.js.org/)** — Biblioteca robusta para criação e composição vetorial de documentos PDF.
- **Web Workers & OffscreenCanvas** — Computação paralela para decodificação e processamento gráfico fora da UI thread.
- **HTML5 Canvas 2D** — Renderização procedural matemática da rede orgânica de raízes.
- **CSS Moderno** — Variáveis CSS de 3 camadas, gradientes acelerados por hardware e responsividade fluida sem dependências pesadas de frameworks.

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo de licença para mais detalhes.
