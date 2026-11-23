import { describe, expect, it } from 'vitest'
import type { Box } from '@/lib/geometry'
import { PHONE, PHONE_INSETS, type PlacedKind } from './frames'
import { arrange, GAP, LABEL_GAP, naturalBox, PADDING, ROW_GAP, snapSize, SPINNER_SIZES, stackOrder, type Item } from './layout'

const item = (id: string, kind: PlacedKind, drawn: Box): Item => ({ id, kind, box: naturalBox(kind, drawn) })
/** Every item's box after arranging around `id`. */
const after = (items: Item[], id: string) => {
  const moved = arrange(items, id)
  return Object.fromEntries(items.map((i) => [i.id, moved.get(i.id) ?? i.box]))
}

describe('naturalBox', () => {
  it('shrinks standard-height controls to 36px around the sketch centre', () => {
    expect(naturalBox('input', { x: 10, y: 100, w: 300, h: 100 })).toEqual({ x: 10, y: 132, w: 300, h: 36 })
  })
  it('leaves containers as drawn', () => {
    const drawn = { x: 0, y: 0, w: 400, h: 300 }
    expect(naturalBox('card', drawn)).toEqual(drawn)
  })
  it('gives fixed-size controls their real size', () => {
    expect(naturalBox('checkbox', { x: 0, y: 0, w: 40, h: 40 })).toEqual({ x: 12, y: 12, w: 16, h: 16 })
  })
})

describe('arrange', () => {
  it('turns a label, input and select drawn in a rough column into a tidy stack', () => {
    // From the bug report: label drawn off to the right, select indented, uneven gaps.
    const items = [
      item('label', 'label', { x: 240, y: 100, w: 90, h: 30 }),
      item('input', 'input', { x: 143, y: 173, w: 470, h: 64 }),
      item('select', 'select', { x: 153, y: 280, w: 468, h: 64 }),
    ]
    const b = after(items, 'select')
    // Left-aligned, full width.
    for (const id of ['label', 'input', 'select']) {
      expect(b[id].x).toBe(143)
      expect(b[id].w).toBe(621 - 143)
    }
    // Standard gaps, whatever was drawn; top stays put.
    expect(b.label.y).toBe(items[0].box.y)
    expect(b.input.y - (b.label.y + b.label.h)).toBe(LABEL_GAP)
    expect(b.select.y - (b.input.y + b.input.h)).toBe(GAP)
  })

  it('left-aligns fixed-size items in a column without stretching them', () => {
    const items = [item('input', 'input', { x: 100, y: 100, w: 300, h: 40 }), item('check', 'checkbox', { x: 120, y: 160, w: 30, h: 30 })]
    const b = after(items, 'check')
    expect(b.check).toMatchObject({ x: 100, w: 16 })
  })

  it('leaves components far apart alone', () => {
    const items = [item('a', 'input', { x: 100, y: 100, w: 300, h: 40 }), item('b', 'input', { x: 500, y: 600, w: 300, h: 40 })]
    expect(arrange(items, 'b').size).toBe(0)
  })

  it('ignores drawn spacing: wide and tight gaps come out the same', () => {
    const wide = [item('a', 'input', { x: 100, y: 100, w: 300, h: 40 }), item('b', 'input', { x: 100, y: 190, w: 300, h: 40 })]
    const tight = [item('a', 'input', { x: 100, y: 100, w: 300, h: 40 }), item('b', 'input', { x: 100, y: 145, w: 300, h: 40 })]
    expect(after(wide, 'b')).toEqual(after(tight, 'b'))
  })

  it('lays out content inside a card at its padding, spanning its width', () => {
    const items = [
      item('card', 'card', { x: 0, y: 0, w: 400, h: 300 }),
      item('a', 'input', { x: 60, y: 70, w: 200, h: 40 }),
      item('b', 'input', { x: 80, y: 150, w: 250, h: 40 }),
    ]
    const b = after(items, 'b')
    expect(b.card).toEqual(items[0].box)
    expect(b.a).toEqual({ x: PADDING, y: PADDING, w: 400 - 2 * PADDING, h: 36 })
    expect(b.b).toEqual({ x: PADDING, y: PADDING + 36 + GAP, w: 400 - 2 * PADDING, h: 36 })
  })

  it('grows a card when its content no longer fits', () => {
    const items = [
      item('card', 'card', { x: 0, y: 0, w: 400, h: 120 }),
      item('a', 'input', { x: 30, y: 20, w: 330, h: 40 }),
      item('b', 'input', { x: 30, y: 70, w: 330, h: 40 }),
    ]
    const b = after(items, 'b')
    expect(b.card.h).toBe(b.b.y + b.b.h + PADDING)
  })

  it('snaps a lone component to a nearby edge', () => {
    // Too far below to stack, but drawn almost in line.
    const items = [item('a', 'card', { x: 100, y: 100, w: 200, h: 200 }), item('b', 'button', { x: 112, y: 420, w: 100, h: 40 })]
    expect(after(items, 'b').b.x).toBe(100)
  })
})

