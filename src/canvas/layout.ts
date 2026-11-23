import { area, center, containsBox, type Box } from '@/lib/geometry'
import type { ComponentKind } from '@/recognize/types'
import { GROUP_INSETS, isFixedSize, isFrame, PHONE_INSETS, type Insets, type PlacedKind } from './frames'
import { textStyleInfo, type TextStyle } from './textStyles'

/*
 * Auto layout: when a sketch becomes a component, tidy where things land.
 *
 * 1. Real size. Controls with a standard size (a 36px input, a 16px checkbox)
 *    shrink to it around the sketch's centre, so the math works on what you
 *    see rather than how big you drew it.
 * 2. Stacks. Components drawn one under another, overlapping horizontally
 *    and close together, form a column, like a flex column: left-aligned,
 *    resizable children all as wide as the widest, a standard gap apart.
 *    Adding to a column re-lays out the whole column.
 * 2b. Rows. Components side by side, close together and roughly level,
 *    form a row: centred on each other vertically, a standard gap apart,
 *    left to right from the first one. A row then acts as one item in a
 *    column, so a switch-and-label row stacks under an input.
 * 3. Containers. Inside a card, content sits at the card's padding and
 *    resizable children span its width, like a flex column with padding.
 *    A card drawn around components wraps them: it keeps its drawn width,
 *    and its height hugs them. A card that gets more content than fits
 *    grows to hold it. Containers always sit
 *    beneath what they hold.
 * 3b. Frames. Anything whose centre lands in a frame belongs to it. A phone
 *    frame is a fixed-size container: content goes inside its screen (under
 *    the status bar, 16px side padding), and it never grows or hugs. A group
 *    (Shift+drag) is a card with no padding and no look: a bare flex column.
 *
 * Sketches say what goes where, not how far apart: spacing always comes from
 * the standards below, never from the distances as drawn.
 * 4. Loners. A component in no column snaps its edges to nearby components.
 */

/** How close (px) a drawn edge must be to a line to snap to it. */
export const EDGE_SNAP = 20
/** Components further apart than this vertically aren't in the same column. */
export const MAX_GAP = 96
/** The gap between items in a column (gap-4). */
export const GAP = 16
/** The gap between items in a row (gap-2), like a switch and its label. */
export const ROW_GAP = 8
/** Components further apart than this horizontally aren't in the same row. */
export const MAX_ROW_GAP = 96
/** How far two components' vertical extents may miss each other and still be in a row. */
export const ROW_SLACK = 16
/** A label sits closer to the control under it (gap-2), like a form field. */
export const LABEL_GAP = 8
/** Inner padding of a container, like a card's (p-6). */
export const PADDING = 24

/**
 * Size bands for components that scale with the sketch: a sketch whose shorter
 * side is under `drawn` px renders at `size` px. People draw several times
 * bigger than the real thing and their sizes wobble, so the bands are wide and
 * two similar sketches come out identical.
 */
export type SizeBands = { drawn: number; size: number }[]
export const SPINNER_SIZES: SizeBands = [
  { drawn: 36, size: 16 },
  { drawn: 100, size: 24 },
  { drawn: 160, size: 32 },
  { drawn: Infinity, size: 48 },
]
export const AVATAR_SIZES: SizeBands = [
  { drawn: 36, size: 24 },
  { drawn: 90, size: 32 },
  { drawn: 140, size: 40 },
  { drawn: 200, size: 64 },
  { drawn: Infinity, size: 96 },
]

export function snapSize(box: Box, bands: SizeBands): number {
  const drawn = Math.min(box.w, box.h)
  return bands.find((b) => drawn < b.drawn)!.size
}

/** Controls that take the sketch's width but have a fixed height (px). */
const FIXED_HEIGHT: Partial<Record<ComponentKind, number>> = {
  label: 20,
  button: 36,
  input: 36,
  'input-group': 36,
  select: 36,
  'native-select': 36,
  combobox: 36,
  // Overlays render as their trigger button.
  'alert-dialog': 36,
  dialog: 36,
  drawer: 36,
  'dropdown-menu': 36,
  popover: 36,
  sheet: 36,
  sonner: 36,
  tooltip: 36,
}

