# 01 — Rebranding para RootPDF

- **Status:** Concluída
- **Branch sugerida:** `chore/rebranding` (alvo: `develop`)

## Objetivo

Substituir a marca atual (`PixelPDF` / `img-to-pdf-ts`) por **RootPDF** em toda a interface, logotipo, favicon, metadados, documentação e configurações, adotando um tom mais acessível e amigável de **estúdio local de PDF** sem alterar a paleta Rosé Pine, a tipografia Space Mono ou a animação de raízes.

## Definições Alinhadas

- **Nome da marca:** `RootPDF`
- **Nome do pacote (`package.json`):** `rootpdf`
- **Subtítulo / tagline:** `Seu Estúdio Local de PDF` *(no cabeçalho: `SEU ESTÚDIO LOCAL DE PDF`)*
- **Tom de voz:** acessível, amigável e claro (posicionando o app como um estúdio/suíte local de PDFs, mantendo a confiança de processamento 100% no navegador).
- **Identidade visual:** manter paleta **Rosé Pine**, fonte **Space Mono** e animação procedural de raízes (`src/rootsAnimation.ts`). Alterar apenas:
  - **Logotipo (`.brand-mark`):** novo ícone SVG orgânico com **múltiplas raízes na diagonal** (inspirado nas raízes procedurais da animação em `src/rootsAnimation.ts`), preservando as dimensões/âncora de `.brand-mark` (`38×38px`) e gradiente Rosé Pine (`#ebbcba` → `#c4a7e7` → `#9ccfd8`) para que a coroa de raízes do `#rootsCanvas` continue alinhada.
  - **Favicon:** atualizar o ícone em `public/` e o link em `index.html` em harmonia com o novo logotipo.
- **Repositório GitHub:** links no app e `README.md` apontando para `https://github.com/kowalczykedu/RootPDF` *(o rename no GitHub será feito pelo mantenedor; `vite.config.ts` já resolve `base` dinamicamente via `GITHUB_REPOSITORY` no Actions)*.

## Arquivos Afetados

- `index.html` — `<title>`, `<meta name="description">` e referência ao novo favicon.
- `public/` — novo favicon alinhado ao logotipo `RootPDF` (remover ou substituir `favicon.png`).
- `package.json` — alterar `"name"` para `"rootpdf"` *(autorizado explicitamente por esta spec)*.
- `.github/workflows/deploy.yml` — atualizar `name` para `Deploy RootPDF to GitHub Pages` *(autorizado explicitamente por esta spec)*.
- `src/main.ts` — novo logotipo SVG em `.brand-mark`, marca/subtítulo no cabeçalho, texto mais amigável no Hero, rodapé e modal "Sobre", `aria-label`s, link do GitHub e migração da chave no `localStorage`.
- `src/style.css` — comentário de cabeçalho do design system e ajustes de estilo do novo `.brand-mark` em SVG.
- `src/pdf/pdf-builder.ts` — atualizar metadados (`pdf.setCreator("RootPDF • TypeScript + pdf-lib")` e `pdf.setProducer("RootPDF")`).
- `README.md` & `AGENTS.md` — atualizar título, descrições, comandos de clone e referências à marca.

## Requisitos

- [x] Aplicar a skill `.agents/skills/brand/SKILL.md` para consistência de voz, tom acessível/amigável e alinhamento do logotipo/ícone.
- [x] Atualizar `.brand-mark` com novo SVG de raiz botânica mantendo a caixa `38×38px` usada como âncora por `src/rootsAnimation.ts`.
- [x] Atualizar o favicon em `public/` e `index.html`.
- [x] Suavizar textos da UI (`Hero`, rodapé e modal "Sobre") para tom mais acessível de estúdio local de PDF.
- [x] Migrar a chave de preferências no `localStorage` para `"rootpdf-settings"` lendo `"pixelpdf-settings"` como fallback para não perder configurações salvas anteriormente.
- [x] Atualizar `package.json`, `.github/workflows/deploy.yml`, `src/pdf/pdf-builder.ts`, `README.md` e `AGENTS.md`.
- [x] Seguir `.agents/rules/frontend-review.md` após atualizar logotipo e copy da UI (apresentar eventuais sugestões das skills `ui-ux-pro-max`, `design-system`, `accessibility-compliance` e `responsive-design` para aprovação).

## Fora de Escopo

- Alterações na paleta Rosé Pine, na tipografia Space Mono ou na matemática da animação em `src/rootsAnimation.ts`.
- Implementação de novas funcionalidades (leitor de PDF será tratado em `specs/02-leitor-pdf.md`).

## Critérios de Aceite

- [x] Nenhuma ocorrência residual de `PixelPDF` ou `img-to-pdf-ts` em UI visível, metadados do PDF gerado, `package.json` ou documentação (exceto o fallback de migração `"pixelpdf-settings"` no código).
- [ ] Novo logotipo SVG e favicon renderizam corretamente no desktop e mobile, com a animação de raízes nascendo alinhada atrás de `.brand-mark`.
- [ ] Preferências salvas anteriormente em `"pixelpdf-settings"` são preservadas na migração para `"rootpdf-settings"`.
- [x] `npm run build` (`tsc -b && vite build`) passa sem erros.
