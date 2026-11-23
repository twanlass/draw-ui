import { boundsOf, distanceToBox, unionBoxes, type Box, type Point } from '@/lib/geometry'
import type { ComponentKind, Match, Ranked, Stroke } from '@/recognize/types'
import { isFrame, type PlacedKind } from './frames'
import { arrange, naturalBox, stackOrder } from './layout'

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
}

type HistoryEntry =
  | { type: 'stroke'; id: string }
  /**
   * `placedIds` are the components one sketch became (usually one; a control
   * and its label make two). `moved` holds the boxes auto layout changed, as
   * they were, for undo.
   */
  | { type: 'swap'; placedIds: string[]; moved: { id: string; box: Box }[] }
  /** A component crossed out, with its old stacking position so undo restores it in place. */
  | { type: 'erase'; placed: Placed; index: number }

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
   * Wrap the components centred inside `box` in an invisible flex container
   * (a Shift+drag). Does nothing if it would wrap nothing.
   */
  | { type: 'group'; id: string; box: Box }
  /** Remove a placed component along with the strokes that crossed it out. */
  | { type: 'erase'; id: string; strokeIds: string[] }
  | { type: 'undo' }
  | { type: 'clear' }

export const initialState: CanvasState = { strokes: [], pending: [], placed: [], history: [] }

/** Run auto layout around `id`, returning the new list and the boxes it replaced. */
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
        toPlaced(action.id, action.match, replaced.filter((s) => !extraIds.has(s.id))),
        ...extra.map((e) => toPlaced(e.id, e.match, replaced.filter((s) => e.strokeIds.includes(s.id)))),
      ]
      const { placed, previous } = layOut([...state.placed, ...added], action.id)
      const addedIds = added.map((p) => p.id)
      return {
        ...state,
        strokes: state.strokes.filter((s) => !ids.has(s.id)),
        pending: state.pending.filter((id) => !ids.has(id)),
        placed,
        history: [
          ...state.history.filter((h) => !(h.type === 'stroke' && ids.has(h.id))),
          { type: 'swap', placedIds: addedIds, moved: previous.filter((m) => !addedIds.includes(m.id)) },
        ],
      }
    }

    case 'add':
      return {
        ...state,
        placed: stackOrder([...state.placed, action.placed]),
        history: [...state.history, { type: 'swap', placedIds: [action.placed.id], moved: [] }],
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
          box: naturalBox(action.kind, p.drawnBox),
          confidence: chosen?.p ?? 0,
          alternatives: [{ kind: p.kind, p: p.confidence }, ...rest].sort((a, b) => b.p - a.p),
        }
      })
      if (switched.every((p, i) => p === state.placed[i])) return state
      return { ...state, placed: layOut(switched, action.id).placed }
    }

    case 'erase': {
      const index = state.placed.findIndex((p) => p.id === action.id)
      if (index === -1) return state
      const ids = new Set(action.strokeIds)
      return {
        ...state,
        strokes: state.strokes.filter((s) => !ids.has(s.id)),
        pending: state.pending.filter((id) => !ids.has(id)),
        placed: state.placed.filter((p) => p.id !== action.id),
        history: [
          ...state.history.filter((h) => !(h.type === 'stroke' && ids.has(h.id))),
          { type: 'erase', placed: state.placed[index], index },
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
      if (last.type === 'erase') {
        const placed = [...state.placed]
        placed.splice(last.index, 0, last.placed)
        return { ...state, placed, history }
      }
      // Undoing a swap removes its components and their sketch in one go, and
      // puts back anything auto layout moved to make room for them.
      const gone = new Set(last.placedIds)
      if (!state.placed.some((p) => gone.has(p.id))) return { ...state, history }
      const restore = new Map(last.moved.map((m) => [m.id, m.box]))
      return {
        ...state,
        placed: state.placed
          .filter((p) => !gone.has(p.id))
          .map((p) => (restore.has(p.id) ? { ...p, box: restore.get(p.id)! } : p)),
        history,
      }
    }

    case 'clear':
      return initialState
  }
}

/** Starting a stroke this far from the open group closes the group right away. */
export const GROUP_BREAK_DISTANCE = 48

export function startsNewGroup(pending: Stroke[], start: Point, gap = GROUP_BREAK_DISTANCE): boolean {
  if (pending.length === 0) return false
  const box = unionBoxes(pending.map((s) => boundsOf(s.points)))
  return distanceToBox(start, box) > gap
}

/** The topmost placed component under a point, allowing `slack` px around its box. */
export function placedAt(placed: Placed[], p: Point, slack = 8): Placed | undefined {
  for (let i = placed.length - 1; i >= 0; i--) {
    if (distanceToBox(p, placed[i].box) <= slack) return placed[i]
  }
  return undefined
}
