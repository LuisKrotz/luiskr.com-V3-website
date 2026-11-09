/**
 * @file carousel-sizing.ts
 * @description Fit/height measurement for CustomCarousel — the
 * ResizeObserver that re-fits slides, the side-by-side fit projection
 * (≤2 items, no landscape, ≥960px viewport, total width ≤ host), and the
 * --carousel-item-height publisher that keeps every slide the same
 * aspect-corrected height.
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { CAROUSEL_CSS_PROPS } from '@core/tokens/css/carousel.js'
import { SPACE } from '@core/tokens/layout/space.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { calcMediaBox } from '@core/utils/wasm/wasm-layout.js'
import type { CustomCarousel } from '../CustomCarousel.js'
import type { CarouselItem } from './render.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { INTERNAL_MOSAIC } from '@core/tokens/layout/masonry.js'

/**
 * Wires a ResizeObserver on the host that re-runs _measureFit on width
 * changes. Reports under FIT_EPS_PX of the last width are dropped —
 * scrollbars appearing/disappearing and sub-pixel reflow would otherwise
 * re-fit on every layout pass. The measurement defers one RAF so it runs
 * post-layout, and ResizeObserver absence (old engines) degrades to the
 * one-shot window-resize path.
 * @param c The CustomCarousel element.
 */
export function startFitObserver(c: CustomCarousel) {
  if (typeof ResizeObserver === TYPE_STRINGS.UNDEFINED) return

  c._fitObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width || 0

    if (Math.abs(width - (c._lastObservedWidth || 0)) < CAROUSEL_LAYOUT.FIT_EPS_PX) return

    c._lastObservedWidth = width

    requestAnimationFrame(() => {
      c._measureFit(width)

      // Fresh task — lets the unsized-fallback branch of setHeightVar
      // republish once the RO has delivered a real host width.
      c._setHeightVar()
    })
  })

  c._fitObserver.observe(c)
}

/**
 * Decides whether the items fit side-by-side (no carousel chrome) or need
 * the scroll track. Side-by-side requires: ≤2 items, viewport
 * ≥ SIDE_BY_SIDE_BREAKPOINT, and projected total width ≤ host width.
 * The projection mirrors the shadow-DOM contract in media-figure.scss +
 * carousel-host.scss exactly: the strip height is the same value
 * setHeightVar publishes to --carousel-media-height — the smallest item
 * rendered into hostW × 70dvh (calcMediaBox — WASM-backed, never
 * upscales); every slide's box is that strip height × the source's own
 * ratio (width: auto, no max-width cap in carousel context), floored at
 * min(MEDIA_MIN_WIDTH, naturalW); each item adds its breakpoint padding
 * + desktop side margin. Items missing intrinsic sizes use
 * GENERIC_DIMENSIONS defaults (conservative portrait) so a partial CMS
 * row can't silently flip to scroll mode.
 * @param c The CustomCarousel element.
 * @param observedWidth Fresh RO width when known — avoids a layout read.
 */
