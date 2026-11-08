/**
 * @file route-search/data.ts — the 404 autocomplete catalog + copy.
 * Builds one searchable entry per public route: static pages resolved
 * through the same slug/title sources the router uses (routeSlugs,
 * appText, componentText, FALLBACK_PAGES) and one entry per portfolio
 * project from the home portfoliolist. `keywords` rides each page
 * node's `searchThemes` list so CMS-authored search vocabulary feeds
 * the matcher verbatim.
 */

import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { LEGAL_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { LOCALES } from '@core/tokens/locales.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { DB_PATHS, ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { ROUTE_SEARCH_KINDS } from '@core/tokens/routes/search.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { appText, componentText, routeSlugs } from '@core/locale/ui-text.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { buildMediaUrls, encodeMediaUrl } from '@core/utils/media.js'
import { stripHtml } from '@core/utils/index.js'
import { toMetaDescription } from '@core/utils/string.js'
import { devError } from '@core/devlog.js'

/** One catalog row — the fields the scorer and the row renderer read. */
export interface RouteEntry {
  /** Canonical localized URL to push on activate. */
  path: string
  /** Row title. */
  title: string
  /** One-line "what's inside" preview. */
  preview: string
  /** Match keywords (searchThemes + slug + title words). */
  keywords: string[]
  /** ROUTE_SEARCH_KINDS discriminant. */
  kind: string
  /** Cover thumbnail URL (projects only; '' otherwise). */
  thumb: string
}

/** Group headers for the kind-ordered result buckets. */
export interface SearchGroups {
  /** PAGE bucket header (home + static pages). */
  pages: string
  /** PROJECT bucket header (portfolio items). */
  portfolio: string
  /** EXPERIMENT bucket header (playgrounds + references). */
  experiments: string
  /** LEGAL bucket header (statutory pages). */
  legal: string
}

/** The localized UI copy node (pages/not-found.search). */
export interface SearchStrings {
  label: string
  placeholder: string
  empty: string
  go: string
  results: string
  hint: string
  /** "N results found" template — `{n}` is the match count slot. */
  found: string
  /** Per-kind group headers — the docs bucket carries its own
   *  English-only token instead (DOCS_STRINGS.SEARCH_GROUP_LABEL). */
  groups: SearchGroups
  /** Pager region aria-label. */
  pager: string
  /** Previous-results-page button label. */
  prev: string
  /** Next-results-page button label. */
  next: string
  /** "Page {a} of {b}" pager status template. */
  page: string
}

/** A home portfoliolist row — the fields this catalog consumes. */
interface PortfolioRow {
  link?: string
  label?: string
  title?: string
  description?: string
  image?: string
}

/** Loose shape of a pages/* fallback node — only the fields read here. */
interface PageNode {
  title?: string
  description?: string
  message?: string
  searchThemes?: string[]
  col1?: string[]
  sections?: Array<{ content?: string[] }>
}

/** Reads a fallback page node with a loose shape. */
const page = (key: string): PageNode | undefined =>
  (FALLBACK_PAGES as Record<string, PageNode | undefined>)[key]

/** Search-themes list for a page node — empty array when absent. */
const themes = (node: PageNode | undefined): string[] =>
  Array.isArray(node?.searchThemes) ? (node.searchThemes as string[]) : []

/**
 * The `search` copy node — live translation first, English fallback
 * snapshot second. The node lives under `pages/search`:
 * `{ title, description, link, search }`.
 */
export const searchStrings = (node: unknown): SearchStrings => {
  const live = (node as { search?: Partial<SearchStrings> } | null)?.search
  const fb =
    (FALLBACK_PAGES as Record<string, { search?: Partial<SearchStrings> } | undefined>)[
      TRANSLATION_KEYS.SEARCH
    ]?.search || {}

  const group = (key: keyof SearchGroups): string =>
    live?.groups?.[key] ?? fb.groups?.[key] ?? CHAR_STRINGS.EMPTY

  return {
    label: live?.label ?? fb.label ?? CHAR_STRINGS.EMPTY,
    placeholder: live?.placeholder ?? fb.placeholder ?? CHAR_STRINGS.EMPTY,
    empty: live?.empty ?? fb.empty ?? CHAR_STRINGS.EMPTY,
    go: live?.go ?? fb.go ?? CHAR_STRINGS.EMPTY,
    results: live?.results ?? fb.results ?? CHAR_STRINGS.EMPTY,
    hint: live?.hint ?? fb.hint ?? CHAR_STRINGS.EMPTY,
    found: live?.found ?? fb.found ?? CHAR_STRINGS.EMPTY,
    groups: {
      pages: group('pages'),
      portfolio: group('portfolio'),
      experiments: group('experiments'),
      legal: group('legal'),
    },
    pager: live?.pager ?? fb.pager ?? CHAR_STRINGS.EMPTY,
    prev: live?.prev ?? fb.prev ?? CHAR_STRINGS.EMPTY,
    next: live?.next ?? fb.next ?? CHAR_STRINGS.EMPTY,
    page: live?.page ?? fb.page ?? CHAR_STRINGS.EMPTY,
  }
}

/** Locale prefix — '' for English, '/br' etc. for every other locale. */
const locPrefix = (lang: string): string =>
  lang && lang !== LOCALES.EN ? `${ROUTE_PATHS.ROOT}${lang}` : CHAR_STRINGS.EMPTY

/**
 * `loadCopy` — the localized `pages/<loc>/search` copy node via the same
 * SWR snapshot flow every other page uses. `done` receives the resolved
 * node (null when the locale copy is absent) so the caller can re-template
 * — mirroring `loadCatalog`'s callback contract.
 */
export function loadCopy(lang: string, done: (_node: unknown | null) => void): void {
  const l = store.getters.getlang()
  const dbpath = `${l.database}${lang}${l.pagesPath}${TRANSLATION_KEYS.SEARCH}`

  fetchFirebaseDb(dbpath)
    .then((snap) => done(snap.exists() ? snap.val() : null))
    .catch((e) => {
      devError(e)
      done(null)
    })
}

/**
 * The static half of the catalog: home + section anchors + legal pages +
 * experimental surfaces + the docs portal. Titles resolve through the
 * same appText/componentText sources route meta uses, so a locale switch
 * renames the rows identically to the page titles themselves.
 * @param lang Current locale code.
 * @returns Static route entries in menu order.
 */
export function staticEntries(lang: string): RouteEntry[] {
  const slugs = routeSlugs(lang)
  const pfx = locPrefix(lang)
  const seg = (slug: string) => `${pfx}${ROUTE_PATHS.ROOT}${slug}`

  const legalLinks =
    (componentText(LEGAL_COMPONENT_KEYS.LEGAL_LINKS) as Array<{ page?: string }> | undefined) || []
  const contact =
    (componentText(CMS_KEYS.CONTACT) as
      { title?: string; line1?: Array<{ description?: string }> } | undefined) || {}
  const docs =
    (componentText('docs-portal') as { title?: string; description?: string } | undefined) || {}

  const contactPreview = (contact.line1 || [])
    .map((l) => l?.description)
    .filter(Boolean)
    .join(`${CHAR_STRINGS.COMMA}${CHAR_STRINGS.SPACE_CHAR}`)

  const legal = (
    [
      [TRANSLATION_KEYS.PRIVACY_POLICY, slugs.privacy, 1],
      [TRANSLATION_KEYS.GDPR, slugs.gdpr, 2],
      [TRANSLATION_KEYS.TERMS_OF_USE, slugs.terms, 3],
      [TRANSLATION_KEYS.LICENSE, slugs.license, 4],
    ] as Array<[string, string, number]>
  ).map(([key, slug, idx]) => {
    const node = page(key)
    const title = legalLinks[idx]?.page || node?.title || slug

    return {
      path: seg(slug),
      title,
      preview: toMetaDescription(stripHtml(node?.sections?.[0]?.content?.[0] || '')),
      keywords: [...themes(node), slug, title],
      kind: ROUTE_SEARCH_KINDS.LEGAL,
      thumb: CHAR_STRINGS.EMPTY,
    }
  })

  const home = page(CMS_KEYS.HOME)
  const about = page(CMS_KEYS.ABOUT)
  const earth = page(TRANSLATION_KEYS.EARTH_PLAYGROUND)
  const star = page(TRANSLATION_KEYS.STAR_FIELD)
  const anim = page(TRANSLATION_KEYS.ANIMATIONS)

  const homeTitle = String(appText(SECTION_UI_KEYS.TITLE) || CHAR_STRINGS.EMPTY)
  const aboutTitle = String(appText(SECTION_UI_KEYS.ABOUT_DESCRIPTION) || about?.title || '')
  const contactTitle = String(appText(CMS_KEYS.CONTACT) || contact.title || '')

  return [
    {
      path: pfx || ROUTE_PATHS.ROOT,
      title: homeTitle,
      preview: home?.message || CHAR_STRINGS.EMPTY,
      keywords: [...themes(home), homeTitle],
      kind: ROUTE_SEARCH_KINDS.PAGE,
      thumb: CHAR_STRINGS.EMPTY,
    },
    {
      path: seg(slugs.about),
      title: aboutTitle,
      preview: toMetaDescription(stripHtml(about?.col1?.[0] || '')),
      keywords: [...themes(about), slugs.about, aboutTitle],
      kind: ROUTE_SEARCH_KINDS.PAGE,
      thumb: CHAR_STRINGS.EMPTY,
    },
    {
      path: seg(slugs.contact),
      title: contactTitle,
      preview: contactPreview,
      keywords: [slugs.contact, contactTitle],
      kind: ROUTE_SEARCH_KINDS.PAGE,
      thumb: CHAR_STRINGS.EMPTY,
    },
    ...legal,
    {
      path: `${ROUTE_PATHS.ROOT}${ROUTE_PATHS.DOCS_SEGMENT}`,
      title: docs.title || ROUTE_PATHS.DOCS_SEGMENT,
      preview: docs.description || CHAR_STRINGS.EMPTY,
      keywords: themes(docs as PageNode),
      kind: ROUTE_SEARCH_KINDS.DOCS,
      thumb: CHAR_STRINGS.EMPTY,
    },
    {
      path: seg(slugs.earthPlayground),
      title: String(appText(CMS_KEYS.EARTH_PLAYGROUND) || slugs.earthPlayground),
      preview: earth?.description || CHAR_STRINGS.EMPTY,
      keywords: [...themes(earth), slugs.earthPlayground],
      kind: ROUTE_SEARCH_KINDS.EXPERIMENT,
      thumb: CHAR_STRINGS.EMPTY,
    },
    {
      path: seg(slugs.starField),
      title: String(appText(CMS_KEYS.STAR_FIELD) || slugs.starField),
      preview: star?.description || CHAR_STRINGS.EMPTY,
      keywords: [...themes(star), slugs.starField],
      kind: ROUTE_SEARCH_KINDS.EXPERIMENT,
      thumb: CHAR_STRINGS.EMPTY,
    },
    {
      path: seg(slugs.animations),
      title: String(appText(CMS_KEYS.ANIMATIONS) || slugs.animations),
      preview: anim?.description || CHAR_STRINGS.EMPTY,
      keywords: [...themes(anim), slugs.animations],
      kind: ROUTE_SEARCH_KINDS.EXPERIMENT,
      thumb: CHAR_STRINGS.EMPTY,
    },
  ]
}

/**
 * The portfolio half — one `/portfolio/<link>` entry per row in the home
 * portfoliolist, hydrated with the row's label/description/cover.
 * Accepts the CMS node in either shape it can arrive (array or keyed
 * object — Firebase serializes arrays as objects on some paths).
 * @param items Raw portfoliolist rows.
 * @param lang Current locale code.
 * @returns Project route entries in list order.
 */
export function projectEntries(
  items: PortfolioRow[] | Record<string, PortfolioRow> | null | undefined,
  lang: string
): RouteEntry[] {
  const pfx = locPrefix(lang)
  const storage = store.getters.getStorage()
  const rows = items ? (Array.isArray(items) ? items : Object.values(items)) : []

  return rows
    .filter((it) => it && typeof it === TYPE_STRINGS.OBJECT && it.link)
    .map((it) => {
      const link = String(it.link)
      const title = it.label || it.title || link
      const thumb = it.image
        ? encodeMediaUrl(`${storage}${DB_PATHS.COVERS}${it.image}${MEDIA.EXT}`)
        : CHAR_STRINGS.EMPTY

      return {
        path: `${pfx}${ROUTE_PATHS.ROOT}${ROUTE_PATHS.PORTFOLIO_SEGMENT}${ROUTE_PATHS.ROOT}${link}`,
        title: String(title),
        preview: toMetaDescription(stripHtml(String(it.description || ''))),
        keywords: [link, String(title)],
        kind: ROUTE_SEARCH_KINDS.PROJECT,
        thumb,
      }
    })
}

/** Normalizes the portfoliolist node — array or keyed object. */
const portfolioRows = (node: unknown): PortfolioRow[] | Record<string, PortfolioRow> => {
  const list = (node as { portfoliolist?: PortfolioRow[] | Record<string, PortfolioRow> })
    ?.portfoliolist

  return list || []
}

/** Wire entry shape in meta/search-index-*.json — {p,t,d,k,c,i,v}. */
interface IndexRow {
  p?: string
  t?: string
  d?: string
  k?: string[]
  /** ROUTE_SEARCH_KINDS discriminant — unknown/absent values land PAGE. */
  c?: string
  /** Cover media src — the blur-up thumb variant is built from it. */
  i?: string
  /** Video flag on the cover (1 = the thumb is the poster frame). */
  v?: number
}

/** Every declared kind value — validates the wire `c` field. */
const KIND_SET = new Set<string>(Object.values(ROUTE_SEARCH_KINDS))

/** Maps one wire index row to a catalog entry. */
const toEntry = (r: IndexRow): RouteEntry => ({
  path: String(r.p || ROUTE_PATHS.ROOT),
  title: String(r.t || r.p || CHAR_STRINGS.EMPTY),
  preview: String(r.d || CHAR_STRINGS.EMPTY),
  keywords: Array.isArray(r.k) ? r.k.map(String) : [],
  kind: r.c && KIND_SET.has(r.c) ? r.c : ROUTE_SEARCH_KINDS.PAGE,
  thumb: r.i
    ? buildMediaUrls(store.getters.getStorage(), CHAR_STRINGS.EMPTY, {
        src: r.i,
        isVideo: r.v === 1,
      }).thumb
    : CHAR_STRINGS.EMPTY,
})

/** The generated search-index URL for a locale (public meta dir). */
const indexUrl = (locale: string): string =>
  `${ROUTE_PATHS.ROOT}meta${ROUTE_PATHS.ROOT}search-index-${locale}.json`

/** The shared docs catalog URL — one English-only artifact for all locales. */
const docsIndexUrl = (): string =>
  `${ROUTE_PATHS.ROOT}meta${ROUTE_PATHS.ROOT}search-index-${ROUTE_PATHS.DOCS_SEGMENT}.json`

/**
 * Docs catalog promise — the artifact is locale-independent and the
 * corpus is English-only, so it resolves once and every locale switch
 * reuses the same entries. A failed fetch clears the slot so the next
 * catalog load retries instead of pinning the outage.
 */
let docsRows: Promise<RouteEntry[]> | null = null

/**
 * `loadDocsRows` — fetches (once) the shared docs search index; resolves
 * to the mapped entries. Only a non-empty artifact pins the slot —
 * `!ok`, a non-array payload and a rejected fetch all resolve [] AND
 * reset it, so the next catalog load retries instead of caching an
 * outage for the rest of the session.
 */
const loadDocsRows = (): Promise<RouteEntry[]> => {
  docsRows ??= fetch(docsIndexUrl(), { cache: 'default' })
    .then((res) => (res.ok ? res.json() : []))
    .then((rows: IndexRow[]) => {
      if (!Array.isArray(rows) || !rows.length) {
        docsRows = null

        return []
      }

      return rows.map(toEntry)
    })
    .catch((e) => {
      devError(e)

      docsRows = null

      return []
    })

  return docsRows
}

/**
 * `loadCatalog` — the locale route catalog comes from the generated
 * `meta/search-index-<loc>.json` (the sitemap's URL set, enriched per
 * locale) merged with the shared docs index (English-only, fetched once
 * and reused across locale switches). When the locale artifact is
 * absent (dev without a build, offline test env) the embedded catalog —
 * static pages plus the store/SWR portfoliolist — is the fallback.
 * @param lang Current locale code.
 * @param done Receives the complete catalog (never throws).
 */
export function loadCatalog(lang: string, done: (_entries: RouteEntry[]) => void): void {
  const base = staticEntries(lang)
  const stored = store.getters.getPortfolioList() as PortfolioRow[]

  const embedded = (rows: PortfolioRow[] | Record<string, PortfolioRow>): RouteEntry[] => [
    ...base,
    ...projectEntries(stored?.length ? stored : rows, lang),
  ]

  // Warms the shared docs fetch in parallel with the locale index —
  // `finish` then just awaits the already-in-flight promise.
  void loadDocsRows()

  const finish = (entries: RouteEntry[]): void => {
    void loadDocsRows().then((docs) => done([...entries, ...docs]))
  }

  fetch(indexUrl(lang), { cache: 'default' })
    .then((res) => (res.ok ? res.json() : null))
    .then((rows: IndexRow[] | null) => {
      if (Array.isArray(rows) && rows.length) {
        finish(rows.map(toEntry))

        return
      }

      embeddedFallback(stored, embedded, base, lang, (entries) => finish(entries))
    })
    .catch((e) => {
      devError(e)

      embeddedFallback(stored, embedded, base, lang, (entries) => finish(entries))
    })
}

/**
 * `orderByKind` — partitions scored hits into kind buckets ordered by
 * each bucket's best hit: the input arrives score-sorted, so a kind's
 * first occurrence index IS its group rank. A weak page keyword hit can
 * no longer outrank a strong project title match just because its kind
 * used to render first. The sort is stable, so the scorer's ordering
 * survives inside each bucket; undeclared kinds sort after every bucket.
 * @param entries Score-ordered hits from the matcher.
 * @returns The same hits partitioned into best-hit-ordered buckets.
 */
export function orderByKind(entries: RouteEntry[]): RouteEntry[] {
  const first = new Map<string, number>()

  entries.forEach((e, i) => {
    if (KIND_SET.has(e.kind) && !first.has(e.kind)) first.set(e.kind, i)
  })

  const rank = (e: RouteEntry): number => first.get(e.kind) ?? entries.length

  return [...entries].sort((a, b) => rank(a) - rank(b))
}

/**
 * `groupLabel` — a kind's bucket header text. Localized labels come from
 * the CMS search copy node; the docs bucket always resolves to the
 * English-only DOCS_STRINGS.SEARCH_GROUP_LABEL token (the corpus exists
 * only in English, so the label names that in every locale).
 * @param strings Resolved search copy node.
 * @param kind The entry kind whose header is needed.
 * @returns The group header text ('' for undeclared kinds).
 */
export function groupLabel(strings: SearchStrings, kind: string): string {
  switch (kind) {
    case ROUTE_SEARCH_KINDS.PAGE:
      return strings.groups.pages
    case ROUTE_SEARCH_KINDS.PROJECT:
      return strings.groups.portfolio
    case ROUTE_SEARCH_KINDS.EXPERIMENT:
      return strings.groups.experiments
    case ROUTE_SEARCH_KINDS.LEGAL:
      return strings.groups.legal
    case ROUTE_SEARCH_KINDS.DOCS:
      return DOCS_STRINGS.SEARCH_GROUP_LABEL
    default:
      return CHAR_STRINGS.EMPTY
  }
}

/** Embedded fallback path — store rows first, then a pages/home fetch. */
function embeddedFallback(
  stored: PortfolioRow[],
  embedded: (_rows: PortfolioRow[] | Record<string, PortfolioRow>) => RouteEntry[],
  base: RouteEntry[],
  lang: string,
  done: (_entries: RouteEntry[]) => void
): void {
  if (stored && stored.length) {
    done(embedded([]))

    return
  }

  const l = store.getters.getlang()
  const locale = l.locale || LOCALES.EN
  const dbpath = `${l.database}${locale}${l.pagesPath}${CMS_KEYS.HOME}`

  fetchFirebaseDb(dbpath)
    .then((snap) => {
      const rows = snap?.exists() ? portfolioRows(snap.val()) : []

      done(embedded(rows))
    })
    .catch((e) => {
      devError(e)

      done(base)
    })
}
