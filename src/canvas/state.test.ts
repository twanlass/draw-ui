import { describe, expect, it } from 'vitest'
import { boxStroke, scrawl } from '@/test/sketch'
import { canvasReducer, initialState, placedAt, startsNewGroup, type CanvasAction, type CanvasState } from './state'

const run = (actions: CanvasAction[], from: CanvasState = initialState) => actions.reduce(canvasReducer, from)
const match = { kind: 'button' as const, box: { x: 0, y: 0, w: 140, h: 44 }, confidence: 1 }

describe('canvas state', () => {
  const a = boxStroke(0, 0, 140, 44)
  const b = scrawl(45, 14, 50, 16)

  it('collects strokes into the open group until it closes', () => {
    const s = run([{ type: 'addStroke', stroke: a }, { type: 'addStroke', stroke: b }])
    expect(s.pending).toEqual([a.id, b.id])
    expect(run([{ type: 'closeGroup' }], s).pending).toEqual([])
  })

  it('swaps the strokes for a component', () => {
    const s = run([
      { type: 'addStroke', stroke: a },
      { type: 'addStroke', stroke: b },
      { type: 'closeGroup' },
      { type: 'swap', id: 'p1', strokeIds: [a.id, b.id], match },
    ])
    expect(s.strokes).toEqual([])
    expect(s.placed).toHaveLength(1)
    expect(s.placed[0].kind).toBe('button')
  })

  it('places a control and its label from one sketch as a row, and undoes both at once', () => {
    const box = boxStroke(100, 50, 30, 30)
    const line = scrawl(140, 56, 200, 16)
    const s = run([
      { type: 'addStroke', stroke: box },
      { type: 'addStroke', stroke: line },
      { type: 'closeGroup' },
      {
        type: 'swap',
        id: 'cb',
        strokeIds: [box.id, line.id],
        match: { kind: 'checkbox', box: { x: 100, y: 50, w: 30, h: 30 }, confidence: 0.6 },
        extra: [{ id: 'lbl', strokeIds: [line.id], match: { kind: 'label', box: { x: 140, y: 56, w: 200, h: 16 }, confidence: 0.6 } }],
      },
    ])
    const cb = s.placed.find((p) => p.id === 'cb')!
    const lbl = s.placed.find((p) => p.id === 'lbl')!
    expect(cb.sketch.map((x) => x.id)).toEqual([box.id])
    expect(lbl.sketch.map((x) => x.id)).toEqual([line.id])
    // A row: label just right of the checkbox, centred on the same line.
    expect(lbl.box.x).toBe(cb.box.x + cb.box.w + 8)
    expect(lbl.box.y + lbl.box.h / 2).toBeCloseTo(cb.box.y + cb.box.h / 2)
    expect(run([{ type: 'undo' }], s).placed).toEqual([])
  })

  it('adds a phone frame beneath what is drawn in it, and undo removes it', () => {
    const btn = run([
      { type: 'addStroke', stroke: a },
      { type: 'closeGroup' },
      { type: 'swap', id: 'btn', strokeIds: [a.id], match: { ...match, box: { x: 150, y: 150, w: 140, h: 44 } } },
    ])
    const phone = { id: 'ph', kind: 'phone' as const, box: { x: 100, y: 50, w: 360, h: 720 }, confidence: 1, alternatives: [], sketch: [] }
    const s = run([{ type: 'add', placed: { ...phone, drawnBox: phone.box } }], btn)
    expect(s.placed.map((p) => p.id)).toEqual(['ph', 'btn'])
    expect(run([{ type: 'undo' }], s).placed.map((p) => p.id)).toEqual(['btn'])
  })

  it('a Shift+drag rect groups the components inside it into a flex column, and undo ungroups', () => {
    const b2 = boxStroke(0, 0, 10, 10)
    // Two inputs too far apart to form a column on their own.
    const s0 = run([
      { type: 'addStroke', stroke: a },
      { type: 'closeGroup' },
      { type: 'swap', id: 'i1', strokeIds: [a.id], match: { kind: 'input', box: { x: 100, y: 100, w: 200, h: 40 }, confidence: 1 } },
      { type: 'addStroke', stroke: b2 },
      { type: 'closeGroup' },
      { type: 'swap', id: 'i2', strokeIds: [b2.id], match: { kind: 'input', box: { x: 130, y: 300, w: 260, h: 40 }, confidence: 1 } },
    ])
    const s = run([{ type: 'group', id: 'g', box: { x: 60, y: 60, w: 400, h: 320 } }], s0)
    const at = (id: string) => s.placed.find((p) => p.id === id)!.box
    // Stacked 16px apart, left-aligned and as wide as each other, in a snug, invisible container.
    expect(at('i2').y).toBe(at('i1').y + at('i1').h + 16)
    expect(at('i2').x).toBe(at('i1').x)
    expect(at('i2').w).toBe(at('i1').w)
    expect(at('g').x).toBeLessThanOrEqual(at('i1').x)
    expect(at('g').y + at('g').h).toBeGreaterThanOrEqual(at('i2').y + at('i2').h)
    expect(s.placed[0].kind).toBe('group')

    const undone = run([{ type: 'undo' }], s)
    expect(undone.placed.map((p) => p.id)).toEqual(['i1', 'i2'])
    expect(undone.placed.map((p) => p.box)).toEqual(s0.placed.map((p) => p.box))
  })

  describe('nested groups', () => {
    type B = { x: number; y: number; w: number; h: number }
    let n = 0
    let s: CanvasState = initialState
    const place = (kind: 'label' | 'input' | 'card', box: B) => {
      const st = boxStroke(box.x, box.y, 10, 10)
      s = run(
        [
          { type: 'addStroke', stroke: st },
          { type: 'closeGroup' },
          { type: 'swap', id: `${kind}${++n}`, strokeIds: [st.id], match: { kind, box, confidence: 1 } },
        ],
        s,
      )
    }
    const at = (id: string) => s.placed.find((p) => p.id === id)!.box
    /** Shift+drag a loose rect around where these components are now. */
    const groupAround = (id: string, ids: string[]) => {
      const bs = ids.map(at)
      const x = Math.min(...bs.map((b) => b.x)) - 12
      const y = Math.min(...bs.map((b) => b.y)) - 12
      const box = { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) + 12 - x, h: Math.max(...bs.map((b) => b.y + b.h)) + 12 - y }
      s = run([{ type: 'group', id, box }], s)
    }
    const inside = (outer: B, inner: B) =>
      inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1
    const overlaps = (a: B, b: B) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    const noOverlaps = (ids: string[]) => {
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) expect(overlaps(at(ids[i]), at(ids[j])), `${ids[i]} / ${ids[j]}`).toBe(false)
    }

    it('two field stacks side by side in a group become a row of columns, all inside it', () => {
      // Screenshot: a grouped label + input on the left, a loose label + input on the right, then a group around both.
      n = 0
      s = initialState
      place('label', { x: 140, y: 195, w: 80, h: 24 })
      place('input', { x: 145, y: 248, w: 450, h: 40 })
      groupAround('left', ['label1', 'input2'])
      place('label', { x: 625, y: 165, w: 80, h: 24 })
      place('input', { x: 615, y: 215, w: 395, h: 40 })
      groupAround('outer', ['left', 'label3', 'input4'])

      for (const id of ['left', 'label3', 'input4']) expect(inside(at('outer'), at(id))).toBe(true)
      for (const id of ['label1', 'input2']) expect(inside(at('left'), at(id))).toBe(true)
      // The right stack is a column of its own, level with the left one.
      expect(at('label3').x).toBe(at('input4').x)
      expect(at('input4').y).toBe(at('label3').y + at('label3').h + 8)
      expect(at('label3').y).toBe(at('left').y)
      noOverlaps(['left', 'label3', 'input4'])
    })

    it('a group inside a card moves its nested group along with it', () => {
      // Screenshot: card, label, a grouped label + input, an input beside it, then a group around those.
      n = 0
      s = initialState
      place('card', { x: 130, y: 67, w: 1405, h: 315 })
      place('label', { x: 180, y: 125, w: 80, h: 24 })
      place('label', { x: 278, y: 200, w: 80, h: 24 })
      place('input', { x: 280, y: 254, w: 450, h: 40 })
      groupAround('inner', ['label3', 'input4'])
      place('input', { x: 748, y: 222, w: 395, h: 40 })
      groupAround('outer', ['label2', 'inner', 'input5'])

      expect(inside(at('card1'), at('outer'))).toBe(true)
      for (const id of ['label2', 'inner', 'input5']) expect(inside(at('outer'), at(id))).toBe(true)
      for (const id of ['label3', 'input4']) expect(inside(at('inner'), at(id))).toBe(true)
      noOverlaps(['label2', 'inner', 'input5'])
      noOverlaps(['label3', 'input4'])
      // As drawn: the label on top, the grouped field with the other input to its right.
      expect(at('label2').y + at('label2').h).toBeLessThanOrEqual(at('inner').y)
      expect(at('input5').x).toBeGreaterThan(at('inner').x + at('inner').w)
    })
  })

  it('a Shift+drag around nothing does nothing', () => {
    expect(run([{ type: 'group', id: 'g', box: { x: 0, y: 0, w: 100, h: 100 } }])).toEqual(initialState)
  })

  it('undo after a swap removes the component and its sketch in one step', () => {
    const s = run([
      { type: 'addStroke', stroke: a },
      { type: 'addStroke', stroke: b },
      { type: 'closeGroup' },
      { type: 'swap', id: 'p1', strokeIds: [a.id, b.id], match },
      { type: 'undo' },
    ])
    expect(s.placed).toEqual([])
    expect(s.strokes).toEqual([])
    expect(s.history).toEqual([])
  })

  it('ignores a late swap if a stroke was undone during recognition', () => {
    const s = run([
      { type: 'addStroke', stroke: a },
      { type: 'addStroke', stroke: b },
      { type: 'closeGroup' },
      { type: 'undo' },
      { type: 'swap', id: 'p1', strokeIds: [a.id, b.id], match },
    ])
    expect(s.placed).toEqual([])
    expect(s.strokes.map((x) => x.id)).toEqual([a.id])
  })

  it('starts a new group when the pen lands far from the open one', () => {
    expect(startsNewGroup([a], { x: 70, y: 20 })).toBe(false)
    expect(startsNewGroup([a], { x: 160, y: 20 })).toBe(false)
    expect(startsNewGroup([a], { x: 400, y: 300 })).toBe(true)
    expect(startsNewGroup([], { x: 400, y: 300 })).toBe(false)
  })
})

