/**
 * @file route-search-viewport-tails.test.js
 * @description <route-search> viewport-fit coverage — the open listbox's
 * --rs-list-avail cap measured from the panel's top edge, the list-only
 * fallback when the panel node is absent, the window-less guard and the
 * resize re-measure while open.
 */
import { jest } from '@jest/globals'
import '@website/components/search/RouteSearch.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Mounts a <route-search> element and waits out its first render pass. */
const mountSearch = async () => {
  const el = document.createElement(COMPONENT_TAGS.ROUTE_SEARCH)

  document.body.appendChild(el)
  await flush()

  return el
}

/** Arms the open-list preconditions (hits + a typed query). */
const openList = (el) => {
  el._hits = [{ title: 'T', path: '/x', preview: '', keywords: [] }]

  const input = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT}`)

  input.value = 't'
  el._openList()
}

describe('route-search viewport fit', () => {
  test('open listbox is capped to the space below the panel', async () => {
    const el = await mountSearch()
    const list = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LIST}`)

    openList(el)

    const expected = Math.floor(window.innerHeight - 0 - 16)

    expect(list.style.getPropertyValue('--rs-list-avail')).toBe(`${expected}px`)

    el.remove()
  })

  test('falls back to the list rect when the panel node is gone', async () => {
    const el = await mountSearch()
    const real = el.$.bind(el)
    const spy = jest
      .spyOn(el, '$')
      .mockImplementation((sel) =>
        sel === `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PANEL}` ? null : real(sel)
      )

    el._fitListToViewport()

    const list = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LIST}`)

    expect(list.style.getPropertyValue('--rs-list-avail')).toBeTruthy()

    spy.mockRestore()
    el.remove()
  })

  test('window-less guard and missing-list guard return early', async () => {
    const el = await mountSearch()
    const w = globalThis.window

    delete globalThis.window
    el._fitListToViewport()
    globalThis.window = w

    // Missing listbox — the !list early return.
    jest.spyOn(el, '$').mockReturnValue(null)
    el._fitListToViewport()
    el.$.mockRestore()

    el.remove()
  })

  test('resize re-measures only while the list is open', async () => {
    const el = await mountSearch()
    const spy = jest.spyOn(el, '_fitListToViewport')

    // Closed list — the listener short-circuits.
    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))
    expect(spy).not.toHaveBeenCalled()

    openList(el)
    spy.mockClear()

    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
    el.remove()
  })
})
