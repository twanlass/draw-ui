import { boundsOf, distanceToBox, unionBoxes, type Box, type Point } from '@/lib/geometry'
import type { ComponentKind, Match, Stroke } from '@/recognize/types'

export interface Placed {
  id: string
  kind: ComponentKind
  box: Box
  label?: string
  /** The sketch it replaced, so undo can bring it back. */
  strokes: Stroke[]
}

type HistoryEntry = { type: 'stroke'; id: string } | { type: 'swap'; placedId: string }

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
  | { type: 'swap'; id: string; strokeIds: string[]; match: Match }
  | { type: 'undo' }
  | { type: 'clear' }

export const initialState: CanvasState = { strokes: [], pending: [], placed: [], history: [] }

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
      return {
        ...state,
        strokes: state.strokes.filter((s) => !ids.has(s.id)),
        pending: state.pending.filter((id) => !ids.has(id)),
        placed: [
          ...state.placed,
          { id: action.id, kind: action.match.kind, box: action.match.box, label: action.match.label, strokes: replaced },
        ],
        history: [
          ...state.history.filter((h) => !(h.type === 'stroke' && ids.has(h.id))),
          { type: 'swap', placedId: action.id },
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
      // Undoing a swap brings the sketch back. Its strokes don't rejoin a
      // group, so they won't be recognized again, and a second undo removes
      // them one at a time.
      const placed = state.placed.find((p) => p.id === last.placedId)
      if (!placed) return { ...state, history }
      return {
        ...state,
        strokes: [...state.strokes, ...placed.strokes],
        placed: state.placed.filter((p) => p.id !== placed.id),
        history: [...history, ...placed.strokes.map((s) => ({ type: 'stroke' as const, id: s.id }))],
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
