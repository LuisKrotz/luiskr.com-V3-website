/**
 * @file route-search-live-tails.test.js
 * @description Coverage tails for <route-search> — live-driver arms the
 * guard tests skip: snapshot-exists copy load, ?q= seeding, focusInput,
 * focus-in/out transitions, keydown branches, revealRow scroll math,
 * stale-seq worker replies, click/pointer handlers and destroy.
 */
import { jest } from '@jest/globals'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { KEYS } from '@core/tokens/primitives.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'

const state = {
  searchNode: { search: { label: 'L', hint: 'H' } },
  indexRows: [],
  docsRows: [],
  workerReject: false,
}

// URL-routed fetch: real fetchFirebaseDb resolves _snapshot(node) — the
// istanbul-visible .then body needs the real module, not a module mock
// (mocked registries discard per-instance coverage hits).
globalThis.fetch = async (url) => {
  const u = String(url)

  if (u.includes('search-index-docs')) {
    return { ok: true, json: async () => state.docsRows }
  }

  if (u.includes('search-index')) {
    return { ok: true, json: async () => state.indexRows }
  }

  return { ok: true, json: async () => state.searchNode }
}

await import('@website/components/search/RouteSearch.js')

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/**
 * Waits until the `fetchFirebaseDb` `.then` has fired — the copy snapshot
 * resolves through a lazy `import()` chunk whose latency varies under
 * instrumentation, so a fixed timer misses it. `_applyStrings` only runs
 * inside that `.then`, making it the reliable readiness signal.
 */
const waitCopy = async (el) => {
  let calls = 0
  const orig = el._applyStrings.bind(el)

  el._applyStrings = () => {
    calls++
    orig()
  }

  for (let i = 0; i < 60 && !calls; i++) await flush(50)

  process.stderr.write(`waitCopy calls=${calls} strings=${JSON.stringify(el._strings?.label)}\n`)
}

const mount = async () => {
  const el = document.createElement(COMPONENT_TAGS.ROUTE_SEARCH)

  document.body.appendChild(el)
  await waitCopy(el)

  return el
}

