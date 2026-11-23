import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { catalog } from '@/recognize/catalog'
import { renderers } from './renderers'

beforeAll(() => {
  // Browser APIs some components (charts, carousels, panels) need.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView ??= () => {}
})

describe('renderers', () => {
  it('has a renderer for every catalog component, plus the frames', () => {
    expect(Object.keys(renderers).sort()).toEqual([...catalog.map((c) => c.kind), 'phone', 'group'].sort())
  })

  it('renders the phone frame', () => {
    expect(() => render(<>{renderers.phone({ box: { x: 0, y: 0, w: 360, h: 720 } })}</>)).not.toThrow()
  })

  it.each(catalog.map((c) => c.kind))('renders %s without throwing', (kind) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Render = renderers[kind]
    const { container } = render(
      <TooltipProvider>
        <div style={{ width: 300, height: 200 }}>
          <Render box={{ x: 0, y: 0, w: 300, h: 200 }} />
        </div>
      </TooltipProvider>,
    )
    expect(container.firstChild).not.toBeNull()
    error.mockRestore()
  })
})
