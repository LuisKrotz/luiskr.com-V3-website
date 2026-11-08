/**
 * @file MediaMosaic.js
 * @description <media-mosaic> — the internals natural-size masonry wall:
 * packs a project section's media into a true skyline masonry (each tile
 * keeps its own natural size — intrinsic/3, /4 when still too wide for the
 * wall, /2 or undivided when too small for the expand trigger) instead of
 * flattening wildly different heights into a carousel strip. At ≤1024px
 * it swaps to the regular <custom-carousel>, configured exactly like the
 * project binder's own. Behavior lives in mosaic/{types,pack,layout,
 * events,render} — this facade keeps the state + configure() contract.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { BaseComponent } from '@core/Component.js'
import { h } from '@core/jsx.js'
import { bindMediaMosaicEvents } from './mosaic/events.js'
import { relayout, scheduleLayout } from './mosaic/layout.js'
import { renderMediaMosaic } from './mosaic/render.js'
import type { CarouselLikeElement, MediaMosaicItem, MosaicTileStyle } from './mosaic/types.js'
import mediaMosaicStyles from '@core/sass/components/media/media-mosaic.scss?tiers'
import '@website/components/carousel/CustomCarousel.js'

/**
 * <media-mosaic> element — packs project-section media at natural sizes.
 * Exposes the same configure({items, folder, forceActive}) contract as
 * <custom-carousel> so the project binder treats both tags identically;
 * forceActive only forwards to the embedded carousel on the ≤1024px path.
 */
export class MediaMosaic extends BaseComponent {
  /** Media rows pushed by the view (intrinsic `size` drives the pack). */
  _items: MediaMosaicItem[] = []
  /** CDN folder prefix prepended to each item's src. */
  _folder: string = ATTR_VALUES.EMPTY
  /** Passthrough for the embedded carousel's forced-active flag. */
  _forceActive = false
  /** ≤1024px viewport flag — swaps the wall for <custom-carousel>. */
  _isCompact = false
  /** Width the current tiles were packed at — repack trigger on change. */
  _packedW = 0
  /** Last host width the ResizeObserver reported (sub-pixel dedup). */
  _lastObservedW = 0
  /** The ≤1024px media query — null where matchMedia is unavailable. */
  _mq: MediaQueryList | null = null
  /** Host ResizeObserver driving repacks on width changes. */
  _ro: ResizeObserver | null = null
  /** Pending layout RAF for debounced re-packs. */
  _rafId: number | null = null
  /** Computed per-tile style objects from the skyline pack. */
  tiles: MosaicTileStyle[] = []
  /** Packed wall height → container style. */
  wallH = `${CHAR_STRINGS.ZERO}${CHAR_STRINGS.PX}`

  constructor() {
    super(mediaMosaicStyles)
  }

  /** Slide data getter — parity with the carousel's items contract. */

  get items(): MediaMosaicItem[] {
    return this._items
  }

  /**
   * Batch-assigns items/folder/forceActive with a single render — mirrors
   * <custom-carousel>.configure so the project binder configures both
   * tags through one code path. Same array + same flags is a no-op.
   * @param {object} o
   * @param {Array} o.items Media descriptors (intrinsic `size` drives the pack).
   * @param {string} o.folder CDN folder prefix.
   * @param {boolean} o.forceActive Forwarded to the ≤1024px carousel only.
   */
  configure({
    items,
    folder,
    forceActive,
  }: {
    items?: MediaMosaicItem[]
    folder?: string
    forceActive?: boolean
  }): void {
    const sameItems = this._items === items

    const sameFlags =
      this._folder === (folder || ATTR_VALUES.EMPTY) &&
      Boolean(forceActive) === Boolean(this._forceActive)

    if (sameItems && sameFlags) return

    this._folder = folder || ATTR_VALUES.EMPTY

    this._forceActive = Boolean(forceActive)

    this.items = items
  }

  /** Setter/getter — media rows (new data repacks at the next pass). */

  set items(val: unknown) {
    this._items = Array.isArray(val) ? (val as MediaMosaicItem[]) : []

    this._packedW = 0

    if (this._isMounted) {
      this.relayout()

      this._updateDom()
    }
  }

  /** CDN media folder prefix. */

  get folder(): string {
    return this._folder
  }

  /** Lifecycle: binds the breakpoint query + host ResizeObserver. */

  override onMounted() {
    bindMediaMosaicEvents(this)
  }

  /** Lifecycle: releases the pending RAF + observer. */

  override onDestroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId)

    this._rafId = null

    this._ro?.disconnect()

    this._ro = null
  }

  /**
   * Post-render pass: on the compact path the freshly rendered carousel
   * gets the same configure payload the binder would send; on the wall
   * path a relayout repacks if the measured width moved (applyTileStyles
   * re-stamps inline styles on rebuilt DOM).
   */
  override onUpdated() {
    if (this._isCompact) {
      this._syncCarousel()

      return
    }

    this.relayout()
  }

  /** Immediate repack — measure → pack → apply (see mosaic/layout.ts). */

  relayout(): void {
    relayout(this)
  }

  /** Debounced repack (resize/data changes). */

  scheduleLayout(): void {
    scheduleLayout(this)
  }

  /**
   * Pushes the binder's payload into the embedded <custom-carousel> —
   * forceActive forwards verbatim so the mobile strip behaves exactly
   * like a view-rendered one (>2 items or all-landscape keeps the track).
   */
  _syncCarousel(): void {
    const el = this.$<CarouselLikeElement>(COMPONENT_TAGS.CUSTOM_CAROUSEL)

    el?.configure({
      items: this._items,
      folder: this._folder,
      forceActive: this._forceActive,
    })
  }

  /** JSX template — see mosaic/render.tsx (wall vs compact carousel). */

  override render() {
    return renderMediaMosaic(this)
  }
}

if (!customElements.get(COMPONENT_TAGS.MEDIA_MOSAIC)) {
  customElements.define(COMPONENT_TAGS.MEDIA_MOSAIC, MediaMosaic)
}
