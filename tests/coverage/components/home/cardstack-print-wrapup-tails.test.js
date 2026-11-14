/**
 * @file cardstack-print-wrapup-tails.test.js
 * @description Coverage tails for home/cardstack/print.ts — the
 * printable deck's residual arms: the setTimeout idle fallback
 * (no requestIdleCallback), the fetch resolution's `.catch` guard,
 * sectionsText's non-array section skip, the `item.link : undefined`
 * long-copy lookup miss, and the `long?.length` feature-copy
 * fill-paragraph loop.
 */

import { describe, test, expect, afterEach } from '@jest/globals'
import { CardStack } from '@website/components/home/CardStack.js'
import {
  warmPrintCopy,
  preparePrint,
  restorePrint,
} from '@website/components/home/cardstack/print.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { mount, waitFor } from '@tests/fixtures/test-constants.js'

/** Card-item factory — unique link/image/label per index, overrides merge in. */
const item = (n, over = {}) => ({
  link: `p-${n}`,
  image: `img-${n}`,
  label: `Project ${n}`,
  description: `Desc ${n}<br>more`,
  featured: true,
  ...over,
})

/** Teardown registry — mounts push cleanup fns; afterEach drains them. */
const cleanups = []

/** Real fetch saved once — the failing stubs restore it per test. */
const realFetch = globalThis.fetch

/** Real idle scheduler saved once — the setTimeout arm restores it. */
const realIdle = window.requestIdleCallback

/**
 * localStorage key for the db layer's offline mirror — fetchFirebaseDb
 * falls back to it when the network read throws (translation paths
 * absent from the boot snapshot take the network+cache route).
 */
const fbKey = (slug) => `${CACHE_STORAGE_KEYS.FB_CACHE_PREFIX}translations/en/projects/${slug}`

/** A stub host for warmPrintCopy — only _printCopy + deckItems are read. */
const stubHost = (deckItems, map = new Map()) => ({ _printCopy: map, deckItems })

afterEach(() => {
  while (cleanups.length) cleanups.pop()()
  globalThis.fetch = realFetch
  window.requestIdleCallback = realIdle
})

