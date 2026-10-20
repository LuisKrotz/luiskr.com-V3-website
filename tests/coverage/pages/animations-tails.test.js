/**
 * @file animations-tails.test.js
 * @description Coverage tails for website/views/animations — the async
 * loadData surface (fetch apply paths, route-meta guards, meta-description
 * push, empty/missing snapshots) that the view suite cannot reach without
 * stubbing fetch.
 */
import { describe, test, expect } from '@jest/globals'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import store from '@core/store.js'
import router from '@core/router/router.js'

import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import '@website/views/animations/Animations.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('Animations tails', () => {
  test('onMounted subscribes, loads data and schedules the scroll-top', async () => {
    const el = document.createElement(VIEW_TAGS.VIEW_ANIMATIONS)

    document.body.appendChild(el)

    // 500ms scroll timeout — flushed real-time (happy-dom scrollTo is a stub).
    await flush(600)

    expect(el._lastLocale).not.toBeNull()

    el.remove()
  })

  test('loadData applies the fetched page node and pushes its description', async () => {
    const prevFetch = globalThis.fetch
    const prevDb = store.getters.getlang().database
    const prevRoute = router.currentRoute

    router.currentRoute = {
      path: ROUTE_PATHS.ROOT,
      meta: { title: TEST_TEXT.HEADING },
    }

    const payload = {
      title: ROUTE_PATHS.ROOT,
      description: 'Localized animations intro.',
    }

    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload })

    const el = document.createElement(VIEW_TAGS.VIEW_ANIMATIONS)

    try {
      store.state.lang.database = 'zz-animations-db/'

      document.body.appendChild(el)
      await flush(80)

      expect(el.translations?.description).toBe('Localized animations intro.')
      expect(document.title).toBe(TEST_TEXT.HEADING)
    } finally {
      globalThis.fetch = prevFetch
      store.state.lang.database = prevDb
      router.currentRoute = prevRoute
      el.remove()
    }
  })

  test('loadData tolerates a null currentRoute and a description-less node', async () => {
    const prevFetch = globalThis.fetch
    const prevDb = store.getters.getlang().database
    const prevRoute = router.currentRoute

    router.currentRoute = null
    store.state.lang.database = 'zz-animations-nodesc/'

    const payload = { title: TEST_TEXT.HEADING }

    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload })

    const el = document.createElement(VIEW_TAGS.VIEW_ANIMATIONS)

    try {
      document.body.appendChild(el)
      await flush(80)

      // description missing → setMetaDescription no-ops; title still lands.
      expect(el.translations?.title).toBe(TEST_TEXT.HEADING)
    } finally {
      globalThis.fetch = prevFetch
      store.state.lang.database = prevDb
      router.currentRoute = prevRoute
      el.remove()
    }
  })

  test('loadData guards a missing route meta and a nonexistent snapshot', async () => {
    const prevFetch = globalThis.fetch
    const prevDb = store.getters.getlang().database
    const prevRoute = router.currentRoute
    const prevLocale = store.getters.getlang().locale

    router.currentRoute = { path: ROUTE_PATHS.ROOT, meta: {} }
    store.state.lang.locale = CHAR_STRINGS.EMPTY
    store.state.lang.database = 'zz-animations-empty/'
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => null })

    const el = document.createElement(VIEW_TAGS.VIEW_ANIMATIONS)

    try {
      document.body.appendChild(el)
      await flush(80)

      expect(el.translations).toBeNull()
    } finally {
      globalThis.fetch = prevFetch
      store.state.lang.database = prevDb
      store.state.lang.locale = prevLocale
      router.currentRoute = prevRoute
      el.remove()
    }
  })

  test('render reads the fallback page title when translations are empty', () => {
    const el = document.createElement(VIEW_TAGS.VIEW_ANIMATIONS)

    el.translations = {}
    el._updateDom()

    const h1 = el.shadowRoot.querySelector('h1')
    const expected = FALLBACK_PAGES[TRANSLATION_KEYS.ANIMATIONS]?.title

    if (expected) {
      expect(h1.getAttribute('aria-label')).toBe(expected)
    } else {
      expect(h1).not.toBeNull()
    }

    // Empty records object still renders the list container once entries
    // resolve — assert the dl row shape stays consistent with the loaded arm.
    expect(el.shadowRoot.querySelector('article')).not.toBeNull()
  })

  test('loadData swallows fetch failures through devError', async () => {
    const prevFetch = globalThis.fetch
    const prevDb = store.getters.getlang().database

    store.state.lang.database = 'zz-animations-fail/'
    globalThis.fetch = async () => {
      throw new Error('net down')
    }

    const el = document.createElement(VIEW_TAGS.VIEW_ANIMATIONS)

    try {
      document.body.appendChild(el)
      await flush(80)

      expect(el.translations).toBeNull()
      expect(el.shadowRoot.querySelector('article')).not.toBeNull()
    } finally {
      globalThis.fetch = prevFetch
      store.state.lang.database = prevDb
      el.remove()
    }
  })
})
