import type { Point } from '@/lib/geometry'
import type { Stroke } from '@/recognize/types'

let n = 0
export const stroke = (points: Point[]): Stroke => ({ id: `t${++n}`, points })

/** Deterministic wobble so shapes look hand-drawn but tests stay stable. */
const wobble = (i: number, amp: number) => Math.sin(i * 1.7) * amp

/** A box drawn in one stroke, clockwise from the top-left, ends meeting. */
export function boxStroke(x: number, y: number, w: number, h: number, amp = 1.5): Stroke {
  const pts: Point[] = []
  const steps = 20
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ]
  for (let c = 0; c < 4; c++) {
    const [ax, ay] = corners[c]
    const [bx, by] = corners[c + 1]
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      pts.push({ x: ax + (bx - ax) * t + wobble(i + c, amp), y: ay + (by - ay) * t + wobble(i + c + 3, amp) })
    }
  }
  pts.push({ x: x + 2, y: y + 1 })
  return stroke(pts)
}

/** A box drawn as four separate lines, one per side. */
export function boxSides(x: number, y: number, w: number, h: number): Stroke[] {
  const line = (ax: number, ay: number, bx: number, by: number) =>
    stroke(Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 })))
  return [line(x, y, x + w, y), line(x + w, y, x + w, y + h), line(x + w, y + h, x, y + h), line(x, y + h, x, y)]
}

/** A squiggle standing in for handwritten text. */
export function scrawl(x: number, y: number, w: number, h: number): Stroke {
  return stroke(Array.from({ length: 30 }, (_, i) => ({ x: x + (w * i) / 29, y: y + h / 2 + Math.sin(i) * (h / 2) })))
}