/** Controls with a fixed width and height (px). */
function fixedSize(kind: PlacedKind, drawn: Box): { w: number; h: number } | null {
  switch (kind) {
    case 'checkbox':
      return { w: 16, h: 16 }
    case 'switch':
      return { w: 32, h: 18 }
    case 'toggle':
      return { w: 36, h: 36 }
    case 'spinner': {
      const s = snapSize(drawn, SPINNER_SIZES)
      return { w: s, h: s }
    }
    case 'avatar': {
      const s = snapSize(drawn, AVATAR_SIZES)
      return { w: s, h: s }
    }
    default:
      return null
  }
}

/** The box the real component occupies, centred where the sketch was. */
export function naturalBox(kind: PlacedKind, drawn: Box, textStyle?: TextStyle): Box {
  if (isFrame(kind)) return drawn
  const c = center(drawn)
  const size = fixedSize(kind, drawn)
  if (size) return { x: c.x - size.w / 2, y: c.y - size.h / 2, ...size }
  const h = kind === 'label' ? textStyleInfo(textStyle).height : FIXED_HEIGHT[kind]
  if (h) return { x: drawn.x, y: c.y - h / 2, w: drawn.w, h }
  return drawn
}

const right = (b: Box) => b.x + b.w
const bottom = (b: Box) => b.y + b.h
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)

/** The nearest line to `value` within `range`, or null. */
function nearest(value: number, lines: number[], range = EDGE_SNAP): number | null {
  let best: number | null = null
  for (const l of lines) {
    if (Math.abs(l - value) <= range && (best === null || Math.abs(l - value) < Math.abs(best - value))) best = l
  }
  return best
}

/** A frame claims anything centred in it, so a sketch spilling over its edge still lands inside. */
function holds(container: Item, b: Box): boolean {
  if (!isFrame(container.kind)) return containsBox(container.box, b, 8)
  const c = center(b)
  const o = container.box
  return c.x >= o.x && c.x <= right(o) && c.y >= o.y && c.y <= bottom(o)
}

/** Where content sits inside a container. */
function insetsOf(container: Item): Insets {
  if (container.kind === 'phone') return PHONE_INSETS
  if (container.kind === 'group') return GROUP_INSETS
  return { top: PADDING, right: PADDING, bottom: PADDING, left: PADDING }
}

const isResizable = (kind: PlacedKind) => fixedSize(kind, { x: 0, y: 0, w: 0, h: 0 }) === null

/** Anything laid out: a placed component's id, kind and current box. */
export interface Item {
  id: string
  kind: PlacedKind
  box: Box
  /** Where it was drawn. Layout decisions are made from this, not from where layout last put it. */
  drawnBox?: Box
  /** For a label: which kind of text, which sets its height. */
  textStyle?: TextStyle
}

/** A form label sits closer to the control under it; other text gets the standard gap. */
const hugsNext = (i: Item | null | undefined) => i?.kind === 'label' && (i.textStyle ?? 'label') === 'label'

/** Only these hold other components; an input that happens to overlap a label doesn't. */
const canContain = (kind: PlacedKind) => kind === 'card' || isFrame(kind)

/** The tightest card, group or phone under a point, bigger than `minArea`. */
export function containerAt<T extends Item>(items: T[], p: { x: number; y: number }, minArea = 0): T | undefined {
  const inside = (b: Box) => p.x >= b.x && p.x <= right(b) && p.y >= b.y && p.y <= bottom(b)
  return items.filter((o) => canContain(o.kind) && inside(o.box) && area(o.box) > minArea).sort((a, b) => area(a.box) - area(b.box))[0]
}

/**
 * A sketch belongs to the container it was started in. Drawn past the
 * container's edge (a button sketched at the bottom of a card that has
 * shrunk to its fields), it wouldn't count as inside by its box, so move
 * the new items into the container's content area, and grow the container
 * if they're still too big. Layout then gives them their place in it.
 * `start` is where the sketch's first stroke began.
 */
