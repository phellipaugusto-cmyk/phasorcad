# Instalar e distribuir o PhasorCAD

O PhasorCAD é um **PWA** (aplicativo web instalável): roda em Windows, Mac, Linux, Android e iPhone/iPad, abre em janela própria, tem ícone e **funciona offline** depois da primeira abertura.

## 1. Gerar o build (uma vez, no computador de desenvolvimento)

```powershell
npm.cmd install
npm.cmd run build        # gera a pasta dist/
```

## 2. Escolha como entregar

### A) Hospedagem estática (a forma mais simples para "qualquer máquina")

Copie o **conteúdo da pasta `dist/`** para qualquer hospedagem estática com **https**
(GitHub Pages, Netlify, Cloudflare Pages, servidor da escola/empresa…).
O build usa caminhos relativos, então funciona na raiz do domínio ou em uma subpasta
(ex.: `https://usuario.github.io/phasorcad/`).

Quem abrir o endereço pode instalar o app (veja a seção 3).

### B) Pasta portátil (sem hospedagem, sem internet)

```powershell
npm.cmd run release
```

Cria `release/PhasorCAD-portatil/`. Compacte a pasta em .zip e leve para outro computador
que tenha o [Node.js](https://nodejs.org):

- **Windows:** dois cliques em `Iniciar-PhasorCAD.bat`
- **Mac/Linux:** `./iniciar-phasorcad.sh`

O navegador abre em `http://localhost:4173/`. Se quiser, instale como app (seção 3);
depois disso o app abre sem o servidor.

### B2) Arquivo único (o mais simples: sem Node, sem servidor)

```powershell
npm.cmd run single       # cria dist-single/PhasorCAD.html
```

Copie o `PhasorCAD.html` para qualquer computador e dê dois cliques: ele abre no navegador, sem
instalar nada e sem internet. Como é um arquivo local, **não instala como app (PWA)** e os circuitos
salvos ficam separados dos outros endereços; para levar circuitos entre versões use **Salvar circuito**
e **Abrir circuito** (arquivo `.json`).

### C) Só para testar no próprio computador

```powershell
npm.cmd run build
npm.cmd run start        # servidor local em http://localhost:4173/
```

## 3. Instalar como app

| Sistema / navegador | Como |
|---|---|
| Chrome / Edge (Windows, Mac, Linux, Android) | Ícone de instalar na barra de endereço, ou menu ⋮ → **Instalar PhasorCAD** |
| Safari (iPhone/iPad) | Botão Compartilhar → **Adicionar à Tela de Início** |
| Safari (Mac, versão 17+) | Menu Arquivo → **Adicionar ao Dock** |
| Firefox | Não instala PWA no desktop; use como página normal (o modo offline continua valendo) |

> O navegador só oferece "Instalar" em **https** ou em **http://localhost**.
> Abrir o arquivo `index.html` com dois cliques (file://) **não** instala nem ativa o modo offline;
> use a hospedagem (A) ou o servidor local (B/C).

## 4. Funcionamento offline e atualizações

- Na primeira visita o app guarda uma cópia de si mesmo no navegador (service worker).
- Ao publicar uma versão nova, ela é carregada na **próxima abertura com internet**
  (às vezes após fechar e abrir o app mais uma vez).
- Para forçar todos os usuários a descartar o cache antigo, mude `VERSION` em `public/sw.js`
  (ex.: `phasorcad-v2`) antes do build.

## 5. Seus circuitos

Os circuitos são salvos no **navegador** (localStorage), separados por endereço:
`localhost:5173` (desenvolvimento), `localhost:4173` (servidor local) e o endereço hospedado
**não compartilham dados**. Trocar de computador também começa vazio. Para levar um circuito, use
**Salvar circuito** (baixa um `.json`) e **Abrir circuito** na outra versão.

## 6. Desinstalar

Chrome/Edge: abra o app → menu ⋮ → **Desinstalar PhasorCAD**.
Para apagar também os circuitos: Configurações do navegador → Privacidade → dados do site.

## Arquivos do pacote PWA

| Arquivo | Função |
|---|---|
| `public/manifest.webmanifest` | Nome, cores e ícones do app |
| `public/sw.js` | Service worker (cache e modo offline) |
| `public/icons/` | Ícones (192, 512, maskable e Apple) |
| `scripts/serve.mjs` | Servidor local sem dependências |
| `scripts/release.mjs` | Monta a pasta portátil |
| `vite.config.ts` | `base: './'` (caminhos relativos) |
