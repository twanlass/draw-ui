import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

  it('Cmd+D duplicates the last component and stays out of the browser shortcut', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    draw(getByTestId('surface'), boxStroke(100, 100, 140, 44).points)
    draw(getByTestId('surface'), scrawl(145, 114, 50, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    let notPrevented = true
    await act(async () => {
      notPrevented = fireEvent.keyDown(window, { key: 'd', metaKey: true })
    })
    expect(notPrevented).toBe(false)
    expect(container.querySelectorAll('[data-kind="button"]')).toHaveLength(2)
    // Still in draw mode: Cmd+D isn't the D debug toggle.
    expect(container.querySelector('button[aria-pressed="true"]')?.getAttribute('aria-label')).toBe('Draw')
  })

  it('in edit mode, highlights what is hovered and steps a label through text styles with + and -', async () => {
    const asLabel = async (strokes: { points: { x: number; y: number }[] }[]) => {
      const xs = strokes.flatMap((s) => s.points.map((p) => p.x))
      const ys = strokes.flatMap((s) => s.points.map((p) => p.y))
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
      return { kind: 'label' as const, box, confidence: 1 }
    }
    const { getByTestId, container, getByText } = render(<SketchCanvas recognizer={asLabel} />)
    const surface = getByTestId('surface')
    draw(surface, scrawl(100, 100, 120, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    const text = () => container.querySelector('[data-kind="label"]')!.textContent
    expect(text()).toBe('Label')

    // Not while drawing: only in edit mode.
    fireEvent.pointerMove(surface, { clientX: 150, clientY: 108 })
    fireEvent.keyDown(window, { key: '+' })
    expect(text()).toBe('Label')
    await act(async () => {
      fireEvent.keyDown(window, { key: 'e' })
    })
    expect(container.querySelector('button[aria-pressed="true"]')?.getAttribute('aria-label')).toBe('Edit')

    // Away from the label, + does nothing and nothing is highlighted.
    fireEvent.pointerMove(surface, { clientX: 600, clientY: 600 })
    fireEvent.keyDown(window, { key: '+' })
    expect(text()).toBe('Label')

    expect(container.querySelector('[data-testid="hover-highlight"]')).toBeNull()
    await act(async () => {
      fireEvent.pointerMove(surface, { clientX: 150, clientY: 108 })
    })
    expect(container.querySelector('[data-testid="hover-highlight"]')).not.toBeNull()
    await act(async () => {
      fireEvent.keyDown(window, { key: '+' })
    })
    expect(text()).toBe('Body text')
    expect(getByText('Body')).not.toBeNull()
    await act(async () => {
      fireEvent.keyDown(window, { key: '-' })
      fireEvent.keyDown(window, { key: '-' })
    })
    expect(text()).toBe('Help text')

    // Edit mode doesn't draw.
    draw(surface, scrawl(400, 300, 100, 16).points)
    expect(container.querySelectorAll('[data-testid="ink"] path')).toHaveLength(0)
  })

  it('in edit mode, double-clicking a button edits its text; Escape cancels', async () => {
    const { getByTestId, container, queryByLabelText, getByLabelText } = render(<SketchCanvas />)
    const surface = getByTestId('surface')
    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    const button = () => container.querySelector('[data-kind="button"] button')!.textContent

    // Not in draw mode.
    fireEvent.doubleClick(surface, { clientX: 170, clientY: 122 })
    expect(queryByLabelText('Edit text')).toBeNull()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'e' })
    })
    fireEvent.doubleClick(surface, { clientX: 170, clientY: 122 })
    const editor = getByLabelText('Edit text') as HTMLInputElement
    expect(editor.value).toBe('Button')
    fireEvent.change(editor, { target: { value: 'Pay now' } })
    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter' })
    })
    expect(queryByLabelText('Edit text')).toBeNull()
    expect(button()).toBe('Pay now')

    fireEvent.doubleClick(surface, { clientX: 170, clientY: 122 })
    const again = getByLabelText('Edit text') as HTMLInputElement
    expect(again.value).toBe('Pay now')
    fireEvent.change(again, { target: { value: 'Nope' } })
    await act(async () => {
      fireEvent.keyDown(again, { key: 'Escape' })
    })
    expect(button()).toBe('Pay now')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
    })
    expect(button()).toBe('Button')
  })

  it('Tab and Shift+Tab move the text editor through components in reading order', async () => {
    const { getByTestId, container, getByLabelText, queryByLabelText } = render(<SketchCanvas />)
    const surface = getByTestId('surface')
    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    draw(surface, boxStroke(400, 400, 260, 40).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'e' })
    })
    fireEvent.doubleClick(surface, { clientX: 170, clientY: 122 })
    const editor = () => getByLabelText('Edit text') as HTMLInputElement
    fireEvent.change(editor(), { target: { value: 'Pay now' } })
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 'Tab' })
    })
    // On to the input's placeholder, the button's text saved.
    expect(editor().value).toBe('Input')
    expect(container.querySelector('[data-kind="button"] button')!.textContent).toBe('Pay now')
    fireEvent.change(editor(), { target: { value: 'Your name' } })
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 'Tab', shiftKey: true })
    })
    expect(editor().value).toBe('Pay now')
    expect(container.querySelector('[data-kind="input"] input')!.getAttribute('placeholder')).toBe('Your name')
    // Past the last one, Tab just saves and closes.
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 'Tab' })
    })
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 'Tab' })
    })
    expect(queryByLabelText('Edit text')).toBeNull()
  })

  it('in edit mode, drags a component somewhere else; undo puts it back', async () => {
    const { getByTestId, container } = render(<SketchCanvas />)
    const surface = getByTestId('surface')
    draw(surface, boxStroke(100, 100, 140, 44).points)
    draw(surface, scrawl(145, 114, 50, 16).points)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'e' })
    })
    const el = () => container.querySelector('[data-kind="button"]') as HTMLElement
    const before = el().style.cssText
    const drag = async (to: { x: number; y: number }) => {
      await act(async () => {
        fireEvent.pointerDown(surface, { clientX: 170, clientY: 122, button: 0, pointerId: 1 })
        fireEvent.pointerMove(surface, { clientX: to.x, clientY: to.y, pointerId: 1 })
      })
      return async () =>
        act(async () => {
          fireEvent.pointerUp(surface, { pointerId: 1 })
        })
    }

    // A jiggle isn't a drag.
    await (await drag({ x: 172, y: 123 }))()
    expect(el().style.cssText).toBe(before)

    const [left, top] = [parseFloat(el().style.left), parseFloat(el().style.top)]
    const drop = await drag({ x: 470, y: 422 })
    // Follows the pointer while dragging, then lands there.
    expect(parseFloat(el().style.left)).toBe(left + 300)
    expect(parseFloat(el().style.top)).toBe(top + 300)
    await drop()
    expect(parseFloat(el().style.left)).toBeGreaterThan(300)
    expect(parseFloat(el().style.top)).toBeGreaterThan(300)

    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
    })
    expect(el().style.cssText).toBe(before)
  })

  it('only offers debug mode when asked to', () => {
    const { queryByLabelText, unmount } = render(<SketchCanvas />)
    expect(queryByLabelText('Debug')).toBeNull()
    expect(queryByLabelText('Draw')).not.toBeNull()
    unmount()
    expect(render(<SketchCanvas showDebug />).queryByLabelText('Debug')).not.toBeNull()
  })

  it('pans the canvas by scrolling and Space+drag, drawing in canvas coordinates', async () => {
    const recognizer = vi.fn(async (strokes: { points: Point[] }[]) => {
      const xs = strokes.flatMap((s) => s.points.map((p) => p.x))
      const ys = strokes.flatMap((s) => s.points.map((p) => p.y))
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { kind: 'button' as const, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, confidence: 1 }
    })
    const { getByTestId, container } = render(<SketchCanvas recognizer={recognizer} />)
    const surface = getByTestId('surface')
    const world = () => getByTestId('world').style.transform

    fireEvent.wheel(surface, { deltaX: 30, deltaY: 200 })
    expect(world()).toBe('translate(-30px, -200px)')

    // Space+drag pans too, and doesn't draw.
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    draw(surface, [{ x: 100, y: 100, z: 0.5 }, { x: 130, y: 150, z: 0.5 }])
    fireEvent.keyUp(window, { code: 'Space', key: ' ' })
    expect(world()).toBe('translate(0px, -150px)')
    expect(container.querySelectorAll('[data-testid=ink] path')).toHaveLength(0)

    // A sketch drawn at screen (100, 100) lands at canvas (100, 250).
    const sketch = boxStroke(100, 100, 140, 44).points
    draw(surface, sketch)
    await act(async () => {
      vi.advanceTimersByTime(MAX_IDLE_MS)
    })
    const drawn = recognizer.mock.calls[0][0][0].points[0]
    expect(drawn.x).toBeCloseTo(sketch[0].x)
    expect(drawn.y).toBeCloseTo(sketch[0].y + 150)
  })

  it('Cmd+K searches the components and Enter adds the highlighted one', async () => {
    // cmdk measures and scrolls its list, which jsdom can't.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    Element.prototype.scrollIntoView = () => {}
    const { getByPlaceholderText, queryByPlaceholderText, container } = render(<SketchCanvas />)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    })
    const search = getByPlaceholderText('Add a component…')
    await act(async () => {
      fireEvent.change(search, { target: { value: 'textar' } })
    })
    await act(async () => {
      fireEvent.keyDown(search, { key: 'Enter' })
    })
    expect(queryByPlaceholderText('Add a component…')).toBeNull()
    expect([...container.querySelectorAll('[data-kind]')].map((e) => (e as HTMLElement).dataset.kind)).toEqual(['textarea'])
    vi.unstubAllGlobals()
  })

  it('keeps the toolbar hidden except after a mode change or with the pointer near the bottom', async () => {
    const { getByTestId } = render(<SketchCanvas />)
    const bar = () => getByTestId('toolbar').dataset.visible
    // Up on first load, then out of the way.
    expect(bar()).toBe('true')
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(bar()).toBe('false')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'e' })
    })
    expect(bar()).toBe('true')
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(bar()).toBe('false')

    // jsdom gives the surface no size, so anywhere is "near the bottom".
    fireEvent.pointerMove(getByTestId('surface'), { clientX: 10, clientY: 10 })
    expect(bar()).toBe('true')
    fireEvent.pointerLeave(getByTestId('surface'))
    expect(bar()).toBe('false')
  })

  it('names toolbar buttons and their shortcuts in tooltips', async () => {
    // Radix positions tooltips with ResizeObserver, which jsdom doesn't have.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    const { getByLabelText, getByRole } = render(<SketchCanvas />)
    await act(async () => {
      getByLabelText('Edit').focus()
      vi.advanceTimersByTime(500)
    })
    expect(getByRole('tooltip').textContent).toBe('EditE')
    vi.unstubAllGlobals()
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
      const { getByTestId, getByText, getByLabelText, container } = render(<SketchCanvas engine="Shapes only" showDebug />)
      const surface = getByTestId('surface')
      // D draws; debug is only on the toolbar.
      fireEvent.click(getByLabelText('Debug'))
      fireEvent.keyDown(window, { key: 'd' })
      expect(container.querySelector('button[aria-pressed="true"]')?.getAttribute('aria-label')).toBe('Draw')
      fireEvent.click(getByLabelText('Debug'))
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
  it('adds a phone frame from the side toolbar (when offered)', async () => {
    expect(render(<SketchCanvas />).queryByLabelText('Add a phone frame')).toBeNull()
    cleanup()
    const { getByLabelText, container } = render(<SketchCanvas showPhone />)
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
