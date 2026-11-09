/**
 * @file project-carousels-tails.test.js
 * @description Coverage tail for views/project/carousels.ts — drives
 * `scaleCarouselItem` across the divisor ladder's early-exit arms and
 * `bindProjectCarousels` through a duck-typed view stub: missing sections,
 * the eager/deferred split, rIC vs setTimeout scheduling, the unmounted
 * step guard, and every scale/landscape/folder fallback.
 */

import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { bindProjectCarousels, scaleCarouselItem } from '@website/views/project/carousels.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CAROUSEL_LAYOUT, CAROUSEL_LOADING } from '@core/tokens/motion/carousel.js'
import { INTERNAL_MOSAIC } from '@core/tokens/layout/masonry.js'
import { resetViewportCache } from '@core/utils/dom.js'

/** Minimal configure-spy element — only the attrs + configure() contract. */
const carouselStub = (attrs = {}) => ({
  configured: null,
  getAttribute: (k) => (k in attrs ? String(attrs[k]) : null),
  configure(c) {
    this.configured = c
  },
})

/** Duck-typed ViewProject — only the fields bindProjectCarousels reads. */
const viewStub = ({
  carousels = [],
  translations,
  isMosaicGroup = () => false,
  isLandscapeGroup = () => false,
  isMounted = true,
  bindIdle = null,
} = {}) => ({
  $$: () => carousels,
  translations,
  isMosaicGroup,
  isLandscapeGroup,
  _isMounted: isMounted,
  _bindIdle: bindIdle,
})

const setWidth = (w) => {
  window.innerWidth = w

  resetViewportCache()
}

afterEach(() => {
  delete globalThis.requestIdleCallback
  delete globalThis.cancelIdleCallback
})

describe('scaleCarouselItem', () => {
  test('returns the item unchanged without a size', () => {
    const item = { src: 'a' }

    expect(scaleCarouselItem(item)).toBe(item)
  })

  test('returns the item unchanged for a non-positive width', () => {
    const item = { size: [0, 10] }

    expect(scaleCarouselItem(item)).toBe(item)
  })

  test('returns the item unchanged below the first ladder step', () => {
    const w = CAROUSEL_LAYOUT.DESKTOP_SCALE_MIN_W * CAROUSEL_LAYOUT.DESKTOP_SCALE_STEPS[0]
    const item = { size: [w, 10] }

    expect(scaleCarouselItem(item)).toBe(item)
  })

  test('breaks the ladder once the next step would fall under the floor', () => {
    const steps = CAROUSEL_LAYOUT.DESKTOP_SCALE_STEPS
    const w = (CAROUSEL_LAYOUT.DESKTOP_SCALE_MIN_W + 1) * steps[0]
    const item = { size: [w, 100] }
    const scaled = scaleCarouselItem(item)

    expect(scaled).not.toBe(item)
    expect(scaled.size[0]).toBeCloseTo(w / steps[0])
    expect(scaled.size[1]).toBeCloseTo(100 / steps[0])
    expect(scaled.naturalSize).toBe(item.size)
  })

  test('compounds every ladder step while the width clears the floor', () => {
    const steps = CAROUSEL_LAYOUT.DESKTOP_SCALE_STEPS
    const min = CAROUSEL_LAYOUT.DESKTOP_SCALE_MIN_W
    const w = min * steps.reduce((a, d) => a * d, 1) + min
    const item = { size: [w, 300] }
    const scaled = scaleCarouselItem(item)

    expect(scaled.size[0]).toBeCloseTo(w / steps.reduce((a, d) => a * d, 1))
    expect(scaled.naturalSize).toBe(item.size)
  })
})

