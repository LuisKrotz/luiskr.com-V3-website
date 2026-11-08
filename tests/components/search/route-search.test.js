/**
 * @file route-search.test.js
 * @description <route-search> — the 404 autocomplete: shell render,
 * catalog build (static + project entries), predict-mode listing,
 * scoring via the JS fallback, keyboard navigation, and click routing.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { ROUTE_SEARCH_KINDS } from '@core/tokens/routes/search.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { KEYS } from '@core/tokens/primitives.js'
import { LOCALES } from '@core/tokens/locales.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { mount } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { RouteSearch } from '@website/components/search/RouteSearch.js'
import {
  searchStrings,
  staticEntries,
  projectEntries,
  loadCatalog,
} from '@website/components/search/route-search/data.js'
import { scoreRoutesJs, normalizeSearchText } from '@core/utils/wasm/wasm-search.js'
import { framePool } from '@core/utils/motion/frame.js'

const S = {
  ROOT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH}`,
  INPUT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT}`,
  LIST: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LIST}`,
  ITEM: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM}`,
  ACTIVE: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM_ACTIVE}`,
  INDEX: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INDEX}`,
  ARROW: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ARROW}`,
  SUBMIT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_SUBMIT}`,
  EMPTY: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_EMPTY}`,
  FOUND: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_FOUND}`,
  FOUND_TEXT: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_FOUND_TEXT}`,
  FOUND_DOTS: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_FOUND_DOTS}`,
  HEAD: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_HEAD}`,
  TITLE: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_TITLE}`,
  PATH: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PATH}`,
  PREVIEW: `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PREVIEW}`,
}

const waitFor = async (fn, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    const v = fn()
    if (v) return v
    await new Promise((r) => setTimeout(r, 10))
  }
  return null
}

describe('route-search data', () => {
  test('searchStrings falls back to the English snapshot', () => {
    const s = searchStrings(null)
    expect(typeof s.placeholder).toBe('string')
    expect(s.placeholder.length).toBeGreaterThan(0)
    expect(typeof s.go).toBe('string')
  })

  test('staticEntries covers home, about, contact, legal, experiments, docs', () => {
    const entries = staticEntries(LOCALES.EN)
    const paths = entries.map((e) => e.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/about')
    expect(paths).toContain('/contact')
    expect(paths).toContain('/privacy-policy')
    expect(paths).toContain('/gdpr')
    expect(paths).toContain('/terms-of-use')
    expect(paths).toContain('/license')
    expect(paths).toContain('/docs')
    expect(paths).toContain('/earth-playground')
    expect(paths).toContain('/star-field-experiment')
    expect(paths).toContain('/animations')
    expect(entries.every((e) => e.title.length > 0)).toBe(true)
  })

  test('staticEntries prefixes slugs for non-English locales', () => {
    const entries = staticEntries(LOCALES.DE)
    expect(entries.find((e) => e.path === '/de')).toBeTruthy()
    expect(
      entries.every((e) => e.path.startsWith('/de/') || e.path === '/de' || e.path === '/docs')
    ).toBe(true)
  })

  test('projectEntries maps portfoliolist rows to portfolio routes', () => {
    const rows = [
      { link: 'acme', label: 'Acme Corp', description: 'A <b>big</b> project.', image: 'acme' },
      { link: '', label: 'Skipped' },
      { label: 'NoLink' },
    ]
    const entries = projectEntries(rows, LOCALES.EN)
    expect(entries).toHaveLength(1)
    expect(entries[0].path).toBe('/portfolio/acme')
    expect(entries[0].title).toBe('Acme Corp')
    expect(entries[0].kind).toBe(ROUTE_SEARCH_KINDS.PROJECT)
    expect(entries[0].thumb).toContain('acme')
    expect(entries[0].preview).not.toContain('<b>')
  })

  test('projectEntries prefixes locale and omits thumb without image', () => {
    const rows = [{ link: 'acme', label: 'Acme' }]
    const entries = projectEntries(rows, LOCALES.DE)
    expect(entries[0].path).toBe('/de/portfolio/acme')
    expect(entries[0].thumb).toBe('')
  })

  test('loadCatalog returns entries (store empty → fetch or base)', async () => {
    const catalog = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    expect(Array.isArray(catalog)).toBe(true)
    expect(catalog.length).toBeGreaterThanOrEqual(11)
  })

  test('scoreRoutesJs: empty query returns whole catalog in order', () => {
    const items = staticEntries(LOCALES.EN)
    const hits = scoreRoutesJs(items, '')
    expect(hits).toHaveLength(items.length)
  })

  test('scoreRoutesJs: title match outranks keyword match; AND semantics', () => {
    const items = [
      { title: 'Privacy Policy', path: '/privacy-policy', preview: 'legal', keywords: ['gdpr'] },
      { title: 'GDPR', path: '/gdpr', preview: 'privacy', keywords: ['privacy'] },
      { title: 'Home', path: '/', preview: '', keywords: [] },
    ]
    const hits = scoreRoutesJs(items, 'privacy')
    expect(hits.length).toBe(2)
    expect(hits[0].index).toBe(0)

    // Both items satisfy both terms; the exact-title + keyword hit wins.
    const both = scoreRoutesJs(items, 'privacy gdpr')
    expect(both).toHaveLength(2)
    expect(both[0].index).toBe(1)

    expect(scoreRoutesJs(items, 'zzz nothing')).toHaveLength(0)
  })

  test('normalizeSearchText folds case + diacritics', () => {
    expect(normalizeSearchText('  Krötz  ')).toBe('krotz')
    expect(normalizeSearchText('A  B')).toBe('a b')
    expect(normalizeSearchText('')).toBe('')
  })
})

describe('RouteSearch element', () => {
  let el
  let cleanup

  beforeEach(() => {
    el = new RouteSearch()
    cleanup = mount(el)
  })

  afterEach(() => cleanup())

  test('defines the custom element', () => {
    expect(customElements.get(COMPONENT_TAGS.ROUTE_SEARCH)).toBe(RouteSearch)
  })

  test('renders the combobox shell', () => {
    const input = el.shadowRoot.querySelector(S.INPUT)
    expect(input).not.toBeNull()
    expect(input.getAttribute(ARIA_ATTRS.ROLE)).toBe(ARIA_ATTRS.ROLE_COMBOBOX)
    expect(input.getAttribute(ARIA_ATTRS.ARIA_AUTOCOMPLETE)).toBe(ARIA_ATTRS.AUTOCOMPLETE_LIST)
    const list = el.shadowRoot.querySelector(S.LIST)
    expect(list.getAttribute(ARIA_ATTRS.ROLE)).toBe(ARIA_ATTRS.ROLE_LISTBOX)
  })

  test('catalog loads; the list opens only once the input carries a query', async () => {
    await waitFor(() => el._catalog.length)

    const list = el.shadowRoot.querySelector(S.LIST)
    const input = el.shadowRoot.querySelector(S.INPUT)

    expect(list.hidden).toBe(true)

    el._hits = el._catalog
    el._renderList()

    expect(el.shadowRoot.querySelectorAll(S.ITEM).length).toBeGreaterThanOrEqual(11)
    expect(list.hidden).toBe(true)

    input.value = 'x'
    el._openList()

    expect(list.hidden).toBe(false)

    const first = el.shadowRoot.querySelector(S.INDEX)
    expect(first.textContent.trim()).toBe('1')
    expect(el.shadowRoot.querySelector(S.ARROW)).not.toBeNull()
    expect(el.shadowRoot.querySelector(S.SUBMIT)).not.toBeNull()
  })

  test('openList springs the list height — mid-flight px values, auto on settle', async () => {
    await waitFor(() => el._catalog.length)

    const list = el.shadowRoot.querySelector(S.LIST)
    const input = el.shadowRoot.querySelector(S.INPUT)

    // Mock a real layout — happy-dom reports 0 for every box, so the
    // rect/scroller come from the element's own inline height + a
    // stand-in natural height.
    const NATURAL = 420

    Object.defineProperty(list, 'offsetHeight', { get: () => NATURAL, configurable: true })
    list.getBoundingClientRect = () => {
      const inline = parseFloat(list.style.height)

      return { height: Number.isNaN(inline) ? (list.hidden ? 0 : NATURAL) : inline }
    }

    input.value = 'x'
    el._hits = el._catalog.slice(0, 3)
    el._renderList()
    el._openList()

    // Pump real frames — the spring should write intermediate clip
    // insets (composited reveal, no height writes) and release the
    // clip once it lands.
    const seen = []

    for (let t = 1; t <= 200; t++) {
      framePool.flush(t * 16)
      seen.push(list.style.clipPath)
    }

    expect(list.style.clipPath).toBe('')
    expect(seen.some((h) => h.startsWith('inset('))).toBe(true)
    expect(seen.some((h) => h === 'inset(0 0 0px 0)')).toBe(false)
  })

  test('rows show title, path and preview', async () => {
    await waitFor(() => el._catalog.length)

    el._hits = el._catalog.slice(0, 3)
    el._renderList()

    const row = el.shadowRoot.querySelector(S.ITEM)
    expect(row.querySelector(S.TITLE).textContent.length).toBeGreaterThan(0)
    expect(row.querySelector(S.PATH).textContent.startsWith('/')).toBe(true)
  })

  test('typing filters results via the scorer', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog
    el._renderList()

    const input = el.shadowRoot.querySelector(S.INPUT)
    input.value = 'privacy'
    input.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }))

    const found = await waitFor(() => {
      const items = el.shadowRoot.querySelectorAll(S.ITEM)
      return items.length === 1 ? items[0] : null
    })
    expect(found).not.toBeNull()
    expect(found.textContent).toContain('Privacy')
  })

  test('keyboard: arrows move active, Enter navigates', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 3)
    el._renderList()
    el._setActive(0)

    const input = el.shadowRoot.querySelector(S.INPUT)
    const kd = (key) =>
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }))

    kd(KEYS.ARROW_DOWN)
    expect(el._active).toBe(1)
    expect(el.shadowRoot.querySelectorAll(S.ACTIVE)).toHaveLength(1)

    kd(KEYS.ARROW_UP)
    expect(el._active).toBe(0)

    let navigated = null
    const orig = router.push
    router.push = (p) => {
      navigated = p
      return Promise.resolve()
    }

    kd(KEYS.ENTER)
    expect(navigated).toBe(el._hits[0].path)
    router.push = orig

    kd(KEYS.ESCAPE)
    expect(el.shadowRoot.querySelector(S.LIST).hidden).toBe(true)
  })

  test('clicking a row navigates to its path', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 2)
    el._renderList()

    let navigated = null
    const orig = router.push
    router.push = (p) => {
      navigated = p
      return Promise.resolve()
    }

    el.shadowRoot.querySelector(`${S.ITEM} a`).click()
    expect(navigated).toBe(el._hits[0].path)
    router.push = orig
  })

  test('pointerover marks the hovered row active', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 3)
    el._renderList()

    const rows = el.shadowRoot.querySelectorAll(S.ITEM)
    rows[1].dispatchEvent(new window.Event('pointerover', { bubbles: true }))
    expect(el._active).toBe(1)

    // Non-item hover leaves the active row untouched.
    el.shadowRoot
      .querySelector(S.INPUT)
      .dispatchEvent(new window.Event('pointerover', { bubbles: true }))
    expect(el._active).toBe(1)
  })

  test('input events on non-input targets are ignored', async () => {
    await waitFor(() => el._catalog.length)

    const list = el.shadowRoot.querySelector(S.LIST)
    list.dispatchEvent(new window.Event('input', { bubbles: true }))
    expect(el._debounce).toBeNull()
  })

  test('keys with no hits do nothing; Escape still closes', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = []
    el._renderList()
    el._setActive(-1)

    const input = el.shadowRoot.querySelector(S.INPUT)
    const kd = (key) =>
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }))

    kd(KEYS.ARROW_DOWN)
    expect(el._active).toBe(-1)

    kd(KEYS.ENTER)
    expect(el._active).toBe(-1)

    // A stale active index beyond the hit list is a guarded no-op.
    el._hits = el._catalog.slice(0, 2)
    el._renderList()
    el._setActive(9)

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p
      return Promise.resolve()
    }

    kd(KEYS.ENTER)
    expect(navigated).toBeNull()
    router.push = orig

    kd(KEYS.ESCAPE)
    expect(el.shadowRoot.querySelector(S.LIST).hidden).toBe(true)
  })

  test('Enter with no active row navigates the first hit', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 3)
    el._renderList()
    el._setActive(-1)

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p
      return Promise.resolve()
    }

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: KEYS.ENTER, bubbles: true }))
    expect(navigated).toBe(el._hits[0].path)
    router.push = orig
  })

  test('focusin opens the list; focusout outside closes, inside keeps', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 2)
    el._renderList()

    const input = el.shadowRoot.querySelector(S.INPUT)
    const list = el.shadowRoot.querySelector(S.LIST)

    input.value = 'x'
    input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }))
    expect(list.hidden).toBe(false)
    expect(input.getAttribute(ARIA_ATTRS.ARIA_EXPANDED)).toBe('true')

    // Moving focus to a row (inside the shadow) keeps the list open.
    const inside = el.shadowRoot.querySelector(`${S.ITEM} a`)

    input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true, relatedTarget: inside }))
    expect(list.hidden).toBe(false)

    input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
    expect(list.hidden).toBe(true)
    expect(input.getAttribute(ARIA_ATTRS.ARIA_EXPANDED)).toBe('false')
  })

  test('openList with no hits keeps the list hidden', async () => {
    await waitFor(() => el._catalog.length)

    const emptyInput = el.shadowRoot.querySelector(S.INPUT)
    emptyInput.value = 'x'

    el._hits = []
    el._renderList()

    el._openList()
    expect(el.shadowRoot.querySelector(S.LIST).hidden).toBe(true)
    expect(el.shadowRoot.querySelector(S.EMPTY).hidden).toBe(false)
  })

  test('clicks outside a row anchor or with modifiers do not navigate', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 2)
    el._renderList()

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p
      return Promise.resolve()
    }

    // Field pill click — no anchor → no navigation.
    el.shadowRoot.querySelector(S.INPUT).click()
    expect(navigated).toBeNull()

    // Ctrl+click keeps native anchor semantics — no router.push.
    const a = el.shadowRoot.querySelector(`${S.ITEM} a`)

    a.dispatchEvent(new window.MouseEvent('click', { bubbles: true, ctrlKey: true }))
    expect(navigated).toBeNull()

    router.push = orig
  })

  test('a query with no matches shows the empty row and hides the list', async () => {
    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = 'zzznothingmatches'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))

    const done = await waitFor(() => {
      const items = el.shadowRoot.querySelectorAll(S.ITEM)
      const empty = el.shadowRoot.querySelector(S.EMPTY)
      return items.length === 0 && !empty.hidden ? true : null
    })

    expect(done).toBe(true)
    expect(el.shadowRoot.querySelector(S.LIST).hidden).toBe(true)
  })

  test('setting the same active row twice is a no-op for ring progress', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 3)
    el._renderList()

    el._setActive(1)
    el._setActive(1) // prev === index arm — no progress calls
    expect(el._active).toBe(1)
    expect(el.shadowRoot.querySelectorAll(S.ACTIVE)).toHaveLength(1)
  })

  test('a row anchor patched past the hits does not navigate', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 2)
    el._renderList()

    const a = el.shadowRoot.querySelector(`${S.ITEM} a`)

    a.setAttribute('data-index', '9')

    let navigated = null
    const orig = router.push

    router.push = (p) => {
      navigated = p
      return Promise.resolve()
    }

    a.click()
    expect(navigated).toBeNull()
    router.push = orig
  })

  test('pointerover a row whose anchor lost its index is ignored', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 2)
    el._renderList()
    el._setActive(0)

    const row = el.shadowRoot.querySelectorAll(S.ITEM)[1]

    row.querySelector('a').removeAttribute('data-index')
    row.dispatchEvent(new window.Event('pointerover', { bubbles: true }))
    expect(el._active).toBe(0)
  })

  test('a typed query keeps a catalog reload from reseeding hits', async () => {
    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    el._hits = []
    input.value = 'typed'

    el.loadData()

    await waitFor(() => null, 30)
    expect(el._hits.length).toBe(0)

    input.value = ''
  })

  test('a gutted shadow tolerates score/open/close/string calls', async () => {
    await waitFor(() => el._catalog.length)

    el.shadowRoot.querySelector(S.ROOT).replaceChildren()

    el._applyStrings() // null input/list/empty/hint arms
    el._openList() // !list arm
    el._closeList() // list null → skip + input null arm
    el._setActive(0) // items [] + input null arms
    el._renderList() // !list arm
    el._mountRing() // !root arm
    el._score() // inputEl null → '' arm → resolves into the null guards

    await waitFor(() => null, 30)
  })

  test('a second keystroke cancels the pending debounce', async () => {
    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = 'p'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))

    const first = el._debounce

    input.value = 'pr'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(el._debounce).not.toBe(first)
  })

  test('a stubbed ring session receives progress + refresh + destroy', async () => {
    await waitFor(() => el._catalog.length)

    const calls = { progress: [], refresh: 0, destroy: 0 }

    el._ring = {
      setProgress: (i, t) => calls.progress.push([i, t]),
      refresh: () => calls.refresh++,
      destroy: () => calls.destroy++,
    }

    el._hits = el._catalog.slice(0, 3)
    el._renderList() // refresh arm

    el._ringTarget(1) // field focused → single tile sweeps open
    el._setActive(1) // row moves never touch the field ring
    el._ringTarget(0) // field blurred → eases shut

    expect(calls.progress).toEqual([
      [0, 1],
      [0, 0],
    ])
    expect(calls.refresh).toBe(1)

    el.onDestroy()

    expect(calls.destroy).toBe(1)
  })

  test('focusout to an element outside the shadow closes the list', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 2)
    el._renderList()

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }))

    input.dispatchEvent(
      new window.FocusEvent('focusout', { bubbles: true, relatedTarget: document.body })
    )

    expect(el.shadowRoot.querySelector(S.LIST).hidden).toBe(true)
  })

  test('destroy with nothing pending tolerates null members', async () => {
    const fresh = new RouteSearch()

    fresh._debounce = null
    fresh._ring = null
    fresh.onDestroy()

    expect(fresh._ring).toBeNull()
  })

  test('a stale scoring reply cannot overwrite newer results', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 4)
    el._renderList()

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = 'a'
    el._score() // seq 1 — its reply lands after seq 2
    input.value = 'privacy'
    el._score() // seq 2

    const found = await waitFor(() => {
      const items = el.shadowRoot.querySelectorAll(S.ITEM)
      return items.length === 1 ? items[0] : null
    })

    expect(found.textContent).toContain('Privacy')
  })

  test('localized strings apply to placeholder + labels after fetch', async () => {
    const input = el.shadowRoot.querySelector(S.INPUT)
    const filled = await waitFor(() => input.getAttribute('placeholder'))

    expect(typeof filled).toBe('string')
    expect(filled.length).toBeGreaterThan(0)
  })

  test('destroy clears debounce and the ring session', async () => {
    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)

    input.value = 'x'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(el._debounce).not.toBeNull()

    el.onDestroy()

    expect(el._debounce).toBeNull()
    expect(el._ring).toBeNull()
  })

  test('arrow keys scroll the active row into the list box (list only)', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 4)
    el._renderList()
    el._setActive(0)

    const list = el.shadowRoot.querySelector(S.LIST)
    const rows = el.shadowRoot.querySelectorAll(S.ITEM)
    const ROW = 50
    const BOX = 100

    // Fake layout: rows stacked ROW px apart, list box shows BOX px.
    list.getBoundingClientRect = () => ({ top: 0, bottom: BOX })
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({
        top: i * ROW - list.scrollTop,
        bottom: (i + 1) * ROW - list.scrollTop,
      })
    })

    const input = el.shadowRoot.querySelector(S.INPUT)
    const kd = (key) =>
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }))

    kd(KEYS.ARROW_DOWN) // row 1 fully visible → no scroll
    expect(list.scrollTop).toBe(0)

    kd(KEYS.ARROW_DOWN) // row 2 below the box → scroll by its overflow
    expect(el._active).toBe(2)
    expect(list.scrollTop).toBe(ROW)

    kd(KEYS.ARROW_UP)
    kd(KEYS.ARROW_UP) // row 0 above the box → scroll back to top
    expect(el._active).toBe(0)
    expect(list.scrollTop).toBe(0)

    el._revealRow(9) // no such row → guarded no-op
    expect(list.scrollTop).toBe(0)
  })

  test('keyboard owns the active row until the pointer moves', async () => {
    await waitFor(() => el._catalog.length)
    el._hits = el._catalog.slice(0, 3)
    el._renderList()
    el._setActive(0)

    const input = el.shadowRoot.querySelector(S.INPUT)
    const rows = el.shadowRoot.querySelectorAll(S.ITEM)

    input.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: KEYS.ARROW_DOWN, bubbles: true })
    )
    expect(el._active).toBe(1)

    // A row scrolling under a resting cursor must not steal the selection.
    rows[2].dispatchEvent(new window.Event('pointerover', { bubbles: true }))
    expect(el._active).toBe(1)

    rows[2].dispatchEvent(new window.Event('pointermove', { bubbles: true }))
    rows[2].dispatchEvent(new window.Event('pointerover', { bubbles: true }))
    expect(el._active).toBe(2)
  })

  test('a re-rank of the same query keeps the arrowed row; a new query resets', async () => {
    await waitFor(() => el._catalog.length)

    // Same-kind entries — kind bucketing would otherwise re-order the
    // mixed catalog slice and move the arrowed row's index.
    const entries = el._catalog.slice(0, 4).map((e) => ({ ...e, kind: ROUTE_SEARCH_KINDS.PAGE }))

    // A live query keeps the list open (a blank field closes it → -1).
    el.shadowRoot.querySelector(S.INPUT).value = 'q'

    el._showHits(entries, 'q')
    expect(el._active).toBe(0)

    // Same query, active still on the top hit → follows the new top.
    el._showHits([entries[2], entries[0], entries[1]], 'q')
    expect(el._active).toBe(0)

    el._setActive(2) // entries[1]

    // Same query re-ranked → the arrowed entry keeps the selection.
    el._showHits([entries[1], entries[3], entries[0]], 'q')
    expect(el._active).toBe(0)
    el._setActive(1) // entries[3]
    el._showHits([entries[0], entries[1], entries[2], entries[3]], 'q')
    expect(el._active).toBe(3)
    expect(el._hits[el._active]).toBe(entries[3])

    // Arrowed entry dropped from the re-rank → falls back to the top.
    el._showHits([entries[0], entries[1]], 'q')
    expect(el._active).toBe(0)

    // Stale active index past the hits → no entry to keep.
    el._active = 9
    el._showHits(entries, 'q')
    expect(el._active).toBe(0)

    // New query → top hit regardless of the previous selection.
    el._setActive(3)
    el._showHits(entries, 'qq')
    expect(el._active).toBe(0)

    el._showHits([], 'qq')
    expect(el._active).toBe(-1)
  })

  test('status line: dots while scoring, "N results found" after', async () => {
    await waitFor(() => el._catalog.length)

    const input = el.shadowRoot.querySelector(S.INPUT)
    const text = el.shadowRoot.querySelector(S.FOUND_TEXT)
    const root = el.shadowRoot.querySelector(S.ROOT)

    // The status element + dot trio render in the shell header.
    expect(el.shadowRoot.querySelector(S.HEAD)).not.toBeNull()
    expect(el.shadowRoot.querySelector(S.FOUND)).not.toBeNull()
    expect(el.shadowRoot.querySelectorAll(`${S.FOUND_DOTS} i`)).toHaveLength(3)

    input.value = 'priv'

    el._setLoading(true)
    expect(el._busy).toBe(true)
    expect(root.classList.contains(ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LOADING)).toBe(true)
    expect(text.textContent).toBe('')

    // Hits arriving mid-flight keep the dots up — no stale count.
    el._showHits(el._catalog.slice(0, 2), 'priv')
    expect(text.textContent).toBe('')

    el._setLoading(false)
    expect(root.classList.contains(ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LOADING)).toBe(false)
    expect(text.textContent).toBe(el._strings.found.replace('{n}', '2'))
    expect(text.textContent).toContain('2')

    // Blank query clears the status.
    input.value = ''
    el._syncFound()
    expect(text.textContent).toBe('')
  })

  test('locale switch reloads the catalog', async () => {
    await waitFor(() => el._catalog.length)
    const spy = jest.spyOn(el, 'loadData')
    store.commit(LANG_MUTATIONS.SET_LANG, LOCALES.DE)
    expect(spy).toHaveBeenCalled()
    store.commit(LANG_MUTATIONS.SET_LANG, LOCALES.EN)
    spy.mockRestore()
  })
})
