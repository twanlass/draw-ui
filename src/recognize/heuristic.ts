import {
  boundsOf,
  center,
  isClosed,
  unionBoxes,
  type Box,
  type Point,
} from '@/lib/geometry'
import type { Match, Recognizer, Stroke } from './types'

/**
 * Shape-only recognizer. Finds the outer frame of a sketch (one closed stroke,
 * or several strokes along the edges), then picks a component from the frame's
 * size and aspect ratio and where the inner marks sit:
 *
 *   small square            -> checkbox
 *   big box                 -> card
 *   short wide box, centered marks inside -> button
 *   short wide box, empty or left-aligned marks -> input
 *
 * It can't read handwriting, so labels stay as placeholder text.
 */

export const thresholds = {
  checkboxMaxSide: 64,
  cardMinW: 160,
  cardMinH: 120,
  controlMaxH: 100,
  controlMinRatio: 1.3,
  /** Inner marks count as centered if their center is this close to the frame's, as a fraction of width. */
  centeredTolerance: 0.2,
  /** Edge band for multi-stroke frames, as a fraction of the shorter side. */
  edgeBand: 0.2,
}

interface Frame {
  box: Box
  frameIds: Set<string>
}

export function findFrame(strokes: Stroke[]): Frame | null {
  if (strokes.length === 0) return null
  const groupBox = unionBoxes(strokes.map((s) => boundsOf(s.points)))
  if (groupBox.w < 8 || groupBox.h < 8) return null

  // One closed stroke that spans (nearly) the whole group.
  for (const s of strokes) {
    if (!isClosed(s.points)) continue
    const b = boundsOf(s.points)
    if (b.w >= groupBox.w * 0.85 && b.h >= groupBox.h * 0.85) {
      return { box: b, frameIds: new Set([s.id]) }
    }
  }

  // Several strokes that together trace all four edges.
  const band = Math.min(groupBox.w, groupBox.h) * thresholds.edgeBand
  const edgeStrokes = strokes.filter((s) => {
    const near = s.points.filter((p) => nearestEdge(p, groupBox, band) !== null)
    return near.length >= s.points.length * 0.8
  })
  if (edgeStrokes.length < 2) return null

  const covered = { top: [] as number[], bottom: [] as number[], left: [] as number[], right: [] as number[] }
  for (const s of edgeStrokes) {
    for (const p of s.points) {
      const edge = nearestEdge(p, groupBox, band)
      if (edge === 'top' || edge === 'bottom') covered[edge].push(p.x)
      else if (edge) covered[edge].push(p.y)
    }
  }
  const spans = (vals: number[], len: number) =>
    vals.length > 0 && Math.max(...vals) - Math.min(...vals) >= len * 0.6
  if (
    spans(covered.top, groupBox.w) &&
    spans(covered.bottom, groupBox.w) &&
    spans(covered.left, groupBox.h) &&
    spans(covered.right, groupBox.h)
  ) {
    return { box: groupBox, frameIds: new Set(edgeStrokes.map((s) => s.id)) }
  }
  return null
}

type Edge = 'top' | 'bottom' | 'left' | 'right'

function nearestEdge(p: Point, b: Box, band: number): Edge | null {
  const d: [Edge, number][] = [
    ['top', Math.abs(p.y - b.y)],
    ['bottom', Math.abs(p.y - (b.y + b.h))],
    ['left', Math.abs(p.x - b.x)],
    ['right', Math.abs(p.x - (b.x + b.w))],
  ]
  d.sort((a, b2) => a[1] - b2[1])
  return d[0][1] <= band ? d[0][0] : null
}

export function classify(strokes: Stroke[]): Match | null {
  const frame = findFrame(strokes)
  if (!frame) return null
  const { box } = frame
  const inner = strokes.filter((s) => !frame.frameIds.has(s.id))
  const ratio = box.w / box.h
  const t = thresholds

  if (Math.max(box.w, box.h) <= t.checkboxMaxSide && ratio >= 0.6 && ratio <= 1.6) {
    return { kind: 'checkbox', box, confidence: 0.8 }
  }
  if (box.w >= t.cardMinW && box.h >= t.cardMinH) {
    return { kind: 'card', box, confidence: 0.7 }
  }
  if (box.h <= t.controlMaxH && ratio >= t.controlMinRatio) {
    if (inner.length === 0) return { kind: 'input', box, confidence: 0.6 }
    const marks = unionBoxes(inner.map((s) => boundsOf(s.points)))
    const offset = Math.abs(center(marks).x - center(box).x) / box.w
    return offset <= t.centeredTolerance
      ? { kind: 'button', box, confidence: 0.75 }
      : { kind: 'input', box, confidence: 0.7 }
  }
  return null
}

export const heuristicRecognizer: Recognizer = async (strokes) => classify(strokes)