export function measureFit(c: CustomCarousel, observedWidth?: number) {
  const vw = typeof window !== TYPE_STRINGS.UNDEFINED ? window.innerWidth : 0

  // _forceActive pins the track below the ultrawide fit gate — carousels
  // are configured force-active for >2 items or landscape groups, but at
  // ≥3840 a set that honestly fits the host has no use for controls, so
  // the projection still runs there even for forced groups.
  if (c._forceActive && vw < CAROUSEL_LAYOUT.MULTI_FIT_MIN_VW) return

  if (c.items.length < 2) return

  // Groups with more than 2 items normally need the scroll track +
  // controls. The ≥3840 ultrawide exception: a handful of slides can't
  // fill the track — "fewer items than the viewport" — so the set falls
  // through to the shared fit projection below and, when every slide
  // projects inside the host, settles into the centered side-by-side
  // row with no carousel chrome at all.
  const multiFit = c.items.length > 2

  if (multiFit && vw < CAROUSEL_LAYOUT.MULTI_FIT_MIN_VW) {
    if (c._isSideBySide) {
      c._isSideBySide = false

      c._updateDom()

      c._setupAfterRender()
    }

    return
  }

  if (vw < CAROUSEL_LAYOUT.SIDE_BY_SIDE_BREAKPOINT) {
    if (c._isSideBySide) {
      c._isSideBySide = false

      c._updateDom()
    }

    return
  }

  const hostW = observedWidth || c.clientWidth || 0

  if (hostW <= 0) return

  // Past the <960 guard window is provably defined — vh reads directly.
  const vh = window.innerHeight

  const maxH = Math.round((vh * CAROUSEL_LAYOUT.MAX_HEIGHT_VH) / 100)

  // Strip height = what setHeightVar publishes on ≥960 viewports (never
  // the mobile branches): the SMALLEST item's honest fit into hostW ×
  // maxH — each source fit by calcMediaBox, the min kept — lifted only
  // when a source is natively narrower than MEDIA_MIN_WIDTH (the lift
  // lets that smallest-width slide reach the floor). >TALL_ITEM_H
  // sources follow their own sliver rule and stay out of the driver.
  let stripH = Infinity

  let smallestW = Infinity

  let smallestWAspect = Infinity

  for (const item of c.items) {
    const w = item.size?.[0] || GENERIC_DIMENSIONS.DEFAULT_WIDTH

    const h = item.size?.[1] || GENERIC_DIMENSIONS.ITEM_FALLBACK_HEIGHT

    stripH = Math.min(stripH, calcMediaBox(w, h, hostW, maxH).height)

    const naturalH = item.naturalSize?.[1] || h

    if (naturalH <= INTERNAL_MOSAIC.TALL_ITEM_H && w < smallestW) {
      smallestW = w

      smallestWAspect = w / h
    }
  }

  if (smallestW < CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH) {
    stripH = CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH / smallestWAspect
  }

  // Item horizontal padding (both sides) — the ≥960 projection always
  // lands on the ≥768 rung of the .internal-extra-item padding ladder.
  const itemPad = CAROUSEL_LAYOUT.ITEM_PAD_768

  // Desktop-only item side margins — only ≥1024 viewports pay them.
  const itemMargin = vw >= CAROUSEL_LAYOUT.ITEM_MARGIN_VW ? CAROUSEL_LAYOUT.ITEM_MARGIN_PX * 2 : 0

  let totalW = 0

  for (const item of c.items) {
    const w = item.size?.[0] || GENERIC_DIMENSIONS.DEFAULT_WIDTH

    const h = item.size?.[1] || GENERIC_DIMENSIONS.ITEM_FALLBACK_HEIGHT

    // CSS contract: the slide box is stripH × the source's intrinsic
    // ratio (height: var(--mf-h), width: auto). The only bound is
    // min-width: min(MEDIA_MIN_WIDTH, --mf-natural-w), resolved after
    // auto-width so the floor wins ties — a file narrower than the
    // floor keeps its natural width, never upscaled. On the ≥3840
    // multi-fit path the real --mf-w cap (--space-8xl) and the
    // --mf-natural-w cap DO bind inside the placeholder sheet for
    // portrait items, so they are mirrored here — over-projecting a
    // wide slide would reject a row that genuinely fits. Landscape
    // items render uncapped at full aspect width (the uniform-height
    // contract — a capped landscape box used to squash into a centre
    // sliver), so their honest projection is aspectW itself.
    const aspectW = Math.max(stripH * (w / h), Math.min(CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH, w))

    const mediaW = multiFit && !isLandscapeItem(item) ? Math.min(aspectW, SPACE['8XL'], w) : aspectW

    totalW += mediaW + itemPad + itemMargin + CAROUSEL_LAYOUT.ITEM_GAP_PX
  }

  const fits = totalW > 0 && totalW <= hostW

  const changed = fits !== c._isSideBySide

  if (changed) {
    c._isSideBySide = fits

    c._updateDom()

    if (!fits) {
      c._setupAfterRender()
    }
  }
}

/**
 * Window-resize handler — `isMobile` is a live getter so the resize path
 * only re-publishes the slide height.
 * @param c The CustomCarousel element.
 */