describe('rows', () => {
  const mid = (b: Box) => b.y + b.h / 2

  it('groups a switch and label side by side, a standard gap apart and centred', () => {
    // From the bug report: label drawn well to the right and a bit lower.
    const items = [item('switch', 'switch', { x: 165, y: 160, w: 72, h: 40 }), item('label', 'label', { x: 280, y: 182, w: 85, h: 30 })]
    const b = after(items, 'label')
    expect(b.switch.x).toBe(items[0].box.x)
    expect(b.label.x).toBe(b.switch.x + b.switch.w + ROW_GAP)
    expect(mid(b.label)).toBe(mid(b.switch))
  })

  it('ignores drawn spacing between row items', () => {
    const near = [item('a', 'button', { x: 0, y: 0, w: 100, h: 40 }), item('b', 'button', { x: 110, y: 5, w: 100, h: 40 })]
    const far = [item('a', 'button', { x: 0, y: 0, w: 100, h: 40 }), item('b', 'button', { x: 190, y: -6, w: 100, h: 40 })]
    expect(after(near, 'b')).toEqual(after(far, 'b'))
  })

  it('stacks a row in a column as one item, without stretching it', () => {
    const items = [
      item('input', 'input', { x: 100, y: 100, w: 300, h: 40 }),
      item('switch', 'switch', { x: 110, y: 160, w: 60, h: 36 }),
      item('label', 'label', { x: 200, y: 165, w: 80, h: 30 }),
    ]
    const b = after(items, 'label')
    expect(b.input.w).toBe(300)
    expect(b.switch.x).toBe(100)
    expect(Math.min(b.switch.y, b.label.y)).toBe(b.input.y + b.input.h + GAP)
    expect(b.label.x).toBe(100 + b.switch.w + ROW_GAP)
    expect(b.label.w).toBe(80)
    expect(mid(b.label)).toBe(mid(b.switch))
  })
})

describe('drawing a card around components', () => {
  const form = () => [
    item('input', 'input', { x: 100, y: 100, w: 300, h: 40 }),
    item('select', 'select', { x: 110, y: 160, w: 290, h: 40 }),
  ]

  it('lays out what it holds at its padding, and hugs its height', () => {
    const items = [...form(), item('card', 'card', { x: 70, y: 60, w: 360, h: 300 })]
    const b = after(items, 'card')
    expect(b.input).toEqual({ x: 70 + PADDING, y: 60 + PADDING, w: 360 - 2 * PADDING, h: 36 })
    expect(b.select).toEqual({ ...b.input, y: b.input.y + 36 + GAP })
    expect(b.card).toEqual({ x: 70, y: 60, w: 360, h: 2 * PADDING + 36 + GAP + 36 })
  })

  it('hugs the same height however loosely it was drawn', () => {
    const loose = after([...form(), item('card', 'card', { x: 20, y: 20, w: 500, h: 500 })], 'card')
    const snug = after([...form(), item('card', 'card', { x: 70, y: 60, w: 360, h: 200 })], 'card')
    expect(loose.card.h).toBe(snug.card.h)
  })

  it('sits beneath what it holds', () => {
    const items = [...form(), item('card', 'card', { x: 70, y: 60, w: 360, h: 200 })]
    expect(stackOrder(items).map((i) => i.id)).toEqual(['card', 'input', 'select'])
  })
})

describe('phone frame', () => {
  const phone = item('phone', 'phone', { x: 100, y: 50, ...PHONE })
  const contentLeft = 100 + PHONE_INSETS.left
  const contentRight = 100 + PHONE.w - PHONE_INSETS.right

  it('puts the first thing drawn in it at the top of the screen, full width', () => {
    const items = [phone, item('input', 'input', { x: 160, y: 300, w: 120, h: 40 })]
    expect(after(items, 'input').input).toEqual({ x: contentLeft, y: 50 + PHONE_INSETS.top, w: contentRight - contentLeft, h: 36 })
  })

  it('claims a sketch that spills over its edge, as long as its centre is inside', () => {
    const items = [phone, item('input', 'input', { x: 80, y: 300, w: 200, h: 40 })]
    const box = after(items, 'input').input
    expect(box.x).toBe(contentLeft)
    expect(box.x + box.w).toBe(contentRight)
  })

  it('keeps its size when content runs past the bottom', () => {
    const items = [phone, ...Array.from({ length: 20 }, (_, i) => item(`b${i}`, 'button', { x: 150, y: 80 + i * 40, w: 120, h: 36 }))]
    const boxes = after(items, 'b19')
    expect(boxes.phone).toEqual(phone.box)
  })

  it('leaves things drawn outside it alone', () => {
    const items = [phone, item('input', 'input', { x: 600, y: 300, w: 120, h: 40 })]
    expect(after(items, 'input').input).toEqual(items[1].box)
  })
})

describe('snapSize', () => {
  const box = (w: number, h = w) => ({ x: 0, y: 0, w, h })

  it('renders similar sketches at the same standard size', () => {
    // Two spinners from an earlier bug report, drawn at about 70px and 50px.
    expect(snapSize(box(70), SPINNER_SIZES)).toBe(24)
    expect(snapSize(box(50), SPINNER_SIZES)).toBe(24)
  })

  it('uses the shorter side, and still lets a deliberately big or small sketch through', () => {
    expect(snapSize(box(200, 50), SPINNER_SIZES)).toBe(24)
    expect(snapSize(box(20), SPINNER_SIZES)).toBe(16)
    expect(snapSize(box(240), SPINNER_SIZES)).toBe(48)
  })
})
