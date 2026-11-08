/**
 * @file route-search-pager-tails.test.js
 * @description Coverage tails for <route-search> kind ordering + the
 * results pager: _showHits partitions hits into best-hit-ordered kind
 * buckets, renderItems emits a role=group header at each kind boundary,
 * _turnPage slices _ranked per MAX_HITS page, the pager row syncs its
 * status/disabled states, and keyboard/click drivers reach every arm.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { ROUTE_SEARCH_KINDS, ROUTE_SEARCH_LIMITS } from '@core/tokens/routes/search.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { KEYS } from '@core/tokens/primitives.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'

import '@website/components/search/RouteSearch.js'

/** Token aliases — classes/kinds/page-size constants used throughout. */
const C = ROUTE_SEARCH_CLASSES
const K = ROUTE_SEARCH_KINDS
const PAGE = ROUTE_SEARCH_LIMITS.MAX_HITS

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Mounts a <route-search> element and waits for its async mount to settle. */
const mount = async () => {
  const el = document.createElement(COMPONENT_TAGS.ROUTE_SEARCH)

  document.body.appendChild(el)
  await flush()

  return el
}

/** Fabricates `n` catalog entries of one kind with distinct paths. */
const make = (n, kind) =>
  Array.from({ length: n }, (_, i) => ({
    title: `${kind}${i}`,
    path: `/${kind}/${i}`,
    preview: '',
    keywords: [],
    kind,
    thumb: '',
  }))

/** Shadow-DOM query shorthand — assertions run inside the search root. */
const q = (el, sel) => el.shadowRoot.querySelector(sel)
/** Pager-region lookups — the paging UI elements under test. */
const pager = (el) => q(el, `.${C.ROUTE_SEARCH_PAGER}`)
const status = (el) => q(el, `.${C.ROUTE_SEARCH_PAGER_STATUS}`)
const prev = (el) => q(el, `.${C.ROUTE_SEARCH_PAGER_PREV}`)
const next = (el) => q(el, `.${C.ROUTE_SEARCH_PAGER_NEXT}`)

