import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import {
  DECISIONS_URL,
  DEFAULT_JEV_MODEL,
  buildDecisionRequest,
  imageSize,
  imageSizeProblem,
  rankAnswers,
  type RecognizeInput,
} from '../src/recognize/jev/decisions'

const MAX_BODY_BYTES = 8 * 1024 * 1024

/**
 * Dev and preview server route that calls Jev on OpenRouter, so the API key
 * never reaches the browser.
 *
 *   GET  /api/recognize  -> { configured: boolean }
 *   POST /api/recognize  { image, width, height } -> { ranked, ms, cost }
 */
export function jevPlugin(env: Record<string, string>): Plugin {
  const handler = createHandler({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.JEV_MODEL || DEFAULT_JEV_MODEL,
  })
  return {
    name: 'draw-ui:jev',
    configureServer(server) {
      server.middlewares.use('/api/recognize', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/recognize', handler)
    },
  }
}

export function createHandler(opts: {
  apiKey?: string
  model: string
  fetch?: typeof fetch
}): Connect.NextHandleFunction {
  const doFetch = opts.fetch ?? fetch
  return async (req, res) => {
    if (req.method === 'GET') return send(res, 200, { configured: Boolean(opts.apiKey) })
    if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST' })
    if (!opts.apiKey) return send(res, 503, { error: 'OPENROUTER_API_KEY is not set' })

    let input: RecognizeInput
    try {
      input = JSON.parse(await readBody(req))
    } catch {
      return send(res, 400, { error: 'Body must be JSON under 8 MB' })
    }
    if (typeof input.image !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(input.image)) {
      return send(res, 400, { error: 'image must be a PNG or JPEG data URL' })
    }

    // Check size here so a bad image fails fast with the real numbers, rather
    // than as Jev's bare "Invalid image dimensions".
    const size = imageSize(input.image)
    const dims = size ? `${size.width}x${size.height}` : 'unknown size'
    const problem = size ? imageSizeProblem(size) : 'could not read image size'
    if (problem) {
      console.warn(`[jev] not sent, image ${dims}: ${problem}`)
      return send(res, 400, { error: `Image rejected before sending: ${problem}` })
    }

    const started = Date.now()
    try {
      const upstream = await doFetch(DECISIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDecisionRequest(input, opts.model)),
      })
      const json = (await upstream.json()) as {
        error?: { message?: string }
        usage?: { cost?: number }
        answers?: Record<string, { type: string; noul?: number }>
      }
      const ms = Date.now() - started
      if (!upstream.ok) {
        const message = json?.error?.message ?? `OpenRouter returned ${upstream.status}`
        console.warn(`[jev] ${upstream.status} after ${ms}ms, image ${dims}: ${message}`)
        return send(res, 502, { error: message, status: upstream.status })
      }
      const ranked = rankAnswers(json)
      const top = ranked
        .slice(0, 3)
        .map((r) => `${r.kind} ${r.p.toFixed(2)}`)
        .join(', ')
      console.info(`[jev] ${ms}ms, image ${dims}, cost ${json?.usage?.cost ?? '?'}: ${top}`)
      return send(res, 200, { ranked, ms, cost: json?.usage?.cost ?? null })
    } catch (err) {
      console.warn(`[jev] request failed after ${Date.now() - started}ms, image ${dims}: ${(err as Error).message}`)
      return send(res, 502, { error: (err as Error).message })
    }
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
