import { boundsOf } from '@/lib/geometry'
import { findFrame, heuristicRecognizer } from '../heuristic'
import type { Match, Recognizer, Stroke } from '../types'
import type { RankedKind } from './decisions'
import { rasterize } from './rasterize'

export interface JevResult {
  ranked: RankedKind[]
  ms: number
  cost: number | null
}

/** POSTs to the dev-server route, which holds the API key. */
export async function callJev(body: { image: string; width: number; height: number }): Promise<JevResult> {
  const res = await fetch('/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Recognize failed with ${res.status}`)
  return json
}

export async function jevAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/recognize')
    return res.ok && (await res.json()).configured === true
  } catch {
    return false
  }
}

/**
 * Turn Jev's ranking into a match. The top guess always wins, however unsure,
 * since a wrong pick is one click to fix from the chip and a sketch that
 * silently stays is worse. Null only when Jev answered nothing.
 */
export function toMatch(ranked: RankedKind[], strokes: Stroke[]): Match | null {
  const [best, ...rest] = ranked
  if (!best) return null
  // Snap to the drawn frame when there is one; otherwise use the ink bounds.
  const box = findFrame(strokes)?.box ?? boundsOf(strokes.flatMap((s) => s.points))
  return { kind: best.kind, box, confidence: best.p, alternatives: rest.slice(0, 5) }
}

export function createJevRecognizer(deps: {
  call?: typeof callJev
  render?: typeof rasterize
  fallback?: Recognizer
  onResult?: (r: JevResult) => void
} = {}): Recognizer {
  const call = deps.call ?? callJev
  const render = deps.render ?? rasterize
  const fallback = deps.fallback ?? heuristicRecognizer
  return async (strokes) => {
    const box = boundsOf(strokes.flatMap((s) => s.points))
    try {
      const result = await call({ image: render(strokes, box), width: box.w, height: box.h })
      deps.onResult?.(result)
      return toMatch(result.ranked, strokes)
    } catch (err) {
      console.warn('[jev] falling back to shape heuristics:', (err as Error).message)
      return fallback(strokes)
    }
  }
}
