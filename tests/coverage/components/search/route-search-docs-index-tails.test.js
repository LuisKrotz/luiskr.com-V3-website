/**
 * @file route-search-docs-index-tails.test.js
 * @description Coverage tails for the shared docs catalog in
 * route-search/data.ts — every loadDocsRows miss arm (!ok, non-array,
 * empty array, rejection) resolves [] AND resets the slot so the next
 * loadCatalog retries; a non-empty artifact merges into the catalog and
 * pins the slot so later locale loads reuse it without a refetch. The
 * `c` → kind mapping arms ride the merge assertions.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_SEARCH_KINDS } from '@core/tokens/routes/search.js'
import { loadCatalog } from '@website/components/search/route-search/data.js'

/** Per-test docs-index reply — swapped before every loadCatalog call. */
const state = { docs: async () => ({ ok: true, json: async () => [] }) }

const localeRows = [{ p: '/x', t: 'X', d: '', k: ['x'], c: ROUTE_SEARCH_KINDS.PAGE }]

const docsCalls = () =>
  globalThis.fetch.mock.calls.filter(([u]) => String(u).includes('-docs')).length

const catalog = () => new Promise((r) => loadCatalog(LOCALES.EN, r))

describe('route-search docs index arms', () => {
  afterEach(() => {
    globalThis.fetch = jest.fn((url) =>
      String(url).includes('-docs') ? state.docs(url) : Promise.resolve(localeResponse())
    )
  })

  const localeResponse = () => ({ ok: true, json: async () => localeRows })

  globalThis.fetch = jest.fn((url) =>
    String(url).includes('-docs') ? state.docs(url) : Promise.resolve(localeResponse())
  )

  test('a rejected docs fetch resolves the locale rows only', async () => {
    state.docs = async () => Promise.reject(new Error('offline'))

    const entries = await catalog()

    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe(ROUTE_SEARCH_KINDS.PAGE)
  })

  test('!ok, non-array and empty payloads all resolve [] and retry next load', async () => {
    state.docs = async () => ({ ok: false, json: async () => [] })
    expect(await catalog()).toHaveLength(1)

    state.docs = async () => ({ ok: true, json: async () => ({ bad: true }) })
    expect(await catalog()).toHaveLength(1)

    state.docs = async () => ({ ok: true, json: async () => [] })
    expect(await catalog()).toHaveLength(1)
  })

  test('a non-empty docs artifact merges and pins — later loads reuse it', async () => {
    state.docs = async () => ({
      ok: true,
      json: async () => [
        {
          p: '/docs/a',
          t: 'Doc A',
          d: 'd',
          k: ['mermaid'],
          c: ROUTE_SEARCH_KINDS.DOCS,
          i: 'cover-src',
          v: 1,
        },
        { p: '/docs/b', t: 'Doc B', d: '', k: ['x'], c: 'bogus', i: 'img-src' },
        { p: '/docs/c', t: 'Doc C', d: '', k: ['x'] },
      ],
    })

    const entries = await catalog()

    expect(entries).toHaveLength(4)
    expect(entries[1].kind).toBe(ROUTE_SEARCH_KINDS.DOCS)
    // Unknown + absent `c` values land the PAGE fallback arm.
    expect(entries[2].kind).toBe(ROUTE_SEARCH_KINDS.PAGE)
    expect(entries[3].kind).toBe(ROUTE_SEARCH_KINDS.PAGE)

    const before = docsCalls()
    const again = await catalog()

    expect(again).toHaveLength(4)
    expect(docsCalls()).toBe(before) // pinned slot — no refetch
  })
})
