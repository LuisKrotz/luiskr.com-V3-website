/**
 * @file portfolio/Related.js
 * @description <portfolio-related> — "related projects" strip at the
 * bottom of project pages: a <custom-carousel> of sibling portfolio items
 * from the projects list.
 *
 * Facade — types/matcher/fetch/JSX live in ./related/.
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h } from '@core/jsx.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { buildProjectsList } from './related/match.js'
import { fetchData, storedTranslations } from './related/data.js'
import { renderRelated } from './related/render.js'
import { mountDividerSheen } from '@core/utils/gpu/divider-sheen.js'
import { mountRingSheen } from '@core/utils/gpu/ring-sheen.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import type { RingSheenSession } from '@core/utils/gpu/ring-sheen.js'
import type { HomeItem, RelatedCard, RelatedTranslations } from './related/types.js'
import internalStyles from '@core/sass/components/internals/internals.scss?inline'
import '@website/components/media/DrawText.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'

/**
 * The PortfolioRelated — related class.
 */
export class PortfolioRelated extends BaseComponent {
  translations: RelatedTranslations = {}

  homePortfolio: HomeItem[] = []

  _unsubRouter: (() => void) | null = null

  _noteOpen = false // disclaimer expand state (clamped to its first line)

  _noteTruncated = false // true while the clamped note overflows its line

  _noteEl: Element | null = null // last note button the observer bound to

  _noteRO: ResizeObserver | null = null

  _measureRaf = 0 // pending rAF handle — debounces note truncation measures

  _dividerTeardowns: (() => void)[] = [] // live divider-sheen mounts (re-bound per render)

  _ringSession: RingSheenSession | null = null // live ring-sheen overlay on the card strip

  _ringEl: Element | null = null // the .related-mosaic node the ring session mounted on

  _loadedCovers = new Map<string, string>() // cover key → highest confirmed painted tier — re-renders re-emit it loaded

  constructor() {
    super(internalStyles)
  }

  /** Toggles the clamped footer disclaimer between one-line and full text. */

  _toggleNote(): void {
    this._noteOpen = !this._noteOpen
    this._updateDom()
  }

  /**
   * Detects whether the clamped note actually overflows — CSS cannot
   * detect line-clamp truncation, so scrollHeight vs clientHeight does
   * it here. The flag drives the `is-truncated` class that reveals the
   * pulsing "···" affordance; measured only while collapsed (open state
   * is unclamped by definition, and the affordance hides anyway).
   */
  _measureNote(): void {
    const textEl = this.$(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_TEXT}`)

    if (!textEl || this._noteOpen) return

    // Skip transient zero-height reads (element hidden/not yet laid out)
    // — they report as truncated and ping-pong the flag on the next render.
    if (textEl.clientHeight === 0) return

    const truncated = textEl.scrollHeight > textEl.clientHeight + 1

    if (truncated !== this._noteTruncated) {
      this._noteTruncated = truncated
      this._updateDom()
    }
  }

  /**
   * Schedules a single truncation measure on the next animation frame.
   * Reads inside rAF hit clean layout, so the scrollHeight query costs
   * ~0; running it synchronously on every onUpdated/RO tick forced a
   * whole-document layout per call (the scroll-jank source profiles
   * flagged). Bursts (render → RO fire → render) collapse into one read.
   */
  _queueNoteMeasure(): void {
    if (this._measureRaf) return

    this._measureRaf = requestAnimationFrame(() => {
      this._measureRaf = 0
      this._measureNote()
    })
  }

  /**
   * Binds a ResizeObserver to the note button so font loads, viewport
   * resizes and locale swaps re-evaluate truncation. The element is
   * recreated on every render, so the observer re-binds whenever the
   * node identity changes instead of watching a detached element.
   */
  _watchNoteTruncation(): void {
    const noteEl = this.$(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE}`)

    if (!noteEl) {
      this._noteEl = null
      return
    }

    this._queueNoteMeasure()

    if (typeof ResizeObserver === TYPE_STRINGS.UNDEFINED || this._noteEl === noteEl) return

    this._noteRO?.disconnect()

    this._noteEl = noteEl

    this._noteRO = new ResizeObserver(() => this._queueNoteMeasure())

