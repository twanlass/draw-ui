import { Component, useState, type ReactNode } from 'react'
import { componentName, type ComponentKind } from '@/recognize/catalog'
import { renderers } from './renderers'
import type { Placed } from './state'

const pct = (p: number) => `${Math.round(p * 100)}%`

/** Renders the real shadcn component at the sketch's position and size. */
export function PlacedComponent({
  placed,
  showChip,
  onReassign,
}: {
  placed: Placed
  showChip: boolean
  onReassign: (kind: ComponentKind) => void
}) {
  const { box, kind, label } = placed
  const Render = renderers[kind]
  return (
    <div
      data-kind={kind}
      className="group/placed absolute flex items-center justify-center animate-in fade-in zoom-in-95 duration-150"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <RenderBoundary key={kind} kind={kind}>
        <Render box={box} label={label} />
      </RenderBoundary>
      {showChip && <MatchChip placed={placed} onReassign={onReassign} />}
    </div>
  )
}

/**
 * What the sketch was read as, with Jev's confidence. Opens the runner-up
 * components so a wrong guess is one click to fix.
 */
function MatchChip({ placed, onReassign }: { placed: Placed; onReassign: (kind: ComponentKind) => void }) {
  const [open, setOpen] = useState(false)
  const hasAlternatives = placed.alternatives.length > 0
  return (
    <div
      className="pointer-events-auto absolute left-0 top-full z-20 mt-1 text-xs"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground shadow-xs hover:text-foreground"
        onClick={() => hasAlternatives && setOpen((o) => !o)}
        title={hasAlternatives ? 'Switch to another component' : undefined}
      >
        {componentName(placed.kind)} {pct(placed.confidence)}
        {hasAlternatives && ' ▾'}
      </button>
      {open && (
        <ul className="mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
          {placed.alternatives.map((a) => (
            <li key={a.kind}>
              <button
                type="button"
                className="flex w-full justify-between rounded-sm px-2 py-1 hover:bg-accent"
                onClick={() => {
                  setOpen(false)
                  onReassign(a.kind)
                }}
              >
                <span>{componentName(a.kind)}</span>
                <span className="text-muted-foreground">{pct(a.p)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One component failing to render shouldn't take down the canvas. */
class RenderBoundary extends Component<{ kind: ComponentKind; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.error(`[draw-ui] ${this.props.kind} failed to render`, err)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex size-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
        {componentName(this.props.kind)}
      </div>
    )
  }
}
