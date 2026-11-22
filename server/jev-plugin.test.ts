import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHandler } from './jev-plugin'

let server: Server | undefined
afterEach(() => server?.close())

async function serve(opts: Parameters<typeof createHandler>[0]) {
  const handler = createHandler(opts)
  server = createServer((req, res) => handler(req, res, () => {}))
  await new Promise<void>((r) => server!.listen(0, r))
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`
}

const body = JSON.stringify({ image: 'data:image/png;base64,AAAA', width: 140, height: 44 })
const post = (url: string, b = body) => fetch(url, { method: 'POST', body: b })

describe('recognize route', () => {
  it('reports whether a key is configured, without leaking it', async () => {
    const url = await serve({ apiKey: 'sk-secret', model: 'm' })
    const res = await fetch(url)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ configured: true })
    expect(text).not.toContain('sk-secret')
  })

  it('refuses to call Jev without a key', async () => {
    const url = await serve({ model: 'm' })
    expect((await post(url)).status).toBe(503)
  })

  it('rejects anything but a PNG or JPEG data URL', async () => {
    const url = await serve({ apiKey: 'k', model: 'm', fetch: vi.fn() })
    expect((await post(url, JSON.stringify({ image: 'https://x/y.png' }))).status).toBe(400)
  })

  it('calls Jev with the key and returns the ranking', async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: { is_button: { type: 'noul', noul: 0.9 }, is_badge: { type: 'noul', noul: 0.2 } },
          usage: { input_tokens: 1, output_tokens: 1, cost: 0.00002 },
        }),
      ),
    )
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const url = await serve({ apiKey: 'sk-secret', model: 'typesafe/jev-1.14', fetch: upstream })
    const res = await post(url)
    const json = (await res.json()) as { ranked: unknown }
    expect(res.status).toBe(200)
    expect(json.ranked).toEqual([
      { kind: 'button', p: 0.9 },
      { kind: 'badge', p: 0.2 },
    ])
    const [target, init] = upstream.mock.calls[0]
    expect(target).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(init.headers.Authorization).toBe('Bearer sk-secret')
    expect(JSON.parse(init.body).model).toBe('typesafe/jev-1.14')
    info.mockRestore()
  })

  it('passes OpenRouter errors back as a 502', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: { code: 402, message: 'Insufficient credits' } }), { status: 402 }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const url = await serve({ apiKey: 'k', model: 'm', fetch: upstream })
    const res = await post(url)
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toBe('Insufficient credits')
    warn.mockRestore()
  })
})
