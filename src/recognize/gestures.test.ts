import { describe, expect, it } from 'vitest'
import { boxStroke, stroke } from '@/test/sketch'
import { crossOut } from './gestures'

/** A slightly wobbly straight line, like a hand-drawn stroke. */
const line = (ax: number, ay: number, bx: number, by: number) =>
  stroke(Array.from({ length: 20 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 19 + Math.sin(i) * 1.5, y: ay + ((by - ay) * i) / 19 })))

describe('crossOut', () => {
  it('finds where the two strokes of an X cross', () => {
    // Shaped like the screenshot: a lopsided X over a search input.
    const hit = crossOut([line(365, 130, 630, 357), line(590, 125, 330, 300)])
    expect(hit).not.toBeNull()
    expect(hit!.x).toBeGreaterThan(420)
    expect(hit!.x).toBeLessThan(470)
    expect(hit!.y).toBeGreaterThan(180)
    expect(hit!.y).toBeLessThan(230)
  })

  it('ignores strokes that are not an X', () => {
    expect(crossOut([line(0, 0, 100, 100)])).toBeNull()
    // Parallel lines.
    expect(crossOut([line(0, 0, 100, 100), line(20, 0, 120, 100)])).toBeNull()
    // Lines that would cross only if extended.
    expect(crossOut([line(0, 0, 40, 40), line(100, 0, 70, 30)])).toBeNull()
    // A box and a line.
    expect(crossOut([boxStroke(0, 0, 100, 40), line(0, 40, 100, 0)])).toBeNull()
    // A shallow crossing reads as two marks, not an X.
    expect(crossOut([line(0, 50, 200, 40), line(0, 40, 200, 55)])).toBeNull()
  })
})
