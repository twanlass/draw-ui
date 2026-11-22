// Builds and reads OpenRouter Decisions API calls for Jev. Pure functions with
// relative imports only, so the Vite dev-server plugin can load this file too.
// API docs: https://openrouter.ai/docs/guides/community/jev
import { catalog, type ComponentKind } from '../catalog'

export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions'
export const DEFAULT_JEV_MODEL = 'typesafe/jev-1.14'

/** Below this, the best guess isn't trusted and the sketch stays a sketch. */
export const MIN_PROBABILITY = 0.5

export interface RecognizeInput {
  /** PNG or JPEG data URL of the sketch, 256 to 1568 px per side. */
  image: string
  /** On-screen size of the sketch in px, since the image is rescaled. */
  width: number
  height: number
}

export interface RankedKind {
  kind: ComponentKind
  p: number
}

const questionKey = (kind: string) => `is_${kind.replace(/-/g, '_')}`
const kindByKey = new Map(catalog.map((c) => [questionKey(c.kind), c.kind as ComponentKind]))

/** One yes/no question per catalog component, all answered in a single call. */
export function buildDecisionRequest(input: RecognizeInput, model = DEFAULT_JEV_MODEL) {
  const w = Math.round(input.width)
  const h = Math.round(input.height)
  const questions: Record<string, unknown> = {}
  for (const c of catalog) {
    questions[questionKey(c.kind)] = {
      type: 'noul',
      instructions: `Is this sketch a drawing of a ${c.name} component?`,
      criteria: {
        true: c.sketch,
        false: `The sketch shows a different UI element, not a ${c.name}.`,
      },
    }
  }
  return {
    model,
    state: [
      'A rough hand-drawn wireframe of one UI element, sketched with a mouse or pen on a canvas where someone is mocking up an app screen. ' +
        `On screen it is ${w}px wide and ${h}px tall. Black ink on white; the image is scaled, so judge size from these numbers.`,
      { type: 'image_url', image_url: { url: input.image } },
    ],
    questions,
  }
}

interface DecisionsResponse {
  answers?: Record<string, { type: string; noul?: number }>
}

/** Every component that got an answer, most likely first. Refusals are dropped. */
export function rankAnswers(response: DecisionsResponse): RankedKind[] {
  const ranked: RankedKind[] = []
  for (const [key, answer] of Object.entries(response.answers ?? {})) {
    const kind = kindByKey.get(key)
    if (!kind || answer.type !== 'noul' || typeof answer.noul !== 'number') continue
    ranked.push({ kind, p: answer.noul })
  }
  return ranked.sort((a, b) => b.p - a.p)
}
