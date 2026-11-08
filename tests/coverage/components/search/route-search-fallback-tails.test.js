/**
 * @file coverage/components/search/route-search-fallback-tails.test.js
 * @description Coverage tail for route-search/data.ts — the
 * `searchStrings` `?? EMPTY` arms reachable only when the locale
 * fallback snapshot itself lacks the search node, plus the component's
 * `snap.exists() === false` arm in loadData.
 */
import { describe, test, expect, beforeAll, jest } from '@jest/globals'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { DATA_MUTATIONS } from '@core/tokens/events/mutations.js'
import { mount } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

/** db.js replies — exists:false drives the no-snapshot arm. */
jest.unstable_mockModule('@core/utils/data/db.js', () => ({
  fetchFirebaseDb: async () => ({ exists: () => false, val: () => ({}) }),
}))

/** The fallback snapshot WITHOUT the search node — `fb.x ?? EMPTY` arms. */
jest.unstable_mockModule('@core/locale/fallback.js', () => ({
  FALLBACK_PAGES: {},
  FALLBACK_APP: {},
  FALLBACK_COMPONENTS: {},
}))

let searchStrings
let loadCatalog

beforeAll(async () => {
  const data = await import('@website/components/search/route-search/data.js')

  searchStrings = data.searchStrings
  loadCatalog = data.loadCatalog
})

const waitFor = async (fn, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    const v = fn()
    if (v) return v
    await new Promise((r) => setTimeout(r, 10))
  }
  return null
}

describe('route-search fallback tails', () => {
  test('searchStrings emits empty strings when no fallback node exists', () => {
    const s = searchStrings(null)

    expect(s.label).toBe('')
    expect(s.placeholder).toBe('')
    expect(s.empty).toBe('')
    expect(s.go).toBe('')
    expect(s.results).toBe('')
    expect(s.hint).toBe('')
  })

  test('loadCatalog resolves with a missing snapshot + empty store', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])

    const entries = await new Promise((r) => loadCatalog('en', r))

    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })

  test('a mounted element tolerates a missing snapshot for copy', async () => {
    const { RouteSearch } = await import('@website/components/search/RouteSearch.js')
    const el = new RouteSearch()
    const cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    // With the snapshot missing, placeholder stays whatever the shell seeded.
    const input = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT}`)

    expect(input).not.toBeNull()

    cleanup()
  })
})
