/**
 * @file mentions-deck-wrapup-tails.test.js
 * @description Coverage tails for carousel/mentions-deck/deck.ts +
 * events.ts — the printable-form arms: the `_printing` freeze gates
 * measure() and applyPoses() so the print-layout reflow can't re-fan
 * the strip mid-snapshot, and the three restore channels events.ts
 * binds (printprepare → prepare, afterprint → restore, the
 * matchMedia('print') false edge → restore for engines that never
 * dispatch the native event).
 */

import { describe, test, expect, afterEach } from '@jest/globals'
import { MentionsDeck } from '@website/components/carousel/MentionsDeck.js'
import { measure, applyPoses } from '@website/components/carousel/mentions-deck/deck.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CLIPBOARD_EVENTS, FORM_EVENTS, PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { mount, TEST_AWARDS, TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Generous flush — the render queue needs a macrotask past mount. */
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

/** Deck items — enough cards that poses/measurement have real geometry. */
const ITEMS = [
  { description: TEST_AWARDS.AWWARDS_SOTD, link: 'https://a.test' },
  { description: TEST_AWARDS.FWA_OF_THE_DAY, link: 'https://b.test' },
  { description: TEST_TEXT.HELLO, link: 'https://c.test' },
]

/** Mounts a MentionsDeck preloaded with ITEMS and waits for the cards. */
const mountDeck = async () => {
  const el = new MentionsDeck()
  const cleanup = mount(el)

  el.items = ITEMS
  await flush()

  return { el, cleanup }
}

describe('mentions-deck print tails', () => {
  let cleanup

  afterEach(() => cleanup?.())

  test('_printing gates measure() — sizes stay untouched while armed', async () => {
    const { el, cleanup: done } = await mountDeck()
    cleanup = done

    el._sizesDirty = false
    el._printing = true

    measure(el)

    // The guard returned before the write pass — no re-measure landed.
    expect(el._sizesDirty).toBe(false)

    el._printing = false
    measure(el)
    expect(el._sizesDirty).toBe(true)
  })

  test('_printing gates applyPoses() — no pose writes while armed', async () => {
    const { el, cleanup: done } = await mountDeck()
    cleanup = done

    const card = el._cardEls[0]

    card.style.opacity = '0.123'
    el._printing = true

    applyPoses(el)

    expect(card.style.opacity).toBe('0.123')

    el._printing = false
    applyPoses(el)
    expect(card.style.opacity).not.toBe('0.123')
  })

  test('window printprepare/afterprint drive the _printing flag', async () => {
    const { el, cleanup: done } = await mountDeck()
    cleanup = done

    expect(el._printing).toBeFalsy()

    window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))
    expect(el._printing).toBe(true)

    window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))
    expect(el._printing).toBe(false)
  })

  test('the matchMedia false edge restores decks that never got afterprint', async () => {
    const origMM = window.matchMedia
    let mqlChange = null

    window.matchMedia = (q) => ({
      matches: q === MEDIA_QUERIES.PRINT,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (ev, fn) => {
        if (ev === FORM_EVENTS.CHANGE) mqlChange = fn
      },
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })

    try {
      const { el, cleanup: done } = await mountDeck()
      cleanup = done

      expect(mqlChange).toBeInstanceOf(Function)

      window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))
      expect(el._printing).toBe(true)

      // matches:true is the no-restore arm — the job is still live.
      mqlChange({ matches: true })
      expect(el._printing).toBe(true)

      mqlChange({ matches: false })
      expect(el._printing).toBe(false)
      expect(el._cardEls[0].style.visibility).not.toBe(ATTR_VALUES.EMPTY)
    } finally {
      window.matchMedia = origMM
    }
  })

  test('bindEvents skips the query channel when matchMedia is absent', async () => {
    const origMM = window.matchMedia

    window.matchMedia = undefined

    try {
      const { el, cleanup: done } = await mountDeck()
      cleanup = done

      // The `if (window.matchMedia)` guard took its absent arm — the deck
      // still mounts and the two window-level print channels stay live.
      window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))
      expect(el._printing).toBe(true)

      window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))
      expect(el._printing).toBe(false)
    } finally {
      window.matchMedia = origMM
    }
  })
})
