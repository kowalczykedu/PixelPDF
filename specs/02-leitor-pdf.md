# 02 — Leitor e Organizador de PDF no Navegador

- **Status:** Concluída
- **Branch sugerida:** `feat/pdf-reader` (alvo: `develop`)

## Objetivo

Adicionar um **Leitor e Organizador de PDF** 100% client-side integrado ao **RootPDF** por meio de seletor de modos (`Imagem → PDF` | `Leitor & Organizador`), permitindo abrir, ler, pesquisar texto, navegar e também mesclar, reordenar, girar, duplicar ou remover páginas e exportar um novo PDF — mantendo a privacidade absoluta no navegador, o tema Rosé Pine e a tipografia Space Mono.

## Definições Alinhadas

- **Navegação & UX:** alternância por abas/modos no topo da interface (`Imagem → PDF` | `Leitor & Organizador`), mantendo os dois fluxos organizados e independentes.
- **Escopo v1 (Leitura + Organização estrutural):**
  - **Leitura:** abertura via seletor de arquivo e *Drag & Drop*; painel lateral de miniaturas; campo "Ir para página N", navegação pelo scroll do mouse e atalhos (`←`/`→`, `+`/`-`); zoom (`Ajustar à largura`, `Ajustar à página` e zoom manual); rotação de visualização; camada de **seleção de texto**; busca de texto (`Ctrl+F` dentro do PDF); modo tela cheia; e persistência da última página e zoom na sessão (`sessionStorage`).
  - **Organização (via `pdf-lib`):** carregar e mesclar múltiplos PDFs, reordenar páginas (drag & drop e controles acessíveis), girar páginas em 90°, duplicar ou remover páginas e exportar o PDF consolidado localmente.
- **Engine & Performance:** adotar `pdfjs-dist` carregado sob demanda via `import()` dinâmico com Worker próprio, somente ao entrar no modo de leitura/organização, evitando peso extra no carregamento inicial de quem usa apenas `Imagem → PDF`.

## Requisitos

- [x] Todo carregamento, renderização, busca e exportação de `.pdf` deve ocorrer 100% localmente na memória do navegador (File API / `ArrayBuffer`), sem envio de arquivos para servidores.
- [x] Adicionar seletor de modo acessível (`Imagem → PDF` | `Leitor & Organizador`) preservando layout responsivo, estados e atalhos sem conflito entre modos.
- [x] Carregar `pdfjs-dist` via *dynamic import* e configurar Worker compatível tanto com `npm run dev` quanto com `npm run preview` e GitHub Pages (`base: "./"` ou `/<repo>/` em `vite.config.ts`).
- [x] Implementar abertura de um ou múltiplos PDFs via seletor e *Drag & Drop*, com tratamento claro em PT-BR para arquivos inválidos, corrompidos ou protegidos por senha.
- [x] Implementar leitor com canvas nítido (HiDPI/`devicePixelRatio`), camada de texto selecionável (`TextLayer`), busca de ocorrências (`Ctrl+F` com destaque e navegação anterior/próxima), miniaturas laterais, ir para página N, zoom manual/automático, rotação, tela cheia e persistência de sessão (página/zoom).
- [x] Implementar organização estrutural das páginas (reordenar, girar, duplicar, excluir, mesclar outro PDF) e exportação do PDF resultante com `pdf-lib` em Worker ou fluxo não bloqueante.
- [x] Seguir o design system Rosé Pine, Space Mono, ícones em SVG, acessibilidade WCAG 2.2 AA e passar pela revisão de `.agents/rules/frontend-review.md`.

## Fora de Escopo

- Assinatura desenhada/imagem, anotações, tarja/substituição de linhas de texto e criação de PDF do zero com blocos de texto + imagens *(escopo dedicado de `specs/03-editor-assinatura-pdf.md`)*.
- Quebra de segurança ou remoção de senha de PDFs criptografados sem que o usuário informe a senha.

## Arquivos Prováveis

- `package.json` — adição da dependência `pdfjs-dist` *(autorizada por esta spec após aprovação)*.
- `vite.config.ts` — apenas se necessário ajuste de build/assets para o Worker do `pdfjs-dist` em subcaminho do GitHub Pages.
- `src/main.ts` & `src/style.css` — seletor de modos, shell do Leitor & Organizador, barra de ferramentas, miniaturas, busca `Ctrl+F`, tela cheia e responsividade.
- `src/types.ts` — tipos para documento PDF aberto, páginas organizadas e estado de leitura.
- `src/pdf/` — novos módulos para carregamento sob demanda do `pdfjs-dist`, busca textual e montagem/mesclagem de páginas via `pdf-lib`.

## Critérios de Aceite

- [x] `npm run build` (`tsc -b && vite build`) passa sem erros e mantém o bundle inicial do modo `Imagem → PDF` isolado do `pdfjs-dist` via code-splitting.
- [x] Worker do `pdfjs-dist` funciona em `npm run dev` e no build estático (`npm run preview`).
- [x] PDFs multi-página abrem com miniaturas, seleção de texto, busca `Ctrl+F`, zoom, rotação, tela cheia e persistência de página/zoom na sessão.
- [x] É possível mesclar dois ou mais PDFs, reordenar/girar/remover páginas e baixar um PDF válido abrível normalmente.
- [x] PDFs inválidos, corrompidos ou protegidos por senha exibem mensagens claras em PT-BR sem quebrar a UI.
- [x] Interface revisada e validada manualmente no navegador em desktop e mobile.
