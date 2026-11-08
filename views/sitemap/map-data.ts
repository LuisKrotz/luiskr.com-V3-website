/**
 * @file views/sitemap/map-data.ts
 * @description Data model for <view-sitemap> — builds the site link
 * tree the DOM index renders from: the site root, one branch per
 * section group (pages / legal / portfolio / playground / docs /
 * media), one node per page, locale leaves under each page ("all
 * links in all languages"), and one node per media item in the media
 * group with locale leaves of its own ("all images and media links",
 * translated like every other row). Leaf hrefs resolve through the
 * same localized-slug tables and media-slug conventions the router
 * and project modal use, so the map never drifts from the real link
 * surface.
 */

import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { EARTH_SHARE } from '@core/tokens/playground/share.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { VALID_LANGS } from '@core/i18n.js'
import { appText, routeSlugs } from '@core/locale/ui-text.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { getFallbackLegalLinks, legalLinks } from '@core/utils/data/legal-links.js'
import { mediaSlugSeq } from '@core/utils/string.js'
import store from '@core/store.js'

/** One node of the sitemap link tree — groups, pages and leaves. */
export interface SitemapNode {
  /** Visible label — group name, page title, locale code or filename. */
  label: string
  /** Navigation target — empty on the synthetic root and on groups. */
  href: string
  /** Tree depth (0 root, 1 group, 2 page, 3 leaf). */
  depth: number
  /** Child nodes — empty on leaves. */
  children: SitemapNode[]
  /** True on group + page nodes (the layout's "dir" flag). */
  dir: boolean
  /** Locale code when the leaf is a localized page variant. */
  locale?: string
  /** Descriptive tooltip — the media object's CMS label. */
  tip?: string
  /** Card media payload — present only on media-bearing page nodes
   *  (project media + playground share captures). */
  media?: SitemapMedia
  /** Group renders collapsed; the children mount on first open. */
  collapsible?: boolean
  /** Group children lay out as a packed media-card wall (the skyline
   *  masonry), not the stacked page list. */
  mosaic?: boolean
  /** Group spans the full index grid and flows its page rows into
   *  multi-column tracks — long flat lists (portfolio) stop reading
   *  as one tall single column. */
  wide?: boolean
  /** Stable group id (SitemapGroupKey) — locale-proof identity for the
   *  view's open-state map and aria-controls region ids. Set on every
   *  group node; page/leaf nodes leave it undefined. */
  key?: string
}

/** One card's media payload — the view resolves `kind` to its element:
 *  'figure' mounts <media-figure> (the progressive thumb→ladder loader;
 *  `src` is the extensionless CDN stem, folder already joined), 'img'
 *  mounts a plain lazy <img> at the absolute capture URL (playground
 *  share screenshots have no mozjpeg ladder — the file IS the source). */
export interface SitemapMedia {
  /** Renderer pick — 'figure' | 'img'. */
  kind: 'figure' | 'img'
  /** 'figure': extensionless stem relative to the CDN base.
   *  'img': the absolute file URL. */
  src: string
  /** Video flag — figure videos autoplay muted in viewport. */
  isVideo?: boolean
  /** Intrinsic [w,h] from the CMS record — drives mosaic packing. */
  size?: number[]
  /** Expand-modal affordance (project media only). */
  canExpand?: boolean
}

/** `pages.sitemap` CMS node — title/intro/group labels per locale. */
export interface SitemapPageNode {
  title?: string
  description?: string
  intro?: string
  groups?: Partial<Record<SitemapGroupKey, string>>
}

/** Group keys in `pages.sitemap.groups` — the seven section branches. */
export type SitemapGroupKey =
  'pages' | 'legal' | 'portfolio' | 'playground' | 'docs' | 'media' | 'playgroundMedia'

/** English group-label fallbacks — used only while the CMS node loads. */
const GROUP_LABEL_FALLBACKS: Record<SitemapGroupKey, string> = {
  pages: 'Pages',
  legal: 'Legal',
  portfolio: 'Portfolio',
  playground: 'Playground',
  docs: 'Docs',
  media: 'Media',
  playgroundMedia: 'Playground media',
}

