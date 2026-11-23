import { boundsOf, unionBoxes, type Box } from '@/lib/geometry'
import { findFrame } from './heuristic'
import type { ComponentKind, Match, Stroke } from './types'

/** Controls that are usually drawn with a label beside them. */
const LABELLED: ReadonlySet<ComponentKind> = new Set(['checkbox', 'switch'])
/** Strokes whose x-ranges come this close are part of the same mark. */
const TOUCH = 4

export interface Part {
  match: Match
  strokeIds: string[]
}

/**
 * A checkbox or switch drawn with its label in one go comes back from the
 * recognizer as one match covering both. Split it into the control (the
 * tallest mark) and a label made of the ink beside it, so each is placed and
 * laid out as its own component. Anything else passes through as one part.
 */
export function splitLabel(match: Match, strokes: Stroke[]): Part[] {
  const whole = [{ match, strokeIds: strokes.map((s) => s.id) }]
  if (!LABELLED.has(match.kind) || strokes.length < 2) return whole

  const marks = clusters(strokes)
  if (marks.length < 2) return whole
  const control = marks.reduce((a, b) => (b.box.h > a.box.h ? b : a))
  const rest = marks.filter((m) => m !== control)
  // A label is flat text on the same line as the control.
  const midY = control.box.y + control.box.h / 2
  const beside = rest.every((m) => m.box.y <= midY + control.box.h && m.box.y + m.box.h >= midY - control.box.h)
  if (!beside) return whole

  const labelStrokes = rest.flatMap((m) => m.strokes)
  const controlBox = findFrame(control.strokes)?.box ?? control.box
  return [
    { match: { ...match, box: controlBox }, strokeIds: control.strokes.map((s) => s.id) },
    {
      match: { kind: 'label', box: boundsOf(labelStrokes.flatMap((s) => s.points)), confidence: match.confidence },
      strokeIds: labelStrokes.map((s) => s.id),
    },
  ]
}

export interface Mark {
  strokes: Stroke[]
  box: Box
}

/** Group strokes whose horizontal extents overlap: a box and its tick, a pill and its knob, one scribble. */
export function clusters(strokes: Stroke[]): Mark[] {
  const sorted = strokes
    .map((s) => ({ strokes: [s], box: boundsOf(s.points) }))
    .sort((a, b) => a.box.x - b.box.x)
  const out: Mark[] = []
  for (const m of sorted) {
    const prev = out[out.length - 1]
    if (prev && m.box.x <= prev.box.x + prev.box.w + TOUCH) {
      prev.strokes.push(...m.strokes)
      prev.box = unionBoxes([prev.box, m.box])
    } else out.push(m)
  }
  return out
}
