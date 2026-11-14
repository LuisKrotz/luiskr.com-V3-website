/**
 * @file preferencesmodal-tails.test.js
 * @description Split from coverage-tails-3.test.js — covers the "PreferencesModal tails" describe.
 */
import { jest } from '@jest/globals'
import _router from '@core/router/router.js'

import '@website/components/feedback/StatsHud.js'
import '@website/components/home/AwardsMentions.js'
import '@website/components/legal/Footer.js'

import '@website/components/home/HomeMosaic.js'
import '@website/components/dialogs/LangDialog.js'
import '@website/components/dialogs/PreferencesModal.js'
import '@website/components/carousel/AwardsCarousel.js'
import '@website/views/home/Home.js'
import '@website/views/legal/Legal.js'
import { updateThemeUI } from '@website/components/dialogs/preferences/sync.js'
import { prefThemeLabel } from '@website/components/dialogs/preferences/types.js'
import store from '@core/store.js'
import { themeToP } from '@core/utils/canvas/widgets/theme-slider/math.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { THEME } from '@core/tokens/theme/theme.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('PreferencesModal tails', () => {
  test('open/close and toggle commit paths', async () => {
    const el = document.createElement(COMPONENT_TAGS.PREFERENCES_MODAL)

    document.body.appendChild(el)
    await flush()

    el.open = true
    await flush()

    el._updateDom?.()
    el.open = false
    el.onStoreUpdate?.()

    el.remove()
  })

  test('playground routes withhold the appearance section', async () => {
    const prev = window.location.pathname

    window.history.replaceState({}, ATTR_VALUES.EMPTY, `/${ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT}`)

    const el = document.createElement(COMPONENT_TAGS.PREFERENCES_MODAL)

    document.body.appendChild(el)
    await flush()

    try {
      el.open = true
      await flush()

      el._updateDom?.()

      // Theme switching is locked on dark-only experiments — the section
      // is withheld entirely, never rendered as a dead control.
      expect(el.shadowRoot.querySelector(`.${PREF_CLASSES.PREF_THEME_SLIDER}`)).toBeNull()
    } finally {
      window.history.replaceState({}, ATTR_VALUES.EMPTY, prev)

      el.remove()
    }
  })

  test('the theme canvas is the real slider control — focusable with the value quartet', async () => {
    const el = document.createElement(COMPONENT_TAGS.PREFERENCES_MODAL)

    document.body.appendChild(el)
    await flush()

    el.open = true
    await flush()

    const canvas = el.shadowRoot.querySelector(`.${PREF_CLASSES.PREF_THEME_CANVAS}`)

    expect(canvas).toBeTruthy()
    expect(canvas.getAttribute(ARIA_ATTRS.ROLE)).toBe(ARIA_ATTRS.ROLE_SLIDER)
    expect(canvas.getAttribute(ARIA_ATTRS.TABINDEX)).toBe(ATTR_VALUES.TABINDEX_ZERO)
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_ORIENTATION)).toBe(ATTR_VALUES.HORIZONTAL)
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_VALUEMIN)).toBe(ATTR_VALUES.TABINDEX_ZERO)
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_VALUEMAX)).toBe(String(themeToP(THEME.LIGHT)))
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_VALUENOW)).toBe(String(themeToP(el.currentTheme)))
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_VALUETEXT)).toBeTruthy()
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBeTruthy()
    expect(canvas.hasAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(false)

    store.commit(PREF_MUTATIONS.TOGGLE_PREFERENCES_MODAL, false)
    el.remove()
  })

  test('updateThemeUI syncs the slider value ARIA and survives a missing canvas', async () => {
    const el = document.createElement(COMPONENT_TAGS.PREFERENCES_MODAL)

    document.body.appendChild(el)
    await flush()

    el.open = true
    await flush()

    const prevTheme = store.getters.getTheme()

    store.commit(PREF_MUTATIONS.SET_THEME, THEME.DARK)
    await flush()

    const canvas = el.shadowRoot.querySelector(`.${PREF_CLASSES.PREF_THEME_CANVAS}`)

    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_VALUENOW)).toBe(String(themeToP(THEME.DARK)))
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_VALUETEXT)).toBe(el.t.appearance[THEME.DARK].label)

    // Canvas-absent arm — a host that cannot query the canvas still
    // walks the button-sync loop without throwing.
    const strayBtn = {
      getAttribute: () => THEME.LIGHT,
      classList: { toggle: jest.fn() },
    }

    updateThemeUI({
      currentTheme: THEME.LIGHT,
      $: () => null,
      $$: () => [strayBtn],
      t: el.t,
    })

    store.commit(PREF_MUTATIONS.SET_THEME, prevTheme)
    store.commit(PREF_MUTATIONS.TOGGLE_PREFERENCES_MODAL, false)
    el.remove()
  })

  test('prefThemeLabel resolves the localized option and falls back to the raw value', () => {
    const appearance = {
      dark: { label: TEST_TEXT.HEADING },
      system: { label: TEST_TEXT.SECOND },
      light: { label: TEST_TEXT.BODY },
    }

    expect(prefThemeLabel(appearance, THEME.DARK)).toBe(TEST_TEXT.HEADING)
    expect(prefThemeLabel(appearance, TEST_TEXT.STALE)).toBe(TEST_TEXT.STALE)
  })
})