describe('switching a placed component', () => {
  it('swaps to an alternative and keeps the old pick as an option', () => {
    const a = boxStroke(0, 0, 140, 44)
    const s = run([
      { type: 'addStroke', stroke: a },
      {
        type: 'swap',
        id: 'p1',
        strokeIds: [a.id],
        match: { ...match, confidence: 0.8, alternatives: [{ kind: 'badge', p: 0.5 }, { kind: 'toggle', p: 0.2 }] },
      },
      { type: 'reassign', id: 'p1', kind: 'badge' },
    ])
    expect(s.placed[0].kind).toBe('badge')
    expect(s.placed[0].confidence).toBe(0.5)
    expect(s.placed[0].alternatives).toEqual([
      { kind: 'button', p: 0.8 },
      { kind: 'toggle', p: 0.2 },
    ])
  })
})

describe('erasing a placed component', () => {
  it('removes the component and the X strokes, and undo puts it back in place', () => {
    const a = boxStroke(0, 0, 140, 44)
    const b = boxStroke(0, 100, 140, 44)
    const x1 = scrawl(0, 0, 10, 10)
    const x2 = scrawl(0, 10, 10, 10)
    let s = run([
      { type: 'addStroke', stroke: a },
      { type: 'swap', id: 'p1', strokeIds: [a.id], match },
      { type: 'addStroke', stroke: b },
      { type: 'swap', id: 'p2', strokeIds: [b.id], match },
      { type: 'addStroke', stroke: x1 },
      { type: 'addStroke', stroke: x2 },
      { type: 'closeGroup' },
      { type: 'erase', id: 'p1', strokeIds: [x1.id, x2.id] },
    ])
    expect(s.placed.map((p) => p.id)).toEqual(['p2'])
    expect(s.strokes).toEqual([])

    s = run([{ type: 'undo' }], s)
    expect(s.placed.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(s.strokes).toEqual([])
  })

  it('finds the topmost component under a point', () => {
    const a = boxStroke(0, 0, 10, 10)
    const s = run([
      { type: 'addStroke', stroke: a },
      { type: 'swap', id: 'card', strokeIds: [a.id], match: { ...match, kind: 'card', box: { x: 0, y: 0, w: 400, h: 300 } } },
      { type: 'addStroke', stroke: { ...a, id: 'b' } },
      { type: 'swap', id: 'btn', strokeIds: ['b'], match: { ...match, box: { x: 50, y: 50, w: 140, h: 44 } } },
    ])
    // Auto layout moved the button to the card's padding.
    expect(placedAt(s.placed, { x: 100, y: 40 })?.id).toBe('btn')
    expect(placedAt(s.placed, { x: 300, y: 200 })?.id).toBe('card')
    expect(placedAt(s.placed, { x: 600, y: 600 })).toBeUndefined()
  })
})
