import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  BugIcon,
  MousePointer2Icon,
  PencilIcon,
  PointerIcon,
  SmartphoneIcon,
  Trash2Icon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { svgInk } from '@/lib/freehand.js'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Point } from '@/lib/geometry'
import { buildReport, sendFeedback } from '@/feedback/report'
import { crossOut } from '@/recognize/gestures'
import { heuristicRecognizer } from '@/recognize/heuristic'
import { shapeRule } from '@/recognize/rules'
import { splitLabel } from '@/recognize/split'
import type { ComponentKind, Recognizer, Stroke } from '@/recognize/types'
import { newPhoneBox } from './frames'
import { idleDelay } from './idle'
import { ComponentPalette } from './ComponentPalette'
import { PlacedComponent } from './PlacedComponent'
import { containerAt, gapAt, parentOf, type Gap } from './layout'
import {
  canvasReducer,
  crossedOut,
  descendantsOf,
  initialState,
  placedAt,
  startsNewGroup,
  type CanvasAction,
  type Placed,
} from './state'
import { textStyleInfo } from './textStyles'

const INK = { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }

let nextId = 0
const newId = (prefix: string) => `${prefix}-${++nextId}`

/**
 * Draw sketches components. Edit doesn't draw: hovering highlights a
 * component, and keys adjust it (+/- steps a label's text style). Interact
 * uses the real components. Debug draws like draw mode, but every component
 * shows its match chip, and switching a component there saves a feedback
 * report for the tuning loop.
 */
type Mode = 'draw' | 'edit' | 'interact' | 'debug'
const draws = (mode: Mode) => mode === 'draw' || mode === 'debug'