export function onCarouselResize(c: CustomCarousel) {
  c.isMobile =
    typeof window !== TYPE_STRINGS.UNDEFINED
      ? window.innerWidth < CAROUSEL_LAYOUT.SIDE_BY_SIDE_BREAKPOINT
      : false

  c._setHeightVar()
}

/**
 * Detects whether a slide item is landscape (by class or aspect ratio).
 * @param item Slide descriptor.
 * @returns true if the item represents landscape orientation.
 */
export function isLandscapeItem(item: CarouselItem | null | undefined): boolean {
  if (!item) return false

  if (item.size && item.size[0] > 0 && item.size[1] > 0) {
    return item.size[0] > item.size[1]
  }

  if (typeof item.src === TYPE_STRINGS.STRING && item.src.includes(STATE_STRINGS.MOBILE)) {
    return false
  }

  return item.class === STATE_STRINGS.LANDSCAPE
}

/**
 * Detects whether a slide item is portrait.
 * @param item Slide descriptor.
 * @returns true if the item represents portrait orientation.
 */
export function isPortraitItem(item: CarouselItem | null | undefined): boolean {
  if (!item) return false

  return !isLandscapeItem(item)
}

/**
 * Evaluates whether the carousel contains a mix of both landscape and portrait items.
 * @param items List of slide descriptors.
 * @returns true if both landscape and portrait items are present.
 */
export function isMixedCarousel(items: CarouselItem[]): boolean {
  if (!Array.isArray(items) || items.length < 2) return false

  const hasLandscape = items.some((it) => isLandscapeItem(it))

  const hasPortrait = items.some((it) => isPortraitItem(it))

  return hasLandscape && hasPortrait
}

/**
 * Calculates the majority landscape aspect ratio key ('16:9' | '21:9' | '32:9') among the
 * landscape items in the list. Compares each item's width/height ratio against the 16:9,
 * 21:9, and 32:9 target ratios and selects the mode (majority proportion).
 * @param items List of slide descriptors.
 * @returns The majority aspect ratio key ('16:9', '21:9', '32:9'), or null if no landscape items.
 */
export function determineLandscapeRatio(items: CarouselItem[]): string | null {
  if (!Array.isArray(items) || items.length === 0) return null

  const landscapeItems = items.filter((it) => isLandscapeItem(it))

  if (landscapeItems.length === 0) return null

  let count16 = 0

  let count21 = 0

  let count32 = 0

  for (const item of landscapeItems) {
    if (item.size && item.size[0] > 0 && item.size[1] > 0) {
      const r = item.size[0] / item.size[1]

      const diff16 = Math.abs(r - CAROUSEL_LAYOUT.RATIO_16_9)

      const diff21 = Math.abs(r - CAROUSEL_LAYOUT.RATIO_21_9)

      const diff32 = Math.abs(r - CAROUSEL_LAYOUT.RATIO_32_9)

      if (diff32 < diff21 && diff32 < diff16) {
        count32++
      } else if (diff21 < diff16) {
        count21++
      } else {
        count16++
      }
    } else {
      count16++
    }
  }

  if (count32 > count21 && count32 > count16) {
    return CAROUSEL_LAYOUT.ASPECT_RATIO_32_9
  }

  if (count21 > count16 && count21 >= count32) {
    return CAROUSEL_LAYOUT.ASPECT_RATIO_21_9
  }

  return CAROUSEL_LAYOUT.ASPECT_RATIO_16_9
}

/**
 * Returns the numeric multiplier (w/h) for a given aspect ratio key.
 * @param ratio Aspect ratio key ('16:9' | '21:9' | '32:9').
 * @returns Numeric ratio (e.g. 16/9, 21/9, 32/9).
 */
export function getRatioMultiplier(ratio: string | null): number {
  if (ratio === CAROUSEL_LAYOUT.ASPECT_RATIO_32_9) return CAROUSEL_LAYOUT.RATIO_32_9

  if (ratio === CAROUSEL_LAYOUT.ASPECT_RATIO_21_9) return CAROUSEL_LAYOUT.RATIO_21_9

  return CAROUSEL_LAYOUT.RATIO_16_9
}

