import { describe, expect, it } from 'vitest'
import { boxStroke, scrawl } from '@/test/sketch'
import { canvasReducer, initialState, startsNewGroup, type CanvasAction, type CanvasState } from './state'

const run = (actions: CanvasAction[], from: CanvasState = initialState) => actions.reduce(canvasReducer, from)
const match = { kind: 'button' as const, box: { x: 0, y: 0, w: 140, h: 44 }, confidence: 1 }

describe('canvas state', () => {
  const a = boxStroke(0, 0, 140, 44)
  const b = scrawl(45, 14, 50, 16)

  it('collects strokes into the open group until it closes', () => {
    const s = run([{ type: 'addStroke', stroke: a }, { type: 'addStroke', stroke: b }])
    expect(s.pending).toEqual([a.id, b.id])
    expect(run([{ type: 'closeGroup' }], s).pending).toEqual([])
  })

  it('swaps the strokes for a component', () => {
    const s = run([
      { type: 'addStroke', stroke: a },
      { type: 'addStroke', stroke: b },
      { type: 'closeGroup' },
      { type: 'swap', id: 'p1', strokeIds: [a.id, b.id], match },
    ])
    expect(s.strokes).toEqual([])
    expect(s.placed).toHaveLength(1)
    expect(s.placed[0].kind).toBe('button')
  })

  it('undo after a swap brings the sketch back, then removes strokes one by one', () => {
    let s = run([
      { type: 'addStroke', stroke: a },
      { type: 'addStroke', stroke: b },
      { type: 'closeGroup' },
      { type: 'swap', id: 'p1', strokeIds: [a.id, b.id], match },
      { type: 'undo' },
    ])
    expect(s.placed).toEqual([])
    expect(s.strokes.map((x) => x.id)).toEqual([a.id, b.id])
    expect(s.pending).toEqual([])
    s = run([{ type: 'undo' }], s)
    expect(s.strokes.map((x) => x.id)).toEqual([a.id])
  })

  it('ignores a late swap if a stroke was undone during recognition', () => {
    const s = run([
      { type: 'addStroke', stroke: a },
      { type: 'addStroke', stroke: b },
      { type: 'closeGroup' },
      { type: 'undo' },
      { type: 'swap', id: 'p1', strokeIds: [a.id, b.id], match },
    ])
    expect(s.placed).toEqual([])
    expect(s.strokes.map((x) => x.id)).toEqual([a.id])
  })

  it('starts a new group when the pen lands far from the open one', () => {
    expect(startsNewGroup([a], { x: 70, y: 20 })).toBe(false)
    expect(startsNewGroup([a], { x: 160, y: 20 })).toBe(false)
    expect(startsNewGroup([a], { x: 400, y: 300 })).toBe(true)
    expect(startsNewGroup([], { x: 400, y: 300 })).toBe(false)
  })
})

describe('switching a placed component', () => {
  it('swaps to an alternative and keeps the old pick as an option', () => {
    const a = boxStroke(0, 0, 140, 44)
    const s = run([
      { type: 'addStroke', stroke: a },
      {
        type: 'swap',
        id: 'p1',
        strokeIds: [a.id],
        match: { ...match, confidence: 0.8, alternatives: [{ kind: 'badge', p: 0.5 }, { kind: 'toggle', p: 0.2 }] },
      },
      { type: 'reassign', id: 'p1', kind: 'badge' },
    ])
    expect(s.placed[0].kind).toBe('badge')
    expect(s.placed[0].confidence).toBe(0.5)
    expect(s.placed[0].alternatives).toEqual([
      { kind: 'button', p: 0.8 },
      { kind: 'toggle', p: 0.2 },
    ])
  })
})
