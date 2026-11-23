import { area, boundsOf, distanceToBox, unionBoxes, type Box, type Point } from '@/lib/geometry'
import type { ComponentKind, Match, Ranked, Stroke } from '@/recognize/types'
import { isFixedSize, isFrame, type PlacedKind } from './frames'
import { stepTextStyle, type TextStyle } from './textStyles'
import { arrange, asContainer, GAP, type Gap, naturalBox, parentOf, PADDING, settleInto, stackOrder } from './layout'

export interface Placed {
  id: string
  kind: PlacedKind
  /** Where it renders, after auto layout. */
  box: Box
  /** Where the sketch was, so switching kind can lay it out afresh. */
  drawnBox: Box
  label?: string
  confidence: number
  /** Other likely components, best first, for the switcher. */
  alternatives: Ranked[]
  /** The strokes it was drawn with, kept for feedback reports. */
  sketch: Stroke[]
  /** For a label: which kind of text (label when unset). */
  textStyle?: TextStyle
}

/** A component's boxes before an action moved it, for undo. */
type Moved = { id: string; box: Box; drawnBox?: Box }

type HistoryEntry =
  | { type: 'stroke'; id: string }
  /**
   * `placedIds` are the components one sketch became (usually one; a control
   * and its label make two). `moved` holds the boxes auto layout changed, as
   * they were, for undo.
   */
  | { type: 'swap'; placedIds: string[]; moved: Moved[] }
  /**
   * A component dragged somewhere else (edit mode): every box as it was, and
   * any group it left empty, for undo.
   */
  | { type: 'move'; moved: Moved[]; removed: { placed: Placed; index: number }[]; order: string[] }
  /** A component's text edited, with what it was, for undo. */
  | { type: 'text'; id: string; from: string | undefined }
  /** A label's text style changed, with what it was, for undo. */
  | { type: 'restyle'; id: string; from: TextStyle | undefined; moved: Moved[] }
  /**
   * Components crossed out, each with its old stacking position so undo
   * restores it in place, and the boxes containers had before re-fitting.
   */
  | { type: 'erase'; removed: { placed: Placed; index: number }[]; moved: { id: string; box: Box }[]; order: string[] }

export interface CanvasState {
  strokes: Stroke[]
  /** Strokes in the group still being drawn. */
  pending: string[]
  placed: Placed[]
  history: HistoryEntry[]
}

export type CanvasAction =
  | { type: 'addStroke'; stroke: Stroke }
  | { type: 'closeGroup' }
  /**
   * Replace a sketch with a component. `extra` places more components from
   * part of the same sketch (a control's label); `strokeIds` covers them all,
   * and undo removes them together.
   */
  | { type: 'swap'; id: string; strokeIds: string[]; match: Match; extra?: { id: string; match: Match; strokeIds: string[] }[] }
  | { type: 'reassign'; id: string; kind: ComponentKind }
  /** Put a component on the canvas directly, like a phone frame from the side toolbar. */
  | { type: 'add'; placed: Placed }
  /**
   * Add a component picked by name (the Cmd+K menu), centred on `at`. Like a
   * sketch, it goes in a container under that point and gets laid out.
   */
  | { type: 'insert'; id: string; kind: ComponentKind; at: Point; gap?: Gap }
  /**
   * Wrap the components centred inside `box` in an invisible flex container
   * (a Shift+drag). Does nothing if it would wrap nothing.
   */
  | { type: 'group'; id: string; box: Box }
  /**
   * Copy the last thing created (everything one sketch became, with anything
   * inside it) straight below the original. Copies get ids `${id}-0`, `${id}-1`…
   */
  | { type: 'duplicate'; id: string }
  /**
   * Remove placed components, with anything inside them, along with the
   * strokes that crossed them out. Groups left empty go too; containers left
   * with less in them re-fit.
   */
  | { type: 'erase'; ids: string[]; strokeIds: string[] }
  /**
   * Drag a component (and anything in it) by `dx`, `dy`, dropping it with the
   * pointer at `at`: it joins the container under the pointer, or the canvas.
   */
  | { type: 'move'; id: string; dx: number; dy: number; at: Point }
  /** Set a component's text (a label, button text, a placeholder); empty goes back to the default. */
  | { type: 'setText'; id: string; text: string }
  /** Step a label's text style up (+1) or down (-1): help, label, body, subtitle, title. */
  | { type: 'restyle'; id: string; step: 1 | -1 }
  | { type: 'undo' }
  | { type: 'clear' }

