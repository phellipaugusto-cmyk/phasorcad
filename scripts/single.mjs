// Gera um ÚNICO arquivo HTML (dist-single/PhasorCAD.html) com todo o app
// dentro: JavaScript, CSS e ícone embutidos. Roda com dois cliques, sem
// Node.js, sem servidor e sem internet.
// Uso:  npm run single      (faz o build e depois roda este script)
//
// Limitações (por ser aberto como arquivo local): não instala como app
// (PWA) e o localStorage fica separado do de http://localhost. Para levar
// circuitos entre as versões, use "Salvar circuito" e "Abrir circuito".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const dist = join(project, 'dist')
const indexPath = join(dist, 'index.html')

if (!existsSync(indexPath)) {
  console.error('A pasta dist não existe. Rode:  npm run build')
  process.exit(1)
}

let html = readFileSync(indexPath, 'utf8')

function readAsset(reference) {
  const clean = reference.replace(/^(\.\/|\/)/, '')
  const path = join(dist, clean)

  if (!existsSync(path)) {
    console.error('Arquivo referenciado não encontrado no build:', reference)
    process.exit(1)
  }

  return readFileSync(path)
}

/* "</script" dentro do JavaScript fecharia a tag antes da hora. */
const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script')

let scripts = 0
let styles = 0

html = html.replace(
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g,
  (_match, src) => {
    scripts++
    const code = readAsset(src).toString('utf8')
    return `<script type="module">${safeScript(code)}</script>`
  },
)

html = html.replace(
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g,
  (_match, href) => {
    styles++
    return `<style>${readAsset(href).toString('utf8')}</style>`
  },
)

/* Ícone da aba embutido; manifesto e ícones do PWA não servem em arquivo local. */
html = html.replace(
  /<link\b[^>]*\brel="icon"[^>]*\bhref="([^"]+)"[^>]*>/g,
  (_match, href) => {
    const path = join(dist, href.replace(/^(\.\/|\/)/, ''))
    if (!existsSync(path)) return ''
    const base64 = readFileSync(path).toString('base64')
    return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${base64}" />`
  },
)

html = html.replace(/<link\b[^>]*\brel="(manifest|apple-touch-icon)"[^>]*>\s*/g, '')

if (scripts !== 1) {
  console.error(`Esperava 1 <script> no build e encontrei ${scripts}.`)
  process.exit(1)
}

if (/(?:src|href)="(?!data:|#|https?:)[^"]*\.(?:js|css)"/.test(html)) {
  console.error('Ainda há referências externas a .js/.css no HTML gerado.')
  process.exit(1)
}

const target = join(project, 'dist-single', 'PhasorCAD.html')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, html)

console.log(
  `Arquivo único criado (${scripts} script, ${styles} CSS embutidos, ${(
    Buffer.byteLength(html) / 1024
  ).toFixed(0)} KB):`,
  target,
)
