import type { Box } from '@/lib/geometry'
import { componentName, type ComponentKind } from '@/recognize/catalog'

/**
 * Containers made with tools rather than recognized from a sketch, so they
 * aren't in the catalog Jev is asked about: a phone frame from the side
 * toolbar, and an invisible group from a Shift+drag.
 */
export type FrameKind = 'phone' | 'group'
/** Anything that can sit on the canvas. */
export type PlacedKind = ComponentKind | FrameKind

export const isFrame = (kind: PlacedKind): kind is FrameKind => kind === 'phone' || kind === 'group'

/** Frames with a fixed size, which never grow or hug their content. */
export const isFixedSize = (kind: PlacedKind) => kind === 'phone'

const FRAME_NAMES: Record<FrameKind, string> = { phone: 'Phone', group: 'Group' }
export const kindName = (kind: PlacedKind) => (isFrame(kind) ? FRAME_NAMES[kind] : componentName(kind))

/** A phone screen in CSS pixels, a little smaller than a real one so it fits a laptop canvas. */
export const PHONE = { w: 360, h: 720 }
/** The bezel width, drawn by the renderer. */
export const PHONE_BEZEL = 8

/**
 * Where content goes inside a frame: under the status bar, above the home
 * indicator, with standard mobile side padding (16px inside the bezel).
 */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}
export const PHONE_INSETS: Insets = {
  top: PHONE_BEZEL + 44 + 8,
  right: PHONE_BEZEL + 16,
  bottom: PHONE_BEZEL + 24,
  left: PHONE_BEZEL + 16,
}

/** A group is a bare flex container: no padding, nothing drawn. */
export const GROUP_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Where a new phone goes: right of the side toolbar and any other phones, centred vertically. */
export function newPhoneBox(existingPhones: Box[], canvas: { w: number; h: number }): Box {
  const x = Math.max(96, ...existingPhones.map((b) => b.x + b.w + 48))
  const y = Math.max(24, Math.round((canvas.h - PHONE.h) / 2))
  return { x, y, ...PHONE }
}
