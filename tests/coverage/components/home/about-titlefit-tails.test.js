/**
 * @file about-titlefit-tails.test.js
 * @description Coverage tails for about/titlefit.ts: the --about-picture-w
 * publisher that measures the rendered title line. Covers the zero-width
 * guard, the dirty-check no-write arm, the session reuse/re-target paths,
 * the missing-ResizeObserver arm, the fonts-ready one-shot wiring, and
 * disarm with and without a session.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { ABOUT_CSS_PROPS } from '@core/tokens/css/about.js'
import '@website/components/home/AboutSection.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import {
  attachTitleFit,
  disarmTitleFit,
  syncTitleFit,
} from '@website/components/home/about/titlefit.js'
import { mount } from '@tests/fixtures/test-constants.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))
/** Fixture image URL — the titlefit loader decodes this as the portrait. */
const TEST_PIC = 'https://www.gravatar.com/avatar/test?d=mp'
/** Translation strings the about section renders during fit tests. */
const TEST_TRANSLATIONS = { title: 'About me', frame: 'Hi there' }
/** Picture-wrapper selector — resolved fresh per test (re-render safe). */
const PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`

describe('AboutSection titlefit tails', () => {
  test('publishes the rendered title width onto the portrait wrapper', async () => {
    const origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = () => ({
      width: 320,
      height: 40,
      top: 0,
      left: 0,
      right: 320,
      bottom: 40,
    })

    try {
      const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
      const unmount = mount(el)
      await flush()

      el.aboutTranslations = TEST_TRANSLATIONS
      el.profilePicture = TEST_PIC
      await flush()

      const pic = el.shadowRoot.querySelector(PIC_SEL)
      expect(pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W)).toBe('320px')

      // The dirty-check no-write arm — a repeat sync with the same measure
      // leaves the property untouched.
      syncTitleFit(el)
      expect(pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W)).toBe('320px')

      unmount()
    } finally {
      Element.prototype.getBoundingClientRect = origRect
    }
  })

  test('skips the write when the title box measures zero', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    const unmount = mount(el)
    await flush()

    el.aboutTranslations = TEST_TRANSLATIONS
    el.profilePicture = TEST_PIC
    await flush()

    // happy-dom reports all-zero rects — the degenerate guard arm.
    const pic = el.shadowRoot.querySelector(PIC_SEL)
    expect(pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W)).toBe('')

    unmount()
  })

  test('syncTitleFit is a no-op without pic or title nodes', async () => {
    const bare = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    // Empty shadow root — pic/title selectors resolve null.
    syncTitleFit(bare)
    attachTitleFit(bare)

    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    const unmount = mount(el)
    await flush()

    el.aboutTranslations = TEST_TRANSLATIONS
    await flush()

    // A title with NO element child — the firstElementChild null arm.
    const title = el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_TITLE}`)
    title.replaceChildren()
    syncTitleFit(el)

    unmount()
    bare.remove()
  })

  test('attach arms a session once and re-arms reuse it', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    const unmount = mount(el)
    await flush()

    el.aboutTranslations = TEST_TRANSLATIONS
    await flush()

    const session = el._titleFit
    expect(session).not.toBeNull()
    expect(session.fontsWired).toBe(true)

    // Second attach — session reuse + fontsWired/already-observed arms.
    attachTitleFit(el)
    expect(el._titleFit).toBe(session)

    unmount()
  })

  test('the ResizeObserver callback re-syncs the published width', async () => {
    const savedRO = globalThis.ResizeObserver
    const observed = []
    const callbacks = []
    globalThis.ResizeObserver = class {
      constructor(cb) {
        callbacks.push(cb)
      }
      observe(t) {
        observed.push(t)
      }
      disconnect() {}
    }

    const origRect = Element.prototype.getBoundingClientRect
    let w = 100
    Element.prototype.getBoundingClientRect = () => ({
      width: w,
      height: 40,
      top: 0,
      left: 0,
      right: w,
      bottom: 40,
    })

    try {
      const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
      const unmount = mount(el)
      await flush()

      el.aboutTranslations = TEST_TRANSLATIONS
      el.profilePicture = TEST_PIC
      await flush()

      const pic = el.shadowRoot.querySelector(PIC_SEL)
      expect(pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W)).toBe('100px')

      // Re-attach with a live session — the existing-observer arm.
      attachTitleFit(el)

      // Real RO delivery is off-task — flush so the per-task measure
      // dedupe releases before the resize callback lands.
      await flush()

      // A column resize fires the observer — the new width republishes.
      w = 240
      callbacks.forEach((cb) => cb([], null))
      expect(pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W)).toBe('240px')

      unmount()
    } finally {
      Element.prototype.getBoundingClientRect = origRect
      if (savedRO === undefined) delete globalThis.ResizeObserver
      else globalThis.ResizeObserver = savedRO
    }
  })

  test('attach survives a missing ResizeObserver', async () => {
    const savedRO = globalThis.ResizeObserver
    globalThis.ResizeObserver = undefined

    try {
      const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
      const unmount = mount(el)
      await flush()

      el.aboutTranslations = TEST_TRANSLATIONS
      await flush()

      expect(el._titleFit).not.toBeNull()
      expect(el._titleFit.ro).toBeNull()

      unmount()
    } finally {
      if (savedRO === undefined) delete globalThis.ResizeObserver
      else globalThis.ResizeObserver = savedRO
    }
  })

  test('disarm drops the session and is safe without one', async () => {
    const bare = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    // No session — the early-return arm.
    disarmTitleFit(bare)

    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    const unmount = mount(el)
    await flush()

    el.aboutTranslations = TEST_TRANSLATIONS
    await flush()

    expect(el._titleFit).not.toBeNull()

    disarmTitleFit(el)
    expect(el._titleFit).toBeNull()

    unmount()
    bare.remove()
  })
})