export const initialState: CanvasState = { strokes: [], pending: [], placed: [], history: [] }

/** Run auto layout around `id`, returning the new list and the boxes it replaced. */
/** How big a component picked by name starts, before layout gives it its real size. */
function startingSize(kind: ComponentKind): { w: number; h: number } {
  if (['card', 'chart', 'table', 'calendar', 'carousel', 'accordion', 'tabs'].includes(kind)) return { w: 360, h: 240 }
  if (kind === 'textarea') return { w: 320, h: 96 }
  if (kind === 'label') return { w: 120, h: 20 }
  if (kind === 'separator') return { w: 320, h: 4 }
  return { w: 240, h: 40 }
}

function layOut(placed: Placed[], id: string) {
  const moves = arrange(placed, id)
  const previous = placed.filter((p) => moves.has(p.id)).map((p) => ({ id: p.id, box: p.box }))
  const next = placed.map((p) => (moves.has(p.id) ? { ...p, box: moves.get(p.id)! } : p))
  return { placed: stackOrder(next), previous }
}

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'addStroke':
      return {
        ...state,
        strokes: [...state.strokes, action.stroke],
        pending: [...state.pending, action.stroke.id],
        history: [...state.history, { type: 'stroke', id: action.stroke.id }],
      }

    case 'closeGroup':
      return state.pending.length ? { ...state, pending: [] } : state

    case 'swap': {
      const ids = new Set(action.strokeIds)
      const replaced = state.strokes.filter((s) => ids.has(s.id))
      // The user undid or cleared some of these strokes while recognition ran.
      if (replaced.length !== ids.size) return state
      const extra = action.extra ?? []
      const extraIds = new Set(extra.flatMap((e) => e.strokeIds))
      const toPlaced = (id: string, match: Match, sketch: Stroke[]): Placed => ({
        id,
        kind: match.kind,
        box: naturalBox(match.kind, match.box),
        drawnBox: match.box,
        label: match.label,
        confidence: match.confidence,
        alternatives: match.alternatives ?? [],
        sketch,
      })
      const added = [
        toPlaced(action.id, asContainer(action.match, state.placed), replaced.filter((s) => !extraIds.has(s.id))),
        ...extra.map((e) => toPlaced(e.id, e.match, replaced.filter((s) => e.strokeIds.includes(s.id)))),
      ]
      // Started inside a card, group or phone, it goes in it.
      const start = replaced[0]?.points[0]
      const settled = start ? settleInto(state.placed, added, start) : { existing: state.placed, added }
      const { placed } = layOut([...settled.existing, ...settled.added], action.id)
      const addedIds = added.map((p) => p.id)
      return {
        ...state,
        strokes: state.strokes.filter((s) => !ids.has(s.id)),
        pending: state.pending.filter((id) => !ids.has(id)),
        placed,
        history: [
          ...state.history.filter((h) => !(h.type === 'stroke' && ids.has(h.id))),
          { type: 'swap', placedIds: addedIds, moved: movedSince(state.placed, placed) },
        ],
      }
    }

    case 'add':
      return {
        ...state,
        placed: stackOrder([...state.placed, action.placed]),
        history: [...state.history, { type: 'swap', placedIds: [action.placed.id], moved: [] }],
      }

    case 'insert': {
      const size = startingSize(action.kind)
      // Into a gap (edit mode's blue line): starting on the line at its
      // neighbours' width. Layout orders by top edge, so it slots in between.
      const { gap } = action
      const drawn = gap
        ? { x: gap.x, y: gap.y, w: gap.w, h: size.h }
        : { x: action.at.x - size.w / 2, y: action.at.y - size.h / 2, ...size }
      const added: Placed = {
        id: action.id,
        kind: action.kind,
        box: naturalBox(action.kind, drawn),
        drawnBox: drawn,
        confidence: 1,
        alternatives: [],
        sketch: [],
      }
      // Aimed at what's on screen, so lay out from where things are shown (as a move does).
      const asShown = state.placed.map((p) => ({ ...p, drawnBox: p.box }))
      const settled = settleInto(asShown, [added], action.at)
      const { placed } = layOut([...settled.existing, ...settled.added], action.id)
      return {
        ...state,
        placed,
        history: [...state.history, { type: 'swap', placedIds: [action.id], moved: movedSince(state.placed, placed) }],
      }
    }

    case 'group': {
      const { box } = action
      const inside = (b: Box) => {
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2
        return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h
      }
      // Smaller than the rect, so dragging inside a card doesn't take the card.
      const members = state.placed.filter((p) => inside(p.box) && p.box.w * p.box.h < box.w * box.h)
      if (members.length === 0) return state
      // The drag only says which components; the group itself starts snug
      // around them, since a hand-dragged rect's edges are noise.
      const u = unionBoxes(members.map((p) => p.box))
      // 1px larger, so it's strictly bigger than any member and so their container.
      const snug = { x: u.x - 1, y: u.y - 1, w: u.w + 2, h: u.h + 2 }
      const group: Placed = { id: action.id, kind: 'group', box: snug, drawnBox: box, confidence: 1, alternatives: [], sketch: [] }
      const { placed, previous } = layOut([...state.placed, group], action.id)
      return {
        ...state,
        placed,
        history: [...state.history, { type: 'swap', placedIds: [action.id], moved: previous.filter((m) => m.id !== action.id) }],
      }
    }

    case 'duplicate': {
      const source = lastCreated(state)
      if (!source.length) return state
      const all = [...new Set([...source, ...source.flatMap((p) => descendantsOf(p, state.placed))])]
      const at = unionBoxes(source.map((p) => p.box))
      const dy = at.h + GAP
      const ids = new Map(all.map((p, i) => [p.id, `${action.id}-${i}`]))
      // A copy is "drawn" where it lands, below the original as laid out, not
      // offset from the original's sketch: a group's sketch is the rect you
      // dragged, often much taller than the group, and layout reasons from
      // drawn boxes, so that would leave a big gap.
      const copies = all.map((p) => {
        const box = { ...p.box, y: p.box.y + dy }
        return { ...p, id: ids.get(p.id)!, box, drawnBox: box }
      })
      // Stretch the containers the original is in so the copy lands inside
      // them too; layout then fits them properly.
      const bottomNeeded = at.y + at.h + dy
      const grown = new Map<string, Box>()
      for (let c = parentOf(source[0], state.placed); c && !isFixedSize(c.kind); c = parentOf(c, state.placed)) {
        const box = grown.get(c.id) ?? c.box
        const h = Math.max(box.h, bottomNeeded + PADDING - box.y)
        grown.set(c.id, { ...box, h })
      }
      // Make room: push what's below the original down by the copy's height,
      // as if the copy were inserted there. Otherwise it lands on whatever is
      // next in the column, and layout hands its contents to that instead.
      const copied = new Set(all.map((p) => p.id))
      const isBelow = (p: Placed) =>
        !copied.has(p.id) && !grown.has(p.id) && p.box.y >= at.y + at.h - 4 && p.box.x < at.x + at.w && at.x < p.box.x + p.box.w
      const down = (b: Box) => ({ ...b, y: b.y + dy })
      const before = state.placed.map((p) =>
        grown.has(p.id) ? { ...p, box: grown.get(p.id)! } : isBelow(p) ? { ...p, box: down(p.box), drawnBox: down(p.drawnBox) } : p,
      )
      const { placed } = layOut([...before, ...copies], ids.get(source[0].id)!)
      const old = new Map(state.placed.map((p) => [p.id, p]))
      return {
        ...state,
        placed,
        history: [
          ...state.history,
          {
            type: 'swap',
            placedIds: copies.map((p) => p.id),
            moved: placed
              .filter((p) => old.has(p.id) && (old.get(p.id)!.box !== p.box || old.get(p.id)!.drawnBox !== p.drawnBox))
              .map((p) => ({ id: p.id, box: old.get(p.id)!.box, drawnBox: old.get(p.id)!.drawnBox })),
          },
        ],
      }
    }

    case 'move': {
      const all = state.placed
      const target = all.find((p) => p.id === action.id)
      if (!target || (!action.dx && !action.dy)) return state
      const subtree = new Set([target, ...descendantsOf(target, all)].map((p) => p.id))
      const from = parentOf(target, all)
      // Layout reasons from where things were drawn, which can be far from
      // where they now show. A drop is aimed at what's on screen, so take the
      // layout as it stands as the drawing, then move the dragged items.
      const shift = (b: Box) => ({ ...b, x: b.x + action.dx, y: b.y + action.dy })
      const asShown = all.map((p) => {
        const box = subtree.has(p.id) ? shift(p.box) : p.box
        return { ...p, box, drawnBox: box }
      })
      const settled = settleInto(
        asShown.filter((p) => !subtree.has(p.id)),
        asShown.filter((p) => subtree.has(p.id)),
        action.at,
      )
      let placed = stackOrder([...settled.existing, ...settled.added])
      // Close up where it came from; a group it leaves empty goes.
      let removed: { placed: Placed; index: number }[] = []
      if (from && !subtree.has(from.id)) {
        const left = all.filter((p) => parentOf(p, all) === from && !subtree.has(p.id))
        // A group of one is no group: left with one member (or none), it dissolves.
        if (from.kind === 'group' && left.length <= 1) {
          removed = [{ placed: from, index: all.indexOf(from) }]
          placed = placed.filter((p) => p.id !== from.id)
        }
        if (left.length) placed = layOut(placed, left[0].id).placed
      }
      placed = layOut(placed, action.id).placed
      return {
        ...state,
        placed,
        history: [...state.history, { type: 'move', moved: movedSince(all, placed), removed, order: all.map((p) => p.id) }],
      }
    }

    case 'setText': {
      const target = state.placed.find((p) => p.id === action.id)
      const label = action.text.trim() || undefined
      if (!target || target.label === label) return state
      return {
        ...state,
        placed: state.placed.map((p) => (p === target ? { ...p, label } : p)),
        history: [...state.history, { type: 'text', id: action.id, from: target.label }],
      }
    }

    case 'restyle': {
      const target = state.placed.find((p) => p.id === action.id)
      if (!target || target.kind !== 'label') return state
      const textStyle = stepTextStyle(target.textStyle, action.step)
      if (textStyle === (target.textStyle ?? 'label')) return state
      const restyled = state.placed.map((p) =>
        p === target ? { ...p, textStyle, box: { ...p.box, h: naturalBox('label', p.drawnBox, textStyle).h } } : p,
      )
      const { placed } = layOut(restyled, action.id)
      return {
        ...state,
        placed,
        history: [...state.history, { type: 'restyle', id: action.id, from: target.textStyle, moved: movedSince(state.placed, placed) }],
      }
    }

    case 'reassign': {
      // Swap a placed component for one of its alternatives; the old pick
      // joins the alternatives so the user can switch back. Its real size may
      // differ, so lay it out again from where it was drawn.
      const switched = state.placed.map((p) => {
        if (p.id !== action.id || p.kind === action.kind || isFrame(p.kind)) return p
        const chosen = p.alternatives.find((a) => a.kind === action.kind)
        const rest = p.alternatives.filter((a) => a.kind !== action.kind)
        return {
          ...p,
          kind: action.kind,
          box: naturalBox(action.kind, p.drawnBox, p.textStyle),
          confidence: chosen?.p ?? 0,
          alternatives: [{ kind: p.kind, p: p.confidence }, ...rest].sort((a, b) => b.p - a.p),
        }
      })
      if (switched.every((p, i) => p === state.placed[i])) return state
      return { ...state, placed: layOut(switched, action.id).placed }
    }

    case 'erase': {
      const all = state.placed
      const targets = all.filter((p) => action.ids.includes(p.id))
      if (!targets.length) return state
      const gone = new Set(targets.flatMap((t) => [t, ...descendantsOf(t, all)]).map((p) => p.id))
      const kidsOf = (c: Placed) => all.filter((k) => parentOf(k, all) === c)
      // A group is only its members: once they're all gone, or all but one,
      // so is it (the last one stays where it is).
      for (let grew = true; grew; ) {
        grew = false
        for (const g of all) {
          if (g.kind !== 'group' || gone.has(g.id)) continue
          const kids = kidsOf(g)
          const lost = kids.filter((k) => gone.has(k.id)).length
          if (lost && kids.length - lost <= 1) {
            gone.add(g.id)
            grew = true
          }
        }
      }
      let placed = all.filter((p) => !gone.has(p.id))
      // Close up what's left in each container something was erased from, by
      // laying out from a remaining member (so a card keeps its room).
      for (const c of new Set(all.filter((p) => gone.has(p.id)).map((p) => parentOf(p, all)))) {
        const survivor = c && !gone.has(c.id) && kidsOf(c).find((k) => !gone.has(k.id))
        if (survivor) placed = layOut(placed, survivor.id).placed
      }
      // The last member of a dissolved group settles into the group's place.
      for (const g of all.filter((p) => p.kind === 'group' && gone.has(p.id))) {
        const last = kidsOf(g).find((k) => !gone.has(k.id))
        if (last) placed = layOut(placed, last.id).placed
      }
      const old = new Map(all.map((p) => [p.id, p.box]))
      const ids = new Set(action.strokeIds)
      return {
        ...state,
        strokes: state.strokes.filter((s) => !ids.has(s.id)),
        pending: state.pending.filter((id) => !ids.has(id)),
        placed,
        history: [
          ...state.history.filter((h) => !(h.type === 'stroke' && ids.has(h.id))),
          {
            type: 'erase',
            removed: all.flatMap((p, index) => (gone.has(p.id) ? [{ placed: p, index }] : [])),
            moved: placed.filter((p) => old.get(p.id) !== p.box).map((p) => ({ id: p.id, box: old.get(p.id)! })),
            order: all.map((p) => p.id),
          },
        ],
      }
    }

    case 'undo': {
      const last = state.history[state.history.length - 1]
      if (!last) return state
      const history = state.history.slice(0, -1)
      if (last.type === 'stroke') {
        return {
          ...state,
          strokes: state.strokes.filter((s) => s.id !== last.id),
          pending: state.pending.filter((id) => id !== last.id),
          history,
        }
      }
      if (last.type === 'move') {
        const restore = new Map(last.moved.map((m) => [m.id, m]))
        const placed = state.placed.map((p) => {
          const m = restore.get(p.id)
          return m ? { ...p, box: m.box, drawnBox: m.drawnBox ?? p.drawnBox } : p
        })
        for (const r of last.removed) placed.splice(r.index, 0, r.placed)
        // Back in the stacking order it had.
        const rank = new Map(last.order.map((id, i) => [id, i]))
        placed.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
        return { ...state, placed, history }
      }
      if (last.type === 'text') {
        return { ...state, placed: state.placed.map((p) => (p.id === last.id ? { ...p, label: last.from } : p)), history }
      }
      if (last.type === 'restyle') {
        const restore = new Map(last.moved.map((m) => [m.id, m]))
        const placed = state.placed.map((p) => {
          const m = restore.get(p.id)
          const back = m ? { ...p, box: m.box, drawnBox: m.drawnBox ?? p.drawnBox } : p
          return p.id === last.id ? { ...back, textStyle: last.from } : back
        })
        return { ...state, placed, history }
      }
      if (last.type === 'erase') {
        const restore = new Map(last.moved.map((m) => [m.id, m.box]))
        const placed = state.placed.map((p) => (restore.has(p.id) ? { ...p, box: restore.get(p.id)! } : p))
        for (const r of last.removed) placed.push(r.placed)
        // Back in the stacking order it had.
        const rank = new Map(last.order.map((id, i) => [id, i]))
        placed.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
        return { ...state, placed, history }
      }
      // Undoing a swap removes its components and their sketch in one go, and
      // puts back anything auto layout moved to make room for them.
      const gone = new Set(last.placedIds)
      if (!state.placed.some((p) => gone.has(p.id))) return { ...state, history }
      const restore = new Map(last.moved.map((m) => [m.id, m]))
      return {
        ...state,
        placed: state.placed
          .filter((p) => !gone.has(p.id))
          .map((p) => {
            const m = restore.get(p.id)
            return m ? { ...p, box: m.box, drawnBox: m.drawnBox ?? p.drawnBox } : p
          }),
        history,
      }
    }

    case 'clear':
      return initialState
  }
}

