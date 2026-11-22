import { describe, expect, it } from 'vitest'
import { catalog } from '../catalog'
import { buildDecisionRequest, rankAnswers } from './decisions'

const input = { image: 'data:image/png;base64,AAAA', width: 140.4, height: 44 }

describe('Jev decision request', () => {
  const req = buildDecisionRequest(input)

  it('asks one yes/no question per component, within the 250-question limit', () => {
    const qs = Object.values(req.questions) as { type: string; criteria: { true: string } }[]
    expect(qs).toHaveLength(catalog.length)
    expect(qs.length).toBeLessThanOrEqual(250)
    expect(qs.every((q) => q.type === 'noul' && q.criteria.true.length > 20)).toBe(true)
  })

  it('sends the sketch image once, in state, with its on-screen size', () => {
    expect(req.state[1]).toEqual({ type: 'image_url', image_url: { url: input.image } })
    expect(req.state[0]).toContain('140px wide and 44px tall')
    expect(req.model).toBe('typesafe/jev-1.14')
  })

  it('has unique, API-safe question keys', () => {
    const keys = Object.keys(req.questions)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => /^[a-z_]+$/.test(k))).toBe(true)
  })
})

describe('rankAnswers', () => {
  it('ranks components by probability and drops refusals and unknown keys', () => {
    const ranked = rankAnswers({
      answers: {
        is_button: { type: 'noul', noul: 0.91 },
        is_toggle: { type: 'noul', noul: 0.4 },
        is_input_otp: { type: 'noul', noul: 0.05 },
        is_badge: { type: 'refusal' },
        is_spaceship: { type: 'noul', noul: 0.99 },
      },
    })
    expect(ranked).toEqual([
      { kind: 'button', p: 0.91 },
      { kind: 'toggle', p: 0.4 },
      { kind: 'input-otp', p: 0.05 },
    ])
  })

  it('handles a response with no answers', () => {
    expect(rankAnswers({})).toEqual([])
  })
})
