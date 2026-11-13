---
name: entrevista
description: >-
  Conduz uma entrevista rápida e estruturada para alinhar requisitos antes de codar,
  seja criando uma nova spec em specs/ a partir de specs/_template.md ou refinando
  uma spec existente em rascunho. Use quando o usuário invocar /entrevista ou pedir
  para alinhar/planejar uma nova atualização ou feature do projeto.
---

# Entrevista de Spec (`/entrevista`)

Use esta skill para transformar uma ideia solta — ou uma spec em `Rascunho` — em uma especificação clara e aprovada antes de qualquer alteração de código.

## Passos

### 1. Identificar o alvo e carregar contexto
1. Leia `AGENTS.md` para respeitar stack, arquitetura e regras do projeto (privacidade 100% local, tema Rosé Pine, Space Mono, acessibilidade WCAG 2.2 AA).
2. Liste os arquivos em `specs/`:
   - Se o usuário citou uma spec existente (ex.: `01-rebranding`, `02-leitor-pdf`), leia o arquivo e foque nas definições em aberto.
   - Se o usuário trouxe uma ideia nova do zero, leia `specs/_template.md` para seguir o mesmo formato.
   - Se o usuário chamou `/entrevista` sem contexto, mostre as specs em `Rascunho` e pergunte se deseja **refinar uma existente** ou **começar uma nova do zero**.

### 2. Conduzir a entrevista (em blocos curtos)
- Faça poucas perguntas por turno (**2 a 4 perguntas objetivas** por rodada, ou use múltipla escolha quando houver opções claras) para não cansar o usuário.
- Cubra apenas o essencial para evitar retrabalho:
  1. **Objetivo & fluxo do usuário:** o que muda na prática e como o usuário interage.
  2. **Escopo & limites:** o que entra nesta entrega e o que fica explicitamente fora de escopo.
  3. **UI/UX & compatibilidade:** impacto visual (layout, modais, atalhos, responsividade) e migração de dados locais (`localStorage`), se aplicável.
  4. **Riscos técnicos / edge cases:** arquivos grandes, erros esperados, impacto em bundle/Web Worker.
- **Não edite código de produção nem saia implementando durante a entrevista.**

### 3. Gerar ou atualizar a spec
Quando as decisões estiverem fechadas:
- **Nova feature (do zero):** crie `specs/XX-slug-curto.md` (seguindo a numeração sequencial) com base em `specs/_template.md`, sugerindo uma branch (`feat/...`, `chore/...`, `fix/...`) direcionada para `develop`.
- **Spec existente:** atualize a spec preenchendo as definições em aberto, ajustando requisitos, arquivos prováveis e critérios de aceite.
- Confirme com o usuário se o documento reflete exatamente o esperado; após confirmação, altere o status para `Aprovada`.

### 4. Encerramento
- Mostre o link da spec criada/atualizada e um resumo curto do que ficou decidido.
- Pergunte se o usuário quer seguir para o plano técnico (`/plan`) e criação da branch para implementar.

