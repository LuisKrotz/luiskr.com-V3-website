/**
 * @file Sitemap.js
 * @description <view-sitemap> — the localized /sitemap page: the full
 * site link index (every page in every language, plus every project
 * media file) grouped by section — pages / legal / portfolio /
 * playground / docs / media / playground media — each anchor
 * SPA-routed on plain clicks. The two media branches render as
 * collapsible skyline-packed card walls: children mount on first open,
 * each card carries its title link, a progressive <media-figure> (or a
 * plain capture <img> for share screenshots, which have no mozjpeg
 * ladder), and its locale chips. Ends on the shared <legal-footer>.
 */

import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { SITEMAP_CLASSES } from '@core/tokens/classes/sitemap.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { EARTH_SHARE, STAR_SHARE } from '@core/tokens/playground/share.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { LOCALES } from '@core/tokens/locales.js'
import { VALID_LANGS, LANG_OPTIONS } from '@core/i18n.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { LABEL_TEXT } from '@core/tokens/strings/text.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { CLIPBOARD_EVENTS, PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { h } from '@core/jsx.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { appText } from '@core/locale/ui-text.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { isPlainClick } from '@core/utils/dom.js'
import { devError } from '@core/devlog.js'
import { printJobActive } from '@core/utils/print/print.js'
import { packMediaMosaic } from '@website/components/media/mosaic/pack.js'
import type { PackedMosaic } from '@website/components/media/mosaic/pack.js'
import { buildSitemapTree } from './map-data.js'
import type {
  SitemapNode,
  SitemapPageNode,
  SitemapProjectMap,
  SitemapProjectsByLocale,
  SitemapShares,
} from './map-data.js'
import sitemapStyles from './sitemap.scss?tiers'
import '@website/components/media/MediaFigure.js'
import '@website/components/legal/Footer.js'

/** One playground page node's share fields as fetched per locale. */
interface PlaygroundPageNode {
  /** Localized per-capture label ("Earth render"/"Star render"). */
  shareCapture?: string
}

/** One fetched share manifest — only the fields the index consumes. */
interface ShareManifest {
  /** Absolute screenshot URLs under the set's share/ prefix. */
  images?: string[]
  /** Absolute recorded-clip URLs under the same prefix. */
  videos?: string[]
  /** Capture URL → intrinsic [w,h] probed at manifest build time —
   *  packs the media wall at the capture's real aspect. */
  dims?: Record<string, number[]>
}

/**
 * The ViewSitemap — sitemap page class.
 */
export class ViewSitemap extends BaseComponent {
  /** Fetched pages.sitemap node (title/intro/group labels). */
  _page: SitemapPageNode | null = null

  /** Fetched translations/<loc>/projects maps, one per locale —
   *  portfolio titles come from the display locale's map; media leaf
   *  slugs need every locale's translated labels. */
  _projects: SitemapProjectsByLocale = {}

  /** Whether the all-locales projects fetch already ran — unlike the
   *  page node it covers every language, so it loads once, not per
   *  locale switch. */
  _projectsLoaded = false

  /** Fetched share manifests — locale-free, loaded once. */
  _shareManifests: { earth?: ShareManifest; star?: ShareManifest } = {}

  /** Whether the two share-manifest fetches already ran. */
  _sharesLoaded = false

  /** Fetched playground page nodes — refetched per locale for the
   *  localized shareCapture labels. */
  _playPages: { earth?: PlaygroundPageNode; star?: PlaygroundPageNode } = {}

  /** Locale the page node was fetched for — refetched on switches. */
  _lastLocale: string | null = null

  /** Open collapsible groups, keyed by their stable SitemapGroupKey —
   *  media branches start closed so hundreds of media cards mount only
   *  on first open. */
  _openGroups = new Set<string>()

  /** Group key the user just toggled — its chevron stamps the one-shot
   *  spin class on the very next render (the view re-creates nodes per
   *  render, so a transition can't replay; the keyframe animates the
   *  newborn node). Consumed + cleared inside render so a stray
   *  rerender doesn't restamp the animation. */
  _spinKey: string | null = null

  /** Measured wall width the packs were computed at — repack trigger. */
  _wallW = 0

  /** Packed-wall memo per group signature (key|width|count) — repacks
   *  only when the wall width or the item count actually changed. */
  _packedCache = new Map<string, PackedMosaic | null>()

  /** Host ResizeObserver driving repacks on real width changes. */
  _ro: ResizeObserver | null = null

  /** Pre-print `_openGroups` snapshot — afterprint restores the user's
   *  disclosure state so the print prep's expand-all doesn't leak into
   *  the live screen session. */
  _openBeforePrint: Set<string> | null = null

  constructor() {
    super(sitemapStyles)
  }

  override onMounted() {
    this.subscribe(store)

    this._ensureData()

    this._updateDom()

    if (typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
      this._ro = new ResizeObserver(() => this._measureWall())

      this._ro.observe(this)
    }

    window.addEventListener(PRINT_EVENTS.PREPARE, this._onPrintPrepare)
    window.addEventListener(CLIPBOARD_EVENTS.AFTER_PRINT, this._onAfterPrint)
  }

  /** Lifecycle: releases the wall ResizeObserver + the print hooks. */

  override onDestroy() {
    this._ro?.disconnect()

    this._ro = null

    window.removeEventListener(PRINT_EVENTS.PREPARE, this._onPrintPrepare)
    window.removeEventListener(CLIPBOARD_EVENTS.AFTER_PRINT, this._onAfterPrint)
  }

  /**
   * Print-prepare answer — the adapter's walk runs right after this
   * event, so every collapsible media group must be open NOW: closed
   * groups mount no children at all, which would print an empty media
   * branch. The user's open set is snapshotted for afterprint, then the
   * full tree re-renders with every group expanded.
   */
  private _onPrintPrepare = (): void => {
    if (this._openBeforePrint) return

    this._openBeforePrint = new Set(this._openGroups)

    const tree = buildSitemapTree(this._page, this._projects, this._shares())

    for (const group of tree.children) {
      if (group.collapsible && group.key) this._openGroups.add(group.key)
    }

    this._spinKey = null

    this._updateDom()
  }

  /** Restores the user's disclosure state after the print sheet closes. */
  private _onAfterPrint = (): void => {
    if (!this._openBeforePrint) return

    this._openGroups = this._openBeforePrint

    this._openBeforePrint = null

    this._updateDom()
  }

  /** Reloads the sitemap page node + projects on locale switch. */

  override onStoreUpdate() {
    const currentLocale = store.getters.getLang() || LOCALES.EN

    if (this._lastLocale && this._lastLocale !== currentLocale) {
      this._ensureData()
    }
  }

  /** Fetches translations/<loc>/pages/sitemap + /projects (SWR). */

  private _ensureData(): void {
    const lang = store.getters.getlang()

    const locale = lang?.locale || LOCALES.EN

    this._lastLocale = locale

    const db = lang?.database || DB_PATHS.TRANSLATIONS

    fetchFirebaseDb(`${db}${locale}${DB_PATHS.PAGES}${TRANSLATION_KEYS.SITEMAP}`)
      .then((snapshot) => {
        if (snapshot?.exists()) {
          this._page = snapshot.val() as SitemapPageNode

          this._updateDom()
        }
      })
      .catch(devError)

    // Playground page nodes — the per-capture labels ("Earth render"/
    // "Star render") live under each experiment's own page record.
    // Same per-locale cadence as the sitemap node.
    for (const [slot, key] of [
      ['earth', TRANSLATION_KEYS.EARTH_PLAYGROUND],
      ['star', TRANSLATION_KEYS.STAR_FIELD],
    ] as const) {
      fetchFirebaseDb(`${db}${locale}${DB_PATHS.PAGES}${key}`)
        .then((snapshot) => {
          if (snapshot?.exists()) {
            this._playPages[slot] = snapshot.val() as PlaygroundPageNode

            this._updateDom()
          }
        })
        .catch(devError)
    }

    // The full projects maps for EVERY locale — media leaves deep-link
    // per language and each locale's slug derives from its translated
    // labels, so one locale's map is not enough. The home portfoliolist
    // store slot stays empty on this route, so the sitemap fetches its
    // own — once, since the maps hold all languages regardless of the
    // display locale.
    if (!this._projectsLoaded) {
      this._projectsLoaded = true

      Promise.all(VALID_LANGS.map((loc) => fetchFirebaseDb(`${db}${loc}${DB_PATHS.PROJECTS}`)))
        .then((snapshots) => {
          VALID_LANGS.forEach((loc, i) => {
            const snapshot = snapshots[i]

            if (snapshot?.exists()) {
              this._projects[loc] = (snapshot.val() as SitemapProjectMap | undefined) || {}
            }
          })

          this._updateDom()
        })
        .catch(devError)
    }

    // Share manifests are locale-free — loaded once, like the projects.
    if (!this._sharesLoaded) {
      this._sharesLoaded = true

      Promise.all(
        [
          ['earth', EARTH_SHARE.MANIFEST_URL],
          ['star', STAR_SHARE.MANIFEST_URL],
        ].map(([slot, url]) =>
          fetch(url)
            .then((res) => (res.ok ? (res.json() as Promise<ShareManifest>) : null))
            .then((data) => [slot, data] as const)
        )
      )
        .then((results) => {
          for (const [slot, data] of results) {
            if (data) this._shareManifests[slot as 'earth' | 'star'] = data
          }

          this._updateDom()
        })
        .catch(devError)
    }
  }

  /**
   * The share sets the tree consumes — manifest URL lists plus each
   * set's localized per-capture label from its playground page node.
   */
  private _shares(): SitemapShares {
    return {
      earth: this._shareManifests.earth
        ? { ...this._shareManifests.earth, label: this._playPages.earth?.shareCapture }
        : undefined,
      star: this._shareManifests.star
        ? { ...this._shareManifests.star, label: this._playPages.star?.shareCapture }
        : undefined,
    }
  }

  /**
   * Measures the wall's content width (the index nav's — wide groups
   * span its full grid) and repacks when it moved past the epsilon.
   * Called by the host ResizeObserver and before a group opens so the
   * first painted wall is already sized correctly.
   */
  private _measureWall(): void {
    const nav = this.$(`.${SITEMAP_CLASSES.SITEMAP_INDEX}`)

    const w = nav?.clientWidth || 0

    if (w > 0 && Math.abs(w - this._wallW) > CAROUSEL_LAYOUT.FIT_EPS_PX) {
      // Print jobs freeze the screen-time repack — the host RO fires when
      // the print layout resizes to the page box, and a mid-snapshot
      // repack + re-render would rewrite absolute tile coordinates under
      // the fragmentainer and mount fresh media whose decodes hold the
      // adapter's pending bag open. The stripped wall grid already
      // handles the paper reflow.
      if (printJobActive()) return

      this._wallW = w

      this._packedCache.clear()

      if (this._openGroups.size) this._updateDom()
    }
  }

  /**
   * The packed wall for one mosaic group — memoized per group key at the
   * measured wall width (recomputing a ~500-tile skyline on every render
   * would stack the whole pack inside each _updateDom pass).
   * @param group The mosaic group node.
   * @returns The packed tile geometry, or null while unmeasurable.
   */
  private _packGroup(group: SitemapNode): PackedMosaic | null {
    const key = `${group.key!}${CHAR_STRINGS.PIPE_SEP}${this._wallW}${CHAR_STRINGS.PIPE_SEP}${group.children.length}`

    const cached = this._packedCache.get(key)

    if (cached !== undefined) return cached

    const items = group.children.map((node) => {
      const size = node.media?.size

      // Outlier bounds cap — a 4-6k px page screenshot packs as a
      // multi-wall sliver and a multi-monitor playground capture as a
      // full-wall banner at their true aspects; the pack treats each
      // axis past MAX_NATURAL_* as the ceiling so the tile holds a
      // cover crop inside the wall rhythm. Only the pack input is
      // capped: the figure keeps the true size so its own aspect box
      // (and the expand modal's natural dims) stays faithful — card
      // overflow clips the residual.
      return {
        src: node.media?.src || CHAR_STRINGS.EMPTY,
        size:
          size &&
          size.length > 1 &&
          (size[0] > GENERIC_DIMENSIONS.MAX_NATURAL_WIDTH ||
            size[1] > GENERIC_DIMENSIONS.MAX_NATURAL_HEIGHT)
            ? [
                Math.min(size[0], GENERIC_DIMENSIONS.MAX_NATURAL_WIDTH),
                Math.min(size[1], GENERIC_DIMENSIONS.MAX_NATURAL_HEIGHT),
              ]
            : size,
      }
    })

    const packed = packMediaMosaic(items, this._wallW || GENERIC_DIMENSIONS.DEFAULT_WIDTH)

    this._packedCache.set(key, packed)

    return packed
  }

  /**
   * Flips a collapsible group open/closed. Measuring BEFORE the flip
   * lets the first opened wall paint at its real width instead of
   * packing at the estimate and shifting.
   * @param key The group's stable SitemapGroupKey.
   */
  private _toggleGroup(key: string): void {
    this._measureWall()

    if (this._openGroups.has(key)) {
      this._openGroups.delete(key)
    } else {
      this._openGroups.add(key)
    }

    // The chevron of the toggled group spins on the render this calls —
    // render() consumes the key so later data-driven renders stay quiet.
    this._spinKey = key

    this._updateDom()
  }

  /**
   * One packed media card — the title link FIRST (DOM order = visual
   * top caption overlay), then the media layer, then the locale chips
   * (bottom overlay). Media resolves to <media-figure> (progressive
   * thumb → manifest-proven quality ladder; videos autoplay muted in
   * viewport) or a plain lazy <img> for share captures, which have no
   * mozjpeg ladder to climb — the file IS the full-quality source.
   * @param node The media page node.
   * @param style The tile's packed position/size style object.
   */
  private _mediaCard(node: SitemapNode, style: Record<string, string>) {
    const media = node.media

    const figure = media?.kind === 'figure'

    const itemW = media?.size?.[0] || GENERIC_DIMENSIONS.DEFAULT_WIDTH

    const itemH = media?.size?.[1] || GENERIC_DIMENSIONS.DEFAULT_HEIGHT

    // The media caption in the display locale — the leaves carry each
    // language's CMS label as their tooltip; the first localized entry
    // falls back when the display locale's slug didn't resolve.
    const current = store.getters.getLang() || LOCALES.EN

    const desc =
      node.children.find((leaf) => leaf.locale === current)?.tip ||
      node.children.find((leaf) => leaf.tip)?.tip ||
      null

    const MediaFigure = COMPONENT_TAGS.MEDIA_FIGURE

    return (
      <div
        key={`${node.href}${CHAR_STRINGS.PIPE_SEP}${node.label}`}
        className={SITEMAP_CLASSES.SITEMAP_CARD}
        style={style}
      >
        <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
          {node.label}
        </h3>
        <a
          className={SITEMAP_CLASSES.SITEMAP_CARD_TITLE}
          href={node.href}
          title={node.label}
          {...{ [DATA_ATTRS.PRINT_LINK]: ATTR_VALUES.EMPTY }}
        >
          {node.label}
        </a>
        {figure ? (
          <MediaFigure
            src={media.src}
            width={itemW}
            height={itemH}
            is-video={media.isVideo ?? false}
            auto-play={media.isVideo ?? false}
            can-expand={media.canExpand ?? false}
            label={node.label}
            classes={SITEMAP_CLASSES.SITEMAP_CARD_FIGURE}
          />
        ) : media?.kind === 'img' ? (
          <img
            className={SITEMAP_CLASSES.SITEMAP_CARD_IMG}
            src={media.src}
            alt={ATTR_VALUES.EMPTY}
            loading={MEDIA_ATTRS.LOADING_LAZY}
            decoding={MEDIA_ATTRS.DECODING_ASYNC}
          />
        ) : null}
        {desc ? (
          // The caption prints under the media — `hidden` on screen, the
          // shadow print sheet reveals it (same contract .print-caption
          // uses for injected nodes).
          <p className={SITEMAP_CLASSES.SITEMAP_CARD_DESC} hidden>
            {desc}
          </p>
        ) : null}
        <div className={SITEMAP_CLASSES.SITEMAP_CARD_LOCALES}>
          {node.children.map((leaf) => (
            <a
              key={leaf.href}
              className={SITEMAP_CLASSES.SITEMAP_LOCALE}
              href={leaf.href}
              hreflang={leaf.locale!.toLowerCase()}
              {...(leaf.tip ? { title: leaf.tip } : {})}
            >
              {leaf.label}
            </a>
          ))}
        </div>
      </div>
    )
  }

  /**
   * JSX template — h1 + intro, then the DOM link index: nested groups →
   * pages → locale/media chips, every anchor SPA-routed on plain clicks.
   * Collapsible groups (media walls) mount their children on first open.
   */
  override render() {
    const page =
      this._page || (FALLBACK_PAGES[TRANSLATION_KEYS.SITEMAP] as SitemapPageNode | undefined) || {}

    const tree = buildSitemapTree(this._page, this._projects, this._shares())

    // The user-toggle spin request — consumed here so only the render a
    // real toggle produced stamps the animation on its chevron.
    const spinKey = this._spinKey

    this._spinKey = null

    const LegalFooter = COMPONENT_TAGS.LEGAL_FOOTER

    const linkClick = (e: Event): void => {
      if (!isPlainClick(e)) return

      const a = (e.target as Element | null)?.closest?.(HTML_TAGS.A) as Element | null

      const href = a?.getAttribute('href')

      if (!href || !href.startsWith('/')) return

      e.preventDefault()

      router.push(href)
    }

    const wallFor = (group: SitemapNode) => {
      const packed = this._packGroup(group)

      return (
        <div
          id={`${APP_IDS.SITEMAP_GROUP_PREFIX}${group.key!}`}
          className={SITEMAP_CLASSES.SITEMAP_WALL}
          style={{
            position: STATE_STRINGS.RELATIVE,
            width: CHAR_STRINGS.PERCENT_100,
            height: `${packed?.height || 0}${CHAR_STRINGS.PX}`,
          }}
        >
          {packed
            ? group.children.map((node, i) => this._mediaCard(node, packed.tiles[i]!.tile))
            : null}
        </div>
      )
    }

    return (
      <article>
        <div id={APP_IDS.MAIN} className={SITEMAP_CLASSES.SITEMAP}>
          <h1 className={SITEMAP_CLASSES.SITEMAP_TITLE}>
            {page.title || String(appText(SECTION_UI_KEYS.SITEMAP) || CHAR_STRINGS.EMPTY)}
          </h1>
          {page.intro ? <p className={SITEMAP_CLASSES.SITEMAP_INTRO}>{page.intro}</p> : null}

          {/* Locale legend — decodes the uppercase chip codes (EN, BR,
              HRK, …) into their language names, matching LANG_OPTIONS
              order so the abbreviations never drift from the picker. */}
          <fieldset className={SITEMAP_CLASSES.SITEMAP_LANGS}>
            <legend className={SITEMAP_CLASSES.SITEMAP_LANGS_TITLE}>{LABEL_TEXT.LEGEND}</legend>
            <ul className={SITEMAP_CLASSES.SITEMAP_LANGS_LIST}>
              {LANG_OPTIONS.map((opt) => (
                <li key={opt.code} className={SITEMAP_CLASSES.SITEMAP_LANG}>
                  <span className={SITEMAP_CLASSES.SITEMAP_LANG_CODE}>
                    {opt.code.toUpperCase()}
                  </span>
                  {`${CHAR_STRINGS.SPACE_CHAR}${CHAR_STRINGS.EM_DASH}${CHAR_STRINGS.SPACE_CHAR}`}
                  <span className={SITEMAP_CLASSES.SITEMAP_LANG_NAME}>{opt.label}</span>
                </li>
              ))}
            </ul>
          </fieldset>

          <nav
            className={SITEMAP_CLASSES.SITEMAP_INDEX}
            aria-label={String(appText(SECTION_UI_KEYS.SITEMAP) || CHAR_STRINGS.EMPTY)}
            onClick={linkClick}
          >
            {tree.children.map((group) => {
              const groupKey = group.key!

              const open = this._openGroups.has(groupKey)

              const groupClass = [
                SITEMAP_CLASSES.SITEMAP_GROUP,
                group.mosaic ? SITEMAP_CLASSES.SITEMAP_GROUP_MOSAIC : CHAR_STRINGS.EMPTY,
                group.wide ? SITEMAP_CLASSES.SITEMAP_GROUP_WIDE : CHAR_STRINGS.EMPTY,
              ]
                .filter(Boolean)
                .join(CHAR_STRINGS.SPACE_CHAR)

              return (
                <section key={groupKey} className={groupClass}>
                  <h2 className={SITEMAP_CLASSES.SITEMAP_GROUP_TITLE}>
                    {group.collapsible ? (
                      <button
                        className={SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}
                        type={FORM_ATTRS.BUTTON}
                        aria-expanded={open ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE}
                        aria-controls={`${APP_IDS.SITEMAP_GROUP_PREFIX}${groupKey}`}
                        onClick={() => this._toggleGroup(groupKey)}
                      >
                        {group.label}
                        <svg
                          className={[
                            SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON,
                            spinKey === groupKey
                              ? open
                                ? SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON_SPIN_OPEN
                                : SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON_SPIN_CLOSE
                              : CHAR_STRINGS.EMPTY,
                          ]
                            .filter(Boolean)
                            .join(CHAR_STRINGS.SPACE_CHAR)}
                          viewBox="0 0 40 40"
                          aria-hidden={ATTR_VALUES.TRUE}
                        >
                          <path d="M16 12 L26 20 L16 28" />
                        </svg>
                      </button>
                    ) : (
                      group.label
                    )}
                  </h2>
                  {group.collapsible && !open ? (
                    // Persistent aria-controls target — the wall mounts
                    // lazily on first open, so the region id lives on an
                    // always-rendered placeholder; `hidden` keeps the
                    // empty disclosure region out of the flex layout.
                    <div id={`${APP_IDS.SITEMAP_GROUP_PREFIX}${groupKey}`} hidden />
                  ) : group.mosaic ? (
                    wallFor(group)
                  ) : (
                    group.children.map((pageNode) => (
                      <div key={pageNode.label} className={SITEMAP_CLASSES.SITEMAP_PAGE}>
                        {/* Heading per page — AT heading-jump contract, same as
                            the footers' legal links. */}
                        <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                          {pageNode.label}
                        </h3>
                        <a
                          className={SITEMAP_CLASSES.SITEMAP_PAGE_LINK}
                          href={pageNode.href}
                          {...{ [DATA_ATTRS.PRINT_LINK]: ATTR_VALUES.EMPTY }}
                        >
                          {pageNode.label}
                        </a>
                        <div className={SITEMAP_CLASSES.SITEMAP_LOCALES}>
                          {pageNode.children.map((leaf) => (
                            <a
                              key={leaf.href}
                              className={SITEMAP_CLASSES.SITEMAP_LOCALE}
                              href={leaf.href}
                              hreflang={leaf.locale!.toLowerCase()}
                            >
                              {leaf.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </section>
              )
            })}
          </nav>
        </div>

        <LegalFooter />
      </article>
    )
  }
}

if (!customElements.get(VIEW_TAGS.VIEW_SITEMAP)) {
  customElements.define(VIEW_TAGS.VIEW_SITEMAP, ViewSitemap)
}
