/**
 * @file anim-demo-wrapup-tails.test.js
 * @description Coverage tails for media/anim-demo — the print-side
 * success arms the fallback env never reaches: dom.ts's loader settle
 * listener (printprepare pins the percent readout at its final step,
 * with and without a counter node) and widgets.ts's capture-success
 * paths — a stubbed live GL surface lets each repaint() draw its frame
 * so the handshake stamps detail.dataUrl instead of declining.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'

import { mountLoaderDemo } from '@website/components/media/anim-demo/dom.js'
import {
  mountBurger,
  mountMenuBackground,
  mountFlag,
  mountSwitch,
  mountTheme,
  mountClose,
} from '@website/components/media/anim-demo/widgets.js'
import { flagRenderer } from '@core/utils/canvas/widgets/flag/renderer.js'
import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/**
 * A no-op WebGL stand-in: every method resolves a truthy stub so shader
 * program builds succeed, every enum reads as a number, and the draw
 * calls each repaint() issues sink harmlessly. The widget believes it
 * owns a live surface — which is exactly the readiness contract the
 * armed capture handshake gates on.
 */
const fakeGl = () =>
  new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'isContextLost') return () => false
        if (prop === 'getExtension') return () => null
        if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => true
        if (prop === 'getShaderInfoLog' || prop === 'getProgramInfoLog') {
          return () => CHAR_STRINGS.EMPTY
        }
        if (prop === 'getAttribLocation' || prop === 'getError') return () => 0
        if (prop === 'drawingBufferWidth' || prop === 'drawingBufferHeight') return 64
        if (typeof prop === 'string' && /^[A-Z]/.test(prop)) return 1

        return () => ({})
      },
    }
  )

/** A no-op Canvas2D stand-in — the flag's shared-renderer blit target. */
const fake2d = () => ({
  clearRect() {},
  drawImage() {},
  imageSmoothingEnabled: true,
  imageSmoothingQuality: '',
})

/** Stage carrying `n` canvases whose getContext answers the fakes. */
const makeStage = (canvasCount = 1, ctx = null) => {
  const stage = document.createElement(HTML_TAGS.DIV)

  for (let i = 0; i < canvasCount; i++) {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.getContext = () => ctx || fakeGl()

    stage.appendChild(canvas)
  }

  document.body.appendChild(stage)

  return stage
}

/** Arms the stage's first canvas for a capture assertion. */
const armedCanvas = (stage) => {
  const canvas = stage.querySelector(HTML_TAGS.CANVAS)

  canvas.toDataURL = jest.fn(() => TEST_TEXT.HELLO)

  return canvas
}

/** Dispatches the print capture handshake on a canvas. */
const capture = (canvas) => {
  const event = new window.CustomEvent(PRINT_EVENTS.CAPTURE, { detail: {} })

  canvas.dispatchEvent(event)

  return event
}

/**
 * Seeds the shared flag renderer's live-surface fields — acquire() then
 * returns it without re-probing and drawFlag paints through the stub GL.
 */
const seedFlagRenderer = () => {
  flagRenderer.gl = fakeGl()
  flagRenderer.canvas = document.createElement(HTML_TAGS.CANVAS)
  flagRenderer.program = {}
  flagRenderer.quadBuffer = {}
  flagRenderer.aPos = 0
  flagRenderer.textures.set('us', {})
  flagRenderer.images.set('us', { complete: true, naturalWidth: 100, naturalHeight: 75 })
}

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY

  flagRenderer.gl = null
  flagRenderer.canvas = null
  flagRenderer.program = null
  flagRenderer.quadBuffer = null
  flagRenderer.textures.clear()
  flagRenderer.images.clear()
  flagRenderer.refs = 0
})

describe('anim-demo dom wrapup tails', () => {
  test('printprepare settles the loader counter at its final step', () => {
    const stage = makeStage(0)
    const counter = document.createElement(HTML_TAGS.SPAN)

    counter.className = ANIM_DEMO_CLASSES.LOADER_COUNTER
    stage.appendChild(counter)

    const teardown = mountLoaderDemo({ stage })

    window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))

    expect(counter.textContent).toBe('100%')

    teardown()
    stage.remove()
  })

  test('the settle listener no-ops on a counter-less stage', () => {
    const stage = makeStage(0)
    const teardown = mountLoaderDemo({ stage })

    expect(() => window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))).not.toThrow()

    teardown()
    stage.remove()
  })
})

describe('anim-demo widget capture-success tails', () => {
  const mounts = [
    ['mountBurger', mountBurger],
    ['mountMenuBackground', mountMenuBackground],
    ['mountSwitch', mountSwitch],
    ['mountTheme', mountTheme],
    ['mountClose', mountClose],
  ]

  for (const [name, mount] of mounts) {
    test(`${name} stamps dataUrl when the surface repaints`, () => {
      const stage = makeStage()
      const canvas = armedCanvas(stage)
      const teardown = mount({ stage })

      // Live GL surface (stubbed) — repaint() draws its settled frame and
      // returns true, so the handshake serializes the buffer instead of
      // declining the still.
      const event = capture(canvas)

      expect(event.detail.skip).toBeUndefined()
      expect(canvas.toDataURL).toHaveBeenCalledWith(NET_STRINGS.IMAGE_PNG)
      expect(event.detail.dataUrl).toBe(TEST_TEXT.HELLO)

      expect(() => teardown()).not.toThrow()

      stage.remove()
    })
  }

  test('mountFlag stamps dataUrl once the shared renderer holds a surface', () => {
    seedFlagRenderer()

    const stage = makeStage(1, fake2d())
    const canvas = armedCanvas(stage)
    const teardown = mountFlag({ stage })

    // useWebGL && isLoaded — the seeded renderer carries a live surface and
    // the pre-loaded flag image passes renderStaticFlag's readiness guard.
    const event = capture(canvas)

    expect(event.detail.skip).toBeUndefined()
    expect(canvas.toDataURL).toHaveBeenCalledWith(NET_STRINGS.IMAGE_PNG)
    expect(event.detail.dataUrl).toBe(TEST_TEXT.HELLO)

    expect(() => teardown()).not.toThrow()

    stage.remove()
  })
})
