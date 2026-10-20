/**
 * @file expanded-close-tails.test.js
 * @description Coverage tails for components/media/expanded/close.ts —
 * the reduced-motion immediate teardown arm and the legacy fallback's
 * `if (content)` closing-class arm (startGenieClose returning false on a
 * shadow-less element routes through the CSS close path).
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { startExpandedClose } from '@website/components/media/expanded/close.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'

const stubEl = ({ content = null } = {}) => ({
  isClosing: false,
  closest: jest.fn(() => null),
  $: jest.fn(() => content),
})

describe('expanded close tails', () => {
  afterEach(() => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('reduced motion tears the modal down immediately', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const el = stubEl()

    startExpandedClose(el)

    expect(el.isClosing).toBe(true)
    // The teardown ran synchronously — no closing-class marking, no
    // CLOSE_MS timer on the reduced-motion path.
    expect(el.$).not.toHaveBeenCalled()
  })

  test('legacy fallback marks the content closing before the timer teardown', () => {
    const add = jest.fn()
    const el = stubEl({ content: { classList: { add } } })

    // No shadowRoot → startGenieClose returns false → CSS fallback path.
    startExpandedClose(el)

    expect(add).toHaveBeenCalledWith(EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSING)
  })
})
