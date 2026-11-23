import { svgInk } from '@/lib/freehand.js'
import { boundsOf, type Box } from '@/lib/geometry'
import type { Stroke } from '../types'

// Jev's image limits: each side 256 to 1568 px, AND at least 78,400 px in
// total (280 x 280). A 256 x 256 image passes the side check but fails the
// area check with "Invalid image dimensions", so the floor is 288 per side.
import { IMAGE_LIMITS } from './decisions'
const MIN_SIDE = 288
const MAX_SIDE = IMAGE_LIMITS.maxSide
const PADDING = 12
const INK_PX = 6
/** Small sketches grow at most this much, then get padded, so a checkbox still looks small. */
const MAX_UPSCALE = 2

export interface Layout {
  /** Canvas pixels per sketch pixel. */
  scale: number
  width: number
  height: number
  /** Where the sketch's top-left lands in the image. */
  offsetX: number
  offsetY: number
}

/**
 * Fit a sketch into Jev's size window: grow small sketches a little and pad
 * them, shrink huge ones, and pad thin ones (a separator line) out to the
 * minimum side. Keeping small things small in the image helps tell a
 * checkbox from a card.
 */
export function layoutFor(box: Box): Layout {
  const w = box.w + PADDING * 2
  const h = box.h + PADDING * 2
  let scale = Math.min(MAX_UPSCALE, Math.max(1, MIN_SIDE / Math.max(w, h)))
  if (Math.max(w, h) * scale > MAX_SIDE) scale = MAX_SIDE / Math.max(w, h)
  const width = Math.max(MIN_SIDE, Math.round(w * scale))
  const height = Math.max(MIN_SIDE, Math.round(h * scale))
  return {
    scale,
    width,
    height,
    offsetX: (width - box.w * scale) / 2,
    offsetY: (height - box.h * scale) / 2,
  }
}

/** Black ink on white, as a PNG data URL. Browser only. */
export function rasterize(strokes: Stroke[], box = boundsOf(strokes.flatMap((s) => s.points))): string {
  const l = layoutFor(box)
  const canvas = document.createElement('canvas')
  canvas.width = l.width
  canvas.height = l.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, l.width, l.height)
  ctx.fillStyle = '#000'
  for (const s of strokes) {
    // Draw at image scale with a constant ink width, so a tiny checkbox
    // blown up 8x doesn't turn into a blob.
    const pts = s.points.map((p) => ({
      x: (p.x - box.x) * l.scale + l.offsetX,
      y: (p.y - box.y) * l.scale + l.offsetY,
      z: p.z,
    }))
    ctx.fill(new Path2D(svgInk(pts, { size: INK_PX, thinning: 0.4, last: true })))
  }
  return canvas.toDataURL('image/png')
}
