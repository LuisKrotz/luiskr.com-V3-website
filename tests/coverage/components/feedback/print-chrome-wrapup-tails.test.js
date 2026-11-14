/**
 * @file print-chrome-wrapup-tails.test.js
 * @description Coverage tails for feedback/CookieBanner.tsx +
 * feedback/SiteToast.tsx — the print-pass render arms: a banner/toast
 * that (re)renders while matchMedia('print') matches must write
 * display:none, never display:block — the inline style would beat the
 * document print sheet's chrome hide on paper.
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { PREF_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { COOKIE_SELECTORS } from '@core/tokens/selectors/cookies.js'
import { TOAST_CLASSES } from '@core/tokens/classes/toast.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

/** matchMedia stub — only the print query matches; everything else reads false. */
const printMatchMedia = (q) => ({
  matches: q === MEDIA_QUERIES.PRINT,
  media: q,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})

describe('feedback print chrome arms', () => {
  const origMM = window.matchMedia

  beforeAll(async () => {
    await import('@website/components/feedback/CookieBanner.js')
    await import('@website/components/feedback/SiteToast.js')
  })

  beforeEach(() => {
    document.body.innerHTML = CHAR_STRINGS.EMPTY
    localStorage.removeItem(PREF_STORAGE_KEYS.COOKIE)
    window.matchMedia = printMatchMedia
  })

  afterEach(() => {
    window.matchMedia = origMM
    document.body.innerHTML = CHAR_STRINGS.EMPTY
  })

  test('cookie-banner renders display:none while a print pass is live', async () => {
    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    document.body.appendChild(el)
    await flush()

    el.translations = { cookies: { message: TEST_TEXT.HELLO, accept: 'a', refuse: 'r' } }
    await flush()

    // The print arm wrote none — the aside still mounted underneath.
    expect(el.style.display).toBe(ATTR_VALUES.NONE)
    expect(el.shadowRoot.querySelector(COOKIE_SELECTORS.COOKIES)).not.toBeNull()

    el.remove()
  })

  test('site-toast renders display:none while a print pass is live', async () => {
    const el = document.createElement(COMPONENT_TAGS.SITE_TOAST)

    document.body.appendChild(el)

    el.push({ text: TEST_TEXT.HELLO, duration: 0 })
    await flush()

    expect(el.style.display).toBe(ATTR_VALUES.NONE)
    expect(el.shadowRoot.querySelector(`.${TOAST_CLASSES.SITE_TOAST_ITEM}`)).not.toBeNull()

    el.remove()
  })
})
