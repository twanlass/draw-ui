import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { SmartphoneIcon } from 'lucide-react'
import { toast } from 'sonner'
import { svgInk } from '@/lib/freehand.js'
import { cn } from '@/lib/utils'
import type { Point } from '@/lib/geometry'
import { buildReport, sendFeedback } from '@/feedback/report'
import { crossOut } from '@/recognize/gestures'
import { heuristicRecognizer } from '@/recognize/heuristic'
import { shapeRule } from '@/recognize/rules'
import { splitLabel } from '@/recognize/split'
import type { Recognizer, Stroke } from '@/recognize/types'
import { newPhoneBox } from './frames'
import { idleDelay } from './idle'
import { PlacedComponent } from './PlacedComponent'
import { canvasReducer, initialState, placedAt, startsNewGroup, type CanvasAction } from './state'

const INK = { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }

let nextId = 0
const newId = (prefix: string) => `${prefix}-${++nextId}`

/**
 * Debug draws like draw mode, but every component shows its match chip, and
 * switching a component there saves a feedback report for the tuning loop.
 */
type Mode = 'draw' | 'interact' | 'debug'

export function SketchCanvas({
  recognizer = heuristicRecognizer,
  status,
}: {
  recognizer?: Recognizer
  /** Shown in the toolbar, e.g. which recognizer is active. */
  status?: string
}) {
  const [state, dispatch] = useReducer(canvasReducer, initialState)
  const [recognizing, setRecognizing] = useState<ReadonlySet<string>>(new Set())
  const [live, setLive] = useState<Point[] | null>(null)
  /** A Shift+drag in progress: where it started and where the pointer is. */
  const [marquee, setMarquee] = useState<{ from: Point; to: Point } | null>(null)
  const [mode, setMode] = useState<Mode>('draw')
  const stateRef = useRef(state)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const idleTimer = useRef<number | undefined>(undefined)

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

    // An X drawn over a component deletes it, skipping recognition.
    const cross = crossOut(group)
    const target = cross && placedAt(stateRef.current.placed, cross)
    if (target) {
      apply({ type: 'erase', id: target.id, strokeIds: [...ids] })
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

  useEffect(() => () => window.clearTimeout(idleTimer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        window.clearTimeout(idleTimer.current)
        apply({ type: 'undo' })
      } else if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey) {
        setMode((m) => (m === 'interact' ? 'draw' : 'interact'))
      } else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) {
        setMode((m) => (m === 'debug' ? 'draw' : 'debug'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const toPoint = (e: React.PointerEvent): Point => {
    const rect = surfaceRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, z: e.pressure || 0.5 }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode === 'interact' || e.button !== 0) return
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

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={surfaceRef}
        data-testid="surface"
        // No text selection while drawing: a stroke across a label shouldn't select it.
        className={cn('absolute inset-0 touch-none', mode !== 'interact' && 'select-none')}
        style={{ cursor: mode === 'interact' ? 'default' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          // Groups have no look of their own; outline them while drawing so
          // you can see what's grouped.
          className={cn(
            mode !== 'interact' &&
              'pointer-events-none [&_[data-kind=group]]:outline-1 [&_[data-kind=group]]:outline-dashed [&_[data-kind=group]]:outline-sky-500/40',
          )}
        >
          {state.placed.map((p) => (
            <PlacedComponent
              key={p.id}
              placed={p}
              chip={mode === 'interact' ? 'hover' : mode === 'debug' ? 'always' : undefined}
              onReassign={(kind) => {
                if (mode === 'debug') {
                  // The correction is the feedback: report the guess as it was.
                  const report = buildReport(p, stateRef.current.placed, kind, status)
                  sendFeedback(report).then(
                    (id) => toast('Feedback saved', { description: `${report.note} · ${id}` }),
                    (err) => toast.error('Feedback not saved', { description: (err as Error).message }),
                  )
                }
                apply({ type: 'reassign', id: p.id, kind })
              }}
            />
          ))}
        </div>
        <svg data-testid="ink" className="pointer-events-none absolute inset-0 size-full fill-foreground/70">
          {state.strokes.map((s) => (
            <path
              key={s.id}
              d={svgInk(s.points, { ...INK, last: true })}
              className={recognizing.has(s.id) ? 'animate-pulse' : undefined}
            />
          ))}
          {live && <path d={svgInk(live, INK)} />}
        </svg>
        {marquee && (
          <div
            data-testid="marquee"
            className="pointer-events-none absolute border border-sky-500 bg-sky-500/5"
            style={(({ x, y, w, h }) => ({ left: x, top: y, width: w, height: h }))(rectOf(marquee))}
          />
        )}
      </div>

      <SideToolbar
        onAddPhone={() => {
          const rect = surfaceRef.current!.getBoundingClientRect()
          const phones = stateRef.current.placed.filter((p) => p.kind === 'phone').map((p) => p.box)
          const box = newPhoneBox(phones, { w: rect.width, h: rect.height })
          apply({
            type: 'add',
            placed: { id: newId('placed'), kind: 'phone', box, drawnBox: box, confidence: 1, alternatives: [], sketch: [] },
          })
        }}
      />
      <Toolbar
        mode={mode}
        onMode={setMode}
        onUndo={() => apply({ type: 'undo' })}
        onClear={() => {
          window.clearTimeout(idleTimer.current)
          apply({ type: 'clear' })
        }}
        canUndo={state.history.length > 0}
        status={recognizing.size > 0 ? 'Recognizing…' : status}
      />
    </div>
  )
}

function rectOf({ from, to }: { from: Point; to: Point }) {
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) }
}

/** Things to drop onto the canvas, down the left edge. */
function SideToolbar({ onAddPhone }: { onAddPhone: () => void }) {
  return (
    <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-lg border bg-background p-1 shadow-sm">
      <button
        className="rounded-md p-2 hover:bg-accent"
        onClick={onAddPhone}
        title="Add a phone frame"
        aria-label="Add a phone frame"
      >
        <SmartphoneIcon className="size-4" />
      </button>
    </div>
  )
}

const MODES: { mode: Mode; label: string; key: string }[] = [
  { mode: 'draw', label: 'Draw', key: 'P' },
  { mode: 'interact', label: 'Interact', key: 'P' },
  { mode: 'debug', label: 'Debug', key: 'D' },
]

function Toolbar(props: {
  mode: Mode
  onMode: (mode: Mode) => void
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
  status?: string
}) {
  const btn =
    'rounded-md px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      {MODES.map(({ mode, label, key }) => (
        <button
          key={mode}
          className={cn(btn, props.mode === mode && 'bg-accent')}
          aria-pressed={props.mode === mode}
          onClick={() => props.onMode(mode)}
          title={`${label} (${key})`}
        >
          {label}
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-border" />
      <button className={btn} onClick={props.onUndo} disabled={!props.canUndo} title="Cmd/Ctrl+Z">
        Undo
      </button>
      <button className={btn} onClick={props.onClear}>
        Clear
      </button>
      {props.status && <span className="px-2 text-xs text-muted-foreground">{props.status}</span>}
    </div>
  )
}