describe('bindProjectCarousels', () => {
  test('configures nothing and leaves no idle handle with no carousels', () => {
    const view = viewStub()

    bindProjectCarousels(view)

    expect(view._bindIdle).toBeNull()
  })

  test('skips a carousel whose section items are missing', () => {
    const c = carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    const view = viewStub({ carousels: [c], translations: { sections: [[]], folder: 'f' } })

    bindProjectCarousels(view)

    expect(c.configured).toBeNull()
  })

  test('skips when translations and the section row are absent', () => {
    const c = carouselStub({})

    bindProjectCarousels(viewStub({ carousels: [c] }))
    bindProjectCarousels(viewStub({ carousels: [c], translations: {} }))
    bindProjectCarousels(viewStub({ carousels: [c], translations: { sections: [] } }))

    expect(c.configured).toBeNull()
  })

  test('configures mobile items unscaled with the empty folder fallback', () => {
    setWidth(INTERNAL_MOSAIC.CAROUSEL_MAX_W)

    const items = [{ size: [4000, 200] }, { size: [10, 10] }]
    const c = carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    const view = viewStub({ carousels: [c], translations: { sections: [[items]] } })

    bindProjectCarousels(view)

    expect(c.configured.items).toBe(items)
    expect(c.configured.folder).toBe(ATTR_VALUES.EMPTY)
    expect(c.configured.forceActive).toBe(false)
  })

  test('keeps natural sizes for mosaic groups even on desktop', () => {
    setWidth(INTERNAL_MOSAIC.CAROUSEL_MAX_W + 1)

    const items = [{ size: [4000, 200] }]
    const c = carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    const view = viewStub({
      carousels: [c],
      translations: { sections: [[items]], folder: 'f' },
      isMosaicGroup: () => true,
    })

    bindProjectCarousels(view)

    expect(c.configured.items).toBe(items)
  })

  test('scales desktop items through the ladder and forwards forceActive', () => {
    setWidth(INTERNAL_MOSAIC.CAROUSEL_MAX_W + 1)

    const items = [{ size: [4000, 200] }, { size: [10, 10] }, { size: [20, 20] }]
    const c = carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    const view = viewStub({
      carousels: [c],
      translations: { sections: [[items]], folder: 'f' },
      isLandscapeGroup: () => true,
    })

    bindProjectCarousels(view)

    expect(c.configured.items[0].naturalSize).toBe(items[0].size)
    expect(c.configured.items[1]).toBe(items[1])
    expect(c.configured.forceActive).toBe(true)
  })

  test('cancels a pending bind through cancelIdleCallback when present', () => {
    const spy = jest.fn()

    globalThis.cancelIdleCallback = spy

    const view = viewStub({ bindIdle: 7 })

    bindProjectCarousels(view)

    expect(spy).toHaveBeenCalledWith(7)
  })

  test('cancels a pending bind through clearTimeout without cancelIdleCallback', () => {
    const spy = jest.spyOn(globalThis, 'clearTimeout')
    const view = viewStub({ bindIdle: 7 })

    bindProjectCarousels(view)

    expect(spy).toHaveBeenCalledWith(7)

    spy.mockRestore()
  })

  test('defers the overflow batch through requestIdleCallback when available', () => {
    const scheduled = []
    const rIC = jest.fn((fn) => {
      scheduled.push(fn)
      return scheduled.length
    })

    globalThis.requestIdleCallback = rIC

    const items = [{ size: [1, 1] }]
    const carousels = Array.from(
      { length: CAROUSEL_LOADING.EAGER_COUNT + CAROUSEL_LOADING.BATCH_SIZE + 1 },
      () => carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    )
    const view = viewStub({ carousels, translations: { sections: [[items]], folder: 'f' } })

    bindProjectCarousels(view)

    expect(carousels.slice(0, CAROUSEL_LOADING.EAGER_COUNT).every((c) => c.configured)).toBe(true)
    expect(rIC).toHaveBeenCalledWith(expect.any(Function), {
      timeout: CAROUSEL_LOADING.DEFERRED_TIMEOUT,
    })

    scheduled[0]()

    const deferredDone = carousels.filter((c) => c.configured).length

    expect(deferredDone).toBe(CAROUSEL_LOADING.EAGER_COUNT + CAROUSEL_LOADING.BATCH_SIZE)

    scheduled[1]()

    expect(carousels.every((c) => c.configured)).toBe(true)
    expect(view._bindIdle).toBeNull()
  })

  test('defers through setTimeout when requestIdleCallback is absent', () => {
    jest.useFakeTimers()

    const items = [{ size: [1, 1] }]
    const carousels = Array.from({ length: CAROUSEL_LOADING.EAGER_COUNT + 1 }, () =>
      carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    )
    const view = viewStub({ carousels, translations: { sections: [[items]], folder: 'f' } })

    bindProjectCarousels(view)

    jest.advanceTimersByTime(CAROUSEL_LOADING.DEFERRED_TIMEOUT)

    expect(carousels.every((c) => c.configured)).toBe(true)
    expect(view._bindIdle).toBeNull()

    jest.useRealTimers()
  })

  test('a deferred step bails out once the view unmounts', () => {
    const scheduled = []

    globalThis.requestIdleCallback = (fn) => {
      scheduled.push(fn)

      return scheduled.length
    }

    const items = [{ size: [1, 1] }]
    const carousels = Array.from({ length: CAROUSEL_LOADING.EAGER_COUNT + 1 }, () =>
      carouselStub({ [DATA_ATTRS.DATA_SEC_IDX]: 0, [DATA_ATTRS.DATA_CAROUSEL_IDX]: 0 })
    )
    const view = viewStub({ carousels, translations: { sections: [[items]], folder: 'f' } })

    bindProjectCarousels(view)

    view._isMounted = false
    scheduled[0]()

    expect(carousels[CAROUSEL_LOADING.EAGER_COUNT].configured).toBeNull()
  })
})
