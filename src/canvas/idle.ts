import { boundsOf, containsBox, isClosed, pathLength } from '@/lib/geometry'
import type { Stroke } from '@/recognize/types'

/**
 * How long to wait after the pen lifts before treating the group as one
 * finished sketch. Short when the sketch looks done, long when it looks like
 * more is coming. Only the gap between lifting the pen and putting it down
 * again counts (a new stroke cancels the wait), and people usually start the
 * next stroke within 200–400ms, so these can stay short.
 */
export const IDLE_MS = {
  /**
   * Likely done: a mark drawn inside a frame (a button's label, a checkbox's
   * tick, a select's chevron), or a closed shape that completes a sketch.
   */
  done: 350,
  /** Nothing in particular to go on. */
  normal: 450,
  /** A lone frame or circle: contents, a tick or a knob may follow. */
  frame: 600,
  /** A tiny mark on its own (tick, chevron, dot, a letter): detail mid-flow. */
  detail: 650,
  /** A single straight line: the first side of a box, or half an X. */
  line: 750,
} as const

/** The longest wait, for tests and anything that must outlast every case. */
export const MAX_IDLE_MS = Math.max(...Object.values(IDLE_MS))

/** Marks smaller than this (px, longest side) count as detail. */
const DETAIL_SIZE = 30
/** End-to-end over path length at or above this is a straight line. */
const STRAIGHT = 0.9
/** A mark this close outside a frame's edge still counts as inside it. */
const INSIDE_SLACK = 6

export function idleDelay(group: Stroke[]): number {
  const last = group[group.length - 1]
  if (!last || last.points.length < 2) return IDLE_MS.normal
  const { points } = last
  if (isClosed(points)) return group.length === 1 ? IDLE_MS.frame : IDLE_MS.done
  // Filling in a frame drawn earlier is usually the last step.
  const box = boundsOf(points)
  const framed = group
    .slice(0, -1)
    .some((s) => isClosed(s.points) && containsBox(boundsOf(s.points), box, INSIDE_SLACK))
  if (framed) return IDLE_MS.done
  if (Math.max(box.w, box.h) < DETAIL_SIZE) return IDLE_MS.detail
  if (group.length === 1 && isStraight(points)) return IDLE_MS.line
  return IDLE_MS.normal
}

function isStraight(points: Stroke['points']): boolean {
  const len = pathLength(points)
  const a = points[0]
  const b = points[points.length - 1]
  return len > 0 && Math.hypot(b.x - a.x, b.y - a.y) / len >= STRAIGHT
}
