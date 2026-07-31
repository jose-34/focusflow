import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerAdapter } from '@whatwg-node/server'
// @ts-expect-error -- built output, no .d.ts; see docs/17_Deployment_Architecture.md
import handler from '../dist/server/server.js'
import { attachGameWebSocketServer } from '../app/lib/ws-server'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.join(__dirname, '../dist/client')

const MIME_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}

// The fetch handler from dist/server/server.js only renders SSR routes and
// server functions — it has no idea dist/client's static assets (JS/CSS
// bundles, fonts, icons) exist. Without this, every route "works" (200,
// real HTML) but ships completely unstyled and non-interactive, since the
// browser's requests for /assets/*.js and *.css 404. Confirmed by hand:
// curl on / returned 200 with real markup, but curl on its own referenced
// /assets/*.css returned 404 until this was added.
function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/') return false

  const filePath = path.join(clientDir, decodeURIComponent(url.pathname))
  if (!filePath.startsWith(clientDir)) return false // path-traversal guard
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false

  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
  if (url.pathname.startsWith('/assets/')) {
    // Vite content-hashes filenames under /assets/ — safe to cache forever.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  createReadStream(filePath).pipe(res)
  return true
}

const fetchAdapter = createServerAdapter(handler.fetch)

const server = http.createServer((req, res) => {
  if (serveStatic(req, res)) return
  fetchAdapter(req, res)
})

attachGameWebSocketServer(server)

const port = Number(process.env.PORT) || 3000
server.listen(port, () => {
  console.log(`Focus Flow listening on port ${port}`)
})
