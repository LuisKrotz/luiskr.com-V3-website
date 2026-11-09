/**
 * @file sizing-tails-custom-carousel-sizing-measurefit-projection-tails.test.js
 * @description Split from sizing-tails.test.js — covers the "custom-carousel sizing measureFit projection tails" describe.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { measureFit } from '@website/components/carousel/custom-carousel/sizing.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'

/** Slide fixtures spanning the aspect-ratio arms measureFit projects —
 *  normal, landscape, portrait, extreme-sliver, and size-missing. */
const SLIDE = { src: 'a.webp', size: [800, 450], label: 'One' }
const WIDE = { src: 'b.webp', size: [1600, 900], label: 'Wide', class: STATE_STRINGS.LANDSCAPE }
const TALL = { src: 'c.webp', size: [400, 2400], label: 'Tall' }
const SLIVER = { src: 'e.webp', size: [200, 4000], label: 'Sliver' }
const NOSIZE = { src: 'd.webp', label: 'No size' }

/** Fresh element stub — measureFit only reads the fields below. */
const stubEl = (items = [SLIDE, SLIDE]) => ({
  _forceActive: false,
  items,
  _isSideBySide: false,
  clientWidth: 0,
  _updateDom: jest.fn(),
  _setupAfterRender: jest.fn(),
  _setHeightVar: jest.fn(),
})

/** Original innerWidth/innerHeight descriptors — restored after each test. */
const savedWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
const savedHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')

/** Viewport stub — redefines innerWidth/Height so fit math sees a real size. */
const setViewport = (w, h) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h })
}

afterEach(() => {
  if (savedWidth) Object.defineProperty(window, 'innerWidth', savedWidth)
  if (savedHeight) Object.defineProperty(window, 'innerHeight', savedHeight)
})

/** Per-item overhead ≥1024: item padding + side margins + gap token. */
const OVERHEAD_DESKTOP =
  CAROUSEL_LAYOUT.ITEM_PAD_768 + CAROUSEL_LAYOUT.ITEM_MARGIN_PX * 2 + CAROUSEL_LAYOUT.ITEM_GAP_PX

/** Per-item overhead below 1024: side margins have not kicked in yet. */
const OVERHEAD_TABLET = CAROUSEL_LAYOUT.ITEM_PAD_768 + CAROUSEL_LAYOUT.ITEM_GAP_PX

describe('custom-carousel sizing measureFit projection tails', () => {
  test('item width is the strip height × the source ratio — no width cap', () => {
    const el = stubEl([SLIDE, SLIDE])

    setViewport(1600, 900)

    // vh 900 → maxH 630; 800×450 fits untouched → strip 450 → mediaW 800.
    // totalW = 2 × (800 + 90) = 1780 — the exact fit boundary.
    const total = 2 * (800 + OVERHEAD_DESKTOP)

    measureFit(el, total)

    expect(el._isSideBySide).toBe(true)

    // Start paired so the no-fit result flips state → teardown path runs.
    const el2 = stubEl([SLIDE, SLIDE])

    el2._isSideBySide = true
    measureFit(el2, total - 1)

    expect(el2._isSideBySide).toBe(false)
    expect(el2._setupAfterRender).toHaveBeenCalled()
  })

  test('below 1024 the side margins are not charged', () => {
    const el = stubEl([SLIDE, SLIDE])

    setViewport(970, 900)
    el._isSideBySide = true

    // No margin below 1024 → 2 × (800 + 74) = 1748; 1747 misses by 1px.
    measureFit(el, 2 * (800 + OVERHEAD_TABLET) - 1)

    expect(el._isSideBySide).toBe(false)
    expect(el._setupAfterRender).toHaveBeenCalled()
  })

  test('tall media is floored at the 280px minimum width', () => {
    const el = stubEl([TALL, TALL])

    setViewport(1600, 900)

    // 400×2400 → strip 630 (0.2625 fit) → aspect width 105 → floored to
    // MEDIA_MIN_WIDTH. totalW = 2 × (280 + 90) = 740; 780 clears it while
    // a 320 floor (820) would not — pins the value to 280 exactly.
    const total = 2 * (CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH + OVERHEAD_DESKTOP)

    measureFit(el, total + 40)

    expect(el._isSideBySide).toBe(true)

    const el2 = stubEl([TALL, TALL])

    measureFit(el2, total - 1)

    expect(el2._isSideBySide).toBe(false)
  })

  test('the width floor never upscales a sub-280px source', () => {
    const el = stubEl([SLIVER, SLIVER])

    setViewport(1600, 900)

    // 200×4000 → aspect width 31.5 → floor min(280, 200) = 200 — the
    // natural width wins over the floor. 2 × (200 + 90) = 580 exactly.
    const total = 2 * (200 + OVERHEAD_DESKTOP)

    measureFit(el, total)

    expect(el._isSideBySide).toBe(true)

    const el2 = stubEl([SLIVER, SLIVER])

    measureFit(el2, total - 1)

    expect(el2._isSideBySide).toBe(false)
  })

  test('strip height is the smallest item fit, not a viewport ladder', () => {
    const el = stubEl([SLIDE, WIDE])

    setViewport(2600, 900)

    // SLIDE 800×450 fits untouched at 450 — smaller than WIDE's 630 —
    // so the strip anchors at 450. BOTH items render at strip × own
    // ratio: 450 × 16/9 = 800 each (SLIDE shares WIDE's ratio) — a
    // tallest-anchored strip or per-item heights would project a
    // different total. totalW = 2 × (800 + 90) = 1780.
    const total = 2 * (800 + OVERHEAD_DESKTOP)

    measureFit(el, total)

    expect(el._isSideBySide).toBe(true)

    const el2 = stubEl([SLIDE, WIDE])

    measureFit(el2, total - 1)

    expect(el2._isSideBySide).toBe(false)
  })

  test('missing intrinsic sizes fall back to the generic dimensions', () => {
    const el = stubEl([NOSIZE, NOSIZE])

    setViewport(1600, 900)
    measureFit(el, 6000)

    expect(el._isSideBySide).toBe(true)
    expect(GENERIC_DIMENSIONS.DEFAULT_WIDTH).toBeGreaterThan(0)
    expect(GENERIC_DIMENSIONS.ITEM_FALLBACK_HEIGHT).toBeGreaterThan(0)
  })

  test('host width falls back to clientWidth when not observed', () => {
    const el = stubEl([SLIDE, SLIDE])

    setViewport(1600, 900)
    el.clientWidth = 2 * (800 + OVERHEAD_DESKTOP)
    measureFit(el)

    expect(el._isSideBySide).toBe(true)
  })

  test('an already-correct side-by-side state skips the re-render', () => {
    const el = stubEl([SLIDE, SLIDE])

    setViewport(1600, 900)
    el._isSideBySide = true
    measureFit(el, 6000)

    expect(el._isSideBySide).toBe(true)
    expect(el._updateDom).not.toHaveBeenCalled()
  })
})
