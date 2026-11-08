/**
 * @file Project.js
 * @description <view-project> — the portfolio detail route: hero cover,
 * case-study sections (media + copy blocks), awards, and the related
 * carousel. Owns the full-screen expand modal (dialog.above/below) with
 * genie zoom from the triggering media, the project JSON-LD graph, and
 * auto-open of media via ?open= deep links. Behavior lives in
 * project/{types,data,modal,modal-dom,layout,carousels,render} — this
 * facade keeps the lifecycle + test-facing method surface.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import type { RouteDescriptor } from '@core/router/router.js'
import internalStyles from '@core/sass/components/internals/internals.scss?inline'
import modalStyles from '@core/sass/components/internals/modal.scss?inline'
import { bindProjectCarousels } from './carousels.js'
import { initProject, loadData, onRouteParamChange, updateRobotsMeta } from './data.js'
import {
  fitDescriptionSizes,
  isLandscapeGroup,
  isMosaicGroup,
  sectionItemHeight,
  sectionMosaicHeight,
  syncTitleMarquee,
  textDelay,
  textOffset,
} from './layout.js'
import { checkAutoOpenModal } from './modal.js'
import { onProjectStoreUpdate, updateModalDOM } from './modal-dom.js'
import { renderProject } from './render.js'
import type { ProjectTranslations, SectionChild } from './types.js'
import '@website/components/media/DrawText.js'
import '@website/components/media/MediaFigure.js'
import '@website/components/media/MediaExpanded.js'
import '@website/components/carousel/CustomCarousel.js'
import '@website/components/media/MediaMosaic.js'
import '@website/components/portfolio/Related.js'
import '@website/components/legal/Footer.js'
import { SCROLL_TIMINGS } from '@core/tokens/media/dimensions.js'
import { TITLE_MARQUEE } from '@core/tokens/motion/marquee.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'

/** View-local type re-exports — canonical definitions + docs live in ./types.js. */
export type { CustomCarouselElement, ProjectMediaItem, SectionChild } from './types.js'

/**
 * The ViewProject — project class.
 */
export class ViewProject extends BaseComponent {
  translations: ProjectTranslations | null = null // the project node: title, cover, sections, folder
  projectSlug: string = ATTR_VALUES.EMPTY // route param / URL-derived slug being displayed
  _lastLocale: string | null = null
  _bindIdle: number | null = null // pending idle-deferred carousel batch handle
  _titleRepeat: number = TITLE_MARQUEE.MIN_REPEAT // title units per marquee half (viewport-sized)
  _descFitObserver: ResizeObserver | null = null // refits description promotions on reveal/resize
  _descFontsWired = false // fonts.ready refit armed once — font metrics can flip the verdict

  constructor() {
    super(`${internalStyles}\n${modalStyles}`)
  }

  /** The store's modal descriptor. */

  get modal() {
    return store.getters.getModal()
  }

  /** Lifecycle: loads project data and binds observers. */

  override onMounted() {
    this.subscribe(store)
    this.initProject()

    // Viewport width drives the marquee repetition count and the
    // description line-count promotions — re-fit both on resize.
    this.addScopedListener(
      window,
      WINDOW_EVENTS.RESIZE,
      () =>
        requestAnimationFrame(() => {
          this._syncTitleMarquee()

          this._fitDescriptionSizes()
        }),
      { passive: true }
    )

    setTimeout(() => {
      window.scrollTo(0, 0)
    }, SCROLL_TIMINGS.SCROLL_INIT_DELAY)
  }

  /** Lifecycle: tears down listeners + WebGL close widget. */

  override onDestroy() {
    this.updateRobotsMeta(false)

    this._descFitObserver?.disconnect()

    this._descFitObserver = null
  }

  /** Toggles the noindex meta for draft/hidden projects. */

  updateRobotsMeta(noindex: boolean): void {
    updateRobotsMeta(noindex)
  }