export function SketchCanvas({
  recognizer = heuristicRecognizer,
  engine,
  showDebug = false,
  showPhone = false,
}: {
  recognizer?: Recognizer
  /** Which recognizer is active, recorded in feedback reports. */
  engine?: string
  /** Offer debug mode in the toolbar (the app turns it on with ?debug). */
  showDebug?: boolean
  /** Offer the phone frame button (hidden for now). */
  showPhone?: boolean
}) {
  const [state, dispatch] = useReducer(canvasReducer, initialState)
  const [recognizing, setRecognizing] = useState<ReadonlySet<string>>(new Set())
  const [live, setLive] = useState<Point[] | null>(null)
  /** A Shift+drag in progress: where it started and where the pointer is. */
  const [marquee, setMarquee] = useState<{ from: Point; to: Point } | null>(null)
  const [mode, setMode] = useState<Mode>('draw')
  const modeRef = useRef(mode)
  modeRef.current = mode
  /**
   * The bottom toolbar stays out of the way: it shows for a moment when the
   * mode changes (and on first load), while the pointer is near the bottom
   * edge or over it, and while it has a note to show.
   */
  const [revealed, setRevealed] = useState(true)
  const [nearBottom, setNearBottom] = useState(false)
  const [overBar, setOverBar] = useState(false)
  const revealTimer = useRef<number | undefined>(undefined)
  const reveal = useCallback(() => {
    setRevealed(true)
    window.clearTimeout(revealTimer.current)
    revealTimer.current = window.setTimeout(() => setRevealed(false), REVEAL_MS)
  }, [])
  useEffect(() => {
    revealTimer.current = window.setTimeout(() => setRevealed(false), REVEAL_MS)
    return () => window.clearTimeout(revealTimer.current)
  }, [])
  const changeMode = useCallback(
    (next: Mode | ((m: Mode) => Mode)) => {
      setMode(next)
      reveal()
    },
    [reveal],
  )
  /** The component under the pointer in edit mode. */
  const [hovered, setHovered] = useState<string>()
  /**
   * A component being dragged in edit mode, with what's inside it. It only
   * becomes a drag once the pointer has moved a little, so a double-click
   * still edits text.
   */
  const [drag, setDrag] = useState<{
    id: string
    ids: Set<string>
    start: Point
    at: Point
    active: boolean
  } | null>(null)
  const dragRef = useRef(drag)
  /** A component whose text is being edited (edit mode, double-click). */
  const [editing, setEditing] = useState<{
    id: string
    text: string
    host?: HTMLElement
    style: React.CSSProperties
  } | null>(null)
  const stateRef = useRef(state)
  const surfaceRef = useRef<HTMLDivElement>(null)
  /**
   * How far the view has scrolled over the canvas. Everything placed or drawn
   * stays in canvas coordinates; only the view moves. Trackpad or wheel
   * scrolling pans, and so does Space+drag or a middle-button drag.
   */
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const panRef = useRef(pan)
  panRef.current = pan
  const [spaceDown, setSpaceDown] = useState(false)
  const panDrag = useRef<{ from: Point; pan: Point } | null>(null)
  const [panning, setPanning] = useState(false)
  /** Where canvas (0, 0) is on screen. */
  const origin = () => {
    const rect = surfaceRef.current!.getBoundingClientRect()
    return { left: rect.left + panRef.current.x, top: rect.top + panRef.current.y }
  }
  const idleTimer = useRef<number | undefined>(undefined)
  /** Where the pointer is over the canvas, for hover shortcuts (+/- on a label). */
  const hover = useRef<Point | null>(null)
  /** The Cmd+K menu, and where on the canvas its pick goes (the pointer when it opened, or the middle of the view). */
  const [palette, setPalette] = useState(false)
  const paletteAt = useRef<Point>({ x: 0, y: 0 })
  /** Edit mode: the gap between two components under the pointer (a blue line), and the one the open menu inserts into. */
  const [gap, setGap] = useState<Gap | null>(null)
  const [paletteGap, setPaletteGap] = useState<Gap | null>(null)
  /** A short note in the toolbar, like the text style a label just became. */
  const [flash, setFlash] = useState<string>()
  const flashTimer = useRef<number | undefined>(undefined)

  // Keep the ref in step with every dispatch, so timers and pointer handlers
  // that fire before the next render see the latest state.
  const apply = useCallback((action: CanvasAction) => {
    stateRef.current = canvasReducer(stateRef.current, action)
    dispatch(action)
  }, [])

  const closeGroup = useCallback(() => {
    window.clearTimeout(idleTimer.current)
    const { pending, strokes } = stateRef.current
    if (pending.length === 0) return
    const ids = new Set(pending)
    const group = strokes.filter((s) => ids.has(s.id))
    apply({ type: 'closeGroup' })

    // An X deletes what it's drawn over, skipping recognition.
    const cross = crossOut(group)
    const targets = cross ? crossedOut(stateRef.current.placed, group, cross) : []
    if (targets.length) {
      apply({ type: 'erase', ids: targets, strokeIds: [...ids] })
      return
    }

    setRecognizing((r) => new Set([...r, ...ids]))
    // Some shapes settle it without asking the recognizer.
    const ruled = shapeRule(group)
    ;(ruled ? Promise.resolve(ruled) : recognizer(group))
      .then((match) => {
        if (!match) return
        // A checkbox or switch drawn with its label becomes two components.
        const [main, ...rest] = splitLabel(match, group)
        apply({
          type: 'swap',
          id: newId('placed'),
          strokeIds: [...ids],
          match: main.match,
          extra: rest.map((r) => ({ id: newId('placed'), ...r })),
        })
      })
      .catch((err) => console.warn('[draw-ui] recognizer failed', err))
      .finally(() => setRecognizing((r) => new Set([...r].filter((id) => !ids.has(id)))))
  }, [recognizer, apply])

  useEffect(
    () => () => {
      window.clearTimeout(idleTimer.current)
      window.clearTimeout(flashTimer.current)
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        window.clearTimeout(idleTimer.current)
        apply({ type: 'undo' })
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const rect = surfaceRef.current!.getBoundingClientRect()
        paletteAt.current = hover.current ?? {
          x: rect.width / 2 - panRef.current.x,
          y: rect.height / 2 - panRef.current.y,
        }
        setPaletteGap(null)
        setPalette(true)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        // Not the browser's bookmark shortcut: copy the last component.
        e.preventDefault()
        apply({ type: 'duplicate', id: newId('placed') })
      } else if (['+', '=', '-', '_'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // In edit mode, over a label, + and - step it through help text,
        // label, body, subtitle and title. Placed components ignore the
        // pointer outside interact mode, so find it from where the pointer is.
        if (modeRef.current !== 'edit') return
        const at = hover.current
        const target = at && editableAt(stateRef.current.placed, at)
        if (!target || target.kind !== 'label') return
        e.preventDefault()
        apply({
          type: 'restyle',
          id: target.id,
          step: e.key === '+' || e.key === '=' ? 1 : -1,
        })
        const now = stateRef.current.placed.find((p) => p.id === target.id)
        setFlash(textStyleInfo(now?.textStyle).name)
        window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlash(undefined), 1200)
      } else if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey) {
        changeMode((m) => (m === 'interact' ? 'draw' : 'interact'))
      } else if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) {
        changeMode((m) => (m === 'edit' ? 'draw' : 'edit'))
      } else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) {
        changeMode('draw')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply, changeMode])

  // Pressing or releasing Cmd/Ctrl in edit mode switches the hover between a
  // group and the component inside it.
  useEffect(() => {
    if (mode !== 'edit') return
    const rehover = (e: KeyboardEvent) => {
      if (e.key !== 'Meta' && e.key !== 'Control') return
      const at = hover.current
      if (!at || dragRef.current || gapAt(stateRef.current.placed, at)) return
      setHovered(grabbableAt(stateRef.current.placed, at, e.type === 'keydown')?.id)
    }
    window.addEventListener('keydown', rehover)
    window.addEventListener('keyup', rehover)
    return () => {
      window.removeEventListener('keydown', rehover)
      window.removeEventListener('keyup', rehover)
    }
  }, [mode])

  // Hold Space to pan by dragging.
  useEffect(() => {
    const typing = (e: KeyboardEvent) =>
      e.target instanceof Element && !!e.target.closest('input, textarea, [contenteditable="true"]')
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e)) return
      e.preventDefault()
      setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false)
    const blur = () => setSpaceDown(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // Scrolling (two fingers on a trackpad, or the wheel; Shift for sideways)
  // pans. Not passive, so a sideways swipe doesn't navigate back.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Pinch-zoom arrives as Ctrl+wheel: leave it to the browser.
      if (e.ctrlKey) return
      e.preventDefault()
      const sideways = e.shiftKey && !e.deltaX
      const dx = sideways ? e.deltaY : e.deltaX
      const dy = sideways ? 0 : e.deltaY
      setPan((p) => ({ x: p.x - dx, y: p.y - dy }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toPoint = (e: { clientX: number; clientY: number; pressure?: number }): Point => {
    const o = origin()
    return {
      x: e.clientX - o.left,
      y: e.clientY - o.top,
      z: e.pressure || 0.5,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      panDrag.current = { from: { x: e.clientX, y: e.clientY }, pan: panRef.current }
      setPanning(true)
      return
    }
    if (mode === 'edit' && e.button === 0) {
      const start = toPoint(e)
      // Clicking the blue line between two components opens the menu to insert there.
      const between = gapAt(stateRef.current.placed, start)
      if (between) {
        e.preventDefault()
        paletteAt.current = { x: between.x + between.w / 2, y: between.y }
        setPaletteGap(between)
        setGap(null)
        setPalette(true)
        return
      }
      const target = grabbableAt(stateRef.current.placed, start, e.metaKey || e.ctrlKey)
      if (!target) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const ids = new Set([target, ...descendantsOf(target, stateRef.current.placed)].map((p) => p.id))
      dragRef.current = { id: target.id, ids, start, at: start, active: false }
      return
    }
    if (!draws(mode) || e.button !== 0) return
    e.preventDefault()
    window.getSelection()?.removeAllRanges()
    window.clearTimeout(idleTimer.current)
    const start = toPoint(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    // Shift+drag drags out a rect that groups what it surrounds.
    if (e.shiftKey) {
      closeGroup()
      setMarquee({ from: start, to: start })
      return
    }
    const { pending, strokes } = stateRef.current
    const ids = new Set(pending)
    if (startsNewGroup(strokes.filter((s) => ids.has(s.id)), start)) closeGroup()
    setLive([start])
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const pd = panDrag.current
    if (pd) {
      setPan({ x: pd.pan.x + e.clientX - pd.from.x, y: pd.pan.y + e.clientY - pd.from.y })
      return
    }
    hover.current = toPoint(e)
    // Near the bottom edge, and not mid-stroke or mid-drag, brings the toolbar up.
    const rect = surfaceRef.current!.getBoundingClientRect()
    setNearBottom(!live && !marquee && !dragRef.current && e.clientY - rect.top > rect.height - BOTTOM_ZONE)
    const d = dragRef.current
    if (d) {
      const at = hover.current
      const active = d.active || Math.hypot(at.x - d.start.x, at.y - d.start.y) > 4
      dragRef.current = { ...d, at, active }
      setDrag(dragRef.current)
      // While dragging, highlight where it would drop.
      if (active)
        setHovered(
          containerAt(
            stateRef.current.placed.filter((p) => !d.ids.has(p.id)),
            at,
          )?.id,
        )
      return
    }
    if (mode === 'edit') {
      // Between two components: the insert line, not the component behind it.
      const between = gapAt(stateRef.current.placed, hover.current)
      setGap(between)
      setHovered(between ? undefined : grabbableAt(stateRef.current.placed, hover.current, e.metaKey || e.ctrlKey)?.id)
    }
    if (marquee) {
      const to = toPoint(e)
      setMarquee((m) => (m ? { ...m, to } : m))
      return
    }
    if (!live) return
    const p = toPoint(e)
    setLive((pts) => (pts ? [...pts, p] : pts))
  }

  const onPointerUp = () => {
    if (panDrag.current) {
      panDrag.current = null
      setPanning(false)
      return
    }
    const d = dragRef.current
    if (d) {
      dragRef.current = null
      setDrag(null)
      if (d.active)
        apply({
          type: 'move',
          id: d.id,
          dx: d.at.x - d.start.x,
          dy: d.at.y - d.start.y,
          at: d.at,
        })
      return
    }
    if (marquee) {
      setMarquee(null)
      const box = rectOf(marquee)
      if (box.w > 8 && box.h > 8) apply({ type: 'group', id: newId('placed'), box })
      return
    }
    if (!live) return
    const stroke: Stroke = { id: newId('stroke'), points: live }
    setLive(null)
    apply({ type: 'addStroke', stroke })
    // A pause after lifting the pen closes the group and recognizes it. How
    // long depends on whether the sketch looks finished (see idle.ts).
    const { pending, strokes } = stateRef.current
    const ids = new Set(pending)
    idleTimer.current = window.setTimeout(closeGroup, idleDelay(strokes.filter((s) => ids.has(s.id))))
  }

  // While dragging, show the canvas as it would be after the drop: the same
  // move the drop applies, run on a copy, so everything else slides into
  // place live. The dragged component itself follows the pointer.
  const preview = useMemo(() => {
    if (!drag?.active) return null
    return canvasReducer(state, { type: 'move', id: drag.id, dx: drag.at.x - drag.start.x, dy: drag.at.y - drag.start.y, at: drag.at })
  }, [drag, state])
  const shown = preview?.placed ?? state.placed
  const highlight = shown.find((p) => p.id === hovered)?.box
  const edited = editing && state.placed.find((p) => p.id === editing.id)

  // In edit mode, double-click a component's text to change it.
  const onDoubleClick = (e: React.MouseEvent) => {
    if (mode !== 'edit') return
    const target = editableAt(stateRef.current.placed, toPoint(e))
    if (target && hasText(target)) openEditor(target)
  }

  // Open the in-place editor on a component's text.
  const openEditor = (target: Placed) => {
    const el = surfaceRef.current!.querySelector(`[data-id="${target.id}"]`)
    const shown = el ? shownText(el, origin()) : undefined
    // Hide the text being edited while the editor sits on top of it.
    shown?.host.setAttribute('data-editing-text', '')
    setEditing({
      id: target.id,
      text: target.label ?? shown?.text ?? '',
      host: shown?.host,
      // Without a text element to match (no layout), cover the component.
      style: shown?.style ?? {
        left: target.box.x,
        top: target.box.y,
        width: target.box.w,
        height: target.box.h,
      },
    })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={surfaceRef}
        data-testid="surface"
        // No text selection while drawing: a stroke across a label shouldn't select it.
        className={cn('absolute inset-0 touch-none overscroll-none', mode !== 'interact' && 'select-none')}
        style={{
          cursor: panning
            ? 'grabbing'
            : spaceDown
              ? 'grab'
              : draws(mode)
                ? 'crosshair'
                : drag?.active
                  ? 'grabbing'
                  : mode === 'edit' && gap
                    ? 'pointer'
                    : mode === 'edit' && hovered
                      ? 'grab'
                    : 'default',
          // A faint dot grid that moves with the canvas, so panning shows.
          // Interact mode previews the real UI, so no grid there.
          backgroundImage: mode === 'interact' ? undefined : 'radial-gradient(circle, var(--border) 1px, transparent 1.2px)',
          backgroundSize: `${GRID}px ${GRID}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onPointerLeave={() => {
          hover.current = null
          setHovered(undefined)
          setGap(null)
          setNearBottom(false)
        }}
      >
        <div data-testid="world" className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <div
            // Groups have no look of their own. Outline one as it's made so you
            // see what got grouped, then fade it after a moment in draw mode;
            // debug keeps every outline.
            className={cn(
              mode !== 'interact' &&
                'pointer-events-none [&_[data-kind=group]]:outline-1 [&_[data-kind=group]]:outline-dashed [&_[data-kind=group]]:outline-sky-500/40',
              mode === 'draw' && '[&_[data-kind=group]]:animate-[group-outline-fade_300ms_ease-out_500ms_forwards]',
            )}
          >
            {mode === 'edit' && highlight && (
              // Behind the component, a little larger, so it shows around opaque ones like cards.
              <div
                data-testid="hover-highlight"
                className="absolute rounded-md bg-sky-500/10 transition-all duration-100"
                style={{
                  left: highlight.x - 4,
                  top: highlight.y - 4,
                  width: highlight.w + 8,
                  height: highlight.h + 8,
                }}
              />
            )}
            {shown.map((p) => (
              <PlacedComponent
                key={p.id}
                placed={drag?.active && drag.ids.has(p.id) ? (state.placed.find((q) => q.id === p.id) ?? p) : p}
                chip={mode === 'debug'}
                offset={
                  drag?.active && drag.ids.has(p.id) ? { x: drag.at.x - drag.start.x, y: drag.at.y - drag.start.y } : undefined
                }
                onReassign={(kind) => {
                  if (mode === 'debug') {
                    // The correction is the feedback: report the guess as it was.
                    const report = buildReport(p, stateRef.current.placed, kind, engine)
                    sendFeedback(report).then(
                      (id) =>
                        toast('Feedback saved', {
                          description: `${report.note} · ${id}`,
                        }),
                      (err) =>
                        toast.error('Feedback not saved', {
                          description: (err as Error).message,
                        }),
                    )
                  }
                  apply({ type: 'reassign', id: p.id, kind })
                }}
              />
            ))}
          </div>
          {mode === 'edit' && (palette ? paletteGap : gap) && (
            // Where a component would be inserted; stays up while the menu is open.
            <div
              data-testid="insert-line"
              className="pointer-events-none absolute z-40 h-0.5 rounded-full bg-blue-500"
              style={lineStyle((palette ? paletteGap : gap)!)}
            />
          )}
          <svg data-testid="ink" className="pointer-events-none absolute inset-0 size-full overflow-visible fill-foreground/70">
            {state.strokes.map((s) => (
              <path
                key={s.id}
                d={svgInk(s.points, { ...INK, last: true })}
                className={recognizing.has(s.id) ? 'animate-pulse' : undefined}
              />
            ))}
            {live && <path d={svgInk(live, INK)} />}
          </svg>
          {mode === 'edit' && editing && edited && (
            <TextEditor
              key={editing.id}
              initial={editing.text}
              style={editing.style}
              onDone={(text, step) => {
                editing.host?.removeAttribute('data-editing-text')
                setEditing(null)
                if (text !== null) apply({ type: 'setText', id: editing.id, text })
                // Tab / Shift+Tab: on to the next (or previous) text in reading order.
                if (step) {
                  const order = readingOrder(stateRef.current.placed.filter(hasText))
                  const next = order[order.findIndex((p) => p.id === editing.id) + step]
                  if (next) openEditor(next)
                }
              }}
            />
          )}
          {marquee && (
            <div
              data-testid="marquee"
              className="pointer-events-none absolute border border-sky-500 bg-sky-500/5"
              style={(({ x, y, w, h }) => ({
                left: x,
                top: y,
                width: w,
                height: h,
              }))(rectOf(marquee))}
            />
          )}
        </div>
      </div>

      {showPhone && (
        <SideToolbar
          onAddPhone={() => {
            const rect = surfaceRef.current!.getBoundingClientRect()
            const phones = stateRef.current.placed.filter((p) => p.kind === 'phone').map((p) => p.box)
            const inView = newPhoneBox(phones, { w: rect.width, h: rect.height })
            const box = { ...inView, x: inView.x - panRef.current.x, y: inView.y - panRef.current.y }
            apply({
              type: 'add',
              placed: {
                id: newId('placed'),
                kind: 'phone',
                box,
                drawnBox: box,
                confidence: 1,
                alternatives: [],
                sketch: [],
              },
            })
          }}
        />
      )}
      <ComponentPalette
        open={palette}
        onOpenChange={(open) => {
          setPalette(open)
          if (!open) setPaletteGap(null)
        }}
        onPick={(kind) => {
          setPalette(false)
          setPaletteGap(null)
          apply({ type: 'insert', id: newId('placed'), kind, at: paletteAt.current, gap: paletteGap ?? undefined })
        }}
      />
      <Toolbar
        mode={mode}
        onMode={changeMode}
        visible={revealed || nearBottom || overBar || flash !== undefined}
        onHover={setOverBar}
        showDebug={showDebug}
        onUndo={() => apply({ type: 'undo' })}
        onClear={() => {
          window.clearTimeout(idleTimer.current)
          apply({ type: 'clear' })
        }}
        canUndo={state.history.length > 0}
        status={flash ?? (recognizing.size > 0 ? 'Recognizing…' : undefined)}
      />
    </div>
  )
}

/** Components whose text can be edited: a label, button text, a placeholder, a title. */
const TEXT_KINDS: ReadonlySet<ComponentKind> = new Set([
  'label',
  'button',
  'input',
  'input-group',
  'textarea',
  'select',
  'native-select',
  'combobox',
  'badge',
  'alert',
  'alert-dialog',
  'dialog',
  'drawer',
  'dropdown-menu',
  'popover',
  'sheet',
  'sonner',
  'tooltip',
  'attachment',
  'bubble',
  'message',
  'field',
  'item',
])

const hasText = (p: Placed) => TEXT_KINDS.has(p.kind as ComponentKind)

/** Top to bottom, then left to right within a line (tops within 8px count as level). */
function readingOrder(placed: Placed[]): Placed[] {
  return [...placed].sort((a, b) => (Math.abs(a.box.y - b.box.y) > 8 ? a.box.y - b.box.y : a.box.x - b.box.x))
}

/**
 * The text a component shows (its placeholder, if it's a field), the element
 * it's drawn in, and that element's look, so an editor can sit exactly on top.
 */
function shownText(
  el: Element,
  origin: { left: number; top: number },
): { text: string; host: HTMLElement; style: React.CSSProperties } | undefined {
  const field = el.querySelector('input, textarea') as HTMLInputElement | null
  const select = el.querySelector('select')
  let text: string | undefined
  let host: HTMLElement | null = null
  if (field?.placeholder) [text, host] = [field.placeholder, field]
  else if (select?.options[0]) [text, host] = [select.options[0].text, select]
  else {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n && !host; n = walker.nextNode()) {
      if (n.textContent?.trim() && n.parentElement) [text, host] = [n.textContent.trim(), n.parentElement]
    }
  }
  if (!host || text === undefined) return undefined
  const css = getComputedStyle(host)
  const r = host.getBoundingClientRect()
  // Flex boxes (a button) centre their text with justify-content, not text-align.
  const centred = css.display.includes('flex') && css.justifyContent === 'center'
  // A placeholder is drawn in the placeholder colour.
  const color = host === field ? getComputedStyle(field, '::placeholder').color || css.color : css.color
  // The editor is one line, and an input centres its line vertically. A
  // textarea's text starts at the top, so cover just its first line there.
  if (host instanceof HTMLTextAreaElement) {
    const px = (v: string) => parseFloat(v) || 0
    const line = px(css.lineHeight) || px(css.fontSize) * 1.5
    return {
      text,
      host,
      style: {
        left: r.left - origin.left,
        top: r.top - origin.top + px(css.borderTopWidth) + px(css.paddingTop),
        width: r.width,
        height: line,
        font: css.font,
        lineHeight: `${line}px`,
        color,
        letterSpacing: css.letterSpacing,
        textAlign: css.textAlign as React.CSSProperties['textAlign'],
        padding: `0 ${css.paddingRight} 0 ${css.paddingLeft}`,
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderWidth: `0 ${css.borderRightWidth} 0 ${css.borderLeftWidth}`,
      },
    }
  }
  return {
    text,
    host,
    style: {
      left: r.left - origin.left,
      top: r.top - origin.top,
      width: r.width,
      height: r.height,
      font: css.font,
      color,
      letterSpacing: css.letterSpacing,
      textAlign: centred ? 'center' : (css.textAlign as React.CSSProperties['textAlign']),
      padding: css.padding,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderWidth: css.borderWidth,
      borderRadius: css.borderRadius,
    },
  }
}

/**
 * Edits a component's text in place: an input laid exactly over the text,
 * in its font, colour and spacing, so nothing moves. Text starts selected so
 * typing replaces it. Enter or clicking away saves; Escape cancels; Tab and
 * Shift+Tab save and move to the next or previous text.
 */
function TextEditor({
  initial,
  style,
  onDone,
}: {
  initial: string
  style: React.CSSProperties
  onDone: (text: string | null, step?: 1 | -1) => void
}) {
  const done = useRef(false)
  const finish = (text: string | null, step?: 1 | -1) => {
    if (done.current) return
    done.current = true
    onDone(text, step)
  }
  return (
    <input
      aria-label="Edit text"
      defaultValue={initial}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value)
        else if (e.key === 'Escape') finish(null)
        else if (e.key === 'Tab') {
          e.preventDefault()
          finish(e.currentTarget.value, e.shiftKey ? -1 : 1)
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-50 m-0 bg-transparent outline-none"
      style={style}
    />
  )
}

/** The component a hover or edit key acts on: the topmost one under the point, not a phone. */
/**
 * What a press or hover in edit mode picks up. Something in a group picks
 * up the (outermost) group, since a group is one unit; with Cmd/Ctrl held it's
 * the component itself.
 */
function grabbableAt(placed: Placed[], p: Point, deep: boolean) {
  const hit = editableAt(placed, p)
  if (!hit || deep) return hit
  let top = hit
  for (let up = parentOf(top, placed); up?.kind === 'group'; up = parentOf(up, placed)) top = up
  return top
}

function editableAt(placed: Placed[], p: Point) {
  return placedAt(
    placed.filter((x) => x.kind !== 'phone'),
    p,
    4,
  )
}

function rectOf({ from, to }: { from: Point; to: Point }) {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    w: Math.abs(to.x - from.x),
    h: Math.abs(to.y - from.y),
  }
}

/** Things to drop onto the canvas, down the left edge. */
function SideToolbar({ onAddPhone }: { onAddPhone: () => void }) {
  return (
    <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-lg border bg-background p-1 shadow-sm">
      <TooltipProvider delayDuration={300}>
        <ToolButton label="Add a phone frame" side="right" className="rounded-md p-2 hover:bg-accent" onClick={onAddPhone}>
          <SmartphoneIcon className="size-4" />
        </ToolButton>
      </TooltipProvider>
    </div>
  )
}

const lineStyle = ({ x, y, w }: Gap): React.CSSProperties => ({ left: x, top: y - 1, width: w })

/** Spacing of the background dot grid. */
const GRID = 24
/** How long the toolbar stays up after a mode change. */
const REVEAL_MS = 1500
/** The pointer this close to the bottom edge (not drawing) brings the toolbar up. */
const BOTTOM_ZONE = 96

const MODES: { mode: Mode; label: string; key?: string; Icon: LucideIcon }[] = [
  { mode: 'draw', label: 'Draw', key: 'D', Icon: PencilIcon },
  { mode: 'edit', label: 'Edit', key: 'E', Icon: MousePointer2Icon },
  { mode: 'interact', label: 'Interact', key: 'P', Icon: PointerIcon },
  { mode: 'debug', label: 'Debug', Icon: BugIcon },
]

function Toolbar(props: {
  mode: Mode
  onMode: (mode: Mode) => void
  visible: boolean
  onHover: (over: boolean) => void
  showDebug: boolean
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
  status?: string
}) {
  const btn = 'rounded-md p-2 hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-testid="toolbar"
        data-visible={props.visible}
        onPointerEnter={() => props.onHover(true)}
        onPointerLeave={() => props.onHover(false)}
        className={cn(
          'absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-sm transition-all duration-200',
          !props.visible && 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        {MODES.filter((m) => m.mode !== 'debug' || props.showDebug).map(({ mode, label, key, Icon }) => (
          <ToolButton
            key={mode}
            label={label}
            keys={key ? [key] : undefined}
            className={cn(btn, props.mode === mode && 'bg-accent')}
            aria-pressed={props.mode === mode}
            onClick={() => props.onMode(mode)}
          >
            <Icon className="size-4" />
          </ToolButton>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton label="Undo" keys={['⌘', 'Z']} className={btn} onClick={props.onUndo} disabled={!props.canUndo}>
          <Undo2Icon className="size-4" />
        </ToolButton>
        <ToolButton label="Clear" className={btn} onClick={props.onClear}>
          <Trash2Icon className="size-4" />
        </ToolButton>
        {props.status && <span className="px-2 text-xs text-muted-foreground">{props.status}</span>}
      </div>
    </TooltipProvider>
  )
}

/** An icon button with a tooltip naming it and its shortcut; the label is also its accessible name. */
function ToolButton({
  label,
  keys,
  side = 'top',
  children,
  ...button
}: { label: string; keys?: string[]; side?: 'top' | 'right' } & React.ComponentProps<'button'>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} {...button}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="flex items-center gap-2">
        {label}
        {keys && (
          <KbdGroup>
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
