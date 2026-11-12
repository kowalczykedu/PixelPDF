---
trigger: model_decision
description: Ativar sempre que a tarefa envolver criação, design, alteração ou revisão de front-end, interface (UI), HTML, CSS, layout, componentes DOM, acessibilidade ou responsividade.
---

# Regra de Front-end & Revisão de UI/UX

Sempre que uma tarefa envolver interface ou design de front-end:

## Skills Principais Obrigatórias

Antes de propor ou revisar soluções visuais, consulte e aplique estas skills do projeto:

1. `.agents/skills/ui-ux-pro-max/SKILL.md` *(principal)* — inteligência de UI/UX, hierarquia visual, estados de interação, formulários e checklist pré-entrega.
2. `.agents/skills/design-system/SKILL.md` *(principal)* — consistência com a arquitetura de tokens CSS em 3 camadas do tema **Rosé Pine** em `src/style.css` e tipografia **Space Mono**.
3. `.agents/skills/accessibility-compliance/SKILL.md` — conformidade WCAG 2.2 AA (navegação por teclado, foco em modais, `aria-label`, contraste e `prefers-reduced-motion`).
4. `.agents/skills/responsive-design/SKILL.md` — layout fluido com CSS Grid/Flexbox, alvos de toque (mín. 44×44px) e ausência de scroll horizontal.

## Fluxo Pós-Criação do Design / UI

1. Implemente a estrutura/interface solicitada e valide com `npm run build`.
2. Revise a UI gerada à luz das 4 skills acima.
3. **Apresente os pontos sugeridos ao usuário para aprovação** (lista curta e objetiva do que pode ser refinado em UX, tokens, responsividade ou acessibilidade) antes de aplicar melhorias visuais extras.