/**
 * What the most recent sketch, group or copy became, still on the canvas,
 * outermost first. Phones come from the toolbar and aren't duplicated.
 */
function lastCreated(state: CanvasState): Placed[] {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i]
    if (h.type !== 'swap') continue
    const ids = new Set(h.placedIds)
    const items = state.placed.filter((p) => ids.has(p.id) && p.kind !== 'phone')
    if (!items.length) continue
    // Only the outermost: anything inside another comes along as its content.
    return items.filter((p) => !items.some((o) => descendantsOf(o, state.placed).includes(p)))
  }
  return []
}

/** Everything inside `item`, at any depth. */
export function descendantsOf(item: Placed, placed: Placed[]): Placed[] {
  const kids = placed.filter((p) => parentOf(p, placed) === item)
  return kids.flatMap((k) => [k, ...descendantsOf(k, placed)])
}

/** The boxes, as they were, of everything an action moved. */
function movedSince(before: Placed[], after: Placed[]): Moved[] {
  const old = new Map(before.map((p) => [p.id, p]))
  return after
    .filter((p) => old.has(p.id) && (old.get(p.id)!.box !== p.box || old.get(p.id)!.drawnBox !== p.drawnBox))
    .map((p) => ({ id: p.id, box: old.get(p.id)!.box, drawnBox: old.get(p.id)!.drawnBox }))
}

