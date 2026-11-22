import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { svgInk } from '@/lib/freehand.js'
import type { Point } from '@/lib/geometry'
import { heuristicRecognizer } from '@/recognize/heuristic'
import type { Recognizer, Stroke } from '@/recognize/types'
import { PlacedComponent } from './PlacedComponent'
import { canvasReducer, initialState, startsNewGroup, type CanvasAction } from './state'

/** A pause this long after lifting the pen closes the group and recognizes it. */
export const GROUP_IDLE_MS = 700

const INK = { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }

let nextId = 0
const newId = (prefix: string) => `${prefix}-${++nextId}`

type Mode = 'draw' | 'interact'

export function SketchCanvas({ recognizer = heuristicRecognizer }: { recognizer?: Recognizer }) {
  const [state, dispatch] = useReducer(canvasReducer, initialState)
  const [live, setLive] = useState<Point[] | null>(null)
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
    recognizer(group).then((match) => {
      if (match) apply({ type: 'swap', id: newId('placed'), strokeIds: [...ids], match })
    })
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
        setMode((m) => (m === 'draw' ? 'interact' : 'draw'))
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
    if (mode !== 'draw' || e.button !== 0) return
    window.clearTimeout(idleTimer.current)
    const start = toPoint(e)
    const { pending, strokes } = stateRef.current
    const ids = new Set(pending)
    if (startsNewGroup(strokes.filter((s) => ids.has(s.id)), start)) closeGroup()
    e.currentTarget.setPointerCapture(e.pointerId)
    setLive([start])
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!live) return
    const p = toPoint(e)
    setLive((pts) => (pts ? [...pts, p] : pts))
  }

  const onPointerUp = () => {
    if (!live) return
    const stroke: Stroke = { id: newId('stroke'), points: live }
    setLive(null)
    apply({ type: 'addStroke', stroke })
    idleTimer.current = window.setTimeout(closeGroup, GROUP_IDLE_MS)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={surfaceRef}
        data-testid="surface"
        className="absolute inset-0 touch-none"
        style={{ cursor: mode === 'draw' ? 'crosshair' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={mode === 'draw' ? 'pointer-events-none' : undefined}>
          {state.placed.map((p) => (
            <PlacedComponent key={p.id} placed={p} />
          ))}
        </div>
        <svg className="pointer-events-none absolute inset-0 size-full fill-foreground/70">
          {state.strokes.map((s) => (
            <path key={s.id} d={svgInk(s.points, { ...INK, last: true })} />
          ))}
          {live && <path d={svgInk(live, INK)} />}
        </svg>
      </div>

      <Toolbar
        mode={mode}
        onToggleMode={() => setMode((m) => (m === 'draw' ? 'interact' : 'draw'))}
        onUndo={() => apply({ type: 'undo' })}
        onClear={() => {
          window.clearTimeout(idleTimer.current)
          apply({ type: 'clear' })
        }}
        canUndo={state.history.length > 0}
      />
    </div>
  )
}

function Toolbar(props: {
  mode: Mode
  onToggleMode: () => void
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
}) {
  const btn =
    'rounded-md px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      <button className={btn} onClick={props.onToggleMode} title="Toggle with P">
        {props.mode === 'draw' ? 'Drawing' : 'Interacting'}
      </button>
      <button className={btn} onClick={props.onUndo} disabled={!props.canUndo} title="Cmd/Ctrl+Z">
        Undo
      </button>
      <button className={btn} onClick={props.onClear}>
        Clear
      </button>
    </div>
  )
}
