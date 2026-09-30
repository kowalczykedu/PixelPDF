# PixelPDF — Image to PDF

Mini aplicação web em TypeScript + Vite + pdf-lib para converter imagens em PDF diretamente no navegador.

## Recursos

- Tema dark preto/roxo por padrão
- Tema claro alternável
- Drag & drop
- Várias imagens em um único PDF
- JPG/JPEG, PNG, WEBP, GIF, BMP, SVG e AVIF (conforme suporte do navegador)
- Reordenação, rotação e remoção de páginas
- A4, A5, Carta, Ofício e tamanho original
- Retrato, paisagem ou automático
- Margens configuráveis
- Conter, preencher ou esticar
- Qualidade alta, balanceada ou compacta
- Progresso da geração
- Configurações salvas localmente
- Conversão no próprio navegador

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

A pasta `dist/` é a versão pronta para hospedagem.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. O arquivo `.github/workflows/deploy.yml` já está configurado para instalar, compilar e publicar `dist/` a cada push em `main`.
5. Aguarde o workflow terminar em **Actions**. O endereço normalmente será:
   `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`

O `vite.config.ts` detecta automaticamente o nome do repositório no GitHub Actions e configura o `base` correto para o GitHub Pages.
