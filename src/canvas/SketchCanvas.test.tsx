import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point } from '@/lib/geometry'
import { boxStroke, scrawl } from '@/test/sketch'
import { GROUP_IDLE_MS, SketchCanvas } from './SketchCanvas'

function draw(surface: Element, points: Point[]) {
  const [first, ...rest] = points
  fireEvent.pointerDown(surface, { clientX: first.x, clientY: first.y, button: 0, pointerId: 1 })
  for (const p of rest) fireEvent.pointerMove(surface, { clientX: p.x, clientY: p.y, pointerId: 1 })
  fireEvent.pointerUp(surface, { pointerId: 1 })
}

describe('SketchCanvas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('swaps a sketched button for a real one after a pause, and undo brings the sketch back', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')

    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    expect(container.querySelector('[data-kind]')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(GROUP_IDLE_MS)
    })
    expect(container.querySelector('[data-kind="button"] button')).not.toBeNull()
    expect(container.querySelectorAll('svg path')).toHaveLength(0)

    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
    })
    expect(container.querySelector('[data-kind]')).toBeNull()
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
  })

  it('closes the open group when the next stroke starts far away', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')

    draw(surface, boxStroke(20, 20, 24, 24).points)
    draw(surface, boxStroke(400, 400, 260, 40).points)
    await act(async () => {
      vi.advanceTimersByTime(GROUP_IDLE_MS)
    })
    const kinds = [...container.querySelectorAll('[data-kind]')].map((el) => el.getAttribute('data-kind'))
    expect(kinds.sort()).toEqual(['checkbox', 'input'])
  })
})
