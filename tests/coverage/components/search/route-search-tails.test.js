/**
 * @file coverage/components/search/route-search-tails.test.js
 * @description Coverage tail for components/search/route-search/data.ts —
 * the loadCatalog arms that need store fixtures: the stored
 * portfoliolist arm, the SWR fetch arms (exists / !exists / reject),
 * the keyed-object portfoliolist normalization, and the
 * title/preview fallback chains.
 */
import { describe, test, expect, afterEach, beforeAll, jest } from '@jest/globals'
import { DATA_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_SEARCH_KINDS } from '@core/tokens/routes/search.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import store from '@core/store.js'

/** Per-test control over the SWR snapshot the loader consumes. */
let dbReply = { exists: () => false, val: () => ({}) }
/** When set, the db mock rejects with this error instead of replying. */
let dbThrow = null

jest.unstable_mockModule('@core/utils/data/db.js', () => ({
  fetchFirebaseDb: async () => {
    if (dbThrow) throw dbThrow

    return dbReply
  },
}))

let loadCatalog
let loadCopy
let projectEntries
let searchStrings
let staticEntries
let orderByKind
let groupLabel

beforeAll(async () => {
  const data = await import('@website/components/search/route-search/data.js')

  loadCatalog = data.loadCatalog
  loadCopy = data.loadCopy
  projectEntries = data.projectEntries
  searchStrings = data.searchStrings
  staticEntries = data.staticEntries
  orderByKind = data.orderByKind
  groupLabel = data.groupLabel
})

/** Fixed 40ms wait — the SWR loader resolves within one timer pass. */
const wait = () => new Promise((r) => setTimeout(r, 40))

