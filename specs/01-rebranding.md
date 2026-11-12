# 01 — Rebranding (Novo Nome e Identidade)

- **Status:** Rascunho (aguardando definições)
- **Branch sugerida:** `chore/rebranding`

## Objetivo

Substituir o nome atual (`PixelPDF` / `img-to-pdf-ts`) pela nova marca escolhida em toda a interface, metadados, documentação e configurações, mantendo a experiência e os dados salvos do usuário intactos.

## Definições em Aberto (preencher antes de executar)

- **Novo nome da marca:** _[a definir]_
- **Subtítulo / tagline:** _[a definir — ex.: manter "Estúdio de PDF" ou novo foco com leitor]_
- **Alterar também o nome do repositório no GitHub?** _[sim/não — se sim, informar nova URL]_
- **Trocar favicon / logo visual ou manter paleta Rosé Pine + raízes?** _[a definir]_

## Pontos já Mapeados no Código

- `index.html` — `<title>` e `<meta name="description">`.
- `package.json` — campo `"name"` (atualmente `"img-to-pdf-ts"`).
- `src/main.ts` — marca no cabeçalho, rodapé, modal "Sobre", `aria-label`s, link do GitHub e chaves no `localStorage` (`"pixelpdf-settings"`).
- `src/pdf/pdf-builder.ts` — metadados internos do PDF (`pdf.setCreator` e `pdf.setProducer`).
- `src/style.css` — comentário de cabeçalho do design system.
- `README.md` — título, descrições, comandos de clone e estrutura.
- `.github/workflows/deploy.yml` — nome do workflow (`Deploy ... to GitHub Pages`).
- `public/favicon.png` — atualizar apenas se houver troca de ícone.

## Requisitos

- [ ] Atualizar todas as ocorrências visíveis e metadados para o novo nome definido.
- [ ] Migrar (ou ler com fallback) a chave antiga `"pixelpdf-settings"` no `localStorage` para não resetar preferências de usuários existentes.
- [ ] Atualizar `README.md` e `AGENTS.md` refletindo a nova marca.

## Fora de Escopo

- Mudanças na paleta Rosé Pine, arquitetura do Worker ou novas funcionalidades de PDF (tratadas em outras specs).

## Critérios de Aceite

- [ ] Nenhuma ocorrência residual indesejada do nome antigo em UI visível, título da página ou metadados do PDF gerado.
- [ ] `npm run build` passa sem erros.
- [ ] Preferências salvas anteriormente no `localStorage` continuam funcionando após a atualização.