describe('cardstack/print wrapup tails', () => {
  test('the idle fallback schedules warm on setTimeout and resolves copy', async () => {
    // No requestIdleCallback → the else arm schedules the warm loop on
    // setTimeout(FALLBACK_DELAY) instead of the idle slice.
    window.requestIdleCallback = undefined

    const realMap = new Map()
    const host = stubHost([{ link: 'wrapup-warm' }], realMap)

    localStorage.setItem(fbKey('wrapup-warm'), JSON.stringify({ sections: [[['warm a']]] }))
    globalThis.fetch = async () => {
      throw new Error('net')
    }

    warmPrintCopy(host)

    await waitFor(() => realMap.get('wrapup-warm')?.length === 1, 5000)

    expect(realMap.get('wrapup-warm')).toEqual(['warm a'])
  })

  test('a section that is not an array flattens to nothing', async () => {
    const realMap = new Map()
    const host = stubHost([{ link: 'wrapup-flat' }], realMap)

    // sections carries a non-array row — the flatMap skips it outright.
    localStorage.setItem(
      fbKey('wrapup-flat'),
      JSON.stringify({ sections: ['not-an-array', [['kept a', 'kept b']]] })
    )
    globalThis.fetch = async () => {
      throw new Error('net')
    }

    warmPrintCopy(host)

    await waitFor(() => realMap.has('wrapup-flat'), 5000)

    expect(realMap.get('wrapup-flat')).toEqual(['kept a', 'kept b'])
  })

  test('a rejected resolution is swallowed by the catch arm', async () => {
    const realMap = new Map()

    // The in-flight marker write passes; the resolved-copy write throws —
    // the .then body rejects, the .catch keeps the warm loop alive.
    const poison = {
      clear: () => realMap.clear(),
      has: (k) => realMap.has(k),
      get: (k) => realMap.get(k),
      set: (k, v) => {
        if (v.length) throw new Error('poison')

        return realMap.set(k, v)
      },
    }
    const host = stubHost([{ link: 'wrapup-catch' }], poison)

    localStorage.setItem(fbKey('wrapup-catch'), JSON.stringify({ sections: [[['x']]] }))
    globalThis.fetch = async () => {
      throw new Error('net')
    }

    warmPrintCopy(host)

    // The in-flight marker lands synchronously; the catch swallows the
    // poisoned resolution write a few macrotasks later.
    await waitFor(() => realMap.has('wrapup-catch'), 5000)

    expect(realMap.get('wrapup-catch')).toEqual([])
  })

  test('preparePrint fills feature-copy paras and linkless items fall back to the blurb', async () => {
    localStorage.setItem(
      fbKey('wrapup-long'),
      JSON.stringify({ sections: [[['Feature one', 'Feature two']]] })
    )
    globalThis.fetch = async () => {
      throw new Error('net')
    }

    const el = new CardStack()

    cleanups.push(mount(el))
    el.processedItems = [
      item(0, { link: 'wrapup-long' }),
      item(1, { link: undefined }),
      item(2, { link: 'wrapup-miss' }),
    ]

    await waitFor(() => el._cardEls.length === 3)
    await waitFor(() => (el._printCopy.get('wrapup-long') || []).length === 2, 5000)

    preparePrint(el)

    const cards = el.shadowRoot.querySelectorAll('[data-index]')
    const longFill = cards[0].querySelector(`.${PRINT_CLASSES.FILL}`)
    const longParas = longFill.querySelectorAll(`.${PRINT_CLASSES.FILL_PARA}`)

    // The resolved feature copy wins — one print-fill-para per section row.
    expect(longParas.length).toBe(2)
    expect(longParas[0].textContent).toContain('Feature one')
    expect(longParas[1].textContent).toContain('Feature two')

    // The linkless card — `item.link : undefined` arm — fills from the
    // portfoliolist blurb instead of feature copy.
    const blurbFill = cards[1].querySelector(`.${PRINT_CLASSES.FILL}`)

    expect(blurbFill).not.toBeNull()
    expect(blurbFill.querySelector(`.${PRINT_CLASSES.FILL_PARA}`)).toBeNull()
    expect(blurbFill.textContent).toContain('Desc 1')

    // The unresolved-slug card — empty in-flight copy — same blurb arm.
    const missFill = cards[2].querySelector(`.${PRINT_CLASSES.FILL}`)

    expect(missFill.textContent).toContain('Desc 2')

    restorePrint(el)
    expect(el.shadowRoot.querySelector(`.${PRINT_CLASSES.FILL}`)).toBeNull()
  })

  test('preparePrint keeps working when a blurb-less card holds copy', async () => {
    localStorage.setItem(fbKey('wrapup-seat'), JSON.stringify({ sections: [[['Seat copy']]] }))
    globalThis.fetch = async () => {
      throw new Error('net')
    }

    const el = new CardStack()

    cleanups.push(mount(el))
    el.processedItems = [item(0, { link: 'wrapup-seat', description: ATTR_VALUES.EMPTY })]

    await waitFor(() => el._cardEls.length === 1)
    await waitFor(() => (el._printCopy.get('wrapup-seat') || []).length === 1, 5000)

    preparePrint(el)

    // The card has no desc slot (no blurb) — the fill seats on the info
    // column directly and still carries the feature copy.
    const fill = el.shadowRoot.querySelector(`.${PRINT_CLASSES.FILL}`)

    expect(fill).not.toBeNull()
    expect(fill.textContent).toContain('Seat copy')

    const para = fill.querySelector(`.${PRINT_CLASSES.FILL_PARA}`)

    expect(para).not.toBeNull()
    expect(para.tagName).toBe(HTML_TAGS.SPAN.toUpperCase())

    restorePrint(el)
  })
})
