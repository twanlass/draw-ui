import type { Box, Point } from '@/lib/geometry'

export interface Stroke {
  id: string
  points: Point[]
}

export type ComponentKind = 'button' | 'input' | 'checkbox' | 'card'

export interface Match {
  kind: ComponentKind
  /** Where the real component goes, in canvas coordinates. */
  box: Box
  /** 0..1, how sure the recognizer is. */
  confidence: number
  /** Text read from the sketch, if the recognizer can read it. */
  label?: string
}

/**
 * Turns a finished group of strokes into a component, or null to leave the
 * sketch alone. Async so a model-backed recognizer can slot in later.
 */
export type Recognizer = (strokes: Stroke[]) => Promise<Match | null>
