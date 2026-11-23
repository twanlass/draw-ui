import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point } from '@/lib/geometry'
import { boxStroke, scrawl } from '@/test/sketch'
import { MAX_IDLE_MS } from './idle'
import { SketchCanvas } from './SketchCanvas'

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

  it('swaps a sketched button for a real one after a pause, and undo removes it and the sketch', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')

    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    expect(container.querySelector('[data-kind]')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    expect(container.querySelector('[data-kind="button"] button')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="ink"] path')).toHaveLength(0)

    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
    })
    expect(container.querySelector('[data-kind]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="ink"] path')).toHaveLength(0)
  })

  it('closes the open group when the next stroke starts far away', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')

    draw(surface, boxStroke(20, 20, 24, 24).points)
    draw(surface, boxStroke(400, 400, 260, 40).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    const kinds = [...container.querySelectorAll('[data-kind]')].map((el) => el.getAttribute('data-kind'))
    expect(kinds.sort()).toEqual(['checkbox', 'input'])
  })

  it('deletes a component when an X is drawn over it, and undo restores it', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')

    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    expect(container.querySelector('[data-kind="button"]')).not.toBeNull()

    const line = (ax: number, ay: number, bx: number, by: number) =>
      Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 }))
    draw(surface, line(130, 90, 210, 160))
    draw(surface, line(210, 90, 130, 160))
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    expect(container.querySelector('[data-kind]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="ink"] path')).toHaveLength(0)

    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
    })
    expect(container.querySelector('[data-kind="button"]')).not.toBeNull()
  })

  it('wraps components in a card drawn around them', async () => {
    // Big sketches are cards, everything else an input.
    const recognizer = async (strokes: { points: Point[] }[]) => {
      const xs = strokes.flatMap((s) => s.points.map((p) => p.x))
      const ys = strokes.flatMap((s) => s.points.map((p) => p.y))
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
      return { kind: box.h > 100 ? ('card' as const) : ('input' as const), box, confidence: 0.9 }
    }
    const { getByTestId, container } = render(<SketchCanvas recognizer={recognizer} />)
    const surface = getByTestId('surface')
    const pause = () => act(async () => void vi.advanceTimersByTime(MAX_IDLE_MS))

    draw(surface, boxStroke(100, 100, 300, 40).points)
    await pause()
    draw(surface, boxStroke(112, 170, 280, 40).points)
    await pause()
    draw(surface, boxStroke(70, 60, 360, 200).points)
    await pause()

    const placed = [...container.querySelectorAll<HTMLElement>('[data-kind]')]
    expect(placed.map((el) => el.dataset.kind)).toEqual(['card', 'input', 'input'])
    // The inputs share a left edge and width.
    expect(placed[1].style.left).toBe(placed[2].style.left)
    expect(placed[1].style.width).toBe(placed[2].style.width)

    // An X on an input deletes the input, not the card around it.
    const line = (ax: number, ay: number, bx: number, by: number) =>
      Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 11, y: ay + ((by - ay) * i) / 11 }))
    const top = parseFloat(placed[1].style.top)
    draw(surface, line(200, top - 10, 260, top + 46))
    draw(surface, line(260, top - 10, 200, top + 46))
    await pause()
    expect([...container.querySelectorAll<HTMLElement>('[data-kind]')].map((el) => el.dataset.kind)).toEqual(['card', 'input'])
  })
  it('in debug mode, switching a component saves feedback with the original guess and sketch', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'fb-1' })))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const { getByTestId, getByText, container } = render(<SketchCanvas status="Shapes only" />)
      const surface = getByTestId('surface')
      fireEvent.keyDown(window, { key: 'd' })
      draw(surface, boxStroke(100, 100, 140, 44).points)
      draw(surface, scrawl(145, 114, 50, 16).points)
      await act(async () => {
        vi.advanceTimersByTime(MAX_IDLE_MS)
      })

      // Debug still draws, and the chip shows without hovering.
      fireEvent.click(getByText(/Button \d+%/))
      await act(async () => {
        fireEvent.click(getByText('Switch'))
      })

      expect(container.querySelector('[data-kind="switch"]')).not.toBeNull()
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe('/api/feedback')
      const report = JSON.parse(init.body as string)
      expect(report).toMatchObject({
        expected: 'switch',
        engine: 'Shapes only',
        target: { kind: 'button' },
        note: expect.stringMatching(/^Read as Button \(\d+%\), should be Switch$/),
      })
      expect(report.target.sketch).toHaveLength(2)
      expect(report.canvas).toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('adds a phone frame from the side toolbar', async () => {
    const { getByLabelText, container } = render(<SketchCanvas />)
    fireEvent.click(getByLabelText('Add a phone frame'))
    expect(container.querySelector('[data-kind="phone"]')).not.toBeNull()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
    })
    expect(container.querySelector('[data-kind="phone"]')).toBeNull()
  })
  it('Shift+drag draws a selection rect and groups what it surrounds', async () => {
    const { getByTestId, queryByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')
    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })

    fireEvent.pointerDown(surface, { clientX: 60, clientY: 60, button: 0, pointerId: 1, shiftKey: true })
    fireEvent.pointerMove(surface, { clientX: 300, clientY: 200, pointerId: 1, shiftKey: true })
    expect(getByTestId('marquee')).toBeTruthy()
    fireEvent.pointerUp(surface, { pointerId: 1 })

    expect(queryByTestId('marquee')).toBeNull()
    expect(container.querySelector('[data-kind="group"]')).not.toBeNull()
    // The drag isn't ink.
    expect(container.querySelectorAll('[data-testid="ink"] path')).toHaveLength(0)
  })
})