  /**
   * Reserves a section's media height BEFORE the carousel mounts: the
   * same formula the carousel uses — first item's aspect ratio × 100vw,
   * capped at the skeleton height — emitted as a CSS `min()` into
   * --carousel-item-height, so the description text below never shifts
   * when the real carousel takes over.
   */
  sectionItemHeight(section: SectionChild[]): string {
    return sectionItemHeight(this, section)
  }

  /** Router hook — project→project navigations reload data without remounting. */

  onRouteParamChange(to: RouteDescriptor | null): void {
    onRouteParamChange(this, to)
  }

  /** Re-syncs modal DOM + reloads on locale change. */

  override onStoreUpdate() {
    onProjectStoreUpdate(this)
  }

  /**
   * Syncs the expand dialog imperatively (store → DOM, no re-render —
   * re-rendering would destroy every mounted carousel). See
   * project/modal-dom.tsx.
   */
  _updateModalDOM(): void {
    updateModalDOM(this)
  }

  /** Initializes the resolved project record for the current route. */

  initProject(): void {
    initProject(this)
  }

  /** Fetches the project node for the route's slug via SWR (optionally deferred). */

  loadData(wait: number | false = false): void {
    loadData(this, wait)
  }

  /**
   * Per-character delay that makes the whole text block land in a fixed
   * 1500ms budget: delay = 1500ms ÷ totalChars (via calcDrawTextDelay),
   * so a 3-word heading and a 300-char paragraph animate in the same
   * window — long copy gets fast chars, short copy gets deliberate ones.
   */
  textDelay(items: unknown): number {
    return textDelay(this, items)
  }

  /**
   * Cumulative start offset for the idx-th paragraph: sums the character
   * count of every preceding paragraph × the shared per-char delay, so
   * paragraph N starts exactly when N−1 finishes — the block reads as
   * one continuous type-in across <h3>/<p> boundaries.
   */
  textOffset(items: unknown, idx: number): number {
    return textOffset(this, items, idx)
  }

  /** Whether a media group renders in landscape layout. */

  isLandscapeGroup(group: unknown): boolean {
    return isLandscapeGroup(this, group)
  }

  /** Whether a media group's height variation swaps it to the mosaic wall. */

  isMosaicGroup(group: unknown): boolean {
    return isMosaicGroup(this, group)
  }

  /**
   * Mosaic-wall height estimate for a section — published on the section
   * wrapper as --media-mosaic-height so a deferred <media-mosaic> reserves
   * its final packed box (zero-CLS, same skyline math the component runs).
   */
  sectionMosaicHeight(section: SectionChild[]): string {
    return sectionMosaicHeight(this, section)
  }

  /** Post-render/resize pass: fits the title repetitions to the viewport and sizes the marquee duration. */

  _syncTitleMarquee(): void {
    syncTitleMarquee(this)
  }

  /**
   * Post-render/resize/reveal pass: stamps the single-paragraph
   * description promotions (--xl one-liner / --md longer) from measured
   * line counts. See project/layout.ts.
   */

  _fitDescriptionSizes(): void {
    fitDescriptionSizes(this)
  }

  /**
   * Deep-link opener: /portfolio/<project>/<media-slug> URLs (written by
   * MediaFigure.openModal) resolve the slug against every media item's
   * label and open that item in the expand modal — refresh/share of an
   * expanded image lands back on the expanded view.
   */
  checkAutoOpenModal(): void {
    return checkAutoOpenModal(this)
  }

  /** Initializes the section carousels after render. */

  _bindCarousels(): void {
    return bindProjectCarousels(this)
  }

  /** JSX template for the view's shadow DOM. */

  override render() {
    return renderProject(this)
  }

  /** Lifecycle: re-binds carousels/modal after re-render. */

  override onUpdated() {
    requestAnimationFrame(() => {
      this._bindCarousels()

      this._updateModalDOM()

      this._syncTitleMarquee()

      this._fitDescriptionSizes()
    })
  }
}

if (!customElements.get(VIEW_TAGS.VIEW_PROJECT)) {
  customElements.define(VIEW_TAGS.VIEW_PROJECT, ViewProject)
}
