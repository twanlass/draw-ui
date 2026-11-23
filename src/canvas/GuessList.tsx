import type { ReactNode } from 'react'
import { pct } from '@/lib/utils'
import { componentName, type ComponentKind } from '@/recognize/catalog'
import type { Ranked } from '@/recognize/types'

/** A menu of components with their probabilities, then any `others` without one. */
export function GuessList({
  guesses,
  others = [],
  onPick,
  children,
}: {
  guesses: Ranked[]
  others?: ComponentKind[]
  onPick: (kind: ComponentKind) => void
  /** Extra rows after the guesses. */
  children?: ReactNode
}) {
  const row = 'flex w-full justify-between rounded-sm px-2 py-1 hover:bg-accent'
  return (
    <ul className="mt-1 max-h-72 w-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
      {guesses.map((g) => (
        <li key={g.kind}>
          <button
            type="button"
            className={row}
            onClick={() => onPick(g.kind)}
          >
            <span>{componentName(g.kind)}</span>
            <span className="text-muted-foreground">{pct(g.p)}</span>
          </button>
        </li>
      ))}
      {others.map((kind, i) => (
        <li key={kind} className={i === 0 && guesses.length ? 'mt-1 border-t pt-1' : undefined}>
          <button type="button" className={row} onClick={() => onPick(kind)}>
            {componentName(kind)}
          </button>
        </li>
      ))}
      {children}
    </ul>
  )
}
