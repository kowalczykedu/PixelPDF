# PixelPDF — Imagem → PDF

Mini projeto em **TypeScript + Vite + pdf-lib** para converter imagens em PDF diretamente no navegador, com interface dark em preto/roxo e tema claro alternável.

## Sobre o projeto

O **PixelPDF** foi desenvolvido com auxílio de **Inteligência Artificial (IA)**, utilizada na criação, estruturação, implementação e aprimoramento do projeto.

O principal objetivo do projeto é oferecer uma forma prática e mais privada de converter imagens para PDF **sem depender de sites externos de conversão**. A conversão é realizada no próprio navegador do usuário, tanto quando o projeto é executado localmente quanto quando é publicado no **GitHub Pages**.

Dessa forma, as imagens selecionadas permanecem no dispositivo e são processadas localmente pelo navegador durante a conversão. O projeto não precisa enviar as imagens para um serviço externo de conversão, evitando expor documentos, fotos ou outros dados presentes nas imagens a plataformas de terceiros.

> **Privacidade:** o objetivo do processamento local é reduzir a exposição dos arquivos. Ainda assim, a segurança de um dispositivo e do próprio navegador depende também do ambiente em que o usuário está executando o projeto.

## Funcionalidades

- Seleção múltipla de imagens.
- Arrastar e soltar arquivos.
- Prévia e lista de páginas.
- Reordenação por drag & drop ou pelos botões ↑ ↓.
- Rotação individual de páginas em 90°.
- Remoção individual e limpeza da lista.
- Detecção simples de arquivos duplicados.
- Ordenação por nome ou tamanho.
- Formatos aceitos: JPG/JPEG, PNG, WEBP, GIF, BMP, SVG e AVIF, desde que o navegador consiga decodificar o arquivo.
- PNG em qualidade alta pode ser preservado como PNG; outros formatos são rasterizados no navegador para JPEG.
- Tamanhos A4, A5, Carta/Letter, Ofício/Legal e original da imagem.
- Orientação automática, retrato e paisagem.
- Margem configurável.
- Enquadramento: conter, preencher ou esticar.
- Qualidade alta, balanceada ou compacta.
- Barra de progresso durante a geração.
- Metadados básicos no PDF.
- Nome de arquivo customizável.
- Tema escuro por padrão e tema claro alternável, com preferência salva no `localStorage`.
- Interface responsiva para telas menores.
- Processamento local no navegador; não existe upload das imagens para um servidor de conversão.

## Compatibilidade de formatos

O suporte final a formatos de imagem é limitado pelo próprio navegador. Por isso, formatos como AVIF podem funcionar em navegadores atuais e falhar em versões antigas. GIF animado é importado como uma imagem estática (normalmente o primeiro frame).

## Privacidade e processamento local

O PixelPDF foi pensado para que a conversão possa ser feita sem utilizar serviços externos de conversão de imagens.

O fluxo é, em essência:

```text
Imagem selecionada
       ↓
Navegador do usuário
       ↓
Processamento local
       ↓
Geração do PDF
       ↓
Arquivo PDF salvo pelo usuário
```

Isso vale tanto para a execução local quanto para uma publicação no GitHub Pages. O GitHub Pages hospeda os arquivos da aplicação, enquanto o processamento das imagens acontece no dispositivo do usuário.

## Como executar

```bash
npm install
npm run dev
```

O tema escuro é usado por padrão. Pelo botão no topo, você pode alternar entre **tema escuro** e **tema claro**; a escolha fica salva no navegador.

Abra o endereço informado pelo Vite, normalmente:

```text
http://localhost:5173
```

## Build de produção

```bash
npm run build
```

A pasta `dist` será gerada com os arquivos otimizados para publicação.

## GitHub Pages

O projeto pode ser publicado no GitHub Pages usando o workflow do GitHub Actions incluído no repositório.

Após o build, a aplicação pode ser acessada por um endereço no formato:

```text
https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

Mesmo hospedado no GitHub Pages, a conversão continua sendo realizada no navegador do usuário, sem a necessidade de um servidor próprio para processar as imagens.

## Estrutura

```text
PixelPDF/
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── public/
│   └── favicon.png
│
├── src/
│   ├── main.ts
│   ├── style.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

## Tecnologias

- **TypeScript** — lógica da aplicação.
- **Vite** — desenvolvimento e build do front-end.
- **pdf-lib** — criação e geração dos arquivos PDF.
- **HTML + CSS** — estrutura e interface.