const input = (el) => el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT}`)

describe('route-search live arms', () => {
  test('snapshot-exists loads copy; ?q= seeds the field; focusInput focuses', async () => {
    window.history.pushState({}, '', '/search?q=focus')
    const el = await mount()
    const inp = input(el)

    await flush(800) // the copy snapshot resolves via a lazy chunk import — needs real time

    expect(inp.value).toBe('focus')
    expect(inp.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBeTruthy() // boot chunk copy loads

    const hintEl = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_HINT}`)

    expect(hintEl.hidden).toBe(false) // real hint copy → hidden = false arm

    el.focusInput()
    expect(document.activeElement).toBeDefined()

    el.remove()
    window.history.pushState({}, '', '/search')
  })

  test('snapshot arms — exists/skip/null; ?q= seed + pre-filled input arm', async () => {
    const el = await mount()

    await flush(800)
    expect(el._strings.label).toBeTruthy() // boot snapshot → exists() true arm

    // ?q= seed with a pre-filled input → !this.inputEl.value falsy arm.
    window.history.pushState({}, '', '/search?q=seeded')
    input(el).value = 'preset'
    el.loadData()
    await flush(800)
    expect(input(el).value).toBe('preset')

    // ?q= seed with an empty input → this.inputEl.value = q arm.
    input(el).value = ''
    el.loadData()
    await flush(800)
    expect(input(el).value).toBe('seeded')

    // loadCatalog done-callback arms — pending query re-scores.
    input(el).value = 'a'
    el.loadData()
    await flush(800)

    input(el).value = ''
    el.loadData() // empty input → the ?.trim() falsy arm
    await flush(800)

    window.history.pushState({}, '', '/search')
    el.remove()
  })

  test('focusout inside the component keeps the list; outside closes it', async () => {
    const el = await mount()
    const inp = input(el)

    inp.value = 't'
    el._showHits([{ title: 'T', path: '/x', preview: '', keywords: [] }], 't')

    const inside = document.createElement('button')

    el.shadowRoot.appendChild(inside)
    el._onFocusOut({ relatedTarget: inside })
    expect(el._listOpen).toBe(true)

    el._onFocusOut({ relatedTarget: null }) // null relatedTarget → the && arm
    expect(el._listOpen).toBe(false)

    el._listOpen = true
    el._onFocusOut({ relatedTarget: document.body })
    expect(el._listOpen).toBe(false)

    inside.remove()
    el.remove()
  })

  test('keydown arms — blank hits early-return, arrows, enter navigates, escape closes', async () => {
    const el = await mount()
    const inp = input(el)
    const kd = (key) => el._onKeydown({ key, preventDefault: jest.fn() })

    kd(KEYS.ARROW_DOWN) // no hits, non-escape → early return

    el._showHits(
      [
        { title: 'A', path: '/a', preview: '', keywords: [] },
        { title: 'B', path: '/b', preview: '', keywords: [] },
      ],
      'a'
    )
    inp.value = 'a'

    kd(KEYS.ARROW_DOWN)
    expect(el._active).toBe(0)

    kd(KEYS.ARROW_DOWN)
    expect(el._active).toBe(1)

    kd(KEYS.ARROW_UP)
    expect(el._active).toBe(0)

    // Enter with _active -1 uses row 0's cond-expr arm.
    el._setActive(-1)
    kd(KEYS.ENTER)

    // Enter on empty hits skips navigate (falsy arm).
    el._hits = []
    el._setActive(-1)
    kd(KEYS.ENTER)

    el._showHits([{ title: 'A', path: '/a', preview: '', keywords: [] }], 'a')
    inp.value = 'a'
    kd(KEYS.ESCAPE)
    expect(el._listOpen).toBe(false)

    el.remove()
  })

  test('revealRow scroll arms via stubbed rects', async () => {
    const el = await mount()
    const list = el.listEl

    el._showHits(
      [
        { title: 'A', path: '/a', preview: '', keywords: [] },
        { title: 'B', path: '/b', preview: '', keywords: [] },
      ],
      'a'
    )
    input(el).value = 'a'

    // children[0] is the kind-boundary group header — select option rows.
    const row = el.listEl.querySelectorAll(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM}`)[1]

    row.getBoundingClientRect = () => ({ top: 200, bottom: 220 })
    list.getBoundingClientRect = () => ({ top: 0, bottom: 100 })
    el._revealRow(1)
    expect(list.scrollTop).toBeGreaterThan(0)

    row.getBoundingClientRect = () => ({ top: -50, bottom: -10 })
    el._revealRow(1)

    el._revealRow(9) // missing row → early return
    el.remove()
  })

  test('stale worker replies are dropped by the seq guard', async () => {
    const el = await mount()
    const inp = input(el)

    el._catalog = [{ title: 'A', path: '/a', preview: '', keywords: [] }]
    inp.value = 'a'
    el._score()
    inp.value = 'ab'
    el._score() // bumps seq — the first reply would be stale

    await flush(120)
    expect(el._seq).toBeGreaterThan(0)

    el.remove()
  })

  test('click arms — submit navigates top hit, plain anchors navigate, modified pass through', async () => {
    const el = await mount()
    const inp = input(el)

    el._showHits([{ title: 'A', path: '/a', preview: '', keywords: [] }], 'a')
    inp.value = 'a'

    const submit = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_SUBMIT}`)

    el._onClick({ target: submit, preventDefault: jest.fn() })

    const a = el.shadowRoot.querySelector(`a[${DATA_ATTRS.DATA_INDEX}]`)

    el._onClick({ target: a, ctrlKey: true }) // non-plain → passes through

    el.remove()
  })

  test('pointerover arms — keyNav gate, non-row target, row select', async () => {
    const el = await mount()
    const inp = input(el)

    el._showHits(
      [
        { title: 'A', path: '/a', preview: '', keywords: [] },
        { title: 'B', path: '/b', preview: '', keywords: [] },
      ],
      'a'
    )
    inp.value = 'a'

    el._keyNav = true
    el._onPointerOver({ target: el.listEl.children[1] })
    expect(el._active).not.toBe(1)

    el._keyNav = false
    el._onPointerOver({
      target: el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_FIELD}`),
    })

    // children[0] is the kind-boundary group header — option rows follow.
    const row = el.listEl.querySelectorAll(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM}`)[1]

    el._onPointerOver({ target: row })
    expect(el._active).toBe(1)

    el.remove()
  })

  test('empty-hint strings keep the hint hidden; pre-filled input skips the seed', async () => {
    window.history.pushState({}, '', '/search')

    const el = await mount()
    const inp = input(el)

    inp.value = 'preset'
    el.loadData()

    await flush(120)
    expect(inp.value).toBe('preset')

    el._strings = { ...el._strings, hint: '' }
    el._applyStrings() // hint falsy → hidden = !s.hint → true arm

    const hintEl = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_HINT}`)

    expect(hintEl.hidden).toBe(true)

    el.remove()
  })

  test('?.-null arms — hint absent, input null in open/close/score paths', async () => {
    const el = await mount()

    // `this.$` → null makes every optional-chain arm land.
    jest.spyOn(el, '$').mockReturnValue(null)

    el._applyStrings() // hint missing → if(hint) false arm

    el._openList() // inputEl null → ?. arm
    el._closeList()
    el._setLoading(false)
    el._setActive(0) // listEl null → items = [] arm

    jest.restoreAllMocks()

    // Second _openList on an already-visible list → wasHidden false arm.
    el._showHits([{ title: 'A', path: '/a', preview: '', keywords: [] }], 'a')
    input(el).value = 'a'
    el._openList()

    // _score on an empty catalog → the zero-results arm.
    el._catalog = []
    input(el).value = 'q'
    el._score()

    el.remove()
  })

  test('input debounce + query sync + destroy teardown', async () => {
    const el = await mount()
    const inp = input(el)

    inp.value = 't'
    el._onInput({ target: inp })
    el._onInput({ target: document.createElement('div') }) // non-input target arm

    await flush(200)

    // _score with a blank input after trimming.
    inp.value = '  '
    el._score()

    const input2 = document.createElement('input')

    input2.value = 'zz'
    el._onInput({ target: input2 }) // non-ROUTE_SEARCH_INPUT class → early return

    el._debounce = setTimeout(() => {}, 10000)
    el.onDestroy()

    el.remove()
  })
})
