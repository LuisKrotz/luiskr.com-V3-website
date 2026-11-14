/**
 * @file draw-text-sheet-tails.test.js
 * @description Coverage tails for website/components/media/draw-text/sheet.ts —
 * the `?tiers` sheet surface: base text for string and tiered module shapes,
 * the shared constructable sheet's in-place print-tier rewrite, the legacy
 * `<style>` updater registry, and the lazy fetch's rejection path.
 */
import { getDevLog, clearDevLog } from '@core/devlog.js'
import { LOG_LEVELS } from '@core/tokens/data/log.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import '@website/components/media/DrawText.js'
import { createDrawTextSheet } from '@website/components/media/draw-text/sheet.js'

const BASE = '.draw-text { display: block; }'
const PRINT = '@media print { .draw-text { opacity: 1; } }'

/** Zero-ms flush — idle callbacks resolve within one macrotask. */
const flush = () => new Promise((r) => setTimeout(r, 0))

// The jest env installs happy-dom's `window` but not its CSSStyleSheet —
// the constructable path runs under the real class (mirroring the
// component-tiered tails convention); the legacy arm deletes it.
const SAVED_CSS_SHEET = globalThis.CSSStyleSheet

beforeAll(() => {
  globalThis.CSSStyleSheet =
    window.CSSStyleSheet ||
    class CSSStyleSheet {
      replaceSync() {}
    }
})

afterAll(() => {
  globalThis.CSSStyleSheet = SAVED_CSS_SHEET
})

describe('draw-text sheet — createDrawTextSheet', () => {
  test('a string module behaves as a base-only sheet', () => {
    const sheet = createDrawTextSheet(BASE)

    expect(sheet.baseStyleText()).toBe(BASE)

    // onPrintText registers but no loader exists — the apply never fires.
    let got = null

    sheet.onPrintText((t) => {
      got = t
    })

    return flush().then(() => expect(got).toBeNull())
  })

  test('a tiered module without a print key arms nothing', async () => {
    const sheet = createDrawTextSheet({ base: BASE, tiers: {} })

    expect(sheet.baseStyleText()).toBe(BASE)
    expect(sheet.getSharedSheet()).toBeTruthy()

    let got = null

    sheet.onPrintText((t) => {
      got = t
    })

    await flush()

    expect(got).toBeNull()
  })

  test('the print tier rewrites the shared sheet in place', async () => {
    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => Promise.resolve({ default: PRINT }),
    })

    const shared = sheet.getSharedSheet()

    expect(shared).toBeTruthy()

    await flush()

    // The print tier landed — the sheet's rule list grew past the base.
    expect(shared.cssRules.length).toBeGreaterThan(0)
  })

  test('legacy style updaters receive the composed text; unregister drops them', async () => {
    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => Promise.resolve(PRINT), // string module — the tolerated arm
    })
    const seen = []

    sheet.onPrintText((t) => seen.push(t))

    const off = sheet.onPrintText((t) => seen.push(`b:${t}`))

    off() // unregistered before resolution — never notified

    await flush()

    expect(seen).toEqual([`${BASE}\n${PRINT}`])
  })

  test('legacy style ELEMENTS recompose their text and unregister cleanly', async () => {
    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => Promise.resolve({ default: PRINT }),
    })
    const el = { textContent: BASE }

    const off = sheet.onPrintStyleNode(el)

    await flush()

    expect(el.textContent).toBe(`${BASE}\n${PRINT}`)

    off()
    expect(() => off()).not.toThrow()
  })

  test('an empty print resolution mutates nothing', async () => {
    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => Promise.resolve(''),
    })
    const shared = sheet.getSharedSheet()
    const before = shared.cssRules.length
    let got = null

    sheet.onPrintText((t) => {
      got = t
    })

    await flush()

    expect(shared.cssRules.length).toBe(before)
    expect(got).toBeNull()
  })

  test('a rejected print load warns through devlog', async () => {
    clearDevLog()

    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => Promise.reject(new Error(TEST_TEXT.STALE)),
    })

    sheet.getSharedSheet()
    await flush()

    expect(getDevLog().some((e) => e.level === LOG_LEVELS.WARN)).toBe(true)
  })

  test('the print fetch falls back to a timer when requestIdleCallback is absent', async () => {
    const saved = window.requestIdleCallback

    window.requestIdleCallback = undefined

    try {
      const sheet = createDrawTextSheet({
        base: BASE,
        tiers: {},
        print: () => Promise.resolve({ default: PRINT }),
      })
      const el = { textContent: BASE }

      sheet.onPrintStyleNode(el)
      await new Promise((r) => setTimeout(r, PREFETCH_CONFIG.FALLBACK_DELAY))

      expect(el.textContent).toBe(`${BASE}\n${PRINT}`)
    } finally {
      window.requestIdleCallback = saved
    }
  })

  test('a real host mounts a <style> node in legacy mode and unregisters on disconnect', () => {
    const saved = globalThis.CSSStyleSheet

    delete globalThis.CSSStyleSheet

    try {
      const el = document.createElement(COMPONENT_TAGS.DRAW_TEXT)

      document.body.appendChild(el)

      expect(el._styleEl).toBeInstanceOf(HTMLElement)
      expect(el._styleEl.tagName).toBe(HTML_TAGS.STYLE.toUpperCase())
      expect(typeof el._printStyleOff).toBe('function')

      el.remove()

      expect(el._printStyleOff).toBeNull()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })

  test('no constructable sheets → getSharedSheet answers null', () => {
    const saved = globalThis.CSSStyleSheet

    delete globalThis.CSSStyleSheet

    try {
      const sheet = createDrawTextSheet({ base: BASE, tiers: {} })

      expect(sheet.getSharedSheet()).toBeNull()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })
})