/** One CMS media record inside a project's cover/sections. */
interface ProjectMedia {
  /** Extensionless CDN stem inside the project folder. */
  src?: string
  /** Video rows resolve to .mp4; stills to .jpg. */
  isVideo?: boolean
  /** The CMS caption — the leaf's tooltip. */
  label?: string
  /** Intrinsic [w,h] — mosaic packing + the figure's aspect box. */
  size?: number[]
  /** Whether the figure may open the expand modal. */
  canExpand?: boolean
}

/** The `translations/<loc>/projects/<slug>` node shape consumed here. */
export interface SitemapProject {
  title?: string
  folder?: string
  cover?: ProjectMedia
  sections?: unknown[]
}

/** The fetched `translations/<loc>/projects` map (slug → project). */
export type SitemapProjectMap = Record<string, SitemapProject>

/**
 * The fetched projects maps for every locale (locale → slug →
 * project) — the media branch derives each item's per-locale deep-link
 * slug from that locale's translated labels.
 */
export type SitemapProjectsByLocale = Record<string, SitemapProjectMap>

/**
 * One playground share-capture manifest the view fetched
 * (`/meta/<experiment>-share.json`) plus the localized per-capture
 * label (`pages.<experiment>.shareCapture`). `images`/`videos` hold
 * absolute CDN file URLs — the build emits one row per capture.
 */
export interface SitemapShareInput {
  /** Absolute screenshot URLs under the set's share/ prefix. */
  images?: string[]
  /** Absolute recorded-clip URLs under the same prefix. */
  videos?: string[]
  /** Capture URL → intrinsic [w,h] probed at manifest build time —
   *  drives the wall's packed-card aspect (absent → generic box). */
  dims?: Record<string, number[]>
  /** Display-locale per-capture label ("Earth render"/"Star render"). */
  label?: string
}

/** The two share sets — keyed by their playground branch. */
export interface SitemapShares {
  /** Earth Playground share captures. */
  earth?: SitemapShareInput
  /** Star Field share captures. */
  star?: SitemapShareInput
}

/**
 * One {label, slug-key} row of the static pages branch — every row is a
 * first-class route slug, so per-locale hrefs come from routeSlugs.
 */
const PAGE_ROWS: ReadonlyArray<{ key: keyof ReturnType<typeof routeSlugs>; label: () => string }> =
  [
    {
      key: 'about',
      label: () => String(appText(SECTION_UI_KEYS.ABOUT_DESCRIPTION) || CHAR_STRINGS.EMPTY),
    },
    {
      key: 'contact',
      label: () => String(appText(CMS_KEYS.CONTACT) || CHAR_STRINGS.EMPTY),
    },
    {
      key: 'search',
      label: () => String(appText(SECTION_UI_KEYS.SEARCH) || CHAR_STRINGS.EMPTY),
    },
    {
      key: 'animations',
      label: () => String(appText(CMS_KEYS.ANIMATIONS) || CHAR_STRINGS.EMPTY),
    },
    {
      key: 'sitemap',
      label: () => String(appText(SECTION_UI_KEYS.SITEMAP) || CHAR_STRINGS.EMPTY),
    },
  ]

/**
 * Locale-prefixed URL for a raw path tail — `portfolio/x` under 'br'
 * becomes `/br/portfolio/x`; the English form stays unprefixed.
 * @param tail Path without leading slash.
 * @param locale Locale code.
 * @returns Root-relative localized path.
 */
const localeTail = (tail: string, locale: string): string =>
  `${locale === LOCALES.EN ? CHAR_STRINGS.EMPTY : `${CHAR_STRINGS.SLASH}${locale}`}${CHAR_STRINGS.SLASH}${tail}`

/**
 * Localized URL for a slug-table key — `routeSlugs` merges CMS slug
 * overrides over the build-time LANG_SLUGS table.
 * @param key LANG_SLUGS route key.
 * @param locale Locale code.
 * @returns Root-relative localized path.
 */
