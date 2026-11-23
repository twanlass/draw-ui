import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { pngHeader } from '../src/test/png'
import { createFeedbackHandler } from './feedback-plugin'

let server: Server | undefined
let dir: string | undefined
afterEach(async () => {
  server?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

async function serve() {
  dir = await mkdtemp(path.join(tmpdir(), 'feedback-'))
  const handler = createFeedbackHandler(dir, () => new Date('2026-11-22T10:00:00.000Z'))
  server = createServer((req, res) => handler(req, res, () => {}))
  await new Promise<void>((r) => server!.listen(0, r))
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`
}

const post = (url: string, body: unknown) => fetch(url, { method: 'POST', body: JSON.stringify(body) })

describe('feedback route', () => {
  it('saves the report, its images and an inbox line', async () => {
    const url = await serve()
    const res = await post(url, {
      note: 'this should be a switch',
      expected: 'switch',
      target: { kind: 'toggle', sketch: [] },
      canvas: [],
      images: { sketch: pngHeader(288, 288), drawing: undefined },
    })
    const { id } = (await res.json()) as { id: string }
    expect(id).toBe('2026-11-22T10-00-00-000Z-toggle')

    const report = JSON.parse(await readFile(path.join(dir!, id, 'report.json'), 'utf8'))
    expect(report).toMatchObject({ id, status: 'open', note: 'this should be a switch', images: { sketch: 'sketch.png' } })
    expect(await readdir(path.join(dir!, id))).toEqual(['report.json', 'sketch.png'])

    const inbox = (await readFile(path.join(dir!, 'inbox.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l))
    expect(inbox).toEqual([{ id, at: '2026-11-22T10:00:00.000Z', kind: 'toggle', expected: 'switch', note: 'this should be a switch' }])
  })

  it('rejects a report without a note', async () => {
    const url = await serve()
    expect((await post(url, { note: ' ', target: { kind: 'toggle' } })).status).toBe(400)
  })
})
