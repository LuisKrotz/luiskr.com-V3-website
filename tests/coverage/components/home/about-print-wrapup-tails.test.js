/**
 * @file about-print-wrapup-tails.test.js
 * @description Coverage tails for home/AboutSection.tsx +
 * home/about/print.ts — the printable bio's event arms: the scoped
 * printprepare/afterprint listeners mounted in onMounted, the
 * matchMedia('print') false-edge restore, plus about/print.ts's
 * `draw.intro ?` fallback (no frame/col1 intro) and the `if (text)`
 * para-overflow guard.
 */

import { describe, test, expect } from '@jest/globals'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import '@website/components/home/AboutSection.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CLIPBOARD_EVENTS, FORM_EVENTS, PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { preparePrint } from '@website/components/home/about/print.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Shadow query for the bio paragraphs the print fills seat into. */
const paras = (el) => el.shadowRoot.querySelectorAll(`.${ABOUT_CLASSES.ABOUT_ITEM_TEXT}`)

/** Shadow query for injected print fills. */
const fills = (el) => el.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.FILL}`)

/** Mounts an AboutSection and waits for the skeleton render. */
const mountAbout = async () => {
  const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

  document.body.appendChild(el)
  await flush()

  return el
}

describe('about print wrapup tails', () => {
  test('window printprepare seats fills; afterprint removes them', async () => {
    const el = await mountAbout()

    el.aboutTranslations = {
      title: 't',
      frame: 'Intro statement',
      col1: ['Intro statement', 'Body one'],
      col2: ['Body two'],
    }
    await flush()

    window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))

    expect(fills(el).length).toBe(paras(el).length)
    expect(fills(el).length).toBeGreaterThan(0)

    window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

    expect(fills(el).length).toBe(0)

    el.remove()
  })

  test('the matchMedia false edge restores the bio fills', async () => {
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
      const el = await mountAbout()

      expect(mqlChange).toBeInstanceOf(Function)

      el.aboutTranslations = { title: 't', col1: ['one', 'two'] }
      await flush()

      window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))
      expect(fills(el).length).toBeGreaterThan(0)

      // matches:true is the no-restore arm — the job is still live.
      mqlChange({ matches: true })
      expect(fills(el).length).toBeGreaterThan(0)

      mqlChange({ matches: false })
      expect(fills(el).length).toBe(0)

      el.remove()
    } finally {
      window.matchMedia = origMM
    }
  })

  test('onMounted skips the query channel when matchMedia is absent', async () => {
    const origMM = window.matchMedia

    window.matchMedia = undefined

    try {
      const el = await mountAbout()

      // The `if (window.matchMedia)` guard took its absent arm — the two
      // window-level channels still drive the print fill lifecycle.
      el.aboutTranslations = { title: 't', col1: ['one'] }
      await flush()

      window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))
      expect(fills(el).length).toBeGreaterThan(0)

      window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))
      expect(fills(el).length).toBe(0)

      el.remove()
    } finally {
      window.matchMedia = origMM
    }
  })

  test('preparePrint covers the intro-less arm — col2-only bio', async () => {
    const el = await mountAbout()

    // No frame and no col1 → aboutDrawData.intro is null: the
    // `draw.intro ?` fallback keeps the spread at items only.
    el.aboutTranslations = { title: 't', col2: ['Lone para'] }
    await flush()

    expect(el.aboutDrawData.intro).toBeNull()

    preparePrint(el)

    expect(fills(el).length).toBe(1)
    expect(fills(el)[0].textContent).toContain('Lone para')

    el.remove()
  })

  test('preparePrint skips shadow paras beyond the texts list', async () => {
    const el = await mountAbout()

    el.aboutTranslations = { title: 't', col1: ['one'] }
    await flush()

    // A decorative extra paragraph the texts list doesn't back — the
    // `if (text)` guard must skip it instead of crashing/filling.
    const extra = document.createElement(HTML_TAGS.P)

    extra.className = ABOUT_CLASSES.ABOUT_ITEM_TEXT
    el.shadowRoot.appendChild(extra)

    preparePrint(el)

    expect(fills(el).length).toBe(paras(el).length - 1)
    expect(extra.querySelector(`.${PRINT_CLASSES.FILL}`)).toBeNull()

    el.remove()
  })
})