const slugHref = (key: keyof ReturnType<typeof routeSlugs>, locale: string): string =>
  localeTail(String(routeSlugs(locale)[key] || key), locale)

/**
 * Last path segment of a link — portfolio entries store 'portfolio/x'
 * tails (or full '/portfolio/x' paths); the bare slug is what the
 * locale prefix needs.
 * @param link Stored link value.
 * @returns Bare trailing slug.
 */
const tailSlug = (link: string): string => link.split(CHAR_STRINGS.SLASH).filter(Boolean).pop()!

/** The localized leaf rows under a page node — one per supplied locale. */
const localeLeaves = (
  hrefFor: (_locale: string) => string,
  locales: readonly string[] = VALID_LANGS
): SitemapNode[] =>
  locales.map((loc) => ({
    label: loc.toUpperCase(),
    href: hrefFor(loc),
    depth: 3,
    children: [],
    dir: false,
    locale: loc,
  }))

/**
 * A page node — label + current-locale href, with one locale leaf per
 * supplied locale.
 * @param labelText Visible page name.
 * @param hrefFor Locale → URL builder.
 * @param locales Locales the page exists in (docs is English-only).
 * @returns The depth-2 page node.
 */
const pageNode = (
  labelText: string,
  hrefFor: (_loc: string) => string,
  locales: readonly string[] = VALID_LANGS
): SitemapNode => {
  const current = store.getters.getLang() || LOCALES.EN

  return {
    label: labelText,
    href: hrefFor((locales as readonly string[]).includes(current) ? current : locales[0]!),
    depth: 2,
    children: localeLeaves(hrefFor, locales),
    dir: true,
  }
}

/**
 * Re-targets a stored legal link onto another locale — the CMS stores
 * the current locale's paths; other locales rebuild from the slug tail
 * through their own slug table.
 * @param link Stored legal link path.
 * @param locale Target locale.
 * @returns Localized legal path.
 */
const legalLeafHref = (link: string, locale: string): string => {
  const tail = tailSlug(link)

  const slugs = routeSlugs(locale)

  const key = (Object.keys(slugs) as Array<keyof typeof slugs>).find((k) => slugs[k] === tail)

  return key ? slugHref(key, locale) : localeTail(tail, locale)
}

/**
 * Portfolio project rows — built from the fetched `projects` map
 * ({slug → {title, cover, folder, sections}}), never the home-only
 * portfoliolist store slot (which is empty off the home route).
 * @param projects The `translations/<loc>/projects` map.
 * @returns Page nodes, one per project, each with 16 locale leaves.
 */
const projectNodes = (projects: SitemapProjectMap): SitemapNode[] =>
  Object.keys(projects).map((slug) =>
    pageNode(projects[slug]?.title || slug, (loc) =>
      localeTail(`${ROUTE_PATHS.PORTFOLIO_SEGMENT}${CHAR_STRINGS.SLASH}${slug}`, loc)
    )
  )

/**
 * The ordered section media items of one project — the same
 * section → group → item traversal views/project/modal.ts walks, so
 * per-locale lists stay index-aligned (only src-bearing items count,
 * exactly like the modal's `label && item.src` gate).
 * @param project The project record.
 * @returns Flat media rows in document order.
 */
const sectionsMedia = (project: SitemapProject): ProjectMedia[] => {
  const items: ProjectMedia[] = []

  for (const section of project.sections || []) {
    if (!Array.isArray(section)) continue

    for (const group of section) {
      if (!Array.isArray(group) || typeof group[0] === TYPE_STRINGS.STRING) continue

      for (const item of group as ProjectMedia[]) {
        if (item?.src) items.push(item)
      }
    }
  }

  return items
}

/**
 * The full media row list of one project — cover first (it is the
 * page's first visual, at scroll top), then the section items in
 * document order.
 * @param project The project record.
 * @returns Cover + section media rows.
 */
const allMedia = (project: SitemapProject): ProjectMedia[] => [
  ...(project.cover?.src ? [project.cover] : []),
  ...sectionsMedia(project),
]

