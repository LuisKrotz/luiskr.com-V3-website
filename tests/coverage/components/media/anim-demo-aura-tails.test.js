/**
 * @file anim-demo-aura-tails.test.js — coverage tail for the aura
 * demo's live-session arms: where `mountRingFill` returns a session
 * (WebGPU widget layer on), the driver must drive `setProgress` across
 * the two chips and `destroy()` on unmount instead of flipping the
 * armed modifier.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

const session = {
  setProgress: jest.fn(),
  refresh: jest.fn(),
  destroy: jest.fn(),
}

jest.unstable_mockModule('@core/utils/gpu/ring-fill.js', () => ({
  mountRingFill: () => session,
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
})