export function settleInto<T extends Item & { drawnBox: Box }>(existing: T[], added: T[], start: { x: number; y: number }): { existing: T[]; added: T[] } {
  const unchanged = { existing, added }
  if (!added.length) return unchanged
  const u = unionOf(added.map((a) => a.box))
  const host = containerAt(existing, start, area(u))
  if (!host || added.every((a) => holds(host, a.box))) return unchanged

  const inset = insetsOf(host)
  const c = { x: host.box.x + inset.left, y: host.box.y + inset.top, w: host.box.w - inset.left - inset.right, h: host.box.h - inset.top - inset.bottom }
  // Shift the sketch, as one piece, the least that brings it inside (top-left first if it's too big).
  const shift = (lo: number, size: number, cLo: number, cSize: number) =>
    lo < cLo || size > cSize ? cLo - lo : lo + size > cLo + cSize ? cLo + cSize - (lo + size) : 0
  const dx = shift(u.x, u.w, c.x, c.w)
  const dy = shift(u.y, u.h, c.y, c.h)
  const fit = (b: Box) => {
    const moved = { ...b, x: b.x + dx, y: b.y + dy }
    return moved.w > c.w ? { ...moved, x: c.x, w: c.w } : moved
  }
  const settled = added.map((a) => ({ ...a, box: fit(a.box), drawnBox: fit(a.drawnBox) }))
  const need = Math.max(...settled.map((a) => bottom(a.box))) + inset.bottom - host.box.y
  if (need <= host.box.h || isFixedSize(host.kind)) return { existing, added: settled }
  return { existing: existing.map((o) => (o === host ? { ...o, box: { ...o.box, h: need } } : o)), added: settled }
}

/** The tightest item that contains `b`: its container, if any. */
export function parentOf<T extends Item>(b: T, items: T[]): T | undefined {
  return items
    .filter((o) => o !== b && canContain(o.kind) && encloses(o, b) && holds(o, b.box))
    .sort((x, y) => area(x.box) - area(y.box))[0]
}

/**
 * Big enough to be `b`'s container. A group hugs its content with no padding,
 * so a group of one is exactly its member's size; it still holds it.
 */
function encloses(o: Item, b: Item): boolean {
  const a = area(o.box)
  const ab = area(b.box)
  return a > ab || (a === ab && o.kind === 'group' && !isFrame(b.kind))
}

/** Two boxes sit one above the other, overlapping horizontally, close together. */
function stacked(a: Box, b: Box): boolean {
  const xs = overlap(a.x, right(a), b.x, right(b))
  const gap = -overlap(a.y, bottom(a), b.y, bottom(b))
  return (xs > 0 || Math.abs(a.x - b.x) <= EDGE_SNAP) && gap >= -4 && gap <= MAX_GAP
}

/** Two boxes sit side by side, roughly level, close together. */
function beside(a: Box, b: Box): boolean {
  const gap = -overlap(a.x, right(a), b.x, right(b))
  return gap >= -4 && gap <= MAX_ROW_GAP && overlap(a.y, bottom(a), b.y, bottom(b)) > -ROW_SLACK
}

/** Everything in `pool` linked to `start` by `linked`, directly or through others. */
function cluster<T>(start: T, pool: T[], linked: (a: T, b: T) => boolean): T[] {
  const group = new Set([start])
  let grew = true
  while (grew) {
    grew = false
    for (const p of pool) {
      if (group.has(p)) continue
      if ([...group].some((g) => linked(g, p))) {
        group.add(p)
        grew = true
      }
    }
  }
  return [...group]
}

/** A row of side-by-side items, or a single item: what a column stacks. */
interface Unit {
  members: Item[]
  box: Box
}

const unionOf = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return { x, y, w: Math.max(...boxes.map(right)) - x, h: Math.max(...boxes.map(bottom)) - y }
}

/** Lay a row out left to right from its first item, centred on its tallest. */
function layoutRow(members: Item[]): Item[] {
  const sorted = [...members].sort((a, b) => a.box.x - b.box.x)
  const tallest = sorted.reduce((t, m) => (m.box.h > t.box.h ? m : t))
  const mid = center(tallest.box).y
  let x = sorted[0].box.x
  return sorted.map((m) => {
    const box = { ...m.box, x, y: mid - m.box.h / 2 }
    x += m.box.w + ROW_GAP
    return { ...m, box }
  })
}

/** Group siblings into units: each row laid out, everything else on its own. */
function unitsOf(siblings: Item[]): Unit[] {
  const units: Unit[] = []
  const seen = new Set<Item>()
  for (const s of siblings) {
    if (seen.has(s)) continue
    const row = cluster(s, siblings, (a, b) => beside(a.box, b.box))
    // Things on top of each other aren't a row, even if each sits beside the
    // same neighbour (a label over an input, both right of a group).
    const isRow = row.length > 1 && row.every((a) => row.every((b) => a === b || overlap(a.box.x, right(a.box), b.box.x, right(b.box)) <= 4))
    if (!isRow) {
      seen.add(s)
      units.push({ members: [s], box: s.box })
      continue
    }
    row.forEach((m) => seen.add(m))
    const members = layoutRow(row)
    units.push({ members, box: unionOf(members.map((m) => m.box)) })
  }
  return units
}

