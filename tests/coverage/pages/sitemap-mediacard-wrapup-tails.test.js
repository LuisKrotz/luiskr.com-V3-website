/**
 * @file sitemap-mediacard-wrapup-tails.test.js
 * @description Coverage tail for views/sitemap/Sitemap.tsx — the
 * _mediaCard locale fallback: `store.getters.getLang() || LOCALES.EN`
 * takes its English arm when the lang store carries no locale (e.g.
 * before the first db resolve), so the caption lookup falls through to
 * the English leaf instead of matching nothing.
 */
import { describe, test, expect, afterEach } from '@jest/globals'

import { ViewSitemap } from '@website/views/sitemap/Sitemap.js'
import store from '@core/store.js'
import { LOCALES } from '@core/tokens/locales.js'
import { SITEMAP_CLASSES } from '@core/tokens/classes/sitemap.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** The lang locale before each test — restored in afterEach. */
let savedLocale

/** Media card node — two locale leaves, English carrying the tip. */
const NODE = {
  href: '/media/shot',
  label: TEST_TEXT.HELLO,
  media: { kind: 'img', src: 'shot.png', size: [800, 450] },
  children: [
    { locale: LOCALES.BR, href: '/br/media/shot', label: 'BR' },
    { locale: LOCALES.EN, href: '/en/media/shot', label: 'EN', tip: TEST_TEXT.HELLO_WORLD },
  ],
}

afterEach(() => {
  store.state.lang.locale = savedLocale
})

describe('sitemap _mediaCard wrapup tails', () => {
  test('a locale-less lang store falls back to the English leaf', () => {
    savedLocale = store.state.lang.locale
    store.state.lang.locale = ''

    const el = new ViewSitemap()
    const card = el._mediaCard(NODE, {})

    // getLang() answered '' — the || arm selects LOCALES.EN, so the
    // caption resolves to the English leaf's tip, not the first tip.
    const desc = card.querySelector(`.${SITEMAP_CLASSES.SITEMAP_CARD_DESC}`)

    expect(desc).not.toBeNull()
    expect(desc.textContent).toBe(TEST_TEXT.HELLO_WORLD)
  })
})
