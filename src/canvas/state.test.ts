import { describe, expect, it } from 'vitest'
import { gapAt } from './layout'
import { boxStroke, scrawl } from '@/test/sketch'
import { unionBoxes } from '@/lib/geometry'
import { canvasReducer, crossedOut, initialState, placedAt, startsNewGroup, type CanvasAction, type CanvasState } from './state'

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

  describe('duplicate', () => {
    const place = (id: string, kind: 'button' | 'checkbox' | 'label' | 'card' | 'input', box: { x: number; y: number; w: number; h: number }, from = initialState) => {
      const st = boxStroke(box.x, box.y, box.w, box.h)
      return run([{ type: 'addStroke', stroke: st }, { type: 'closeGroup' }, { type: 'swap', id, strokeIds: [st.id], match: { kind, box, confidence: 1 } }], from)
    }
    const at = (s: CanvasState, id: string) => s.placed.find((p) => p.id === id)!.box

    it('does nothing on an empty canvas', () => {
      expect(run([{ type: 'duplicate', id: 'd' }])).toBe(initialState)
    })

    it('copies the last component straight below it, and again below that', () => {
      const s = run([{ type: 'duplicate', id: 'd1' }, { type: 'duplicate', id: 'd2' }], place('btn', 'button', { x: 100, y: 100, w: 140, h: 44 }))
      expect(s.placed.map((p) => p.kind)).toEqual(['button', 'button', 'button'])
      const [a, b, c] = [at(s, 'btn'), at(s, 'd1-0'), at(s, 'd2-0')]
      expect(b).toEqual({ ...a, y: a.y + a.h + 16 })
      expect(c).toEqual({ ...b, y: b.y + b.h + 16 })
      expect(run([{ type: 'undo' }], s).placed).toHaveLength(2)
    })

    it('copies a control together with its label', () => {
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
          match: { kind: 'checkbox', box: { x: 100, y: 50, w: 30, h: 30 }, confidence: 1 },
          extra: [{ id: 'lbl', strokeIds: [line.id], match: { kind: 'label', box: { x: 140, y: 56, w: 200, h: 16 }, confidence: 1 } }],
        },
        { type: 'duplicate', id: 'd' },
      ])
      expect(s.placed.map((p) => p.kind).sort()).toEqual(['checkbox', 'checkbox', 'label', 'label'])
      const copyCb = s.placed.find((p) => p.id.startsWith('d-') && p.kind === 'checkbox')!.box
      const copyLbl = s.placed.find((p) => p.id.startsWith('d-') && p.kind === 'label')!.box
      // Still a row, on its own line below the first.
      expect(copyLbl.x).toBe(copyCb.x + copyCb.w + 8)
      expect(copyCb.x).toBe(at(s, 'cb').x)
      expect(copyCb.y).toBeGreaterThanOrEqual(at(s, 'lbl').y + at(s, 'lbl').h)
    })

    it('copies a card with what is inside it, and copies inside a card stay in it', () => {
      let s = place('card', 'card', { x: 100, y: 100, w: 320, h: 200 })
      s = place('in', 'input', { x: 130, y: 130, w: 240, h: 40 }, s)
      s = run([{ type: 'duplicate', id: 'd' }], s)
      const card = at(s, 'card')
      const inputs = s.placed.filter((p) => p.kind === 'input').map((p) => p.box)
      expect(inputs).toHaveLength(2)
      for (const b of inputs) expect(b.y + b.h).toBeLessThanOrEqual(card.y + card.h)
    })

    it('copies a Shift+drag group with everything in it, stacked below the original', () => {
      let s = place('lbl', 'label', { x: 100, y: 100, w: 80, h: 20 })
      s = place('in', 'input', { x: 104, y: 134, w: 240, h: 40 }, s)
      s = run([{ type: 'group', id: 'g', box: { x: 80, y: 80, w: 300, h: 120 } }, { type: 'duplicate', id: 'd' }], s)
      const copies = s.placed.filter((p) => p.id.startsWith('d-'))
      expect(copies.map((p) => p.kind).sort()).toEqual(['group', 'input', 'label'])
      const g = at(s, 'g')
      const copy = copies.find((p) => p.kind === 'group')!.box
      expect(copy).toEqual({ ...g, y: g.y + g.h + 16 })
      // The copy's contents sit inside it exactly as the original's do.
      for (const kind of ['label', 'input'] as const) {
        const orig = s.placed.find((p) => !p.id.startsWith('d-') && p.kind === kind)!.box
        const dup = copies.find((p) => p.kind === kind)!.box
        expect(dup).toEqual({ ...orig, y: orig.y + copy.y - g.y })
      }
      // A generous drag rect doesn't push the copy away.
      const loose = run(
        [{ type: 'group', id: 'g', box: { x: 40, y: 40, w: 420, h: 360 } }, { type: 'duplicate', id: 'd' }],
        place('in', 'input', { x: 104, y: 134, w: 240, h: 40 }, place('lbl', 'label', { x: 100, y: 100, w: 80, h: 20 })),
      )
      const lg = loose.placed.find((p) => p.id === 'g')!.box
      expect(loose.placed.find((p) => p.id.startsWith('d-') && p.kind === 'group')!.box.y).toBe(lg.y + lg.h + 16)
      // Undo removes the whole copy in one go; again keeps stacking.
      expect(run([{ type: 'undo' }], s).placed).toHaveLength(3)
      expect(run([{ type: 'duplicate', id: 'e' }], s).placed.filter((p) => p.kind === 'group')).toHaveLength(3)
    })

    it('copies a group of one component with its component', () => {
      // The group hugs its only member exactly, so it's the same size as it.
      const s = run(
        [{ type: 'group', id: 'g', box: { x: 80, y: 80, w: 200, h: 90 } }, { type: 'duplicate', id: 'd' }],
        place('btn', 'button', { x: 100, y: 100, w: 120, h: 40 }),
      )
      const copies = s.placed.filter((p) => p.id.startsWith('d-'))
      expect(copies.map((p) => p.kind).sort()).toEqual(['button', 'group'])
      const [g, b] = [copies.find((p) => p.kind === 'group')!.box, copies.find((p) => p.kind === 'button')!.box]
      expect(b.y).toBe(g.y)
      expect(g.y).toBeGreaterThan(at(s, 'btn').y + at(s, 'btn').h)
    })

    it('makes room when something sits right below the original, instead of landing on it', () => {
      // A label + input group with a copy of it directly below (16px apart),
      // then the original made the last thing created again, as if it had
      // been grouped after the one below was made.
      let s = place('lbl', 'label', { x: 100, y: 100, w: 80, h: 20 })
      s = place('in', 'input', { x: 104, y: 134, w: 416, h: 40 }, s)
      s = run([{ type: 'group', id: 'top', box: { x: 90, y: 90, w: 440, h: 90 } }, { type: 'duplicate', id: 'low' }], s)
      const isTop = (h: (typeof s.history)[number]) => h.type === 'swap' && h.placedIds.includes('top')
      s = { ...s, history: [...s.history.filter((h) => !isTop(h)), ...s.history.filter(isTop)] }
      const top = at(s, 'top')
      expect(at(s, 'low-0').y).toBe(top.y + top.h + 16)

      const after = run([{ type: 'duplicate', id: 'd' }], s)
      const group = (prefix: string) => after.placed.find((p) => p.id.startsWith(prefix) && p.kind === 'group')!.box
      const members = (prefix: string) => after.placed.filter((p) => p.id.startsWith(prefix) && p.kind !== 'group').map((p) => p.box)
      const inside = (o: typeof top, b: typeof top) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h
      // The copy goes between the two, with its own label and input...
      const copy = group('d-')
      expect(copy.y).toBe(top.y + top.h + 16)
      expect(members('d-')).toHaveLength(2)
      for (const b of members('d-')) expect(inside(copy, b)).toBe(true)
      // ...and the group below moves down, keeping only its own.
      const low = group('low-')
      expect(low.y).toBe(copy.y + copy.h + 16)
      expect(low.h).toBe(top.h)
      for (const b of members('low-')) expect(inside(low, b)).toBe(true)
      expect(run([{ type: 'undo' }], after).placed).toEqual(s.placed)
    })

    it('copies a card drawn last along with what is inside it', () => {
      let s = place('in', 'input', { x: 130, y: 130, w: 240, h: 40 })
      s = place('card', 'card', { x: 100, y: 100, w: 320, h: 120 }, s)
      s = run([{ type: 'duplicate', id: 'd' }], s)
      expect(s.placed.map((p) => p.kind).sort()).toEqual(['card', 'card', 'input', 'input'])
      const copyCard = s.placed.find((p) => p.id.startsWith('d-') && p.kind === 'card')!.box
      const copyIn = s.placed.find((p) => p.id.startsWith('d-') && p.kind === 'input')!.box
      expect(copyCard.y).toBeGreaterThanOrEqual(at(s, 'card').y + at(s, 'card').h)
      expect(copyIn.y).toBeGreaterThan(copyCard.y)
      expect(copyIn.y + copyIn.h).toBeLessThanOrEqual(copyCard.y + copyCard.h)
    })
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
      { type: 'erase', ids: ['p1'], strokeIds: [x1.id, x2.id] },
    ])
    expect(s.placed.map((p) => p.id)).toEqual(['p2'])
    expect(s.strokes).toEqual([])

    s = run([{ type: 'undo' }], s)
    expect(s.placed.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(s.strokes).toEqual([])
  })

  // Label + input fields, each wrapped in a group, stacked like a form.
  const form = (count: number) => {
    let s = initialState
    for (let i = 0; i < count; i++) {
      const y = 100 + i * 200
      for (const [id, kind, box] of [
        [`l${i}`, 'label', { x: 100, y, w: 80, h: 20 }],
        [`i${i}`, 'input', { x: 104, y: y + 34, w: 300, h: 40 }],
      ] as const) {
        const st = boxStroke(box.x, box.y, box.w, box.h)
        s = run([{ type: 'addStroke', stroke: st }, { type: 'closeGroup' }, { type: 'swap', id, strokeIds: [st.id], match: { kind, box, confidence: 1 } }], s)
      }
      s = run([{ type: 'group', id: `g${i}`, box: { x: 90, y: y - 10, w: 330, h: 90 } }], s)
    }
    return s
  }
  const line = (id: string, ax: number, ay: number, bx: number, by: number) => ({
    id,
    points: Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 })),
  })
  const bigX = (b: { x: number; y: number; w: number; h: number }) => [line('x1', b.x, b.y, b.x + b.w, b.y + b.h), line('x2', b.x + b.w, b.y, b.x, b.y + b.h)]

  it('a big X over a whole form erases all of it, and one undo brings it all back', () => {
    const s = form(4)
    const all = unionBoxes(s.placed.map((p) => p.box))
    // Drawn a bit loosely: narrower than the form on the left, overshooting below.
    const strokes = bigX({ x: all.x + 60, y: all.y - 30, w: all.w - 30, h: all.h + 80 })
    const ids = crossedOut(s.placed, strokes, { x: all.x + all.w / 2, y: all.y + all.h / 2 })
    const after = run([{ type: 'erase', ids, strokeIds: [] }], s)
    expect(after.placed).toEqual([])
    expect(run([{ type: 'undo' }], after).placed).toEqual(s.placed)
  })

  it('a small X takes just the component under it, and a group left with one member dissolves', () => {
    const s = form(2)
    const label = s.placed.find((p) => p.id === 'l0')!.box
    const strokes = bigX({ x: label.x + 10, y: label.y - 4, w: 50, h: 28 })
    const ids = crossedOut(s.placed, strokes, { x: label.x + 35, y: label.y + 10 })
    expect(ids).toEqual(['l0'])
    const after = run([{ type: 'erase', ids, strokeIds: [] }], s)
    expect(after.placed.map((p) => p.id).sort()).toEqual(['g1', 'i0', 'i1', 'l1'])
    expect(run([{ type: 'undo' }], after).placed).toEqual(s.placed)
  })

  it('erasing everything in a group erases the group too', () => {
    const s = form(1)
    const after = run([{ type: 'erase', ids: ['l0', 'i0'], strokeIds: [] }], s)
    expect(after.placed).toEqual([])
  })

  it('erasing a group erases what is in it', () => {
    const after = run([{ type: 'erase', ids: ['g0'], strokeIds: [] }], form(2))
    expect(after.placed.map((p) => p.id).sort()).toEqual(['g1', 'i1', 'l1'])
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

describe('laying out a whole form in a card', () => {
  // The checkout target: a two-column header, full-width fields, a row of
  // three fields, a checkbox with its label and a full-width button.
  type K = 'card' | 'label' | 'separator' | 'input' | 'input-group' | 'select' | 'checkbox' | 'button'
  const card: [string, K, { x: number; y: number; w: number; h: number }] = ['card', 'card', { x: 82, y: 62, w: 958, h: 860 }]
  const parts: [string, K, { x: number; y: number; w: number; h: number }][] = [
    ['route', 'label', { x: 135, y: 120, w: 230, h: 30 }],
    ['travelers', 'label', { x: 135, y: 168, w: 270, h: 26 }],
    ['price', 'label', { x: 680, y: 130, w: 305, h: 60 }],
    ['sep', 'separator', { x: 135, y: 232, w: 850, h: 4 }],
    ['nameL', 'label', { x: 135, y: 270, w: 155, h: 24 }],
    ['name', 'input', { x: 135, y: 311, w: 850, h: 70 }],
    ['numL', 'label', { x: 135, y: 418, w: 145, h: 24 }],
    ['num', 'input-group', { x: 135, y: 459, w: 850, h: 70 }],
    ['expL', 'label', { x: 135, y: 566, w: 85, h: 24 }],
    ['exp', 'input', { x: 135, y: 607, w: 242, h: 70 }],
    ['cvcL', 'label', { x: 402, y: 566, w: 50, h: 24 }],
    ['cvc', 'input', { x: 402, y: 607, w: 194, h: 70 }],
    ['ctyL', 'label', { x: 621, y: 566, w: 160, h: 24 }],
    ['cty', 'select', { x: 621, y: 607, w: 364, h: 70 }],
    ['check', 'checkbox', { x: 135, y: 710, w: 35, h: 35 }],
    ['saveL', 'label', { x: 190, y: 713, w: 350, h: 28 }],
    ['pay', 'button', { x: 135, y: 782, w: 850, h: 88 }],
  ]
  const draw = (order: typeof parts) =>
    order.reduce((s, [id, kind, box]) => {
      const st = boxStroke(box.x, box.y, box.w, box.h)
      return run([{ type: 'addStroke', stroke: st }, { type: 'closeGroup' }, { type: 'swap', id, strokeIds: [st.id], match: { kind, box, confidence: 1 } }], s)
    }, initialState)

  it.each([
    ['the card first', [card, ...parts]],
    ['the card last, around everything', [...parts, card]],
  ])('lays out rows and columns, drawing %s', (_, order) => {
    const s = draw(order)
    const at = (id: string) => s.placed.find((p) => p.id === id)!.box
    const c = at('card')
    const left = c.x + 24
    const full = c.w - 48
    // Header: route over dates on the left, price on the right, tops level.
    expect(at('route').x).toBe(left)
    expect(at('travelers').x).toBe(left)
    expect(at('travelers').y).toBeGreaterThan(at('route').y)
    expect(at('price').y).toBe(at('route').y)
    expect(at('price').x).toBeGreaterThan(at('route').x + at('route').w)
    // Full-width rows, in order.
    for (const id of ['sep', 'name', 'num', 'pay']) expect([at(id).x, at(id).w]).toEqual([left, full])
    // Three fields side by side: each label above its own input, left edges shared.
    const fields = [['expL', 'exp'], ['cvcL', 'cvc'], ['ctyL', 'cty']]
    for (const [l, i] of fields) {
      expect(at(l).x).toBe(at(i).x)
      expect(at(i).y).toBe(at(l).y + at(l).h + 8)
    }
    expect(new Set(fields.map(([l]) => at(l).y)).size).toBe(1)
    expect(at('exp').x + at('exp').w).toBeLessThan(at('cvc').x)
    expect(at('cvc').x + at('cvc').w).toBeLessThan(at('cty').x)
    expect(at('cty').x + at('cty').w).toBeCloseTo(left + full)
    // Checkbox with its label in a row, then the button.
    expect(at('saveL').x).toBe(at('check').x + at('check').w + 8)
    const order2 = ['route', 'price', 'sep', 'name', 'num', 'exp', 'check', 'pay'].map((id) => at(id).y)
    expect(order2).toEqual([...order2].sort((a, b) => a - b))
    // Everything inside the card.
    for (const p of s.placed) if (p.id !== 'card') expect(p.box.y + p.box.h).toBeLessThanOrEqual(c.y + c.h)
  })
})

describe('text styles', () => {
  const place = (s: CanvasState, id: string, kind: 'label' | 'input', box: { x: number; y: number; w: number; h: number }) => {
    const st = boxStroke(box.x, box.y, box.w, box.h)
    return run([{ type: 'addStroke', stroke: st }, { type: 'closeGroup' }, { type: 'swap', id, strokeIds: [st.id], match: { kind, box, confidence: 1 } }], s)
  }
  const form = () => place(place(initialState, 'lbl', 'label', { x: 100, y: 100, w: 200, h: 20 }), 'in', 'input', { x: 100, y: 128, w: 300, h: 40 })
  const at = (s: CanvasState, id: string) => s.placed.find((p) => p.id === id)!

  it('steps a label up through body, subtitle and title, and stops at the ends', () => {
    let s = form()
    const seen = []
    for (let i = 0; i < 4; i++) {
      s = run([{ type: 'restyle', id: 'lbl', step: 1 }], s)
      seen.push([at(s, 'lbl').textStyle, at(s, 'lbl').box.h])
    }
    expect(seen).toEqual([['body', 24], ['subtitle', 28], ['title', 32], ['title', 32]])
    const down = run([{ type: 'restyle', id: 'lbl', step: -1 }, { type: 'restyle', id: 'lbl', step: -1 }, { type: 'restyle', id: 'lbl', step: -1 }, { type: 'restyle', id: 'lbl', step: -1 }, { type: 'restyle', id: 'lbl', step: -1 }], s)
    expect([at(down, 'lbl').textStyle, at(down, 'lbl').box.h]).toEqual(['help', 16])
  })

  it('re-flows what is below, with the standard gap under anything but a form label', () => {
    const s = form()
    expect(at(s, 'in').box.y).toBe(at(s, 'lbl').box.y + 20 + 8)
    const t = run([{ type: 'restyle', id: 'lbl', step: 1 }, { type: 'restyle', id: 'lbl', step: 1 }, { type: 'restyle', id: 'lbl', step: 1 }], s)
    expect(at(t, 'in').box.y).toBe(at(t, 'lbl').box.y + 32 + 16)
  })

  it('undoes a style change, putting everything back', () => {
    const s = form()
    const t = run([{ type: 'restyle', id: 'lbl', step: 1 }, { type: 'restyle', id: 'lbl', step: 1 }], s)
    expect(run([{ type: 'undo' }, { type: 'undo' }], t).placed).toEqual(s.placed)
  })

  it('leaves anything but a label alone', () => {
    const s = form()
    expect(run([{ type: 'restyle', id: 'in', step: 1 }], s)).toBe(s)
  })

  it('a copy keeps its style', () => {
    const s = run([{ type: 'restyle', id: 'lbl', step: 1 }, { type: 'duplicate', id: 'd' }], place(initialState, 'lbl', 'label', { x: 100, y: 100, w: 200, h: 20 }))
    expect(s.placed.map((p) => p.textStyle)).toEqual(['body', 'body'])
  })
})

describe('editing text', () => {
  const s = run([{ type: 'addStroke', stroke: boxStroke(100, 100, 140, 44) }, { type: 'closeGroup' }])
  const placed = run([{ type: 'swap', id: 'btn', strokeIds: [s.strokes[0].id], match: { kind: 'button', box: { x: 100, y: 100, w: 140, h: 44 }, confidence: 1 } }], s)
  const label = (st: CanvasState) => st.placed[0].label

  it('sets a component’s text, and undo puts the old text back', () => {
    const t = run([{ type: 'setText', id: 'btn', text: 'Pay now' }, { type: 'setText', id: 'btn', text: 'Pay' }], placed)
    expect(label(t)).toBe('Pay')
    expect(label(run([{ type: 'undo' }], t))).toBe('Pay now')
    expect(label(run([{ type: 'undo' }, { type: 'undo' }], t))).toBeUndefined()
  })

  it('empty text goes back to the default, and unchanged text adds no history', () => {
    const t = run([{ type: 'setText', id: 'btn', text: 'Pay now' }], placed)
    expect(label(run([{ type: 'setText', id: 'btn', text: '   ' }], t))).toBeUndefined()
    expect(run([{ type: 'setText', id: 'btn', text: 'Pay now' }], t)).toBe(t)
  })
})

describe('a sketch started inside a container', () => {
  type K = 'card' | 'label' | 'input' | 'button'
  const place = (s: CanvasState, id: string, kind: K, box: { x: number; y: number; w: number; h: number }, start?: { x: number; y: number }) => {
    const st = boxStroke(box.x, box.y, box.w, box.h)
    if (start) st.points = [{ ...start, z: 0.5 }, ...st.points]
    return run([{ type: 'addStroke', stroke: st }, { type: 'closeGroup' }, { type: 'swap', id, strokeIds: [st.id], match: { kind, box, confidence: 1 } }], s)
  }
  const at = (s: CanvasState, id: string) => s.placed.find((p) => p.id === id)!.box
  const inside = (o: { x: number; y: number; w: number; h: number }, b: typeof o) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h

  it('goes in it even when drawn past its edge, below what is already there', () => {
    let s = place(initialState, 'card', 'card', { x: 220, y: 150, w: 770, h: 300 })
    s = place(s, 'l1', 'label', { x: 270, y: 210, w: 160, h: 24 })
    s = place(s, 'i1', 'input', { x: 270, y: 262, w: 668, h: 76 })
    // Hangs over the card's bottom edge.
    s = place(s, 'i2', 'input', { x: 270, y: 420, w: 668, h: 76 }, { x: 300, y: 430 })
    const card = at(s, 'card')
    // Started near the bottom of the card, drawn mostly below it and off its left edge.
    const t = place(s, 'btn', 'button', { x: 200, y: card.y + card.h - 30, w: 320, h: 80 }, { x: 600, y: card.y + card.h - 25 })
    const c = at(t, 'card')
    for (const id of ['i2', 'btn']) expect(inside(c, at(t, id))).toBe(true)
    expect(at(t, 'btn').y).toBe(at(t, 'i2').y + at(t, 'i2').h + 16)
    expect(at(t, 'btn').x).toBe(c.x + 24)
    expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
  })

  it('grows a card that is too small to hold it', () => {
    const s = place(initialState, 'card', 'card', { x: 100, y: 100, w: 400, h: 80 })
    const t = place(s, 'in', 'input', { x: 130, y: 120, w: 300, h: 40 }, { x: 140, y: 125 })
    const t2 = place(t, 'in2', 'input', { x: 130, y: 160, w: 300, h: 60 }, { x: 140, y: 165 })
    const c = at(t2, 'card')
    for (const id of ['in', 'in2']) expect(inside(c, at(t2, id))).toBe(true)
    expect(c.h).toBeGreaterThan(80)
  })

  it('a box drawn around components is a card, whatever the recognizer guessed', () => {
    let s = place(initialState, 'l1', 'label', { x: 280, y: 200, w: 80, h: 24 })
    s = place(s, 'i1', 'input', { x: 280, y: 248, w: 386, h: 76 })
    const st = boxStroke(200, 125, 538, 294)
    const t = run(
      [
        { type: 'addStroke', stroke: st },
        { type: 'closeGroup' },
        { type: 'swap', id: 'box', strokeIds: [st.id], match: { kind: 'textarea', box: { x: 200, y: 125, w: 538, h: 294 }, confidence: 0.7, alternatives: [{ kind: 'card', p: 0.2 }] } },
      ],
      s,
    )
    const box = t.placed.find((p) => p.id === 'box')!
    expect(box.kind).toBe('card')
    expect(box.alternatives[0]).toEqual({ kind: 'textarea', p: 0.7 })
    for (const id of ['l1', 'i1']) expect(inside(box.box, at(t, id))).toBe(true)
  })

  it('an empty box is left to the recognizer', () => {
    const s = place(initialState, 'i1', 'input', { x: 900, y: 248, w: 300, h: 40 })
    const st = boxStroke(200, 125, 300, 100)
    const t = run(
      [
        { type: 'addStroke', stroke: st },
        { type: 'closeGroup' },
        { type: 'swap', id: 'ta', strokeIds: [st.id], match: { kind: 'textarea', box: { x: 200, y: 125, w: 300, h: 100 }, confidence: 0.7 } },
      ],
      s,
    )
    expect(t.placed.find((p) => p.id === 'ta')!.kind).toBe('textarea')
  })

  it('a component picked by name goes in the card under the point, and undo removes it', () => {
    const s = place(initialState, 'card', 'card', { x: 100, y: 100, w: 400, h: 240 })
    const t = run([{ type: 'insert', id: 'b', kind: 'button', at: { x: 300, y: 200 } }], s)
    const b = at(t, 'b')
    expect(inside(at(t, 'card'), b)).toBe(true)
    expect(b.x).toBe(at(t, 'card').x + 24)
    expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
  })

  it('a component picked from a gap (the blue line) slots in right there, and undo puts things back', () => {
    let s = place(initialState, 'card', 'card', { x: 100, y: 100, w: 420, h: 300 })
    s = place(s, 'l', 'label', { x: 130, y: 130, w: 120, h: 24 })
    s = place(s, 'i', 'input', { x: 130, y: 170, w: 360, h: 40 })
    s = place(s, 'b', 'button', { x: 130, y: 240, w: 360, h: 40 })
    const order = (t: CanvasState) => ['l', 'i', 'b', 'new'].sort((a, b) => at(t, a).y - at(t, b).y)
    for (const [lower, upper, kind] of [
      ['l', 'i', 'button'],
      ['i', 'b', 'button'],
      ['l', 'i', 'textarea'],
      ['i', 'b', 'textarea'],
    ] as const) {
      const gap = gapAt(s.placed, { x: 300, y: (at(s, lower).y + at(s, lower).h + at(s, upper).y) / 2 })!
      expect(gap).not.toBeNull()
      const t = run([{ type: 'insert', id: 'new', kind, at: { x: gap.x + gap.w / 2, y: gap.y }, gap }], s)
      const want = ['l', 'i', 'b']
      want.splice(want.indexOf(upper), 0, 'new')
      expect(order(t)).toEqual(want)
      expect(inside(at(t, 'card'), at(t, 'new'))).toBe(true)
      expect(at(t, 'new').x).toBe(at(t, 'i').x)
      expect(at(t, 'new').w).toBe(at(t, 'i').w)
      // Stacked with nothing overlapping.
      const ys = want.map((id) => at(t, id))
      for (let k = 1; k < ys.length; k++) expect(ys[k].y).toBeGreaterThanOrEqual(ys[k - 1].y + ys[k - 1].h)
      if (kind === 'textarea') expect(at(t, 'new').h).toBeGreaterThanOrEqual(60)
      expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
    }
  })

  it('in a card, the space before the first and after the last is a gap too', () => {
    let s = place(initialState, 'card', 'card', { x: 100, y: 100, w: 420, h: 300 })
    s = place(s, 'l', 'label', { x: 130, y: 130, w: 120, h: 24 })
    s = place(s, 'i', 'input', { x: 130, y: 170, w: 360, h: 40 })
    const card = at(s, 'card')
    const [l, i] = [at(s, 'l'), at(s, 'i')]
    const above = gapAt(s.placed, { x: 300, y: card.y + 6 })!
    const below = gapAt(s.placed, { x: 300, y: card.y + card.h - 6 })!
    expect(above.y).toBeGreaterThan(card.y)
    expect(above.y).toBeLessThan(l.y)
    expect(below.y).toBeGreaterThan(i.y + i.h)
    expect(below.y).toBeLessThan(card.y + card.h)
    for (const [gap, want] of [
      [above, ['new', 'l', 'i']],
      [below, ['l', 'i', 'new']],
    ] as const) {
      const t = run([{ type: 'insert', id: 'new', kind: 'button', at: { x: gap.x + gap.w / 2, y: gap.y }, gap }], s)
      expect(['l', 'i', 'new'].sort((a, b) => at(t, a).y - at(t, b).y)).toEqual(want)
      expect(inside(at(t, 'card'), at(t, 'new'))).toBe(true)
      expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
    }
  })

  it('finds no gap over a component or beside the stack', () => {
    let s = place(initialState, 'l', 'label', { x: 130, y: 130, w: 120, h: 24 })
    s = place(s, 'i', 'input', { x: 130, y: 170, w: 360, h: 40 })
    const i = at(s, 'i')
    expect(gapAt(s.placed, { x: i.x + 20, y: i.y + i.h / 2 })).toBeNull()
    expect(gapAt(s.placed, { x: i.x + i.w + 50, y: i.y - 4 })).toBeNull()
    // On the bare canvas there's no "before the first" or "after the last".
    expect(gapAt(s.placed, { x: i.x + 20, y: at(s, 'l').y - 10 })).toBeNull()
    expect(gapAt(s.placed, { x: i.x + 20, y: i.y + i.h + 10 })).toBeNull()
  })

  it('starting outside leaves it outside', () => {
    const s = place(initialState, 'card', 'card', { x: 100, y: 100, w: 400, h: 200 })
    const t = place(s, 'btn', 'button', { x: 600, y: 150, w: 120, h: 40 })
    expect(inside(at(t, 'card'), at(t, 'btn'))).toBe(false)
  })
})

describe('moving a component (edit mode)', () => {
  type K = 'card' | 'label' | 'input' | 'button'
  type B = { x: number; y: number; w: number; h: number }
  const place = (s: CanvasState, id: string, kind: K, box: B, start?: { x: number; y: number }) => {
    const st = boxStroke(box.x, box.y, box.w, box.h)
    if (start) st.points = [{ ...start, z: 0.5 }, ...st.points]
    return run([{ type: 'addStroke', stroke: st }, { type: 'closeGroup' }, { type: 'swap', id, strokeIds: [st.id], match: { kind, box, confidence: 1 } }], s)
  }
  const at = (s: CanvasState, id: string) => s.placed.find((p) => p.id === id)!.box
  const inside = (o: B, b: B) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h
  // The screenshot: a card holding two label + input groups, with a button
  // that ended up inside the second group, between its label and input.
  // Shift+drag a little way around components where they are now.
  const groupAround = (s: CanvasState, id: string, ids: string[]) => {
    const u = unionBoxes(ids.map((i) => at(s, i)))
    return run([{ type: 'group', id, box: { x: u.x - 6, y: u.y - 6, w: u.w + 12, h: u.h + 12 } }], s)
  }
  const setup = () => {
    let s = place(initialState, 'card', 'card', { x: 150, y: 170, w: 770, h: 530 })
    s = place(s, 'l1', 'label', { x: 200, y: 230, w: 160, h: 24 })
    s = place(s, 'i1', 'input', { x: 200, y: 270, w: 670, h: 60 })
    s = groupAround(s, 'g1', ['l1', 'i1'])
    s = place(s, 'l2', 'label', { x: 200, y: 400, w: 160, h: 24 })
    s = place(s, 'i2', 'input', { x: 200, y: 440, w: 670, h: 60 })
    s = groupAround(s, 'g2', ['l2', 'i2'])
    // Started just under the second label: it lands inside that group.
    const l2 = at(s, 'l2')
    return place(s, 'btn', 'button', { x: 200, y: l2.y + l2.h + 2, w: 670, h: 40 }, { x: 500, y: l2.y + l2.h + 4 })
  }

  it('drags a button out of a group to the bottom of the card', () => {
    const s = setup()
    const btn = at(s, 'btn')
    const g2 = at(s, 'g2')
    expect(inside(g2, btn)).toBe(true)
    const card = at(s, 'card')
    // Drop it below the group, still inside the card.
    const drop = { x: btn.x + 300, y: g2.y + g2.h + 30 }
    const t = run([{ type: 'move', id: 'btn', dx: 0, dy: drop.y - (btn.y + 10), at: drop }], s)
    const [nb, ng2, nc] = [at(t, 'btn'), at(t, 'g2'), at(t, 'card')]
    expect(inside(nc, nb)).toBe(true)
    expect(inside(ng2, nb)).toBe(false)
    expect(nb.y).toBe(ng2.y + ng2.h + 16)
    // The group closed up: label straight over its input again.
    expect(at(t, 'i2').y).toBe(at(t, 'l2').y + at(t, 'l2').h + 8)
    expect(nc.x).toBe(card.x)
    expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
  })

  it('drags something above another in the same column, and out of the card onto the canvas', () => {
    const s = setup()
    const g1 = at(s, 'g1')
    const btn = at(s, 'btn')
    // Above the first group.
    const up = { x: btn.x + 300, y: g1.y - 4 }
    const t = run([{ type: 'move', id: 'btn', dx: 0, dy: up.y - (btn.y + 20), at: up }], s)
    expect(at(t, 'btn').y + at(t, 'btn').h + 16).toBe(at(t, 'g1').y)
    // Out of the card altogether.
    const card = at(t, 'card')
    const out = { x: card.x + card.w + 200, y: card.y + 50 }
    const u = run([{ type: 'move', id: 'btn', dx: out.x - (at(t, 'btn').x + 10), dy: out.y - (at(t, 'btn').y + 10), at: out }], t)
    expect(inside(at(u, 'card'), at(u, 'btn'))).toBe(false)
    expect(at(u, 'g1').y).toBe(at(u, 'card').y + 24)
  })

  it('moving one of two out of a group dissolves the group; the other stays in the card', () => {
    const s = setup()
    const g1 = at(s, 'g1')
    const card = at(s, 'card')
    // The label of the first group, to the bottom of the card.
    const drop = { x: g1.x + 300, y: card.y + card.h - 20 }
    const l1 = at(s, 'l1')
    const t = run([{ type: 'move', id: 'l1', dx: drop.x - (l1.x + 10), dy: drop.y - (l1.y + 10), at: drop }], s)
    expect(t.placed.some((p) => p.id === 'g1')).toBe(false)
    expect(inside(at(t, 'card'), at(t, 'i1'))).toBe(true)
    expect(inside(at(t, 'card'), at(t, 'l1'))).toBe(true)
    expect(at(t, 'i1').y).toBe(at(t, 'card').y + 24)
    expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
  })

  it('moving the only thing out of a group removes the group, and undo brings it back', () => {
    let s = place(initialState, 'btn', 'button', { x: 100, y: 100, w: 120, h: 40 })
    s = run([{ type: 'group', id: 'g', box: { x: 90, y: 90, w: 150, h: 60 } }], s)
    const t = run([{ type: 'move', id: 'btn', dx: 300, dy: 200, at: { x: 450, y: 320 } }], s)
    expect(t.placed.map((p) => p.id)).toEqual(['btn'])
    expect(run([{ type: 'undo' }], t).placed).toEqual(s.placed)
  })
})