    this._noteRO.observe(noteEl)
  }

  /** CDN base URL for project media. */

  get storage() {
    return store.getters.getStorage() || CDN_URLS.CDN_BASE
  }

  /**
   * Maps the DB `related.projects` rows into display-ready cards — see
   * related/match.ts for the fuzzy link/image/title join against the
   * home portfoliolist.
   */
  get projectsList(): RelatedCard[] {
    return buildProjectsList(this.translations, this.homePortfolio, this.storage)
  }

  /**
   * Lifecycle: seeds translations from the store (they may already be
   * loaded by the view), kicks the SWR fetch for the two DB nodes it
   * needs, and subscribes to the router — navigating between projects
   * re-runs the fuzzy match against the new page's related list.
   */
  override onMounted() {
    this.subscribe(store)

    this._unsubRouter = router.subscribe(() => {
      this._updateDom()
    })

    if (!this.translations?.title) {
      this.translations = storedTranslations()
    }

    this.fetchData()
  }

  /** Lifecycle: removes the router subscription + the note observer. */
  override onDestroy() {
    this._dividerTeardowns.forEach((teardown) => teardown())

    this._dividerTeardowns = []

    this._ringSession?.destroy()

    this._ringSession = null
    this._ringEl = null

    if (typeof this._unsubRouter === TYPE_STRINGS.FUNCTION) {
      this._unsubRouter?.()

      this._unsubRouter = null
    }

    this._noteRO?.disconnect()

    this._noteRO = null

    this._noteEl = null

    if (this._measureRaf) {
      cancelAnimationFrame(this._measureRaf)

      this._measureRaf = 0
    }
  }

  override onStoreUpdate() {
    if (!this.translations?.title) {
      this.translations = storedTranslations()
    }

    this._updateDom()
  }

  override onUpdated() {
    this._watchNoteTruncation()

    this._mountDividerSheen()

    this._syncRingSheen()

    this._syncAnimDescs()
  }

  /**
   * Binds animation descriptions to the animated nodes the render just
   * produced — every related tile's hover lift, and the disclaimer's
   * pulsing note-dots. Must run post-render (never in the JSX): the
   * desc node is injected per root, so applying on detached nodes
   * would spawn duplicate `lk-anim-desc-*` ids — a WCAG failure.
   * Re-rendered nodes are re-bound; idempotent on repeats.
   */
  _syncAnimDescs(): void {
    for (const tile of this.$$(`.${RELATED_CLASSES.RELATED_MOSAIC_ITEM}`)) {
      applyAnimationDesc(tile as Element, ANIMATION_IDS.RELATED_TILE)
    }

    for (const dots of this.$$(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_MORE}`)) {
      applyAnimationDesc(dots as Element, ANIMATION_IDS.NOTE_DOT)
    }
  }

  /**
   * Keeps the instanced ring-sheen overlay bound to the live
   * `.related-mosaic` node — renders recreate the strip, so a session
   * mounted on a detached node is torn down and remounted. Without
   * WebGPU the mount is a no-op and the CSS pseudo rings stay.
   */
  _syncRingSheen(): void {
    const el = this.$(`.${RELATED_CLASSES.RELATED_MOSAIC}`)

    if (el === this._ringEl) {
      this._ringSession?.refresh()

      return
    }

    this._ringSession?.destroy()

    this._ringSession = null
    this._ringEl = el

    if (el instanceof HTMLElement) {
      this._ringSession =
        mountRingSheen(
          el,
          `.${RELATED_CLASSES.RELATED_MOSAIC_ITEM}`,
          RELATED_CLASSES.RELATED_MOSAIC_RING_CANVAS
        ) || null
    }
  }

  /**
   * Re-mounts the divider-sheen WebGPU widgets on the footer's `<hr>`
   * dividers — the nodes are recreated on every render, so each update
   * disposes the stale mounts first (canvas + IO + rAF + widget).
   * Without `navigator.gpu` or under reduced-motion the mount helper
   * is a no-op and the CSS `::after` sweep stays the render path.
   */
  _mountDividerSheen(): void {
    this._dividerTeardowns.forEach((teardown) => teardown())

    this._dividerTeardowns = []

    for (const hr of this.$$(`hr.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER}`)) {
      this._dividerTeardowns.push(
        mountDividerSheen(hr as HTMLElement, INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER_CANVAS)
      )
    }
  }

  /**
   * Fires two SWR reads in parallel: the home page node (for the
   * portfoliolist join table) and the components/related node — see
   * related/data.ts.
   */
  fetchData(): void {
    fetchData(this)
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    return renderRelated(this)
  }
}

if (!customElements.get(COMPONENT_TAGS.PORTFOLIO_RELATED)) {
  customElements.define(COMPONENT_TAGS.PORTFOLIO_RELATED, PortfolioRelated)
}