describe('route-search data tails', () => {
  afterEach(() => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])
    dbThrow = null
  })

  test('loadCopy resolves null when the fetch rejects', async () => {
    dbThrow = new Error('offline')

    const node = await new Promise((r) => loadCopy(LOCALES.EN, r))

    expect(node).toBeNull()
  })

  test('loadCatalog uses the stored portfoliolist without fetching', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [
      { link: 'acme', label: 'Acme', description: 'Work', image: 'acme' },
      { link: 'b2', title: 'Beta Title' },
    ])

    const entries = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    const projects = entries.filter((e) => e.kind === ROUTE_SEARCH_KINDS.PROJECT)

    expect(projects).toHaveLength(2)
    expect(projects[0].path).toBe('/portfolio/acme')
    expect(projects[1].title).toBe('Beta Title') // label missing → title arm
    expect(projects[1].thumb).toBe('') // image missing → '' arm
  })

  test('loadCatalog fetch path — SWR snapshot hydrates project rows', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])
    dbThrow = null
    dbReply = {
      exists: () => true,
      val: () => ({
        portfoliolist: [{ link: 'fetched', label: 'Fetched Row', image: 'fetched' }],
      }),
    }

    const entries = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    const projects = entries.filter((e) => e.kind === ROUTE_SEARCH_KINDS.PROJECT)

    expect(projects).toHaveLength(1)
    expect(projects[0].path).toBe('/portfolio/fetched')
    expect(projects[0].thumb).toContain('fetched')
  })

  test('loadCatalog fetch path — a missing snapshot yields the base catalog', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])
    dbThrow = null
    dbReply = { exists: () => false, val: () => ({}) }

    const entries = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    const base = staticEntries(LOCALES.EN)

    expect(entries.map((e) => e.path)).toEqual(base.map((e) => e.path))
  })

  test('loadCatalog fetch path — a null reply resolves the base catalog', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])
    dbThrow = null
    dbReply = null

    const entries = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    const base = staticEntries(LOCALES.EN)

    expect(entries.map((e) => e.path)).toEqual(base.map((e) => e.path))
  })

  test('loadCatalog fetch path — a keyed-object portfoliolist normalizes', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])
    dbThrow = null
    dbReply = {
      exists: () => true,
      val: () => ({
        portfoliolist: { k1: { link: 'keyed' }, k2: { link: 'rows' } },
      }),
    }

    const entries = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    const projects = entries.filter((e) => e.kind === ROUTE_SEARCH_KINDS.PROJECT)

    expect(projects.map((p) => p.path)).toEqual(['/portfolio/keyed', '/portfolio/rows'])
  })

  test('loadCatalog fetch path — a rejected fetch still resolves the base', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])
    dbThrow = new Error('db offline')

    const entries = await new Promise((r) => loadCatalog(LOCALES.EN, r))
    const base = staticEntries(LOCALES.EN)

    expect(entries.map((e) => e.path)).toEqual(base.map((e) => e.path))

    dbThrow = null
  })

  test('projectEntries accepts a keyed-object portfoliolist', () => {
    const rows = { a: { link: 'one' }, b: { link: 'two', image: 'two' } }

    const entries = projectEntries(rows, LOCALES.EN)

    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.path)).toEqual(['/portfolio/one', '/portfolio/two'])
  })

  test('projectEntries tolerates non-object/null rows and null input', () => {
    const entries = projectEntries([null, 'x', { link: '' }], LOCALES.EN)

    expect(entries).toHaveLength(0)
    expect(projectEntries(null, LOCALES.EN)).toEqual([])
    expect(projectEntries(undefined, LOCALES.EN)).toEqual([])
  })

  test('projectEntries falls back to link as the title', () => {
    const entries = projectEntries([{ link: 'sluggy' }], LOCALES.EN)

    expect(entries[0].title).toBe('sluggy')
  })

  test('searchStrings prefers the live node over the fallback', () => {
    const s = searchStrings({ search: { label: 'LIVE', go: 'GO!' } })

    expect(s.label).toBe('LIVE')
    expect(s.go).toBe('GO!')
    // Missing keys fall back to the English snapshot.
    expect(s.placeholder.length).toBeGreaterThan(0)
    expect(s.empty.length).toBeGreaterThan(0)
  })

  test('searchStrings resolves group + pager copy (live wins, snapshot fills)', () => {
    const live = searchStrings({
      search: {
        groups: { pages: 'LP', portfolio: 'LPF', experiments: 'LE', legal: 'LL' },
        pager: 'LPG',
        prev: 'LPV',
        next: 'LNX',
        page: 'LPG {a}/{b}',
      },
    })

    expect(live.groups.pages).toBe('LP')
    expect(live.groups.portfolio).toBe('LPF')
    expect(live.groups.experiments).toBe('LE')
    expect(live.groups.legal).toBe('LL')
    expect(live.pager).toBe('LPG')
    expect(live.prev).toBe('LPV')
    expect(live.next).toBe('LNX')
    expect(live.page).toBe('LPG {a}/{b}')

    const fb = searchStrings(null)

    expect(fb.groups.pages.length).toBeGreaterThan(0)
    expect(fb.pager.length).toBeGreaterThan(0)
    expect(fb.prev.length).toBeGreaterThan(0)
    expect(fb.next.length).toBeGreaterThan(0)
    expect(fb.page.length).toBeGreaterThan(0)
  })

  test('orderByKind buckets follow each kind’s best hit — score order wins', () => {
    const K = ROUTE_SEARCH_KINDS
    // Score-sorted input: the project hit leads, so the whole portfolio
    // bucket renders ahead of the page bucket — a weak page keyword hit
    // can't leapfrog a strong project title match by kind priority.
    const mixed = [
      { path: '/proj', kind: K.PROJECT },
      { path: '/page', kind: K.PAGE },
      { path: '/exp', kind: K.EXPERIMENT },
      { path: '/proj2', kind: K.PROJECT },
      { path: '/docs/a', kind: K.DOCS },
      { path: '/legal', kind: K.LEGAL },
      { path: '/weird', kind: 'mystery' },
    ]

    const out = orderByKind(mixed)

    // Bucket rank = the kind's first index in the score-sorted input;
    // intra-bucket order is stable; undeclared kinds sink last.
    expect(out.map((e) => e.path)).toEqual([
      '/proj',
      '/proj2',
      '/page',
      '/exp',
      '/docs/a',
      '/legal',
      '/weird',
    ])
  })

  test('groupLabel resolves each bucket; docs stays the English-only token', () => {
    const K = ROUTE_SEARCH_KINDS
    const s = searchStrings(null)

    expect(groupLabel(s, K.PAGE)).toBe(s.groups.pages)
    expect(groupLabel(s, K.PROJECT)).toBe(s.groups.portfolio)
    expect(groupLabel(s, K.EXPERIMENT)).toBe(s.groups.experiments)
    expect(groupLabel(s, K.LEGAL)).toBe(s.groups.legal)
    expect(groupLabel(s, K.DOCS)).toBe(DOCS_STRINGS.SEARCH_GROUP_LABEL)
    expect(groupLabel(s, 'mystery')).toBe(CHAR_STRINGS.EMPTY)
  })

  test('searchStrings tolerates missing nodes entirely', () => {
    const s = searchStrings(undefined)

    expect(typeof s.hint).toBe('string')
    expect(typeof s.results).toBe('string')
  })

  test('staticEntries resolves legal titles through the footer links', () => {
    const entries = staticEntries(LOCALES.EN)
    const privacy = entries.find((e) => e.path === '/privacy-policy')

    expect(privacy).toBeTruthy()
    expect(privacy.kind).toBe(ROUTE_SEARCH_KINDS.LEGAL)
    expect(privacy.keywords.length).toBeGreaterThan(0)
  })

  test('staticEntries rows all carry a path, title and kind', () => {
    const entries = staticEntries(LOCALES.EN)

    for (const e of entries) {
      expect(e.path.startsWith('/')).toBe(true)
      expect(e.title.length).toBeGreaterThan(0)
      expect(Object.values(ROUTE_SEARCH_KINDS)).toContain(e.kind)
      expect(Array.isArray(e.keywords)).toBe(true)
    }
  })

  test('loadCatalog stays alive while async work settles', async () => {
    store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, [])

    const entries = await new Promise((r) => loadCatalog(LOCALES.BR, r))

    // An empty stored list takes the fetch path (length 0 → falsy arm).
    expect(entries.filter((e) => e.kind === ROUTE_SEARCH_KINDS.PROJECT)).toEqual(
      entries.filter((e) => e.path.includes('/portfolio/'))
    )

    await wait()
  })
})
