import { describe, expect, it } from 'vitest'
import { boxSides, boxStroke, scrawl, stroke } from '@/test/sketch'
import { classify } from './heuristic'

describe('heuristic recognizer', () => {
  it('reads a small square as a checkbox', () => {
    expect(classify([boxStroke(10, 10, 24, 24)])?.kind).toBe('checkbox')
  })

  it('reads a big box as a card', () => {
    expect(classify([boxStroke(0, 0, 320, 200)])?.kind).toBe('card')
  })

  it('reads a wide box with centered text as a button', () => {
    expect(classify([boxStroke(0, 0, 140, 44), scrawl(45, 14, 50, 16)])?.kind).toBe('button')
  })

  it('reads a wide box with left-aligned text as an input', () => {
    expect(classify([boxStroke(0, 0, 260, 40), scrawl(10, 12, 70, 16)])?.kind).toBe('input')
  })

  it('reads an empty wide box as an input', () => {
    expect(classify([boxStroke(0, 0, 260, 40)])?.kind).toBe('input')
  })

  it('accepts a box drawn as four separate sides', () => {
    expect(classify(boxSides(0, 0, 300, 180))?.kind).toBe('card')
  })

  it('places the component at the sketched box', () => {
    const box = classify([boxStroke(100, 50, 140, 44)])!.box
    expect(box.x).toBeCloseTo(100, -1)
    expect(box.y).toBeCloseTo(50, -1)
    expect(box.w).toBeCloseTo(140, -1)
    expect(box.h).toBeCloseTo(44, -1)
  })

  it('leaves an open squiggle alone', () => {
    expect(classify([scrawl(0, 0, 200, 40)])).toBeNull()
  })

  it('leaves a lone straight line alone', () => {
    expect(classify([stroke([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 1 }, { x: 300, y: 0 }])])).toBeNull()
  })

  it('leaves a tall narrow box alone', () => {
    expect(classify([boxStroke(0, 0, 40, 100)])).toBeNull()
  })
})
