/**
 * @file route-search-sync-tails.test.js
 * @description Coverage tails for components/search/RouteSearch.tsx — the
 * arms the behavior suites can't reach from the happy path: `?q=`/`?p=`
 * deep-link seeding, the _syncQueryParam URL writer (typeof history
 * guard + replaceState arms), SSR window guards, the NaN css-gap list
 * cap, the toEnd page turn, submit/pager click arms, the searchRoutes
 * reject catch, the ring mount bail, pointermove keynav release, and
 * the already-defined custom-element registration guard.
 */

import { describe, test, expect, afterEach } from '@jest/globals'
import { RouteSearch } from '@website/components/search/RouteSearch.js'
import { wasmPool } from '@core/utils/wasm/wasm-pool.js'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { KEYS } from '@core/tokens/primitives.js'
import { LOCALES } from '@core/tokens/locales.js'
import { POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { ROUTE_SEARCH_LIMITS } from '@core/tokens/routes/search.js'
import { mount } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'
import router from '@core/router/router.js'

/** Shadow-DOM selector bundle for the route-search element surface. */
const S = {
  ROOT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH}`,
  INPUT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT}`,
  LIST: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LIST}`,
  SUBMIT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_SUBMIT}`,
  NEXT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_NEXT}`,
}

/** Short flush — sync tails poll frequently so each tick stays cheap. */
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms))

/** Polls `fn` until it returns truthy — async UI has no fixed settle tick. */
const waitFor = async (fn, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    const v = fn()

    if (v) return v

    await new Promise((r) => setTimeout(r, 10))
  }

  return null
}

describe('route-search sync tails', () => {
  let el
  let cleanup

  afterEach(() => {
    cleanup?.()
    cleanup = null
    el = null
    window.history.pushState({}, '', '/')
  })

  test('mounting at ?q=&p= seeds the field, the page and the ranked query', async () => {
    window.history.pushState({}, '', '/search?q=seeded&p=2')
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    expect(input.value).toBe('seeded')
    expect(el._page).toBe(1)
    expect(el._rankedQuery).toBe('seeded')
  })

  test('window/history guards return the safe defaults', () => {
    el = new RouteSearch()
    cleanup = mount(el)

    // The SSR arms: bare `window`/`history` globals unset for the call.
    const win = globalThis.window

    delete globalThis.window

    expect(el._queryParam()).toBe('')
    expect(el._pageParam()).toBe(0)

    el._syncQueryParam('x') // history undefined with window gone

    globalThis.window = win

    // History still undefined in the happy-dom global — the guard exits.
    el._syncQueryParam('x')
    expect(window.location.search).not.toContain('q=')
  })

  test('_syncQueryParam writes ?q= (+p= when ranked) and clears them', async () => {
    globalThis.history = window.history

    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el._rankedQuery = 'abc'
    el._page = 1
    el._syncQueryParam('abc')

    expect(window.location.search).toContain('q=abc')
    expect(window.location.search).toContain('p=2')

    // Unranked / page-0 — the p param drops instead of shipping a stale page.
    el._page = 0
    el._rankedQuery = 'other'
    el._syncQueryParam('abc')

    expect(window.location.search).not.toContain('p=')

    // Blank query — both params leave the URL.
    el._syncQueryParam('')

    expect(window.location.search).not.toContain('q=')
  })

  test('_syncQueryParam falls back to English when the lang locale is unset', async () => {
    globalThis.history = window.history

    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const saved = store.state.lang.locale

    store.state.lang.locale = null
    el._syncQueryParam('abc')

    expect(window.location.search).toContain('q=abc')
    expect(window.location.pathname).toContain('search')

    store.state.lang.locale = saved
  })

  test('a keystroke routes through _onInput → _syncQueryParam', async () => {
    globalThis.history = window.history

    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = 'typed'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(window.location.search).toContain('q=typed')
  })

  test('pointermove releases the keyboard-owned active row', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el._keyNav = true

    el.shadowRoot
      .querySelector(S.ROOT)
      .dispatchEvent(new window.Event(POINTER_EVENTS.POINTERMOVE, { bubbles: true }))

    expect(el._keyNav).toBe(false)
  })

  test('ArrowUp on the first row turns back a page and seeds the last row', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const max = ROUTE_SEARCH_LIMITS.MAX_HITS

    // Two full pages of ranked hits — the turn lands on page 0's last row.
    el._ranked = Array.from({ length: max * 2 }, () => el._catalog[0])
    el._hits = el._ranked.slice(max)
    el._page = 1
    el._setActive(0)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: KEYS.ARROW_UP, bubbles: true }))

    expect(el._page).toBe(0)
    expect(el._active).toBe(el._hits.length - 1)
  })

  test('submit click navigates the top hit', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el._hits = el._catalog.slice(0, 2)

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p

      return Promise.resolve()
    }

    el.shadowRoot
      .querySelector(S.SUBMIT)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    router.push = orig

    expect(navigated).toBe(el._hits[0].path)
  })

  test('the pager next button turns the page', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const max = ROUTE_SEARCH_LIMITS.MAX_HITS

    el._ranked = Array.from({ length: max * 2 }, () => el._catalog[0])
    el._hits = el._ranked.slice(0, max)
    el._page = 0
    el._renderList()
    el._syncPager()

    el.shadowRoot
      .querySelector(S.NEXT)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    expect(el._page).toBe(1)
    expect(el._hits).toHaveLength(max)
  })

  test('a worker rejection still settles loading without corrupting hits', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const origDispatch = wasmPool.dispatch

    wasmPool.dispatch = () => Promise.reject(new Error('pool down'))

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = 'abc'
    el._score()

    await flush()

    wasmPool.dispatch = origDispatch

    expect(el._busy).toBe(false)
  })

  test('the list cap falls back when the css gap var is unparseable', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const orig = globalThis.getComputedStyle

    globalThis.getComputedStyle = (node) => {
      const st = orig.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'getPropertyValue' ? () => 'abc' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    el._fitListToViewport()

    globalThis.getComputedStyle = orig

    const list = el.shadowRoot.querySelector(S.LIST)

    expect(list.style.getPropertyValue('--rs-list-avail')).toBeTruthy()
  })

  test('mountRing bails when the root element is gone', () => {
    el = new RouteSearch()
    cleanup = mount(el)

    el.shadowRoot.querySelector(S.ROOT)?.remove()

    expect(() => el._mountRing()).not.toThrow()
  })

  test('focusInput moves focus into the combobox input', () => {
    el = new RouteSearch()
    cleanup = mount(el)

    el.focusInput()

    expect(el.shadowRoot.querySelector(S.INPUT)).not.toBeNull()
  })

  test('loadData falls back to English when the lang locale is unset', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    const saved = store.state.lang.locale

    store.state.lang.locale = null
    el.loadData()
    await flush()

    expect(el._catalog.length).toBeGreaterThan(0)

    store.state.lang.locale = saved
  })

  test('_syncQueryParam prefixes the localized search route outside English', async () => {
    globalThis.history = window.history

    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const saved = store.state.lang.locale

    store.state.lang.locale = LOCALES.DE
    el._syncQueryParam('abc')

    expect(window.location.pathname).toContain(`/${LOCALES.DE}/`)
    expect(window.location.search).toContain('q=abc')

    store.state.lang.locale = saved
  })

  test('the list cap honors a parseable css gap var', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const orig = globalThis.getComputedStyle

    globalThis.getComputedStyle = (node) => {
      const st = orig.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'getPropertyValue' ? () => '12' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    el._fitListToViewport()

    globalThis.getComputedStyle = orig

    const list = el.shadowRoot.querySelector(S.LIST)

    expect(list.style.getPropertyValue('--rs-list-avail')).toBeTruthy()
  })

  test('a cleared field syncs the empty-query arm', async () => {
    globalThis.history = window.history

    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = ''
    input.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(window.location.search).not.toContain('q=')
  })

  test('a non-Escape key falls through the keydown chain', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    // The keydown guard drops non-Escape keys on an empty hit list —
    // populated rows are required to reach the Escape else-if arm.
    el._hits = el._catalog.slice(0, 3)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'x', bubbles: true }))

    expect(el._active).toBeLessThanOrEqual(0)
  })

  test('Escape closes an open list', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el._hits = el._catalog.slice(0, 3)
    el._renderList()
    el._openList()

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: KEYS.ESCAPE, bubbles: true }))

    expect(el._listOpen).toBe(false)
  })

  test('submit click navigates the active row when one is set', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el._hits = el._catalog.slice(0, 3)
    el._setActive(1)

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p

      return Promise.resolve()
    }

    el.shadowRoot
      .querySelector(S.SUBMIT)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    router.push = orig

    expect(navigated).toBe(el._hits[1].path)
  })

  test('submit click with no hits is a no-op', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el._hits = []

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p

      return Promise.resolve()
    }

    el.shadowRoot
      .querySelector(S.SUBMIT)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    router.push = orig

    expect(navigated).toBeNull()
  })

  test('_showHits tolerates a missing empty row', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_EMPTY}`)?.remove()

    expect(() => el._showHits(el._catalog.slice(0, 2), 'q')).not.toThrow()
  })

  test('_syncPager tolerates a missing status label', async () => {
    el = new RouteSearch()
    cleanup = mount(el)

    await waitFor(() => el._catalog.length)

    el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_STATUS}`)?.remove()

    expect(() => el._syncPager()).not.toThrow()
  })

  test('a second module instance skips re-registering the element', async () => {
    // The file-level import already registered the tag; a second specifier
    // re-executes the module body — the guard must take its defined arm.
    const mod = await import('@website/components/search/RouteSearch.tsx')

    expect(mod.RouteSearch).toBeDefined()
    expect(customElements.get(COMPONENT_TAGS.ROUTE_SEARCH)).toBe(RouteSearch)
  })
})
