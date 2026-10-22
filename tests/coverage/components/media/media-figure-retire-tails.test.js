/**
 * @file media-figure-retire-tails.test.js
 * @description Coverage tails for figure/load.ts's crossfade-retire arms —
 * under-layers leave only after the successor has painted AND its opacity
 * fade completed (transitionend), with the MEDIA_LAYER_RETIRE timeout
 * covering no-transition environments. Arms: timeout fallback, the
 * `retired` latch when the timeout fires after transitionend already
 * retired, the detached-successor early return (mid-flight _updateDom),
 * and the missing-thumb else arm.
 */
import '@website/components/media/MediaFigure.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ANIMATION_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'

const retireWindow = ANIMATION_DURATIONS.MEDIA_LAYER_RETIRE + 50

describe('media-figure retire tails', () => {
  const mount = (attrs = {}) => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)

    document.body.appendChild(el)

    return el
  }

  const climb = async (fig) => {
    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()
      inst.onload()
    } finally {
      window.Image = origImage
    }

    return fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)
  }

  test('no transitionend — the retire timeout still drops under-layers', async () => {
    const fig = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    const highs = await climb(fig)

    expect(highs.length).toBe(2)

    const top = highs[highs.length - 1]

    top.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))

    // Mid-fade — the painted rung must still be present (the blink fix).
    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(2)

    // The timeout retires once the fade window has elapsed.
    await new Promise((r) => setTimeout(r, retireWindow))

    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(1)

    fig.remove()
  })

  test('transitionend retires early — the later timeout hits the retired latch', async () => {
    const fig = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    const highs = await climb(fig)
    const top = highs[highs.length - 1]

    top.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))
    top.dispatchEvent(new Event(ANIMATION_EVENTS.TRANSITIONEND))

    // Retired at fade end — no waiting for the timeout.
    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(1)

    // The fallback timer still fires — retired latch returns silently.
    await new Promise((r) => setTimeout(r, retireWindow))

    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(1)

    fig.remove()
  })

  test('a successor detached by a mid-flight render never prunes', async () => {
    const fig = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    const highs = await climb(fig)
    const top = highs[highs.length - 1]

    top.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))

    // Re-render detaches the successor before its fade completes.
    fig._updateDom()

    top.dispatchEvent(new Event(ANIMATION_EVENTS.TRANSITIONEND))

    const rebuilt = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

    // The detached successor must not prune the rebuilt DOM's layer.
    expect(rebuilt.length).toBe(1)
    expect(rebuilt[0].getAttribute('src')).toBe(fig.highResSrc)

    await new Promise((r) => setTimeout(r, retireWindow))

    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(1)

    fig.remove()
  })

  test('an erroring successor drops itself — the painted rung stays', async () => {
    const fig = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    const highs = await climb(fig)
    const top = highs[highs.length - 1]

    top.dispatchEvent(new Event(WINDOW_EVENTS.ERROR))

    // The failed clone is gone; the painted layer it was stacked on stays.
    expect(top.isConnected).toBe(false)
    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(1)

    fig.remove()
  })

  test('publish on a mounted figure with no high layer re-renders instead of cloning', async () => {
    const fig = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    // Strip the high layer before the probe confirms — publish must take
    // the mounted _updateDom arm rather than the clone-and-stack arm.
    fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).forEach((img) => img.remove())

    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()
      inst.onload()
    } finally {
      window.Image = origImage
    }

    // _updateDom rebuilt the layer bound to fig.highResSrc — a single
    // high img, no clone stack, no listeners.
    const highs = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

    expect(highs.length).toBe(1)
    expect(highs[0].getAttribute(MEDIA_ATTRS.SRC)).toBe(fig.highResSrc)

    fig.remove()
  })

  test('publish on a detached figure skips the DOM write entirely', async () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, TEST_TEXT.SECOND)
    // Never appended — _isMounted stays false.

    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()
      inst.onload()
    } finally {
      window.Image = origImage
    }

    // No high layer in the never-rendered shadow → the `else if
    // (fig._isMounted)` else arm: publish is a state-only no-op.
    expect(fig.isLoaded).toBe(true)
    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(0)
  })

  test('retire tolerates a missing thumb element', async () => {
    const fig = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    const highs = await climb(fig)
    const top = highs[highs.length - 1]

    fig.$(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)?.remove()

    top.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))
    top.dispatchEvent(new Event(ANIMATION_EVENTS.TRANSITIONEND))

    expect(fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`).length).toBe(1)

    fig.remove()
  })
})