/**
 * Lay out the canvas after `id` was placed or changed. Returns new boxes for
 * every item that moved.
 *
 * Containment is worked out once, from the boxes as they are, so moving
 * things around can't change what belongs to what mid-pass. Then:
 * 1. If `id` holds components (a card or group drawn around them), lay them
 *    out inside it and hug them.
 * 2. Walk up through its containers, re-laying out each one's contents.
 * 3. At the top level, tidy the column the outermost one is in, or snap it.
 * Moving a container always moves everything inside it.
 */
export function arrange(items: Item[], id: string): Map<string, Box> {
  const byId = new Map(items.map((i) => [i.id, i]))
  if (!byId.has(id)) return new Map()
  const parent = new Map(items.map((i) => [i.id, parentOf(i, items)?.id]))
  const boxes = new Map(items.map((i) => [i.id, i.box]))
  const cur = (key: string): Item => ({ ...byId.get(key)!, box: boxes.get(key)! })
  const kids = (key: string | undefined) => items.filter((i) => parent.get(i.id) === key).map((i) => cur(i.id))
  // What layout reasons from: everything where it was drawn, so earlier
  // tidying (a label nudged into a row, a group stretched across a card)
  // can't snowball into later decisions. A leaf is at its real size where
  // it was drawn. A container is where it was drawn (a group: around its
  // members as drawn) but as tall as it now is, since its height is fitted.
  const asDrawn = (i: Item): Item => {
    const inner = kids(i.id)
    if (!inner.length) return i.drawnBox ? { ...i, box: naturalBox(i.kind, i.drawnBox, i.textStyle) } : i
    if (isFixedSize(i.kind)) return i
    const at = i.kind === 'group' ? unionOf(inner.map((k) => asDrawn(k).box)) : (i.drawnBox ?? i.box)
    return { ...i, box: { x: at.x, y: at.y, w: at.w, h: i.box.h } }
  }
  const descendants = (key: string): Item[] => kids(key).flatMap((k) => [k, ...descendants(k.id)])

  const move = (key: string, box: Box) => {
    const was = boxes.get(key)!
    const dx = box.x - was.x
    const dy = box.y - was.y
    if (dx || dy) {
      for (const d of descendants(key)) boxes.set(d.id, { ...d.box, x: d.box.x + dx, y: d.box.y + dy })
    }
    boxes.set(key, box)
  }

  // Fit a container's height to its content. A group always hugs; a card
  // drawn around components hugs, but one filled in afterwards only grows,
  // so a card drawn first keeps its room; a phone keeps its size.
  const fit = (key: string, hug: boolean) => {
    const c = cur(key)
    const content = kids(key)
    if (!content.length || isFixedSize(c.kind)) return
    const h = Math.max(...content.map((k) => bottom(k.box))) + insetsOf(c).bottom - c.box.y
    if (hug || c.kind === 'group' || h > c.box.h) boxes.set(key, { ...c.box, h })
  }

  // Inner containers first (their height sets the gaps), then this one's
  // children; twice, since placing a child container can change its width.
  const layoutInside = (key: string, hug: boolean) => {
    for (let pass = 0; pass < 2; pass++) {
      for (const k of kids(key)) if (kids(k.id).length) layoutInside(k.id, false)
      for (const [kid, box] of placeChildren(cur(key), kids(key).map(asDrawn))) move(kid, box)
    }
    fit(key, hug)
  }

  if (kids(id).length) layoutInside(id, true)
  let root = id
  for (let c = parent.get(id); c; c = parent.get(c)) {
    layoutInside(c, false)
    root = c
  }

  const top = kids(undefined).map(asDrawn)
  for (const [key, box] of arrangeOne(top, root)) {
    const widened = box.w !== boxes.get(key)!.w
    move(key, box)
    if (widened && kids(key).length) layoutInside(key, false)
  }

  const moved = new Map<string, Box>()
  for (const i of items) if (!sameBox(boxes.get(i.id)!, i.box)) moved.set(i.id, boxes.get(i.id)!)
  return moved
}

/**
 * Where a container's children go, like nested flex boxes inside its
 * padding: rows top to bottom with standard gaps, a row split into
 * equal-width columns where its parts sit side by side, resizable children
 * as wide as their column (see placeBlock).
 */
