/**
 * @file sizing-tails-custom-carousel-sizing-ratio-heightvar-tails.test.js
 * @description Coverage tails for custom-carousel/sizing — the mobile-src
 * landscape guard, the >3-ratio portrait rescan loop in
 * getSmallestPortraitRatio, and the setHeightVar slideH fallback ladder
 * (mixed without resolvable portrait ratio, non-mixed without a landscape
 * ratio, and the firstSlide clientHeight arm incl. the ||0 edge).
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import {
  getSmallestPortraitRatio,
  isLandscapeItem,
  setHeightVar,
} from '@website/components/carousel/custom-carousel/sizing.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'

const savedWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
const savedHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')

afterEach(() => {
  if (savedWidth) Object.defineProperty(window, 'innerWidth', savedWidth)
  if (savedHeight) Object.defineProperty(window, 'innerHeight', savedHeight)
})

/** Minimal element stub — setHeightVar only touches $/items/flags/style/closest. */
const stubEl = ({
  items,
  isMobile = false,
  isMixed = false,
  landscapeRatio = null,
  slideH = 300,
}) => ({
  $: jest.fn(() => ({ clientHeight: slideH })),
  items,
  isMobile,
  isMixed,
  landscapeRatio,
  clientWidth: 320,
  style: { getPropertyValue: jest.fn(() => ''), setProperty: jest.fn() },
  closest: jest.fn(() => null),
})

describe('custom-carousel sizing ratio + setHeightVar tails', () => {
  test('isLandscapeItem treats a mobile-marked src as portrait', () => {
    expect(isLandscapeItem({ src: `cover-${STATE_STRINGS.MOBILE}.webp` })).toBe(false)
  })

  test('getSmallestPortraitRatio skips >3 ratios in pass one then rescans without the cap', () => {
    const tallPortraits = [{ size: [100, 400] }, { size: [100, 450] }]

    // Both ratios (4, 4.5) exceed the ≤3 cap → pass one leaves minRatio
    // null → pass two rescans and keeps the smallest (4).
    expect(getSmallestPortraitRatio(tallPortraits)).toBe(4)
  })

  test('setHeightVar mobile+mixed falls back to firstItem size when no portrait ratio resolves', () => {
    const el = stubEl({
      isMobile: true,
      isMixed: true,
      // Landscape first item + sizeless portrait → getSmallestPortraitRatio null.
      items: [{ size: [800, 450] }, { src: 'b.webp' }],
    })

    setHeightVar(el)

    // slideH = round(450/800 · 320) = 180 → publishes a height var.
    expect(el.style.setProperty).toHaveBeenCalled()
  })

  test('setHeightVar mobile+mixed reads firstSlide.clientHeight when firstItem has no size', () => {
    const el = stubEl({
      isMobile: true,
      isMixed: true,
      items: [{ src: 'a.webp' }, { src: 'b.webp' }],
      slideH: 400,
    })

    setHeightVar(el)

    expect(el.style.setProperty).toHaveBeenCalled()
  })

  test('setHeightVar mobile+mixed with clientHeight 0 hits the ||0 arm and returns early', () => {
    const el = stubEl({
      isMobile: true,
      isMixed: true,
      items: [{ src: 'a.webp' }, { src: 'b.webp' }],
      slideH: 0,
    })

    setHeightVar(el)

    expect(el.style.setProperty).not.toHaveBeenCalled()
  })

  test('setHeightVar mobile non-mixed without landscapeRatio uses firstItem size', () => {
    const el = stubEl({
      isMobile: true,
      items: [{ size: [800, 450] }],
    })

    setHeightVar(el)

    expect(el.style.setProperty).toHaveBeenCalled()
  })

  test('setHeightVar mobile non-mixed without landscapeRatio or size uses clientHeight', () => {
    const el = stubEl({
      isMobile: true,
      items: [{ src: 'a.webp' }],
      slideH: 350,
    })

    setHeightVar(el)

    expect(el.style.setProperty).toHaveBeenCalled()
  })

  test('setHeightVar without items falls back to [] in the natural-height cap', () => {
    const el = stubEl({ items: undefined, slideH: 350 })

    setHeightVar(el)

    // naturalCapH = reduce over [] → Infinity → finalH = min(350, maxH).
    expect(el.style.setProperty).toHaveBeenCalled()
  })

  test('setHeightVar mobile non-mixed with clientHeight 0 hits the ||0 arm and returns early', () => {
    const el = stubEl({
      isMobile: true,
      items: [{ src: 'a.webp' }],
      slideH: 0,
    })

    setHeightVar(el)

    expect(el.style.setProperty).not.toHaveBeenCalled()
  })
})
