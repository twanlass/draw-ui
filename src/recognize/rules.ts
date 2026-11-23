import { boundsOf, unionBoxes, type Point } from '@/lib/geometry'
import { clusters } from './split'
import type { Match, Stroke } from './types'

/** The checkbox's own box, at most this big (px); casual sketches overshoot 45. */
const MAX_BOX = 64
const MIN_BOX = 8
/**
 * A square's ink reaches its corners; a circle's stays about 0.29 of its size
 * away. Ink at least this close (as a fraction of size) to every corner is a box.
 */
const CORNER_REACH = 0.2

/**
 * Sketches whose shape alone settles what they are, checked before asking
 * Jev: faster, and steadier than a model on cases it keeps confusing.
 */
export function shapeRule(strokes: Stroke[]): Match | null {
  return checkboxWithLabel(strokes)
}

/**
 * A tiny square box with flat ink to its right (a line or scribble for its
 * label) and nothing around them: a checkbox with a label. Jev tends to read
 * the pair as an input or input group. The returned match covers the whole
 * sketch; splitLabel then separates the box from its label.
 */
export function checkboxWithLabel(strokes: Stroke[]): Match | null {
  const marks = clusters(strokes)
  if (marks.length < 2) return null
  const [box, ...rest] = marks
  const side = Math.max(box.box.w, box.box.h)
  if (side > MAX_BOX || Math.min(box.box.w, box.box.h) < MIN_BOX) return null
  if (box.box.w / box.box.h > 2 || box.box.h / box.box.w > 2) return null
  if (!reachesCorners(box.strokes.flatMap((s) => s.points))) return null

  const midY = box.box.y + box.box.h / 2
  const flatBeside = rest.every(
    (m) => m.box.h <= Math.max(30, box.box.h * 1.5) && Math.abs(m.box.y + m.box.h / 2 - midY) <= box.box.h,
  )
  if (!flatBeside) return null
  const all = unionBoxes(marks.map((m) => m.box))
  return { kind: 'checkbox', box: all, confidence: 0.9 }
}

function reachesCorners(points: Point[]): boolean {
  const b = boundsOf(points)
  const size = Math.max(b.w, b.h)
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x, y: b.y + b.h },
    { x: b.x + b.w, y: b.y + b.h },
  ]
  return corners.every((c) => Math.min(...points.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) <= size * CORNER_REACH)
}
