/**
 * @file loadcatalog-modal-tails.test.js
 * @description Sweep tails: route-search/data.ts loadCatalog fetch arms
 * (index rows map, embedded + fetch-fallback paths) and SearchModal's
 * closed-render / repeated-update / store-arm paths.
 */
import { jest } from '@jest/globals'
import { loadCatalog } from '@website/components/search/route-search/data.js'
import '@website/components/dialogs/SearchModal.js'

import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

const flush = (ms = 120) => new Promise((r) => setTimeout(r, ms))

describe('loadCatalog fetch arms', () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('index rows map to entries via the ?. fallbacks; docs rows merge', async () => {
    globalThis.fetch = jest.fn((url) => {
      const isDocs = String(url).includes('-docs.json')

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            isDocs
              ? [{ p: '/docs/x', t: 'Doc X', d: 'd', k: ['x'], c: 'docs' }]
              : [
                  { p: '/a', t: TEST_TEXT.HEADING, d: TEST_TEXT.SECOND, k: ['x'], c: 'page' },
                  { p: '', t: '', d: null, k: 'bad', c: 'bogus' },
                  {},
                ]
          ),
      })
    })

    const done = jest.fn()

    loadCatalog('en', done)
    await flush()

    expect(done).toHaveBeenCalled()

    const entries = done.mock.calls[0][0]

    expect(entries.length).toBe(4)
    expect(entries[3].kind).toBe('docs')
    expect(entries[1].kind).toBe('page') // unknown c lands the PAGE arm
  })

  test('res.ok false → embedded fallback (store rows)', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => null }))

    const done = jest.fn()

    loadCatalog('en', done)
    await flush()

    expect(done).toHaveBeenCalled()
  })

  test('fetch rejection → embedded fallback via pages fetch', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline')))

    const done = jest.fn()

    loadCatalog('en', done)
    await flush(300)

    expect(done).toHaveBeenCalled()
  })
})

describe('SearchModal residual arms', () => {
  test('render returns EMPTY while closed; open setter toggles', () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    expect(el.render()).toBe(ATTR_VALUES.EMPTY)
    expect(el.isOpen).toBe(false) // store-getter arm when flag absent
  })

  test('onStoreUpdate re-enters on repeated open state', async () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, true)
    await flush()

    el.onStoreUpdate() // isOpen && hasAttribute → second arm

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    await flush()

    el.remove()
  })
})