/** Starting a stroke this far from the open group closes the group right away. */
export const GROUP_BREAK_DISTANCE = 48

export function startsNewGroup(pending: Stroke[], start: Point, gap = GROUP_BREAK_DISTANCE): boolean {
  if (pending.length === 0) return false
  const box = unionBoxes(pending.map((s) => boundsOf(s.points)))
  return distanceToBox(start, box) > gap
}

/**
 * What an X erases: everything mostly inside it, so one big X clears a whole
 * form. An X too small to cover anything takes the topmost component where
 * its strokes cross.
 */
export function crossedOut(placed: Placed[], strokes: Stroke[], crossing: Point): string[] {
  const x = unionBoxes(strokes.map((s) => boundsOf(s.points)))
  const covered = placed.filter((p) => overlapArea(p.box, x) >= COVERED * area(p.box))
  if (covered.length) return covered.map((p) => p.id)
  const under = placedAt(placed, crossing)
  return under ? [under.id] : []
}

/** How much of a component an X must cover to erase it. */
const COVERED = 0.5

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** The topmost placed component under a point, allowing `slack` px around its box. */
export function placedAt(placed: Placed[], p: Point, slack = 8): Placed | undefined {
  for (let i = placed.length - 1; i >= 0; i--) {
    if (distanceToBox(p, placed[i].box) <= slack) return placed[i]
  }
  return undefined
}