describe('route-search kind ordering + pager', () => {
  test('hits partition into kind buckets with a group header per boundary', async () => {
    const el = await mount()
    const [docA, docB] = make(2, K.DOCS)

    // Score-sorted input — the docs hit leads, so its whole bucket
    // renders first; the second docs hit rejoins that bucket ahead of
    // the weaker page/legal hits (a partition, not an interleave).
    el._showHits([docA, ...make(1, K.PAGE), ...make(1, K.LEGAL), ...make(1, K.PROJECT), docB], 'q')

    expect(el._ranked.map((e) => e.kind)).toEqual([K.DOCS, K.DOCS, K.PAGE, K.LEGAL, K.PROJECT])

    const groups = el.shadowRoot.querySelectorAll(`.${C.ROUTE_SEARCH_GROUP}`)

    expect(groups).toHaveLength(4)
    expect(groups[0].textContent).toContain('English')

    const input = q(el, `.${C.ROUTE_SEARCH_INPUT}`)

    input.value = ''
    el.remove()
  })

  test('a hit list past one page arms the pager status + buttons', async () => {
    const el = await mount()

    el._showHits(make(PAGE * 2 + 10, K.PAGE), 'q')

    expect(el._hits).toHaveLength(PAGE)
    expect(pager(el).hidden).toBe(false)
    expect(status(el).textContent).toBe('Page 1 of 3')
    expect(prev(el).disabled).toBe(true)
    expect(next(el).disabled).toBe(false)

    el._turnPage(1)

    expect(el._page).toBe(1)
    expect(el._hits).toHaveLength(PAGE)
    expect(el._active).toBe(0)
    expect(status(el).textContent).toBe('Page 2 of 3')
    expect(prev(el).disabled).toBe(false)

    el._turnPage(1)

    expect(el._page).toBe(2)
    expect(el._hits).toHaveLength(10)
    expect(next(el).disabled).toBe(true)

    el._turnPage(1) // past the end — no-op arm
    expect(el._page).toBe(2)

    el._turnPage(-1, true) // backward seed lands on the last row
    expect(el._active).toBe(el._hits.length - 1)

    el._turnPage(-1)
    el._turnPage(-1) // before the start — no-op arm
    expect(el._page).toBe(0)

    const input = q(el, `.${C.ROUTE_SEARCH_INPUT}`)

    input.value = ''
    el.remove()
  })

  test('pager buttons + arrow keys turn pages', async () => {
    const el = await mount()

    el._showHits(make(PAGE + 5, K.PAGE), 'q')

    const inp = q(el, `.${C.ROUTE_SEARCH_INPUT}`)

    inp.value = 'q'
    el._setActive(el._hits.length - 1)
    el._onKeydown({ key: KEYS.ARROW_DOWN, preventDefault: jest.fn() })

    expect(el._page).toBe(1)
    expect(el._active).toBe(0)

    el._onKeydown({ key: KEYS.ARROW_UP, preventDefault: jest.fn() })

    expect(el._page).toBe(0)
    expect(el._active).toBe(el._hits.length - 1)

    next(el).dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    expect(el._page).toBe(1)

    prev(el).dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    expect(el._page).toBe(0)

    inp.value = ''
    el.remove()
  })

  test('a same-query re-rank clamps the page; a new query resets it', async () => {
    const el = await mount()

    el._showHits(make(PAGE * 3, K.PAGE), 'q')
    el._turnPage(2)
    expect(el._page).toBe(2)

    // Same query, fewer hits — the page clamps to the new last page.
    el._showHits(make(PAGE + 2, K.PAGE), 'q')
    expect(el._page).toBe(1)

    el._showHits(make(PAGE * 2, K.PAGE), 'other')
    expect(el._page).toBe(0)

    el.remove()
  })

  test('_syncPager and _turnPage tolerate missing nodes', async () => {
    const el = await mount()

    jest.spyOn(el, '$').mockReturnValue(null)

    el._syncPager() // pager null → early return

    el._ranked = make(PAGE + 5, K.PAGE)
    el._turnPage(1) // valid turn, listEl null → the if(list) false arm

    expect(el._page).toBe(1)

    jest.restoreAllMocks()

    // Pager present but gutted — status/prev/next null arms.
    const p = pager(el)

    p.replaceChildren()
    el._syncPager()
    expect(p.hidden).toBe(false)

    el._hits = []
    el._renderList() // zero hits → pager.hidden via the !hits arm

    el.remove()
  })

  test('a page sliced mid-group still labels its leading bucket', async () => {
    const el = await mount()

    el._showHits(make(PAGE + 5, K.DOCS), 'q')
    el._turnPage(1)

    const groups = el.shadowRoot.querySelectorAll(`.${C.ROUTE_SEARCH_GROUP}`)

    expect(groups).toHaveLength(1)
    expect(groups[0].getAttribute('role')).toBe('group')
    expect(groups[0].getAttribute('aria-label')).toContain('English')

    // Page 2 numbering continues from the global rank — not 1 again.
    const indexEl = el.shadowRoot.querySelector(`.${C.ROUTE_SEARCH_INDEX}`)

    expect(indexEl.textContent.trim()).toBe(String(PAGE + 1))

    const input = q(el, `.${C.ROUTE_SEARCH_INPUT}`)

    input.value = ''
    el.remove()
  })

  test('applyStrings rewrites pager aria labels + status on a locale flip', async () => {
    const el = await mount()

    el._showHits(make(PAGE + 5, K.PAGE), 'q')

    el._strings = {
      ...el._strings,
      pager: 'PG',
      prev: 'PV',
      next: 'NX',
      page: 'P {a}/{b}',
    }
    el._applyStrings()

    expect(pager(el).getAttribute('aria-label')).toBe('PG')
    expect(prev(el).getAttribute('aria-label')).toBe('PV')
    expect(next(el).getAttribute('aria-label')).toBe('NX')
    expect(status(el).textContent).toBe('P 1/2')

    const input = q(el, `.${C.ROUTE_SEARCH_INPUT}`)

    input.value = ''
    el.remove()
  })

  test('row anchors keep data-index aligned to the page-local position', async () => {
    const el = await mount()

    el._showHits(make(PAGE + 5, K.PAGE), 'q')
    el._turnPage(1)

    const first = el.shadowRoot.querySelector(`a[${DATA_ATTRS.DATA_INDEX}]`)

    expect(first.getAttribute(DATA_ATTRS.DATA_INDEX)).toBe('0')
    expect(el._hits[0].path).toBe(`/page/${PAGE}`)

    const input = q(el, `.${C.ROUTE_SEARCH_INPUT}`)

    input.value = ''
    el.remove()
  })
})
