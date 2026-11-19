// Servidor estático mínimo para a pasta dist (sem dependências).
// Uso:  node scripts/serve.mjs [porta]      (padrão: 4173)
//
// O PWA só pode ser instalado a partir de https ou de http://localhost,
// por isso este servidor escuta somente em localhost.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const root = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'dist',
)

const port = Number(process.argv[2] ?? process.env.PORT ?? 4173)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(
    'A pasta dist não existe. Rode primeiro:  npm run build',
  )
  process.exit(1)
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')

  let file = normalize(join(root, decodeURIComponent(url.pathname)))

  // Impede sair da pasta dist (../).
  if (!file.startsWith(root)) {
    response.writeHead(403).end('Acesso negado')
    return
  }

  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, 'index.html')
  }

  if (!existsSync(file)) {
    file = join(root, 'index.html')
  }

  // Arquivos com hash em assets/ nunca mudam; o resto sempre é revalidado
  // (index.html e sw.js precisam refletir versões novas).
  const cache = file.includes(`${join(root, 'assets')}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'

  response.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': cache,
  })

  response.end(readFileSync(file))
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${port} já está em uso. Tente: node scripts/serve.mjs ${port + 1}`)
  } else {
    console.error(error)
  }

  process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
  const address = `http://localhost:${port}/`

  console.log(`PhasorCAD rodando em ${address}`)
  console.log('Deixe esta janela aberta. Para sair: Ctrl+C')

  if (process.argv.includes('--open')) {
    const command =
      process.platform === 'win32'
        ? `start "" "${address}"`
        : process.platform === 'darwin'
          ? `open "${address}"`
          : `xdg-open "${address}"`

    exec(command)
  }
})
