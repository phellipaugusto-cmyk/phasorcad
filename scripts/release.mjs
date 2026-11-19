// Monta a pasta portátil release/PhasorCAD-portatil/ a partir do build.
// Uso:  npm run release      (faz o build e depois roda este script)
//
// A pasta resultante pode ser compactada em .zip e levada a qualquer
// computador com Node.js: basta dar dois cliques em Iniciar-PhasorCAD.bat
// (Windows) ou rodar ./iniciar-phasorcad.sh (Mac/Linux).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

const dist = join(project, 'dist')

if (!existsSync(join(dist, 'index.html'))) {
  console.error('A pasta dist não existe. Rode:  npm run build')
  process.exit(1)
}

const target = join(project, 'release', 'PhasorCAD-portatil')

rmSync(target, { recursive: true, force: true })
mkdirSync(join(target, 'scripts'), { recursive: true })

cpSync(dist, join(target, 'dist'), { recursive: true })
cpSync(join(project, 'scripts', 'serve.mjs'), join(target, 'scripts', 'serve.mjs'))
cpSync(join(project, 'Iniciar-PhasorCAD.bat'), join(target, 'Iniciar-PhasorCAD.bat'))
cpSync(join(project, 'iniciar-phasorcad.sh'), join(target, 'iniciar-phasorcad.sh'))

writeFileSync(
  join(target, 'LEIA-ME.txt'),
  `PhasorCAD (versão portátil)

COMO ABRIR
  Windows:   dê dois cliques em Iniciar-PhasorCAD.bat
  Mac/Linux: no terminal, rode ./iniciar-phasorcad.sh
  (precisa do Node.js: https://nodejs.org)

O navegador abre em http://localhost:4173/ . Deixe a janela preta aberta
enquanto usa o app.

INSTALAR COMO APP (opcional, recomendado)
  No Chrome ou no Edge, clique no ícone de instalar na barra de endereço
  (ou menu > "Instalar PhasorCAD"). Depois disso o app abre pela área de
  trabalho/menu iniciar, em janela própria, e funciona offline, sem
  precisar deixar o servidor rodando.

OBSERVAÇÃO
  Seus circuitos ficam salvos no navegador deste computador, no endereço
  usado para abrir o app. Mudar de endereço ou de computador começa vazio.
`,
)

console.log('Pacote portátil criado em:', target)