/**
 * Calculates the smallest portrait aspect ratio (height / width) among portrait items.
 * Used in mixed carousels to anchor the uniform carousel height on mobile to the
 * shortest portrait item.
 * @param items List of slide descriptors.
 * @returns Smallest portrait height-to-width ratio, or null if no portrait items with sizes.
 */
export function getSmallestPortraitRatio(items: CarouselItem[]): number | null {
  if (!Array.isArray(items) || items.length === 0) return null

  const portraitItems = items.filter((it) => isPortraitItem(it))

  if (portraitItems.length === 0) return null

  let minRatio: number | null = null

  for (const item of portraitItems) {
    if (item.size && item.size[0] > 0 && item.size[1] > 0) {
      const ratio = item.size[1] / item.size[0]

      if (ratio <= 3 && (minRatio === null || ratio < minRatio)) {
        minRatio = ratio
      }
    }
  }

  if (minRatio === null) {
    for (const item of portraitItems) {
      if (item.size && item.size[0] > 0 && item.size[1] > 0) {
        const ratio = item.size[1] / item.size[0]

        if (minRatio === null || ratio < minRatio) {
          minRatio = ratio
        }
      }
    }
  }

  return minRatio
}

/**
 * Publishes --carousel-item-height on the enclosing <section> and
 * --carousel-media-height on the host: the aspect-corrected height
 * ensuring all slides share one uniform height. The uniform height is
 * the SMALLEST rendered item — the min height each sized source reaches
 * when fit to the strip width and the viewport cap — so siblings shrink
 * to it and no source upscales. The only upscale the contract allows is
 * the floor correction: when a source is natively narrower than
 * MEDIA_MIN_WIDTH, the strip lifts just enough for that smallest-width
 * slide to reach the floor (equal heights wins). Sources taller than
 * TALL_ITEM_H keep their own sliver/floor rule and stay out of the
 * width driver. Every slide's box is the strip height ×
 * its own aspect (the media-figure sheet drops the natural-size caps in
 * carousel context), so the media fills with zero crop and zero
 * distortion. In mixed carousels on mobile, the uniform height anchors
 * to the shortest portrait item.
 * @param c The CustomCarousel element.
 */
