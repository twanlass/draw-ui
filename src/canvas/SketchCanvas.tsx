import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
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
import { PlacedComponent } from './PlacedComponent'
import { containerAt } from './layout'
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
  const idleTimer = useRef<number | undefined>(undefined)
  /** Where the pointer is over the canvas, for hover shortcuts (+/- on a label). */
  const hover = useRef<Point | null>(null)
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
        setMode((m) => (m === 'interact' ? 'draw' : 'interact'))
      } else if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) {
        setMode((m) => (m === 'edit' ? 'draw' : 'edit'))
      } else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) {
        setMode('draw')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const toPoint = (e: React.PointerEvent): Point => {
    const rect = surfaceRef.current!.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      z: e.pressure || 0.5,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode === 'edit' && e.button === 0) {
      const start = toPoint(e)
      const target = editableAt(stateRef.current.placed, start)
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
    hover.current = toPoint(e)
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
    if (mode === 'edit') setHovered(editableAt(stateRef.current.placed, hover.current)?.id)
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

  const highlight = state.placed.find((p) => p.id === hovered)?.box
  const edited = editing && state.placed.find((p) => p.id === editing.id)

  // In edit mode, double-click a component's text to change it.
  const onDoubleClick = (e: React.MouseEvent) => {
    if (mode !== 'edit') return
    const rect = surfaceRef.current!.getBoundingClientRect()
    const target = editableAt(stateRef.current.placed, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    if (target && hasText(target)) openEditor(target)
  }

  // Open the in-place editor on a component's text.
  const openEditor = (target: Placed) => {
    const rect = surfaceRef.current!.getBoundingClientRect()
    const el = surfaceRef.current!.querySelector(`[data-id="${target.id}"]`)
    const shown = el ? shownText(el, rect) : undefined
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
        className={cn('absolute inset-0 touch-none', mode !== 'interact' && 'select-none')}
        style={{
          cursor: draws(mode) ? 'crosshair' : drag?.active ? 'grabbing' : mode === 'edit' && hovered ? 'grab' : 'default',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onPointerLeave={() => {
          hover.current = null
          setHovered(undefined)
        }}
      >
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
          {state.placed.map((p) => (
            <PlacedComponent
              key={p.id}
              placed={p}
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

      {showPhone && (
        <SideToolbar
          onAddPhone={() => {
            const rect = surfaceRef.current!.getBoundingClientRect()
            const phones = stateRef.current.placed.filter((p) => p.kind === 'phone').map((p) => p.box)
            const box = newPhoneBox(phones, { w: rect.width, h: rect.height })
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
      <Toolbar
        mode={mode}
        onMode={setMode}
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
function shownText(el: Element, origin: DOMRect): { text: string; host: HTMLElement; style: React.CSSProperties } | undefined {
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

const MODES: { mode: Mode; label: string; key?: string; Icon: LucideIcon }[] = [
  { mode: 'draw', label: 'Draw', key: 'D', Icon: PencilIcon },
  { mode: 'edit', label: 'Edit', key: 'E', Icon: MousePointer2Icon },
  { mode: 'interact', label: 'Interact', key: 'P', Icon: PointerIcon },
  { mode: 'debug', label: 'Debug', Icon: BugIcon },
]

function Toolbar(props: {
  mode: Mode
  onMode: (mode: Mode) => void
  showDebug: boolean
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
  status?: string
}) {
  // Icon buttons, named by aria-label and title for screen readers and hover.
  const btn = 'rounded-md p-2 hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      {MODES.filter((m) => m.mode !== 'debug' || props.showDebug).map(({ mode, label, key, Icon }) => (
        <button
          key={mode}
          className={cn(btn, props.mode === mode && 'bg-accent')}
          aria-pressed={props.mode === mode}
          aria-label={label}
          onClick={() => props.onMode(mode)}
          title={key ? `${label} (${key})` : label}
        >
          <Icon className="size-4" />
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-border" />
      <button className={btn} onClick={props.onUndo} disabled={!props.canUndo} aria-label="Undo" title="Undo (Cmd/Ctrl+Z)">
        <Undo2Icon className="size-4" />
      </button>
      <button className={btn} onClick={props.onClear} aria-label="Clear" title="Clear">
        <Trash2Icon className="size-4" />
      </button>
      {props.status && <span className="px-2 text-xs text-muted-foreground">{props.status}</span>}
    </div>
  )
}
