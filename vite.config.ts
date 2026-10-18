/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/* In development, the same /api routes Vercel serves, plus the Lab,
   which runs Droid on this machine and so exists only here. */
function api(): Plugin {
  return {
    name: 'telekinesis-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        try {
          if (url.pathname === '/api/voice') {
            const { GET } = await import('./api/voice.ts')
            return send(res, await GET(new Request(url)))
          }
          if (url.pathname === '/api/coach' && req.method === 'POST') {
            const { POST } = await import('./api/coach.ts')
            const headers = { 'Content-Type': 'application/json', ...(req.headers.origin ? { Origin: req.headers.origin } : {}) }
            return send(res, await POST(new Request(new URL(url.pathname, `http://${req.headers.host}`), { method: 'POST', headers, body: await body(req) })))
          }
          if (url.pathname === '/api/grok' && req.method === 'POST') {
            const { POST } = await import('./api/grok.ts')
            const headers = req.headers.origin ? { Origin: req.headers.origin } : undefined
            return send(res, await POST(new Request(new URL(url.pathname, `http://${req.headers.host}`), { method: 'POST', headers })))
          }
          if (url.pathname.startsWith('/api/lab')) return await lab(url, req, res)
        } catch (e) {
          res.statusCode = 500
          return res.end(e instanceof Error ? e.message : String(e))
        }
        next()
      })
    },
  }
}

async function lab(url: URL, req: IncomingMessage, res: ServerResponse) {
  const json = (body: unknown, status = 200) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }
  /* the Lab runs Droid on this machine: a page on another site must not
     be able to start a run here, and browsers send its POST without asking */
  const origin = req.headers.origin
  if (origin && new URL(origin).host !== req.headers.host) return json({ error: 'Not allowed' }, 403)
  const { adopt, labStatus, startRun, subscribe } = await import('./lab/server.ts')
  const [, , , , id, action] = url.pathname.split('/')
  if (url.pathname === '/api/lab/status') return json(labStatus())
  if (url.pathname === '/api/lab/runs' && req.method === 'POST') {
    const { brief } = JSON.parse(await body(req)) as { brief?: string }
    if (!brief?.trim()) return json({ error: 'Describe the test first.' }, 400)
    return json({ id: startRun(brief.trim()) })
  }
  if (id && action === 'events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    const stop = subscribe(id, (e) => res.write(`data: ${JSON.stringify(e)}\n\n`))
    if (!stop) return res.end()
    req.on('close', stop)
    return
  }
  if (id && action === 'adopt' && req.method === 'POST') {
    await adopt(id)
    return json({ ok: true })
  }
  json({ error: 'Not found' }, 404)
}

const body = (req: IncomingMessage) =>
  new Promise<string>((ok, fail) => {
    let s = ''
    req.on('data', (c) => (s += c))
    req.on('end', () => ok(s))
    req.on('error', fail)
  })

async function send(res: ServerResponse, r: Response) {
  res.statusCode = r.status
  r.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await r.arrayBuffer()))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /* the keys live in .env.local; the API routes read process.env, as on Vercel */
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), api()],
    server: { watch: { ignored: ['**/.lab/**'] } },
    test: { exclude: ['**/node_modules/**', '**/dist/**', '.lab/**'] },
  }
})