function placeChildren(container: Item, children: Item[]): Map<string, Box> {
  const out = new Map<string, Box>()
  if (!children.length) return out
  const inset = insetsOf(container)
  placeBlock(children, container.box.x + inset.left, container.box.w - inset.left - inset.right, container.box.y + inset.top, out)
  return out
}

/** Overlaps smaller than this are a sloppy edge, not a real overlap. */
const BAND_SLACK = 4

/**
 * Split items into bands along an axis: runs of items whose extents chain
 * together, with a clean gap (nothing crossing it) between one band and the
 * next. Along y these are rows, along x columns.
 */
function bands(items: Item[], axis: 'x' | 'y'): Item[][] {
  const start = (i: Item) => (axis === 'x' ? i.box.x : i.box.y)
  const end = (i: Item) => (axis === 'x' ? right(i.box) : bottom(i.box))
  const out: Item[][] = []
  let edge = -Infinity
  for (const i of [...items].sort((a, b) => start(a) - start(b))) {
    if (out.length && start(i) < edge - BAND_SLACK) out[out.length - 1].push(i)
    else out.push([i])
    edge = out[out.length - 1].length === 1 ? end(i) : Math.max(edge, end(i))
  }
  return out
}

/**
 * Rows of a block. Neighbouring rows that share columns are one row: a row
 * of labels over a row of inputs is a row of label-over-input fields, and a
 * label drawn a little higher than the field beside it doesn't split off.
 */
function rowsOf(items: Item[]): Item[][] {
  const cols = (group: Item[]) => bands(group, 'x').length
  const rows: Item[][] = []
  for (const row of bands(items, 'y')) {
    const prev = rows[rows.length - 1]
    if (prev && sideBySide(prev, row, cols)) rows[rows.length - 1] = [...prev, ...row]
    else rows.push(row)
  }
  return rows
}

/**
 * Whether two neighbouring rows are really one: they line up into the same
 * columns, or together they make new columns that sit further apart than the
 * rows do (a big heading drawn a little lower than the text beside it).
 * Further below than beside means stacked, like an indented label.
 */
function sideBySide(above: Item[], below: Item[], cols: (g: Item[]) => number): boolean {
  const both = [...above, ...below]
  const n = cols(both)
  const most = Math.max(cols(above), cols(below))
  if (n < 2 || n < most) return false
  if (n === most) return true
  const rowGap = Math.min(...below.map((i) => i.box.y)) - Math.max(...above.map((i) => bottom(i.box)))
  const columns = bands(both, 'x').map((c) => unionOf(c.map((i) => i.box))).sort((a, b) => a.x - b.x)
  const colGap = Math.min(...columns.slice(1).map((c, i) => c.x - right(columns[i])))
  return rowGap < colGap
}

/**
 * Lay out a block of items within `width` from (`left`, `top`), returning its
 * bottom. Cut it into rows where nothing crosses between them, and a row into
 * columns where nothing crosses between those, then do the same inside each,
 * so full-width fields, a two-column header and a three-column row of fields
 * can share one card.
 */
function placeBlock(items: Item[], left: number, width: number, top: number, out: Map<string, Box>): number {
  const rows = rowsOf(items)
  if (rows.length > 1) {
    let y = top
    let end = top
    for (const row of rows) {
      end = placeBlock(row, left, width, y, out)
      y = end + (row.length === 1 && hugsNext(row[0]) ? LABEL_GAP : GAP)
    }
    return end
  }
  const cols = bands(items, 'x').sort((a, b) => Math.min(...a.map((i) => i.box.x)) - Math.min(...b.map((i) => i.box.x)))
  if (cols.length === 1) return placeColumn(unitsOf(items), left, width, top, out)
  // Single small things side by side (a checkbox and its label, a label
  // beside one field) are an inline row at their own sizes, not columns.
  const stretchy = cols.filter((c) => c.length > 1 || (isResizable(c[0].kind) && c[0].kind !== 'label'))
  if (stretchy.length <= 1 && cols.every((c) => c.length === 1)) {
    const members = layoutRow(items)
    return placeColumn([{ members, box: unionOf(members.map((m) => m.box)) }], left, width, top, out)
  }
  const w = (width - GAP * (cols.length - 1)) / cols.length
  return Math.max(...cols.map((col, i) => placeBlock(col, left + i * (w + GAP), w, top, out)))
}

