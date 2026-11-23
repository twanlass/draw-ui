/**
 * Kinds of text a drawn label can be, smallest to largest. Hovering a label
 * and pressing + or - steps through them; layout uses each one's line height.
 */
export type TextStyle = 'help' | 'label' | 'body' | 'subtitle' | 'title'

export const TEXT_STYLES: { style: TextStyle; name: string; height: number; placeholder: string }[] = [
  { style: 'help', name: 'Help text', height: 16, placeholder: 'Help text' },
  { style: 'label', name: 'Label', height: 20, placeholder: 'Label' },
  { style: 'body', name: 'Body', height: 24, placeholder: 'Body text' },
  { style: 'subtitle', name: 'Subtitle', height: 28, placeholder: 'Subtitle' },
  { style: 'title', name: 'Title', height: 32, placeholder: 'Title' },
]

const info = (style: TextStyle = 'label') => TEXT_STYLES.find((t) => t.style === style)!

export const textStyleInfo = info

/** The next style up (+1) or down (-1), stopping at the ends. */
export function stepTextStyle(style: TextStyle | undefined, step: 1 | -1): TextStyle {
  const i = TEXT_STYLES.findIndex((t) => t.style === (style ?? 'label'))
  return TEXT_STYLES[Math.min(TEXT_STYLES.length - 1, Math.max(0, i + step))].style
}
