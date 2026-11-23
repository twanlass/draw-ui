import { describe, expect, it } from 'vitest'
import { boxStroke, scrawl, stroke } from '@/test/sketch'
import { splitLabel } from './split'
import type { Match } from './types'

const line = (ax: number, ay: number, bx: number, by: number) =>
  stroke(Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 })))
const matchFor = (kind: Match['kind']): Match => ({
  kind,
  box: { x: 0, y: 0, w: 1, h: 1 },
  confidence: 0.8,
})

describe('splitLabel', () => {
  it('splits a checkbox drawn with a label line into the box and a label', () => {
    // The sketch from the screenshot: a small box, then a long line to its right.
    const box = boxStroke(100, 50, 30, 30)
    const label = line(140, 62, 340, 64)
    const parts = splitLabel(matchFor('checkbox'), [box, label])
    expect(parts.map((p) => p.match.kind)).toEqual(['checkbox', 'label'])
    expect(parts[0].strokeIds).toEqual([box.id])
    expect(parts[0].match.box.w).toBeLessThan(40)
    expect(parts[1].strokeIds).toEqual([label.id])
    expect(parts[1].match.box.x).toBeGreaterThanOrEqual(140)
  })

  it('keeps a switch knob with its pill, and takes a label on the left too', () => {
    const label = scrawl(0, 40, 120, 16)
    const pill = boxStroke(140, 30, 70, 36)
    const knob = boxStroke(146, 36, 24, 24)
    const parts = splitLabel(matchFor('switch'), [label, pill, knob])
    expect(parts.map((p) => p.match.kind)).toEqual(['switch', 'label'])
    expect(parts[0].strokeIds.sort()).toEqual([pill.id, knob.id].sort())
    expect(parts[1].strokeIds).toEqual([label.id])
  })

  it('leaves a checked checkbox whole', () => {
    const box = boxStroke(0, 0, 30, 30)
    const tick = line(6, 15, 24, 6)
    expect(splitLabel(matchFor('checkbox'), [box, tick])).toHaveLength(1)
  })

  it('leaves other components whole', () => {
    const box = boxStroke(0, 0, 140, 44)
    const text = scrawl(160, 14, 60, 16)
    expect(splitLabel(matchFor('button'), [box, text])).toHaveLength(1)
  })

  it("doesn't split off ink that isn't on the control's line", () => {
    const box = boxStroke(0, 0, 30, 30)
    const far = line(40, 200, 200, 200)
    expect(splitLabel(matchFor('checkbox'), [box, far])).toHaveLength(1)
  })
})