/** Stack units top to bottom from `top`; single resizable items span `width`. Returns the bottom. */
function placeColumn(units: Unit[], left: number, width: number, top: number, out: Map<string, Box>): number {
  let y = top
  let end = top
  for (const u of [...units].sort((a, b) => a.box.y - b.box.y)) {
    const one = u.members.length === 1 ? u.members[0] : null
    const dx = left - u.box.x
    const dy = y - u.box.y
    for (const m of u.members) {
      out.set(
        m.id,
        one ? { x: left, y, w: isResizable(one.kind) ? width : m.box.w, h: m.box.h } : { ...m.box, x: m.box.x + dx, y: m.box.y + dy },
      )
    }
    end = y + u.box.h
    y = end + (hugsNext(one) ? LABEL_GAP : GAP)
  }
  return end
}

/** Order items so containers come before (beneath) what they hold. Stable otherwise. */
export function stackOrder<T extends Item>(items: T[]): T[] {
  const depth = (i: T) => {
    let d = 0
    for (let p = parentOf(i, items); p; p = parentOf(p, items)) d++
    return d
  }
  const depths = new Map(items.map((i) => [i.id, depth(i)]))
  return [...items].sort((a, b) => depths.get(a.id)! - depths.get(b.id)!)
}

function arrangeOne(items: Item[], id: string): Map<string, Box> {
  const moved = new Map<string, Box>()
  const item = items.find((i) => i.id === id)
  if (!item) return moved
  const container = parentOf(item, items)
  const siblings = items.filter((o) => o !== container && parentOf(o, items) === container)
  const units = unitsOf(siblings)
  const unit = units.find((u) => u.members.some((m) => m.id === id))!
  // In a group the user said these belong together, so everything in it is
  // one column however far apart it was drawn.
  const column = (container?.kind === 'group' ? units : cluster(unit, units, (a, b) => stacked(a.box, b.box))).sort(
    (a, b) => a.box.y - b.box.y,
  )
  // Every placement is recorded; arrange keeps only real changes.
  const place = (m: Item, box: Box) => moved.set(m.id, box)
  const single = (u: Unit) => (u.members.length === 1 ? u.members[0] : null)

  if (column.length === 1 && !container) {
    const only = single(unit)
    if (only) place(only, snapAlone(only, siblings))
    else unit.members.forEach((m) => place(m, m.box))
    return moved
  }

  // A column: left edge, width and gaps shared by every unit. Inside a
  // container it fills the padded width, and starts at the top padding
  // unless something else sits above it. Single resizable items stretch;
  // rows and fixed-size items keep their size and align left.
  const stretchy = column.filter((u) => {
    const one = single(u)
    return one !== null && isResizable(one.kind)
  })
  let left = Math.min(...column.map((u) => u.box.x))
  let rightEdge = stretchy.length ? Math.max(...stretchy.map((u) => right(u.box))) : null
  let top = column[0].box.y
  if (container) {
    const inset = insetsOf(container)
    left = container.box.x + inset.left
    rightEdge = right(container.box) - inset.right
    const above = units.some((u) => !column.includes(u) && bottom(u.box) <= top)
    if (!above) top = container.box.y + inset.top
  }

  let y = top
  for (const u of column) {
    const one = single(u)
    const w = one && isResizable(one.kind) && rightEdge !== null ? rightEdge - left : u.box.w
    const dx = left - u.box.x
    const dy = y - u.box.y
    for (const m of u.members) {
      place(m, one ? { x: left, y, w, h: m.box.h } : { ...m.box, x: m.box.x + dx, y: m.box.y + dy })
    }
    y += u.box.h + (hugsNext(one) ? LABEL_GAP : GAP)
  }
  return moved
}

/** A top-level component in no column: edges snap to nearby components. */
function snapAlone(item: Item, siblings: Item[]): Box {
  const box = item.box
  const others = siblings.filter((s) => s !== item).map((s) => s.box)
  const lefts = others.flatMap((s) => [s.x, right(s)])
  const rights = others.flatMap((s) => [right(s), s.x])
  const l = nearest(box.x, lefts)
  if (!isResizable(item.kind)) return l === null ? box : { ...box, x: l }
  const r = nearest(right(box), rights)
  const x = l ?? box.x
  const w = (r ?? right(box)) - x
  return w > 8 ? { ...box, x, w } : box
}

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
