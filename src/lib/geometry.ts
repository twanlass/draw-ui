export interface Point {
  x: number
  y: number
  z?: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function boundsOf(points: Point[]): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function unionBoxes(boxes: Box[]): Box {
  return boundsOf(
    boxes.flatMap((b) => [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
    ]),
  )
}

export function center(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

export function area(b: Box): number {
  return b.w * b.h
}

/** True if `inner` lies inside `outer`, allowing `slack` px of overshoot. */
export function containsBox(outer: Box, inner: Box, slack = 0): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.w <= outer.x + outer.w + slack &&
    inner.y + inner.h <= outer.y + outer.h + slack
  )
}

/** Distance from a point to the nearest edge of a box (0 if inside). */
export function distanceToBox(p: Point, b: Box): number {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w))
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h))
  return Math.hypot(dx, dy)
}

export function pathLength(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return len
}

/**
 * A stroke is "closed" when its ends meet relative to its size, which is how
 * people draw boxes and circles in one go.
 */
export function isClosed(points: Point[], tolerance = 0.2): boolean {
  if (points.length < 4) return false
  const b = boundsOf(points)
  const size = Math.max(b.w, b.h)
  if (size === 0) return false
  const first = points[0]
  const last = points[points.length - 1]
  return Math.hypot(first.x - last.x, first.y - last.y) <= size * tolerance
}
