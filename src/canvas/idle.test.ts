import { describe, expect, it } from 'vitest'
import { boxSides, boxStroke, scrawl, stroke } from '@/test/sketch'
import { IDLE_MS, MAX_IDLE_MS, idleDelay } from './idle'

const line = (ax: number, ay: number, bx: number, by: number) =>
  stroke(Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 })))
const tick = stroke([
  { x: 0, y: 8 },
  { x: 3, y: 11 },
  { x: 6, y: 14 },
  { x: 10, y: 8 },
  { x: 14, y: 2 },
])

describe('idleDelay', () => {
  it('waits longest after one straight line, the start of a box or an X', () => {
    expect(idleDelay([line(0, 0, 200, 0)])).toBe(IDLE_MS.line)
    expect(IDLE_MS.line).toBe(MAX_IDLE_MS)
  })

  it('gives a lone frame time for its contents', () => {
    expect(idleDelay([boxStroke(0, 0, 200, 40)])).toBe(IDLE_MS.frame)
  })

  it('is quick once a frame is filled in: a button label, a checkbox tick', () => {
    expect(idleDelay([boxStroke(0, 0, 140, 44), line(40, 22, 100, 22)])).toBe(IDLE_MS.done)
    expect(idleDelay([boxStroke(0, 0, 140, 44), scrawl(40, 14, 60, 16)])).toBe(IDLE_MS.done)
    expect(idleDelay([boxStroke(-4, -2, 22, 22), tick])).toBe(IDLE_MS.done)
  })

  it('waits longer after a tiny mark outside any frame, since detail tends to come in bursts', () => {
    expect(idleDelay([boxStroke(0, 0, 200, 40), { ...tick, points: tick.points.map((p) => ({ ...p, x: p.x + 220 })) }])).toBe(
      IDLE_MS.detail,
    )
    expect(idleDelay([tick])).toBe(IDLE_MS.detail)
  })

  it('is quick when a closed shape completes a multi-stroke sketch', () => {
    expect(idleDelay([scrawl(10, 10, 60, 16), boxStroke(0, 0, 200, 40)])).toBe(IDLE_MS.done)
  })

  it('uses the normal wait otherwise', () => {
    expect(idleDelay([boxStroke(0, 0, 200, 40), scrawl(230, 10, 60, 16)])).toBe(IDLE_MS.normal)
    expect(idleDelay(boxSides(0, 0, 200, 40))).toBe(IDLE_MS.normal)
    expect(idleDelay([])).toBe(IDLE_MS.normal)
  })
})
