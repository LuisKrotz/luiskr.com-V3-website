/**
 * @file animations-tails-2.test.js
 * @description Coverage tails for website/views/animations — the data-miss
 * arms: `componentText('animations')` returning undefined (records `|| {}`)
 * and the h1 aria-label chain degrading through missing fallback page copy
 * and an empty appText hit to `undefined`. Both locale modules are stubbed
 * wholesale (sync factories) so the misses are deterministic.
 */
import { jest, describe, test, expect } from '@jest/globals'
import { LANG_SLUGS } from '@core/i18n.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

jest.unstable_mockModule('@core/locale/ui-text.js', () => ({
  appText: () => CHAR_STRINGS.EMPTY,
  componentText: () => undefined,
  routeSlugs: (lang) => LANG_SLUGS[lang] || LANG_SLUGS.en,
  rightsText: () => CHAR_STRINGS.EMPTY,
  rightsParts: () => ({ rights: CHAR_STRINGS.EMPTY, year: CHAR_STRINGS.EMPTY }),
}))

jest.unstable_mockModule('@core/locale/fallback.js', () => {
  const app = { actions: { click: 'click', tap: 'tap' }, carousel: {}, statsHud: {} }

  return {
    FALLBACK: Object.freeze({ APP: app, components: {}, pages: {}, loaderLocales: {} }),
    FALLBACK_APP: app,
    FALLBACK_LOADERS: {},
    FALLBACK_COMPONENTS: {},
    FALLBACK_PAGES: {},
  }
})

const { ViewAnimations } = await import('@website/views/animations/Animations.js')
const { ANIMATIONS_CLASSES } = await import('@core/tokens/classes/animations.js')

describe('Animations tails 2', () => {
  test('renders with records and page fallbacks both missing', () => {
    const el = new ViewAnimations()

    document.body.appendChild(el)
    el._updateDom()

    // componentText → undefined → `records || {}` → empty entries → skeleton rows.
    expect(el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_LIST}`)).toBeNull()

    // The aria-label chain bottoms out at `undefined` (no attribute).
    const h1 = el.shadowRoot.querySelector('h1')
    expect(h1.getAttribute('aria-label')).toBeNull()

    el.remove()
  })
})
