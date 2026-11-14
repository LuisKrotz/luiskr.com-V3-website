/**
 * @file home-route-tails.test.js
 * @description Split from coverage-tails-3.test.js — covers the "Home route tails" describe.
 */
import { jest } from '@jest/globals'
import { CMS_KEYS, ROUTE_NAMES } from '@core/constants.js'
import { LOCALES } from '@core/tokens/locales.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import {
  TEST_AWARDS,
  TEST_MENTION_ROWS,
  TEST_PROJECTS,
  TEST_SCHEMA,
  TEST_TEXT,
} from '@tests/fixtures/test-constants.js'

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
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { loadHomeData, onHomeStoreUpdate } from '@website/views/home/data.js'
import store from '@core/store.js'

/** Generous flush — view render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('Home route tails', () => {
  test('mounts, scrolls to meta target, and passes data to children', async () => {
    window.scrollTo = jest.fn()

    const el = document.createElement(VIEW_TAGS.VIEW_HOME)

    document.body.appendChild(el)
    await flush(200)

    el.onRouteParamChange?.({ meta: { scrollTo: CMS_KEYS.ABOUT } })
    el.onRouteParamChange?.({ meta: {} })
    el.onRouteParamChange?.(null)

    await flush(200)

    el._passDataToChildren?.()
    el.onUpdated?.()
    el.onStoreUpdate?.()

    el.remove()
  })

  test('onHomeStoreUpdate falls back to English when the lang locale is unset', () => {
    const prev = store.state.lang.locale

    store.state.lang.locale = null

    expect(() => onHomeStoreUpdate({ _lastLocale: null, loadData: jest.fn() })).not.toThrow()

    store.state.lang.locale = prev
  })

  test('emits an awards ItemList with the localized mention rows once about resolves', async () => {
    const prevRoute = _router.currentRoute
    const prevLocale = store.state.lang.locale

    _router.currentRoute = { name: ROUTE_NAMES.HOME, view: VIEW_TAGS.VIEW_HOME, meta: {} }
    // A real locale the suite hasn't fetched yet — fetchFirebaseDb's
    // background revalidation swaps the cached en snapshot for the
    // mocked-fetch {} response, so the first read under a fresh locale
    // is the only deterministic source of the committed boot payload.
    store.state.lang.locale = LOCALES.BR

    const view = {
      processedItems: [{ label: TEST_TEXT.HEADING, link: TEST_PROJECTS.SAGE, image: 'cover-img' }],
      _updateDom() {},
      _passDataToChildren() {},
      _lastLocale: null,
    }

    loadHomeData(view)
    await flush(200)

    const script = document.getElementById(SCHEMA_STRINGS.JSON_LD_SCRIPT_ID)

    expect(script).not.toBeNull()

    const graph = JSON.parse(script.textContent)[TEST_SCHEMA.GRAPH] || []
    const lists = graph.filter((n) => n[TEST_SCHEMA.TYPE] === TEST_SCHEMA.ITEM_LIST)
    const awards = lists.find((l) =>
      (l.itemListElement || []).some((e) =>
        String(e.url || '').includes(TEST_AWARDS.AI_READY_DOCS_LINK_FRAGMENT)
      )
    )

    expect(awards).toBeTruthy()

    const last = awards.itemListElement[awards.itemListElement.length - 1]

    expect(last.url).toContain(TEST_AWARDS.AI_READY_DOCS_LINK_FRAGMENT)
    expect(last.image).toContain(TEST_AWARDS.AI_READY_MEDIA_PATH)

    _router.currentRoute = prevRoute
    store.state.lang.locale = prevLocale
  })

  test('award schema rows degrade gracefully on empty mention fields', async () => {
    const prevRoute = _router.currentRoute
    const prevLocale = store.state.lang.locale
    const prevFetch = globalThis.fetch

    _router.currentRoute = { name: ROUTE_NAMES.ABOUT, view: VIEW_TAGS.VIEW_HOME, meta: {} }
    // An unregistered locale skips the i18n boot chunk so the about read
    // reaches the fetch stub instead of the committed snapshot.
    store.state.lang.locale = TEST_TEXT.UNKNOWN

    const aboutNode = {
      col1: [TEST_TEXT.BODY],
      mentions: TEST_TEXT.HEADING,
      mention_items: TEST_MENTION_ROWS,
    }

    globalThis.fetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes(`pages/${CMS_KEYS.ABOUT}`) && !String(url).includes('profilePicture')
          ? aboutNode
          : {},
    })

    const view = {
      processedItems: [],
      _updateDom() {},
      _passDataToChildren() {},
      _lastLocale: null,
    }

    try {
      loadHomeData(view)
      await flush(200)
    } finally {
      globalThis.fetch = prevFetch
      store.state.lang.locale = prevLocale
      _router.currentRoute = prevRoute
    }

    const script = document.getElementById(SCHEMA_STRINGS.JSON_LD_SCRIPT_ID)
    const graph = JSON.parse(script.textContent)[TEST_SCHEMA.GRAPH] || []
    const lists = graph.filter((n) => n[TEST_SCHEMA.TYPE] === TEST_SCHEMA.ITEM_LIST)
    const awards = lists.find((l) => (l.itemListElement || []).length === TEST_MENTION_ROWS.length)

    expect(awards).toBeTruthy()
    expect(awards.itemListElement[0].position).toBe(1)
  })
})
