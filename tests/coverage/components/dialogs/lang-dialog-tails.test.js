/**
 * @file lang-dialog-tails.test.js
 * @description Coverage tails for components/dialogs/lang-dialog —
 * `localeUrl`'s earthPlayground `||` fallback (a fetched slugs dictionary
 * carrying an empty slug collapses to the static route segment) and the
 * `!isPlainClick` early return on the locale option anchors.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { localeUrl } from '@website/components/dialogs/lang-dialog/locale.js'
import { renderLangDialog } from '@website/components/dialogs/lang-dialog/render.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

describe('lang-dialog locale + render tails', () => {
  afterEach(() => {
    store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, null)
    router.currentRoute = { name: ROUTE_NAMES.HOME }
  })

  test('localeUrl falls back to the static playground segment on an empty slug', () => {
    router.currentRoute = { name: ROUTE_NAMES.EARTH_PLAYGROUND }

    // A live DB slugs node can carry an empty value — the || arm must
    // produce the untranslated segment instead of a bare locale root.
    store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, { earthPlayground: CHAR_STRINGS.EMPTY })

    const url = localeUrl(LOCALES.DE)

    expect(url).toContain(ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT)
  })

  test('lang option anchors keep native semantics on a modified click', () => {
    const host = { isOpen: true, selectLang: jest.fn(), close: jest.fn() }
    const tree = renderLangDialog(host)
    const anchor = tree.querySelector(`a[${DATA_ATTRS.DATA_LANG}]`)

    expect(anchor).toBeTruthy()

    const ev = new MouseEvent(MOUSE_EVENTS.CLICK, {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    })

    anchor.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(false)
    expect(host.selectLang).not.toHaveBeenCalled()
  })
})
