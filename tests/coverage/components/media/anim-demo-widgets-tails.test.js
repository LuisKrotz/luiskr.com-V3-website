/**
 * @file anim-demo-widgets-tails.test.js
 * @description Coverage tails for the live-widget demo drivers — every
 * mount instantiates the real widget class on the stage canvas (falling
 * back to its own CSS contract without WebGL), returns a teardown that
 * stops the beat cycle and destroys the widget, and arms the print-
 * capture handshake + unpool guard.
 */
import { describe, test, expect, jest } from '@jest/globals'

import {
  mountBurger,
  mountMenuBackground,
  mountFlag,
  mountSwitch,
  mountTheme,
  mountClose,
} from '@website/components/media/anim-demo/widgets.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Stage carrying one canvas — the shape every widget stage renders. */
const makeStage = (canvasCount = 1) => {
  const stage = document.createElement(HTML_TAGS.DIV)

  for (let i = 0; i < canvasCount; i++) {
    stage.appendChild(document.createElement(HTML_TAGS.CANVAS))
  }

  document.body.appendChild(stage)

  return stage
}

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('anim-demo widget mounts', () => {
  const mounts = [
    ['mountBurger', mountBurger],
    ['mountMenuBackground', mountMenuBackground],
    ['mountSwitch', mountSwitch],
    ['mountTheme', mountTheme],
    ['mountClose', mountClose],
  ]

  for (const [name, mount] of mounts) {
    test(`${name} mounts the real widget and tears it down`, () => {
      const stage = makeStage()

      const teardown = mount({ stage })

      expect(typeof teardown).toBe('function')

      // The widget fell back without WebGL (test env) — the armed
      // listener declines the stamp so the stage's CSS fallback owns the
      // print paint; clearing the mark restores the live-widget path.
      const canvas = stage.querySelector(HTML_TAGS.CANVAS)

      canvas.toDataURL = jest.fn(() => TEST_TEXT.HELLO)

      const declined = new window.CustomEvent(PRINT_EVENTS.CAPTURE, { detail: {} })

      canvas.dispatchEvent(declined)

      expect(declined.detail.skip).toBe(true)
      expect(canvas.toDataURL).not.toHaveBeenCalled()

      // Unmarking the fallback is not enough: the armed lambda also
      // gates on the widget's own surface (gl / _wasm — the same
      // readiness contract as the flag's useWebGL && isLoaded), which a
      // widget that fell back at construction never reaches in the
      // test env. The still still declines.
      canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

      const stillDeclined = new window.CustomEvent(PRINT_EVENTS.CAPTURE, { detail: {} })

      canvas.dispatchEvent(stillDeclined)

      expect(stillDeclined.detail.skip).toBe(true)
      expect(canvas.toDataURL).not.toHaveBeenCalled()
      expect(() => teardown()).not.toThrow()

      stage.remove()
    })
  }

  test('mountFlag mounts one widget per stage canvas and destroys them all', () => {
    const stage = makeStage(3)

    const teardown = mountFlag({ stage })

    expect(typeof teardown).toBe('function')

    for (const canvas of stage.querySelectorAll(HTML_TAGS.CANVAS)) {
      canvas.toDataURL = jest.fn(() => TEST_TEXT.HELLO)
      canvas.dispatchEvent(new window.CustomEvent(PRINT_EVENTS.CAPTURE, { detail: {} }))
    }

    // No GL in the test env → every widget fell back and declined.
    for (const canvas of stage.querySelectorAll(HTML_TAGS.CANVAS)) {
      expect(canvas.toDataURL).not.toHaveBeenCalled()

      // Unmarking the fallback is not enough for a flag: the armed
      // lambda also gates on the widget's own readiness (useWebGL &&
      // isLoaded — renderStaticFlag's paint guard), which a widget
      // that fell back at construction never reaches.
      canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

      const stillDeclined = new window.CustomEvent(PRINT_EVENTS.CAPTURE, { detail: {} })

      canvas.dispatchEvent(stillDeclined)

      expect(stillDeclined.detail.skip).toBe(true)
      expect(canvas.toDataURL).not.toHaveBeenCalled()
    }

    expect(() => teardown()).not.toThrow()

    stage.remove()
  })

  test('mountFlag mounts an empty widget list on a bare stage', () => {
    const stage = makeStage(0)

    const teardown = mountFlag({ stage })

    expect(typeof teardown).toBe('function')
    expect(() => teardown()).not.toThrow()

    stage.remove()
  })

  test('a printcapture event declines the still on an unpaintable surface', () => {
    const stage = makeStage()
    const canvas = stage.querySelector(HTML_TAGS.CANVAS)

    const teardown = mountBurger({ stage })

    // The mount fell back without WebGL — clearing the mark alone can't
    // conjure a surface: the armed lambda's gl/_wasm readiness gate
    // still declines, which is what the print adapter relies on before
    // it ever serializes a buffer.
    canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

    canvas.toDataURL = jest.fn(() => TEST_TEXT.HELLO)

    const event = new window.CustomEvent(PRINT_EVENTS.CAPTURE, { detail: {} })

    canvas.dispatchEvent(event)

    expect(event.detail.skip).toBe(true)
    expect(canvas.toDataURL).not.toHaveBeenCalled()

    teardown()
    stage.remove()
  })
})
