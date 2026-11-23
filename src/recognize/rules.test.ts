import { describe, expect, it } from 'vitest'
import { boxStroke, scrawl, stroke } from '@/test/sketch'
import sketches from './fixtures/sketches.json'
import { checkboxWithLabel } from './rules'
import { splitLabel } from './split'
import type { Stroke } from './types'

const line = (ax: number, ay: number, bx: number, by: number) =>
  stroke(Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 })))
const circle = (cx: number, cy: number, r: number) =>
  stroke(Array.from({ length: 33 }, (_, i) => ({ x: cx + r * Math.cos((i / 32) * Math.PI * 2), y: cy + r * Math.sin((i / 32) * Math.PI * 2) })))

describe('checkboxWithLabel', () => {
  // Real sketches from feedback reports that Jev read as an input or input group.
  it.each(Object.entries(sketches))('reads %s (a real sketch) as a checkbox, which splits into box + label', (_, strokes) => {
    const match = checkboxWithLabel(strokes as Stroke[])
    expect(match?.kind).toBe('checkbox')
    expect(splitLabel(match!, strokes as Stroke[]).map((p) => p.match.kind)).toEqual(['checkbox', 'label'])
  })

  it('takes a scribbled label too', () => {
    expect(checkboxWithLabel([boxStroke(0, 0, 24, 24), scrawl(36, 4, 120, 16)])?.kind).toBe('checkbox')
  })

  it('leaves a small circle with a line alone (a radio option, not a checkbox)', () => {
    expect(checkboxWithLabel([circle(12, 12, 12), line(36, 12, 160, 12)])).toBeNull()
  })

  it('leaves a field with an icon drawn inside it alone', () => {
    expect(checkboxWithLabel([boxStroke(0, 0, 260, 40), boxStroke(10, 10, 18, 18), line(40, 20, 120, 20)])).toBeNull()
  })

  it('leaves a lone box, or a big box beside a line, to Jev', () => {
    expect(checkboxWithLabel([boxStroke(0, 0, 24, 24)])).toBeNull()
    expect(checkboxWithLabel([boxStroke(0, 0, 80, 80), line(100, 40, 200, 40)])).toBeNull()
  })

  it("doesn't take ink that isn't beside the box", () => {
    expect(checkboxWithLabel([boxStroke(0, 0, 24, 24), line(36, 120, 160, 120)])).toBeNull()
  })
})
