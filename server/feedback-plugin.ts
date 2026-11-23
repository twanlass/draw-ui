import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

const MAX_BODY_BYTES = 16 * 1024 * 1024

/**
 * Dev server route that saves a debug-mode correction to disk, where
 * Claude Code (or anyone) can pick it up:
 *
 *   feedback/inbox.jsonl          one line per report: { id, at, kind, expected, note }
 *   feedback/<id>/report.json     the full report, with "status": "open"
 *   feedback/<id>/sketch.png      the component's sketch
 *   feedback/<id>/drawing.png     the whole canvas's sketches
 *
 *   POST /api/feedback  FeedbackReport -> { id }
 */
export function feedbackPlugin(root: string): Plugin {
  const handler = createFeedbackHandler(path.join(root, 'feedback'))
  return {
    name: 'draw-ui:feedback',
    configureServer(server) {
      server.middlewares.use('/api/feedback', handler)
    },
  }
}

export function createFeedbackHandler(dir: string, now = () => new Date()): Connect.NextHandleFunction {
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' })
    let report: {
      note?: unknown
      target?: { kind?: string }
      expected?: unknown
      images?: Record<string, string | undefined>
      [k: string]: unknown
    }
    try {
      report = JSON.parse(await readBody(req))
    } catch {
      return send(res, 400, { error: 'Body must be JSON under 16 MB' })
    }
    if (typeof report.note !== 'string' || !report.note.trim() || !report.target?.kind) {
      return send(res, 400, { error: 'Need a note and a target' })
    }

    const at = now()
    const id = `${at.toISOString().replace(/[:.]/g, '-')}-${report.target.kind}`
    const out = path.join(dir, id)
    await mkdir(out, { recursive: true })

    const { images = {}, ...rest } = report
    const saved: Record<string, string> = {}
    for (const [name, url] of Object.entries(images)) {
      const m = typeof url === 'string' && /^data:image\/png;base64,(.+)$/.exec(url)
      if (!m || !/^[a-z]+$/.test(name)) continue
      await writeFile(path.join(out, `${name}.png`), Buffer.from(m[1], 'base64'))
      saved[name] = `${name}.png`
    }
    await writeFile(
      path.join(out, 'report.json'),
      JSON.stringify({ id, at: at.toISOString(), status: 'open', ...rest, images: saved }, null, 2) + '\n',
    )
    const line = { id, at: at.toISOString(), kind: report.target.kind, expected: report.expected, note: report.note.trim() }
    await appendFile(path.join(dir, 'inbox.jsonl'), JSON.stringify(line) + '\n')
    console.info(`[feedback] ${id}: ${line.note}`)
    return send(res, 200, { id })
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY_BYTES) reject(new Error('Body too large'))
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
