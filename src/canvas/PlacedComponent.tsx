import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { catalog, type ComponentKind } from '@/recognize/catalog'
import { isFrame, kindName, type PlacedKind } from './frames'
import { cn, pct } from '@/lib/utils'
import { GuessList } from './GuessList'
import { renderers } from './renderers'
import type { Placed } from './state'

/** When the match chip shows: on hover (interacting), always (debug), or never. */
export type ChipMode = 'hover' | 'always'

/** Renders the real shadcn component at the sketch's position and size. */
export function PlacedComponent({
  placed,
  chip,
  onReassign,
}: {
  placed: Placed
  chip?: ChipMode
  onReassign: (kind: ComponentKind) => void
}) {
  const { box, kind, label } = placed
  const Render = renderers[kind]
  const ref = useRef<HTMLDivElement>(null)
  const chipTop = useContentBottom(ref, kind)
  return (
    <div
      ref={ref}
      data-kind={kind}
      // Hovered, or with its menu open, it rises above its neighbours so its
      // chip and menu aren't hidden under components placed later. A frame
      // has no chip and must stay beneath what's drawn in it.
      className={cn(
        'group/placed absolute flex items-center justify-start transition-[left,top,width,height] ease-out animate-in fade-in zoom-in-95 duration-200',
        !isFrame(kind) && 'hover:z-30 has-[[data-chip-open]]:z-40',
      )}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <RenderBoundary key={kind} kind={kind}>
        <Render box={box} label={label} />
      </RenderBoundary>
      {chip && !isFrame(kind) && <MatchChip placed={placed} mode={chip} top={chipTop} onReassign={onReassign} />}
    </div>
  )
}

/**
 * What the sketch was read as, with Jev's confidence. Opens the runner-up
 * components so a wrong guess is one click to fix. On hover it shows only
 * while its component is hovered (or its menu is open), so a tight stack of
 * components doesn't bury itself in chips. In debug mode it always shows and
 * the menu lists every component, so any wrong guess can be corrected.
 */
function MatchChip({
  placed,
  mode,
  top,
  onReassign,
}: {
  placed: Placed
  mode: ChipMode
  top: number | undefined
  onReassign: (kind: ComponentKind) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debug = mode === 'always'
  const others = debug
    ? catalog
        .map((c) => c.kind)
        .filter((k) => k !== placed.kind && !placed.alternatives.some((a) => a.kind === k))
    : []
  const canSwitch = placed.alternatives.length > 0 || others.length > 0

  // Clicking anywhere else closes the menu.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div
      ref={ref}
      data-chip-open={open || undefined}
      // Padding, not margin, above the chip, so the pointer can cross from
      // the component to the chip without leaving it.
      className={cn(
        'pointer-events-auto absolute left-0 top-full z-20 pt-1 text-xs',
        !debug && 'invisible group-hover/placed:visible data-[chip-open]:visible',
      )}
      style={top === undefined ? undefined : { top }}
      // Don't start a stroke when clicking the chip while drawing.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground shadow-xs hover:text-foreground"
        onClick={() => canSwitch && setOpen((o) => !o)}
        title={canSwitch ? 'Switch to another component' : undefined}
      >
        {kindName(placed.kind)} {pct(placed.confidence)}
        {canSwitch && ' ▾'}
      </button>
      {open && (
        <GuessList
          guesses={placed.alternatives}
          others={others}
          onPick={(kind) => {
            setOpen(false)
            onReassign(kind)
          }}
        />
      )}
    </div>
  )
}

/**
 * Where the rendered component's bottom edge sits inside the placed box. A
 * control with a standard height is shorter than the sketch and centred in it,
 * so the chip follows the component rather than the sketch's bottom edge.
 */
function useContentBottom(ref: React.RefObject<HTMLDivElement | null>, kind: PlacedKind) {
  const [bottom, setBottom] = useState<number>()
  useLayoutEffect(() => {
    const content = ref.current?.firstElementChild
    if (!(content instanceof HTMLElement)) return
    // No layout (e.g. jsdom) reads as 0; keep the chip under the sketch box then.
    const measure = () => setBottom(content.offsetHeight ? content.offsetTop + content.offsetHeight : undefined)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [ref, kind])
  return bottom
}

/** One component failing to render shouldn't take down the canvas. */
class RenderBoundary extends Component<{ kind: PlacedKind; children: ReactNode }, { failed: boolean }> {
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
        {kindName(this.props.kind)}
      </div>
    )
  }
}
