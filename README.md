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

## Como executar localmente

Clone o repositório ou baixe o projeto e, dentro da pasta, execute:

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

Para gerar os arquivos otimizados para publicação:

```bash
npm run build
```

A pasta `dist` será criada com a versão pronta para hospedagem.

Para testar localmente a versão de produção, você também pode usar:

```bash
npm run preview
```

## Publicação no GitHub Pages

O PixelPDF foi preparado para ser publicado no **GitHub Pages** usando **GitHub Actions**. O repositório contém um workflow em:

```text
.github/workflows/deploy.yml
```

Esse workflow instala as dependências, executa o build do Vite e publica automaticamente a pasta `dist` no GitHub Pages.

### 1. Crie um repositório no GitHub

Crie um repositório para o projeto, por exemplo:

```text
PixelPDF
```

Depois envie o conteúdo do projeto para a branch `main`.

A estrutura deve ficar diretamente na raiz do repositório:

```text
PixelPDF/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
├── src/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

> **Importante:** o `.github` deve estar na raiz do repositório. Não coloque o projeto inteiro dentro de uma segunda pasta antes de fazer o push.

### 2. Ative o GitHub Pages

No repositório, abra:

**Settings → Pages**

Em **Build and deployment → Source**, selecione:

```text
GitHub Actions
```

### 3. Faça o primeiro push

Depois de enviar o projeto para o GitHub, o workflow será iniciado automaticamente.

O processo será aproximadamente:

```text
git push
   ↓
GitHub Actions
   ↓
npm install
   ↓
npm run build
   ↓
criação da pasta dist/
   ↓
publicação do artefato
   ↓
GitHub Pages
```

### 4. Acesse o site

Depois que o workflow terminar com sucesso, o site ficará disponível normalmente em:

```text
https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

Por exemplo:

```text
https://exemplo.github.io/PixelPDF/
```

O endereço exato pode ser encontrado em **Settings → Pages** no repositório.

### 5. Atualizações futuras

Depois da configuração inicial, novas versões podem ser publicadas simplesmente fazendo um novo push para a branch `main`:

```bash
git add .
git commit -m "Atualiza o PixelPDF"
git push
```

O GitHub Actions fará novamente o build e o deploy automaticamente.

### 6. Funcionamento no GitHub Pages

O GitHub Pages é responsável apenas por hospedar os arquivos da aplicação. A conversão das imagens continua acontecendo no navegador do usuário.

Isso significa que, mesmo acessando o PixelPDF por um endereço do GitHub Pages, o fluxo continua sendo:

```text
Usuário seleciona a imagem
          ↓
Imagem permanece no dispositivo
          ↓
JavaScript + pdf-lib executam no navegador
          ↓
PDF é criado localmente
          ↓
Usuário salva o PDF
```

Não é necessário contratar um servidor/backend para realizar a conversão.

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
