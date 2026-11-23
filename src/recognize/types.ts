import type { Box, Point } from '@/lib/geometry'
import type { ComponentKind } from './catalog'

export type { ComponentKind }

export interface Stroke {
  id: string
  points: Point[]
}

export interface Ranked {
  kind: ComponentKind
  /** 0..1, how likely the sketch is this component. */
  p: number
}

export interface Match {
  kind: ComponentKind
  /** Where the real component goes, in canvas coordinates. */
  box: Box
  /** 0..1, how sure the recognizer is. */
  confidence: number
  /** Text read from the sketch, if the recognizer can read it. */
  label?: string
  /** Runner-up components, best first, so the user can switch. */
  alternatives?: Ranked[]
}

/**
 * Turns a finished group of strokes into a component, or null to leave the
 * sketch alone. Async so a model-backed recognizer can do network calls.
 */
export type Recognizer = (strokes: Stroke[]) => Promise<Match | null>
