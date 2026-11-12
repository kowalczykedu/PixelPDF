# 02 — Leitor de PDF no Navegador

- **Status:** Rascunho (aguardando definições)
- **Branch sugerida:** `feat/pdf-reader`

## Objetivo

Adicionar capacidade de leitura/visualização de arquivos PDF existentes diretamente no navegador, mantendo o princípio de privacidade 100% local e a identidade visual Rosé Pine.

## Definições em Aberto (preencher antes de executar)

1. **Escopo principal do leitor:**
   - [ ] Apenas visualizar PDFs (abrir, navegar páginas, zoom, rotação de visualização)?
   - [ ] Ou também integrar com o fluxo atual (ex.: extrair páginas como imagem, mesclar PDFs ou misturar páginas de PDF + imagens para exportar um novo PDF)?
2. **Navegação & UX:**
   - [ ] Alternância por abas/modos no mesmo app (ex.: `Imagem → PDF` | `Leitor de PDF`) ou abertura unificada na mesa atual?
   - [ ] Recursos desejados: miniaturas laterais, ir para página N, busca de texto (`Ctrl+F` no PDF), seleção de texto, modo tela cheia?
3. **Dependência técnica:**
   - Avaliar `pdfjs-dist` (renderização fiel de texto/vetores/fontes via Worker próprio) vs. impacto no bundle e compatibilidade com `base: "./"` no GitHub Pages (`vite.config.ts`).

## Requisitos Iniciais (base)

- [ ] Todo carregamento e renderização do `.pdf` deve acontecer 100% no cliente (File API / `ArrayBuffer`), sem envio para servidor.
- [ ] Suportar abertura via seletor de arquivo e *Drag & Drop*.
- [ ] Tratar PDFs inválidos, corrompidos ou protegidos por senha com mensagens claras em PT-BR.
- [ ] Seguir o design system Rosé Pine, tipografia Space Mono, ícones SVG e acessibilidade por teclado.

## Fora de Escopo (inicial)

- Edição avançada de texto/anotações dentro do PDF (a menos que seja incluída após alinhamento).

## Critérios de Aceite

- [ ] Abrir e renderizar PDFs multi-página mantendo a interface fluida (processamento em Worker).
- [ ] Worker da biblioteca de leitura funciona tanto em `npm run dev` quanto no build estático (`npm run preview` / GitHub Pages).
- [ ] `npm run build` passa sem erros.