/**
 * Canonical deep-link slug for one media item — `mediaSlugSeq` against
 * the project's per-locale `seen` map, the identical convention
 * modal.ts + the build emit use, so `<label>-2` ordinals never drift.
 * The cover and unlabeled rows get no slug (the modal only sequences
 * labeled section items).
 * @param item The media record.
 * @param cover True for the cover row — never slug-addressable.
 * @param seen The per-(project, locale) slug sequence map.
 * @returns The canonical slug, or '' when not modal-addressable.
 */
const mediaSlug = (item: ProjectMedia, cover: boolean, seen: Map<string, number>): string =>
  !cover && item.label ? mediaSlugSeq(seen, item.label) : CHAR_STRINGS.EMPTY

/**
 * One media page-block — `<project>: <label>` (label already starting
 * with the project title is used as-is; missing labels fall back to the
 * file name) with one locale leaf per language. Each leaf deep-links to
 * the media in THAT locale (`/<loc>/portfolio/<slug>/<media-slug>`,
 * derived from that locale's translated labels — the modal auto-opens
 * on hit); rows that are not modal-addressable fall back to the
 * localized project page, and the leaf's tooltip shows the item's
 * caption in that leaf's language.
 * @param projectsByLocale All locales' projects maps.
 * @param slug The project slug.
 * @param current The display locale (drives the block's own href).
 * @returns Depth-2 page nodes, one per media item of the project.
 */
const mediaItemNodes = (
  projectsByLocale: SitemapProjectsByLocale,
  slug: string,
  current: string
): SitemapNode[] => {
  const project = projectsByLocale[current]?.[slug] || {}

  const title = project.title || slug

  const items = allMedia(project)

  // Per-locale parallel media lists + slug indexes — each locale's
  // slug comes from its own translated labels, so the leaf href is the
  // deep link the locale's own project view resolves. Index-aligned to
  // `items` and src-verified: a locale whose media list drifts yields
  // '' for that slot and the leaf falls back to the project page
  // rather than pointing at a wrong slug.
  const byLocale = new Map<string, { all: ProjectMedia[]; slugs: string[] }>(
    VALID_LANGS.map((loc) => {
      const locProject = projectsByLocale[loc]?.[slug] || {}

      const locAll = allMedia(locProject)

      const locCoverCount = locProject.cover?.src ? 1 : 0

      const seen = new Map<string, number>()

      const slugs = locAll.map((it, i) => mediaSlug(it, i < locCoverCount, seen))

      return [loc, { all: locAll, slugs }] as const
    })
  )

  const projectHrefFor = (loc: string): string =>
    localeTail(`${ROUTE_PATHS.PORTFOLIO_SEGMENT}${CHAR_STRINGS.SLASH}${slug}`, loc)

  return items.map((item, i) => {
    const text = item.label || `${tailSlug(item.src!)}${item.isVideo ? MEDIA.VIDEO_EXT : MEDIA.EXT}`

    const leaf = (loc: string): SitemapNode => {
      const entry = byLocale.get(loc)!

      const locItem = entry.all[i]

      const media = locItem?.src === item.src ? entry.slugs[i] : CHAR_STRINGS.EMPTY

      const base = projectHrefFor(loc)

      return {
        label: loc.toUpperCase(),
        href: media ? `${base}${CHAR_STRINGS.SLASH}${media}` : base,
        depth: 3,
        children: [],
        dir: false,
        locale: loc,
        // media is non-empty only when the slug exists — which requires
        // a label — so the tip can ride on it directly.
        ...(media ? { tip: locItem!.label } : {}),
      }
    }

    const self = leaf(
      (VALID_LANGS as readonly string[]).includes(current) ? current : VALID_LANGS[0]!
    )

    return {
      label: text.startsWith(title)
        ? text
        : `${title}${CHAR_STRINGS.COLON}${CHAR_STRINGS.SPACE_CHAR}${text}`,
      href: self.href,
      depth: 2,
      children: VALID_LANGS.map(leaf),
      dir: true,
      // The media card payload — the extensionless folder-joined stem the
      // <media-figure> resolves into its progressive ladder (kodak thumb
      // → manifest-proven quality rungs). No folder → no resolvable
      // stem → the block renders caption-only.
      ...(project.folder
        ? {
            media: {
              kind: 'figure' as const,
              src: project.folder + item.src,
              isVideo: item.isVideo,
              size: item.size,
              canExpand: item.canExpand,
            },
          }
        : {}),
    }
  })
}

