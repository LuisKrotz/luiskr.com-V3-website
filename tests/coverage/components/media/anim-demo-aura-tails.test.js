/**
 * @file anim-demo-aura-tails.test.js — coverage tail for the aura
 * demo's live-session arms: where `mountRingFill` returns a session
 * (WebGPU widget layer on), the driver must drive `setProgress` across
 * the two chips and `destroy()` on unmount instead of flipping the
 * armed modifier.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

const session = {
  setProgress: jest.fn(),
  refresh: jest.fn(),
  destroy: jest.fn(),
}

jest.unstable_mockModule('@core/utils/gpu/ring-fill.js', () => ({
  // The real mount appends its overlay canvas synchronously — the
  // driver reads `canvas:not(.is-fallback)` as the live signal (the
  // stylesheet's own gate), so the mock must append a live canvas too.
  mountRingFill: (strip, _tiles, canvasClass) => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = canvasClass
    strip.appendChild(canvas)

    return session
  },
}))

const { AnimDemo } = await import('@website/components/media/AnimDemo.js')
const { ANIMATION_IDS } = await import('@core/tokens/data/animation-ids.js')
const { ANIM_DEMO_CLASSES: C } = await import('@core/tokens/classes/anim-demo.js')
const { COMMON_ATTRS } = await import('@core/tokens/attrs/common.js')
const { mount } = await import('@tests/fixtures/test-constants.js')

describe('anim-demo aura live-session driver', () => {
  let demo
  let unmount

  beforeEach(() => {
    jest.useFakeTimers()
    session.setProgress.mockClear()
    session.destroy.mockClear()

    demo = new AnimDemo()
    demo.setAttribute(COMMON_ATTRS.ANIMATION, ANIMATION_IDS.NAV_ICON_AURA)
    unmount = mount(demo)
  })

  afterEach(() => {
    unmount?.()
    jest.useRealTimers()
  })

  test('cycles setProgress across both chips and destroys on unmount', () => {
    const chips = demo.shadowRoot.querySelectorAll(`.${C.CHIP}`)

    expect(chips).toHaveLength(2)

    jest.advanceTimersByTime(10)
    expect(session.setProgress).toHaveBeenCalledWith(0, 1)

    jest.advanceTimersByTime(10000)
    expect(session.setProgress).toHaveBeenCalledWith(1, 1)

    unmount()
    expect(session.destroy).toHaveBeenCalledTimes(1)
    unmount = null
  })

  test('falls back to the armed CSS trail when the session has no live canvas', () => {
    // Let the observer fire so the driver mounts and the mock appends
    // its canvas before the failure lands.
    jest.advanceTimersByTime(10)

    // The failed-mount path: the session object exists but its canvas
    // never resolved past is-fallback — the driver must keep the CSS
    // trail sweeping instead of driving dead setProgress calls.
    const strip = demo.shadowRoot.querySelector(`.${C.CHIPS}`)
    const canvas = strip.querySelector(HTML_TAGS.CANVAS)

    canvas.classList.add(STATE_CLASSES.IS_FALLBACK)

    // The mount-time immediate arm already drove the live path — drop
    // those calls so only the post-fallback beats are measured.
    session.setProgress.mockClear()

    const chips = demo.shadowRoot.querySelectorAll(`.${C.CHIP}`)

    jest.advanceTimersByTime(1600)
    expect(chips[1].classList.contains(C.CHIP_ARMED)).toBe(true)
    expect(chips[0].classList.contains(C.CHIP_ARMED)).toBe(false)
    expect(session.setProgress).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1600)
    expect(chips[1].classList.contains(C.CHIP_ARMED)).toBe(false)

    jest.advanceTimersByTime(1600)
    expect(chips[0].classList.contains(C.CHIP_ARMED)).toBe(true)
  })
})
