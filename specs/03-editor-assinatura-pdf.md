# 03 — Assinatura, Edição em Camadas e Criação de PDF

- **Status:** Aprovada
- **Branch sugerida:** `feat/pdf-editor` (alvo: `develop`)
- **Depende de:** `specs/02-leitor-pdf.md`

## Objetivo

Expandir o **RootPDF** com ferramentas 100% client-side para **assinar PDFs**, **anotar e substituir trechos de texto em camadas** sobre documentos existentes, preencher formulários básicos e **criar novos PDFs combinando blocos de texto e imagens** — preservando privacidade local, tema Rosé Pine e compatibilidade com leitores padrão.

## Definições Alinhadas

- **Modelo técnico realista no navegador (`pdf-lib` + Canvas):**
  - PDFs arbitrários armazenam texto em coordenadas fixas e frequentemente com fontes *subsetted* (sem estrutura de parágrafo/reflow). Por isso, a edição de linhas em PDFs existentes funcionará via **camada visual ("Cobrir / Substituir trecho")**: o usuário pode cobrir uma área com tarja na cor do papel e posicionar novo texto editável por cima.
  - Em documentos criados dentro do próprio RootPDF, os blocos de texto e imagens permanecem editáveis no projeto local antes da exportação.
- **Assinaturas salváveis localmente:**
  - Suportar desenho à mão livre em Canvas, upload de imagem de assinatura (PNG/JPG/SVG transparente) e assinatura tipográfica.
  - Permitir salvar assinaturas em `localStorage` (chave dedicada, ex.: `rootpdf-signatures`) para reutilização rápida, com botão claro para excluir assinaturas salvas a qualquer momento.

## Requisitos

- [x] Todo processamento, armazenamento de assinaturas/rascunhos e gravação do PDF final ocorre 100% localmente no navegador.
- [x] **Assinatura visual:** criar assinatura (desenho à mão livre, imagem ou texto estilizado), posicionar/redimensionar/rotacionar sobre qualquer página e achatar/gravar no PDF via `pdf-lib`.
- [x] **Biblioteca local de assinaturas:** salvar assinaturas reutilizáveis em `localStorage` com listagem visual e exclusão individual ou completa.
- [x] **Edição em camadas sobre PDF existente:** inserir blocos de texto (fonte, tamanho, cor), inserir imagens, aplicar marca-texto/formas e usar a ferramenta **Cobrir / Substituir trecho** (tarja configurável + novo texto sobreposto).
- [x] **Formulários AcroForm (quando existirem no PDF):** detectar campos editáveis de texto/checkbox e permitir preenchimento antes de exportar.
- [x] **Criação de PDF do zero (Texto + Imagens):** modo/compositor para criar páginas com blocos de texto formatado e imagens posicionáveis, com opção de rascunho local e exportação em PDF.
- [x] Garantir precisão de coordenadas entre a prévia em tela (viewport/zoom do leitor) e as coordenadas reais em pontos PDF (`pdf-lib`), seguindo a mesma disciplina de `src/utils/layout.ts`.
- [x] Seguir o design system Rosé Pine, Space Mono, ícones SVG, acessibilidade WCAG 2.2 AA (incluindo manipulação por teclado dos elementos inseridos) e revisão de `.agents/rules/frontend-review.md`.

## Fora de Escopo

- Edição destrutiva nativa de *content streams* PDF com reflow automático de parágrafos e reescrita de fontes *subsetted* arbitrárias.
- Assinatura digital criptográfica com certificado ICP-Brasil / A1 / A3 (PAdES / PKCS#7).

## Arquivos Prováveis

- `src/main.ts` & `src/style.css` — barra de ferramentas do editor, overlay interativo por página, modal de assinatura e compositor de páginas texto + imagem.
- `src/types.ts` — modelos de anotações/camadas (assinatura, texto, tarja/substituição, imagem, destaque) e assinatura salva.
- `src/utils/layout.ts` (ou novo helper dedicado) — conversão exata de coordenadas tela ↔ pontos PDF considerando zoom e rotação da página.
- `src/pdf/` — aplicação das camadas sobre páginas existentes e geração de páginas a partir de texto + imagens com `pdf-lib`.

## Critérios de Aceite

- [x] `npm run build` (`tsc -b && vite build`) passa sem erros.
- [ ] Assinatura desenhada/importada e blocos de texto/tarja gravam exatamente na posição, escala e página exibidas na prévia (inclusive em páginas rotacionadas ou tamanhos variados).
- [ ] Assinaturas salvas persistem em `localStorage` entre recarregamentos e podem ser removidas pelo usuário.
- [ ] PDF criado do zero com textos + imagens e PDFs editados/assinados abrem corretamente em visualizadores externos e no próprio leitor do RootPDF.
- [ ] Validado manualmente no navegador (`npm run dev`) em desktop e mobile.