/**
 * One share capture's deep-link leaf target — captures live on their
 * playground route (there is no per-capture page), so every leaf points
 * at the localized playground URL.
 * @param slugKey The playground route slug key.
 * @returns The locale → href builder.
 */
const shareHrefFor =
  (slugKey: 'earthPlayground' | 'starField') =>
  (loc: string): string =>
    slugHref(slugKey, loc)

/**
 * Strips an absolute share-capture URL back to the extensionless CDN
 * stem <media-figure> consumes — `experiments/…/share/foo.mp4` →
 * `experiments/…/share/foo`. The figure re-appends its own poster/webm/
 * mp4 grammar, manifest-gated so only proven variants are requested —
 * that is what keeps a missing poster frame off the wire (the old raw
 * <img> requested it blind and rendered the broken-image glyph).
 * @param url Absolute capture URL from the share manifest.
 * @returns CDN_BASE-relative stem (unknown prefixes pass through).
 */
const shareStem = (url: string): string => {
  const key = url.startsWith(CDN_URLS.CDN_BASE) ? url.slice(CDN_URLS.CDN_BASE.length) : url

  const ext = EARTH_SHARE.VIDEO_EXTS.find((e) => key.endsWith(e))

  return ext ? key.slice(0, key.length - ext.length) : key
}

/**
 * Playground share-capture media nodes — one card per screenshot/clip
 * under each experiment's share/ prefix, titled `<Playground>: <capture
 * label> N`, linking back to the localized playground route. Images
 * carry 'img' payloads (absolute URLs, no ladder exists); videos carry
 * 'figure' payloads on the stripped stem so they inherit viewport
 * autoplay + manifest-gated sources.
 * @param title The playground's display-locale title.
 * @param input The fetched share set + localized capture label.
 * @param slugKey The playground route slug key.
 * @param current The display locale (drives the block's own href).
 * @returns Depth-2 page nodes, one per capture.
 */
const shareMediaNodes = (
  title: string,
  input: SitemapShareInput,
  slugKey: 'earthPlayground' | 'starField',
  current: string
): SitemapNode[] => {
  const hrefFor = shareHrefFor(slugKey)

  const base = input.label || title

  const captures: SitemapMedia[] = [
    ...(input.images || []).map((url) => ({
      kind: 'img' as const,
      src: url,
      size: input.dims?.[url],
    })),
    ...(input.videos || []).map((url) => ({
      kind: 'figure' as const,
      src: shareStem(url),
      size: input.dims?.[url],
      isVideo: true,
    })),
  ]

  return captures.map((media, i) => {
    const text = `${base}${CHAR_STRINGS.SPACE_CHAR}${i + 1}`

    return {
      label: text.startsWith(title)
        ? text
        : `${title}${CHAR_STRINGS.COLON}${CHAR_STRINGS.SPACE_CHAR}${text}`,
      href: hrefFor(current),
      depth: 2,
      children: localeLeaves(hrefFor),
      dir: true,
      media,
    }
  })
}

/**
 * Builds the full sitemap link tree — group labels come from the
 * `pages.sitemap` node the view fetched (live locale first, bundled EN
 * snapshot via FALLBACK_PAGES when absent); portfolio + media rows come
 * from the per-locale `projects` maps the view fetched (the display
 * locale's map labels the rows; every locale's map feeds the media
 * leaf slugs).
 * @param page The fetched `pages.sitemap` CMS node, when available.
 * @param projectsByLocale All locales' `translations/<loc>/projects` maps.
 * @param shares The fetched playground share-capture sets (the
 *  playground-media branch's items).
 * @returns The synthetic root node; children are the section groups.
 */
