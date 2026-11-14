/**
 * @file legal-footer-version.test.js
 * @description Covers the release-stamp line under the copyright — the
 * baked VITE_* env renders `v<version> / build <id>`; an unset env (the
 * default under Jest) renders no line at all.
 */
import { CMS_KEYS } from '@core/constants.js'
import store from '@core/store.js'
import { TEST_TEXT, TEST_VERSION } from '@tests/fixtures/test-constants.js'

import '@website/components/legal/Footer.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ROUTE_STRINGS } from '@core/tokens/strings/routes.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('legal Footer release stamp', () => {
  test('renders the version/build stamp from the baked env', async () => {
    const prevEnv = globalThis.__VITE_ENV__
    const prevComponents = store.getters.getlang()?.components
    const payload = {
      [CMS_KEYS.LEGAL_FOOTER]: {
        links: [
          { page: TEST_TEXT.HELLO, link: `${ROUTE_PATHS.ROOT}${ROUTE_STRINGS.PRIVACY_POLICY}` },
        ],
      },
    }

    globalThis.__VITE_ENV__ = {
      VITE_APP_VERSION: TEST_VERSION.APP,
      VITE_BUILD_ID: TEST_VERSION.BUILD,
    }

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, payload)

    const el = document.createElement(COMPONENT_TAGS.LEGAL_FOOTER)

    document.body.appendChild(el)
    await flush()

    // re-commit + re-render so a resolved _ensureData can't swap the
    // components payload mid-assertion.
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, payload)
    el._updateDom()

    const stamp = el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_VERSION}`)

    expect(stamp).not.toBeNull()
    expect(stamp.textContent).toBe(`v${TEST_VERSION.APP} / build ${TEST_VERSION.BUILD}`)

    globalThis.__VITE_ENV__ = prevEnv
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, prevComponents)
    el.remove()
  })

  test('an unset env renders no stamp line', async () => {
    const prevEnv = globalThis.__VITE_ENV__

    globalThis.__VITE_ENV__ = undefined

    const el = document.createElement(COMPONENT_TAGS.LEGAL_FOOTER)

    document.body.appendChild(el)
    await flush()

    expect(
      el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_VERSION}`)
    ).toBeNull()

    globalThis.__VITE_ENV__ = prevEnv
    el.remove()
  })
})
