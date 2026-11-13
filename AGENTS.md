# AGENTS.md

Guia permanente para agentes trabalhando neste repositório. Leia este arquivo e a spec correspondente em `specs/` antes de propor ou editar código.

## Visão Geral & Stack

- **Projeto:** **RootPDF** — seu estúdio local de PDF 100% client-side (sem backend; nenhum arquivo do usuário sai do navegador).
- **Stack:** TypeScript (`strict: true`), Vite 7, `pdf-lib`, Web Worker com `OffscreenCanvas`, HTML5 Canvas 2D e CSS puro com tokens em 3 camadas (tema **Rosé Pine** e fonte **Space Mono**).
- **Deploy:** Site estático publicado no GitHub Pages via `.github/workflows/deploy.yml` (push em `main`).

## Comandos Essenciais

- `npm run dev` — servidor de desenvolvimento local (porta `5173`).
- `npm run build` — checagem TypeScript (`tsc -b`) + build de produção (`vite build`).
- `npm run preview` — prévia local do build gerado em `dist/`.

> Não há suíte de testes automatizados configurada ainda. **Sempre** rode `npm run build` após alterações de código e verifique o resultado sem erros.

## Mapa Rápido da Arquitetura

- `index.html` & `public/` — ponto de entrada HTML, carregamento da fonte Space Mono e favicons (`favicon.svg`, `favicon.png`).
- `src/main.ts` — interface principal, estado da aplicação, reconciliação de DOM, modais e atalhos.
- `src/style.css` — arquitetura de tokens Rosé Pine, layout responsivo e estilos dos componentes.
- `src/rootsAnimation.ts` — animação procedural de raízes botânicas em Canvas 2D.
- `src/types.ts` — tipos compartilhados, formatos aceitos, tamanhos de folha e `DEFAULT_SETTINGS`.
- `src/pdf/pdf-client.ts` — controlador de geração e cancelamento junto ao Web Worker.
- `src/pdf/pdf.worker.ts` — execução em background com `OffscreenCanvas`.
- `src/pdf/pdf-builder.ts` — montagem do PDF com `pdf-lib`, enquadramento, clipping e metadados.
- `src/utils/format.ts`, `src/utils/image.ts`, `src/utils/layout.ts` — formatação, miniaturas/rasterização e geometria compartilhada entre prévia e PDF.

## Regras de Engenharia

1. **Privacidade local obrigatória:** todo processamento de imagem/PDF deve ocorrer localmente na memória do navegador. Não introduzir uploads ou chamadas de processamento a servidores externos.
2. **Fidelidade prévia ↔ PDF:** cálculos de enquadramento, margem, orientação e proporção devem permanecer consistentes entre a prévia em tela e o arquivo gerado (centralizados em `src/utils/layout.ts`).
3. **Performance & UI responsiva:** manter operações pesadas fora da thread principal (Web Worker / yielding) e preservar `prefers-reduced-motion`.
4. **Acessibilidade (WCAG 2.2 AA):** manter `:focus-visible`, `aria-label` descritivos, contraste do tema e ícones em SVG (não usar emojis em botões).
5. **Mudanças cirúrgicas:** não alterar `package.json`, `vite.config.ts` ou `.github/workflows/deploy.yml` a menos que a spec peça explicitamente.
6. **Preservar comentários úteis** existentes que não tenham relação com a tarefa.

## Fluxo Spec-Driven (Como Trabalhar Aqui)

1. Toda nova feature ou mudança relevante deve ter um arquivo curto em `specs/` (use `specs/_template.md`).
2. Se a spec estiver com status `Rascunho`, alinhe as dúvidas em aberto com o usuário antes de implementar.
3. Antes de codar uma spec aprovada, apresente um plano breve listando os arquivos que serão tocados.
4. Ao concluir a implementação e validar com `npm run build`, atualize os checkboxes (`- [x]`) e o status da spec para `Concluída`.

## Fluxo de Branches & PRs

- **`develop`** — branch de integração para novas features e atualizações (branches `feat/...`, `chore/...`, `fix/...` abrem PR para `develop`).
- **`main`** — branch estável/produção (recebe PRs de `develop` e dispara o deploy no GitHub Pages).