export function setHeightVar(c: CustomCarousel) {
  const minPortraitRatio = c.isMobile && c.isMixed ? getSmallestPortraitRatio(c.items) : null

  const landscapeMultiplier =
    c.isMobile && !c.isMixed && c.landscapeRatio ? getRatioMultiplier(c.landscapeRatio) : null

  const anySized = c.items?.some((item) => item?.size?.[0] && item?.size?.[1])

  const unsizedFallback = minPortraitRatio === null && landscapeMultiplier === null && !anySized

  // Unsized sets still need ONE strip height — publishing nothing leaves
  // every slide at `height:auto` (natural aspect), the ragged-heights bug
  // on strips mixing e.g. a video thumb and images. The fallback uses the
  // RO-cached host width ONLY: no clientWidth/innerWidth/innerHeight read
  // — this path runs inside dirty render tasks where any layout read is a
  // forced-reflow violation. CSS already clamps the slide box to the
  // 70dvh - pad ceiling via max-height, so the JS value needs no viewport
  // cap; before the first RO delivery the ~70dvh --mf-h placeholder keeps
  // the row uniform and the RO pass republishes once a width exists.
  if (unsizedFallback) {
    const cachedW = c._lastObservedWidth || 0

    if (cachedW <= 0) return

    publishStripHeight(c, Math.round(cachedW / CAROUSEL_LAYOUT.RATIO_16_9))

    return
  }

  const hostW =
    c.clientWidth ||
    (typeof window !== TYPE_STRINGS.UNDEFINED
      ? window.innerWidth
      : GENERIC_DIMENSIONS.DEFAULT_WIDTH)

  const maxH =
    typeof window !== TYPE_STRINGS.UNDEFINED
      ? Math.round((window.innerHeight * CAROUSEL_LAYOUT.MAX_HEIGHT_VH) / 100)
      : GENERIC_DIMENSIONS.ITEM_FALLBACK_HEIGHT

  const vw = typeof window !== TYPE_STRINGS.UNDEFINED ? window.innerWidth : 0

  // ≤1024 bands never render a slide past HALF the source's own pixels
  // (the "forced to 100%" bug fix): the placeholder sheet caps every
  // figure at natural/2 there, so the projection mirrors it by fitting
  // each item's halved box. The published strip stays reachable by the
  // biggest item — uniform where sources allow, never upscaled.
  const halfBound = vw > 0 && vw <= CAROUSEL_LAYOUT.HALF_NATURAL_MAX_VW

  const fitScale = halfBound ? CAROUSEL_LAYOUT.HALF_NATURAL_SCALE : 1

  // Uniform strip = the SMALLEST item's honest fit — every sibling
  // shrinks to it, so the row keeps equal heights with zero upscale.
  // calcMediaBox mirrors the CSS contract (fit hostW × maxH, never
  // upscale), so the min over the sized items is the shortest box the
  // strip can reach without any source stretching past its pixels.
  // Sources taller than TALL_ITEM_H (full-page screenshots) already
  // render by their own sliver/floor rule and are excluded from the
  // smallest-width driver — their extreme aspect would otherwise pin
  // the correction at an absurd strip height.
  let smallest = Infinity

  let fitMax = 0

  let smallestW = Infinity

  let smallestWAspect = Infinity

  for (const item of c.items) {
    const w = item?.size?.[0] || 0

    const h = item?.size?.[1] || 0

    if (!w || !h) continue

    const fit = calcMediaBox(w * fitScale, h * fitScale, hostW, maxH)

    smallest = Math.min(smallest, fit.height)

    fitMax = Math.max(fitMax, fit.height)

    const naturalH = item?.naturalSize?.[1] || h

    if (naturalH <= INTERNAL_MOSAIC.TALL_ITEM_H && w < smallestW) {
      smallestW = w

      smallestWAspect = w / h
    }
  }

  const projected =
    minPortraitRatio !== null
      ? hostW * minPortraitRatio
      : landscapeMultiplier !== null
        ? hostW / landscapeMultiplier
        : smallest

  // Min-width correction: fires only when a source is natively narrower
  // than the MEDIA_MIN_WIDTH floor — the strip then lifts until that
  // smallest-width slide reaches the floor (equal heights wins). Every
  // other set keeps the smallest-height anchor and lets the CSS floor
  // crop sub-floor boxes instead of upscaling the whole row.
  const corrected =
    smallestW < CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH
      ? CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH / smallestWAspect
      : projected

  // A vw-anchored target can't exceed what the biggest item can honestly
  // render under the half-natural cap — clamp to the tallest half-fit
  // (skipped when no item carries sizes: fitMax would pin the strip to 0).
  const bounded = halfBound && fitMax > 0 ? Math.min(corrected, fitMax) : corrected

  // bounded is always finite here — unsized sets (smallest=Infinity)
  // exit through the unsizedFallback branch above.
  publishStripHeight(c, Math.min(Math.round(bounded), maxH))
}

/**
 * Publishes the uniform strip height on the host (--carousel-media-height)
 * and the enclosing section (--carousel-item-height), skipping no-op
 * writes so repeat calls never touch the style declaration twice.
 * @param c The CustomCarousel element.
 * @param finalH Strip height in px.
 */
function publishStripHeight(c: CustomCarousel, finalH: number) {
  const finalHPx = `${finalH}${COMMON_ATTRS.PX}`

  const currentMediaH = c.style.getPropertyValue(CAROUSEL_CSS_PROPS.CAROUSEL_MEDIA_HEIGHT)

  if (currentMediaH !== finalHPx) {
    c.style.setProperty(CAROUSEL_CSS_PROPS.CAROUSEL_MEDIA_HEIGHT, finalHPx)
  }

  const section = c.closest(COMMON_ATTRS.SECTION)

  if (section) {
    const currentH = section.style.getPropertyValue(CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT)

    if (currentH !== finalHPx) {
      section.style.setProperty(CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT, finalHPx)
    }
  }
}
