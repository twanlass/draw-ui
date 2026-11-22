import { describe, expect, it, vi } from 'vitest'
import { boxStroke, scrawl } from '@/test/sketch'
import { layoutFor } from './rasterize'
import { createJevRecognizer, toMatch } from './recognizer'

const sketch = [boxStroke(100, 100, 140, 44), scrawl(145, 114, 50, 16)]
const render = () => 'data:image/png;base64,AAAA'

describe('Jev recognizer', () => {
  it('swaps to the top component and keeps runners-up as alternatives', async () => {
    const call = vi.fn().mockResolvedValue({
      ranked: [
        { kind: 'button', p: 0.9 },
        { kind: 'badge', p: 0.3 },
        { kind: 'toggle', p: 0.2 },
      ],
      ms: 210,
      cost: 0.00002,
    })
    const match = await createJevRecognizer({ call, render })(sketch)
    expect(match?.kind).toBe('button')
    expect(match?.confidence).toBe(0.9)
    expect(match?.alternatives?.map((a) => a.kind)).toEqual(['badge', 'toggle'])
    // Snaps to the drawn frame, and sends the on-screen size.
    expect(match?.box.w).toBeCloseTo(140, -1)
    expect(call.mock.calls[0][0]).toMatchObject({ image: render() })
    expect(call.mock.calls[0][0].width).toBeGreaterThan(130)
  })

  it('leaves the sketch alone when nothing is likely enough', () => {
    expect(toMatch([{ kind: 'button', p: 0.3 }], sketch)).toBeNull()
    expect(toMatch([], sketch)).toBeNull()
  })

  it('falls back to shape heuristics when Jev fails', async () => {
    const call = vi.fn().mockRejectedValue(new Error('502'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const match = await createJevRecognizer({ call, render })(sketch)
    expect(match?.kind).toBe('button')
    warn.mockRestore()
  })
})

describe('image layout', () => {
  it('scales a tiny sketch up to the 256px minimum', () => {
    const l = layoutFor({ x: 0, y: 0, w: 20, h: 20 })
    expect(Math.min(l.width, l.height)).toBe(256)
  })

  it('scales a huge sketch down to the 1568px maximum', () => {
    const l = layoutFor({ x: 0, y: 0, w: 4000, h: 1000 })
    expect(l.width).toBeLessThanOrEqual(1568)
    expect(l.height).toBeGreaterThanOrEqual(256)
  })

  it('pads a thin line out to the minimum side', () => {
    const l = layoutFor({ x: 0, y: 0, w: 600, h: 2 })
    expect(l.height).toBe(256)
    expect(l.width).toBeLessThanOrEqual(1568)
  })
})

describe('image layout keeps relative size', () => {
  it('upscales a checkbox at most 2x, padding the rest', () => {
    const l = layoutFor({ x: 0, y: 0, w: 24, h: 24 })
    expect(l.scale).toBe(2)
    expect(l.width).toBe(256)
  })
})