export const buildSitemapTree = (
  page?: SitemapPageNode | null,
  projectsByLocale: SitemapProjectsByLocale = {},
  shares: SitemapShares = {}
): SitemapNode => {
  const current = store.getters.getLang() || LOCALES.EN

  const projects = projectsByLocale[current] || projectsByLocale[LOCALES.EN] || {}

  const groups =
    page?.groups ||
    (FALLBACK_PAGES[TRANSLATION_KEYS.SITEMAP] as SitemapPageNode | undefined)?.groups ||
    {}

  const label = (key: SitemapGroupKey): string => groups[key] || GROUP_LABEL_FALLBACKS[key]

  const group = (
    key: SitemapGroupKey,
    children: SitemapNode[],
    flags: { collapsible?: boolean; mosaic?: boolean; wide?: boolean } = {}
  ): SitemapNode => ({
    label: label(key),
    href: CHAR_STRINGS.EMPTY,
    depth: 1,
    children,
    dir: true,
    key,
    ...(flags.collapsible ? { collapsible: true } : {}),
    ...(flags.mosaic ? { mosaic: true } : {}),
    ...(flags.wide ? { wide: true } : {}),
  })

  // Media branches — full-grid, collapsed by default (hundreds of cards
  // mount + load only on first open), packed as a skyline card wall.
  const MEDIA_GROUP_FLAGS = { collapsible: true, mosaic: true }

  // Home row — legalLinks() filters the home entry out (it is not a
  // legal page), so the label comes from the fallback's first row, the
  // same contract legal-footer's home link uses.
  const homeLabel =
    getFallbackLegalLinks(current)[0]!.page ||
    String(appText(SECTION_UI_KEYS.TITLE) || CHAR_STRINGS.EMPTY)

  return {
    label: String(appText(SECTION_UI_KEYS.TITLE) || CHAR_STRINGS.EMPTY),
    href: localeTail(CHAR_STRINGS.EMPTY, current),
    depth: 0,
    children: [
      group('pages', [
        pageNode(homeLabel, (loc) => localeTail(CHAR_STRINGS.EMPTY, loc)),
        ...PAGE_ROWS.map((row) => pageNode(row.label(), (loc) => slugHref(row.key, loc))),
      ]),
      group(
        'legal',
        legalLinks().map((l) => ({
          label: l.page,
          href: l.link,
          depth: 2,
          children: localeLeaves((loc) => legalLeafHref(l.link, loc)),
          dir: true,
        }))
      ),
      // Portfolio is the longest flat list — span the full index width
      // and let its page rows flow into columns instead of one tall run.
      group('portfolio', projectNodes(projects), { wide: true }),
      group('playground', [
        pageNode(String(appText(CMS_KEYS.EARTH_PLAYGROUND) || CHAR_STRINGS.EMPTY), (loc) =>
          slugHref('earthPlayground', loc)
        ),
        pageNode(String(appText(CMS_KEYS.STAR_FIELD) || CHAR_STRINGS.EMPTY), (loc) =>
          slugHref('starField', loc)
        ),
      ]),
      group('docs', [
        {
          label: DOCS_STRINGS.TITLE,
          href: ROUTE_PATHS.DOCS,
          depth: 2,
          children: localeLeaves(() => ROUTE_PATHS.DOCS, [LOCALES.EN]),
          dir: true,
        },
      ]),
      group(
        'media',
        Object.keys(projects).flatMap((slug) => mediaItemNodes(projectsByLocale, slug, current)),
        MEDIA_GROUP_FLAGS
      ),
      group(
        'playgroundMedia',
        [
          ...(shares.earth
            ? shareMediaNodes(
                String(appText(CMS_KEYS.EARTH_PLAYGROUND) || CHAR_STRINGS.EMPTY),
                shares.earth,
                'earthPlayground',
                current
              )
            : []),
          ...(shares.star
            ? shareMediaNodes(
                String(appText(CMS_KEYS.STAR_FIELD) || CHAR_STRINGS.EMPTY),
                shares.star,
                'starField',
                current
              )
            : []),
        ],
        MEDIA_GROUP_FLAGS
      ),
    ].filter((g) => g.children.length > 0),
    dir: true,
  }
}
