/**
 * @file mosaic-burn-word-boxes-tails.test.js
 * @description Coverage tails for mosaic/burn/paper.js — the DOM Range
 * fragment path (titleWordBoxes): per-word rects drive fillText positions,
 * empty/missing Range support falls back to the measured word-pack, and
 * non-text / whitespace-only children are skipped.
 */

import { describe, test, expect, afterEach } from '@jest/globals'
import { rasterizeTitle } from '@website/components/home/mosaic/burn/paper.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'

const savedCreateRange = Object.getOwnPropertyDescriptor(document, 'createRange')

/** Recording 2d ctx — tracks fillText/measureText calls, swallows the rest. */
const recCtx = () => {
  const calls = { fillText: [], measureText: 0 }

  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'fillText') return (...a) => calls.fillText.push(a)
        if (prop === 'measureText') return () => (calls.measureText++, { width: 1e6 })

        return () => undefined
      },
      set: () => true,
    }
  )

  return { ctx, calls }
}

/** Paper stub — rasterizeTitle only reads width + getContext. */
const stubPaper = (ctx, w = 400) => ({ width: w, getContext: () => ctx })

/** h2 whose only child is the given text node. */
const titleWith = (...nodes) => {
  const h2 = document.createElement(HTML_TAGS.H2)

  for (const n of nodes) h2.appendChild(n)

  return h2
}

/** Range stub returning `rects[i]` per created range, in call order. */
const rangeSeq = (rects) => {
  let i = 0

  return () => ({
    setStart: () => {},
    setEnd: () => {},
    getClientRects: () => rects[Math.min(i++, rects.length - 1)] ?? [],
  })
}

afterEach(() => {
  if (savedCreateRange) Object.defineProperty(document, 'createRange', savedCreateRange)
})

describe('mosaic burn word-box tails', () => {
  test('DOM word rects position each word — wrap never consulted', () => {
    const h2 = titleWith(document.createTextNode('Dell Design'))

    document.createRange = rangeSeq([
      [{ left: 10, top: 5, right: 70, bottom: 30, width: 60, height: 25 }],
      [{ left: 80, top: 5, right: 160, bottom: 30, width: 80, height: 25 }],
    ])

    const { ctx, calls } = recCtx()

    rasterizeTitle(h2, stubPaper(ctx), 400, 40, 'rgb(0,0,0)')

    // Two words drawn at their DOM x; baseline = bottom − 0.22·fontPx.
    expect(calls.fillText.map((c) => c[0])).toEqual(['Dell', 'Design'])
    expect(calls.fillText[0][1]).toBe(10)
    expect(calls.fillText[1][1]).toBe(80)
    expect(calls.measureText).toBe(0)
  })

  test('a word fragment without a rect is skipped, siblings still draw', () => {
    const h2 = titleWith(document.createTextNode('A B'))

    document.createRange = rangeSeq([
      [],
      [{ left: 20, top: 5, right: 40, bottom: 30, width: 20, height: 25 }],
    ])

    const { ctx, calls } = recCtx()

    rasterizeTitle(h2, stubPaper(ctx), 400, 40, 'rgb(0,0,0)')

    expect(calls.fillText.map((c) => c[0])).toEqual(['B'])
  })

  test('empty rects across the board fall back to the measured wrap', () => {
    const h2 = titleWith(document.createTextNode('Dell Design'))

    document.createRange = rangeSeq([[], []])

    const { ctx, calls } = recCtx()

    rasterizeTitle(h2, stubPaper(ctx), 400, 40, 'rgb(0,0,0)')

    // Fallback ran measureText packing — every trial overflows 1e6-wide.
    expect(calls.measureText).toBeGreaterThan(0)
    expect(calls.fillText.length).toBeGreaterThan(0)
  })

  test('missing createRange falls back to the measured wrap', () => {
    const h2 = titleWith(document.createTextNode('Dell Design'))

    document.createRange = undefined

    const { ctx, calls } = recCtx()

    rasterizeTitle(h2, stubPaper(ctx), 400, 40, 'rgb(0,0,0)')

    expect(calls.measureText).toBeGreaterThan(0)
    expect(calls.fillText.length).toBeGreaterThan(0)
  })

  test('non-text and whitespace-only children are skipped', () => {
    const span = document.createElement(HTML_TAGS.SPAN)

    span.textContent = 'Zed Win'

    const h2 = titleWith(document.createTextNode('   '), span)

    document.createRange = rangeSeq([[]])

    const { ctx, calls } = recCtx()

    rasterizeTitle(h2, stubPaper(ctx), 400, 40, 'rgb(0,0,0)')

    // Element children yield no word boxes → measured fallback ran.
    expect(calls.measureText).toBeGreaterThan(0)
    expect(calls.fillText.length).toBeGreaterThan(0)
  })
})
