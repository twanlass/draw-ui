import { boundsOf, pathLength, type Point } from '@/lib/geometry'
import type { Stroke } from './types'

/** End-to-end distance over path length; 1 is a ruler-straight line. */
const MIN_STRAIGHTNESS = 0.85
/** The two lines must cross at a steeper angle than this (degrees). */
const MIN_CROSS_ANGLE = 35
/** The shorter line must be at least this fraction of the longer one. */
const MIN_LENGTH_RATIO = 0.4
const MIN_LINE_LENGTH = 16

/**
 * A cross-out: two roughly straight strokes that cross each other, like an X.
 * Returns where they cross, or null if the strokes aren't an X.
 */
export function crossOut(strokes: Stroke[]): Point | null {
  if (strokes.length !== 2) return null
  const [a, b] = strokes.map((s) => s.points)
  if (!isLine(a) || !isLine(b)) return null

  const la = chord(a)
  const lb = chord(b)
  const lenA = Math.hypot(la.dx, la.dy)
  const lenB = Math.hypot(lb.dx, lb.dy)
  if (Math.min(lenA, lenB) / Math.max(lenA, lenB) < MIN_LENGTH_RATIO) return null

  const cos = Math.abs(la.dx * lb.dx + la.dy * lb.dy) / (lenA * lenB)
  const angle = (Math.acos(Math.min(1, cos)) * 180) / Math.PI
  if (angle < MIN_CROSS_ANGLE) return null

  return segmentIntersection(a[0], a[a.length - 1], b[0], b[b.length - 1])
}

function isLine(points: Point[]): boolean {
  if (points.length < 2) return false
  const { w, h } = boundsOf(points)
  if (Math.max(w, h) < MIN_LINE_LENGTH) return false
  const len = pathLength(points)
  const { dx, dy } = chord(points)
  return len > 0 && Math.hypot(dx, dy) / len >= MIN_STRAIGHTNESS
}

function chord(points: Point[]) {
  const first = points[0]
  const last = points[points.length - 1]
  return { dx: last.x - first.x, dy: last.y - first.y }
}

function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x)
  if (d === 0) return null
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
}
