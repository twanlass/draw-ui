// Builds and reads OpenRouter Decisions API calls for Jev. Pure functions with
// relative imports only, so the Vite dev-server plugin can load this file too.
// API docs: https://openrouter.ai/docs/guides/community/jev
import { catalog, type ComponentKind } from '../catalog'

export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions'
export const DEFAULT_JEV_MODEL = 'typesafe/jev-1.14'

/** Jev's documented image limits (multimodal-decisions docs). */
export const IMAGE_LIMITS = { minSide: 256, maxSide: 1568, minArea: 78_400, maxArea: 2_458_624 }

/** Width and height from a PNG or JPEG data URL's header, or null if unreadable. */
export function imageSize(dataUrl: string): { width: number; height: number } | null {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bytes = Uint8Array.from(atob(b64.slice(0, 64 * 1024)), (c) => c.charCodeAt(0))
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length >= 24) {
    const v = new DataView(bytes.buffer)
    return { width: v.getUint32(16), height: v.getUint32(20) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walk JPEG segments to the start-of-frame marker.
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null
      const marker = bytes[i + 1]
      const len = (bytes[i + 2] << 8) | bytes[i + 3]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] }
      }
      i += 2 + len
    }
  }
  return null
}

/** Why Jev would reject an image of this size, or null if it fits. */
export function imageSizeProblem(size: { width: number; height: number }): string | null {
  const { width: w, height: h } = size
  const L = IMAGE_LIMITS
  if (Math.min(w, h) < L.minSide || Math.max(w, h) > L.maxSide) {
    return `each side must be ${L.minSide}-${L.maxSide}px, got ${w}x${h}`
  }
  if (w * h < L.minArea || w * h > L.maxArea) {
    return `total pixels must be ${L.minArea}-${L.maxArea}, got ${w * h} (${w}x${h})`
  }
  return null
}

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
