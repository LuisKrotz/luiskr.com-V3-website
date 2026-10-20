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
import { CAROUSEL_SELECTORS } from '@core/tokens/selectors/carousel.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { calcMediaBox } from '@core/utils/wasm/wasm-layout.js'
import type { CustomCarousel } from '../CustomCarousel.js'
import type { CarouselItem } from './render.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'

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
    })
  })

  c._fitObserver.observe(c)
}

/**
 * Decides whether the items fit side-by-side (no carousel chrome) or need
 * the scroll track. Side-by-side requires: ≤2 items, viewport
 * ≥ SIDE_BY_SIDE_BREAKPOINT, and projected total width ≤ host width.
 * The projection mirrors the shadow-DOM contract in media-figure.scss +
 * carousel-host.scss exactly: strip height is --mf-h (70dvh minus a pad
 * under 1024, fixed $space-* steps above) clamped to the file's natural
 * height, media width is aspect-driven and capped by the regular gutter
 * cap, the landscape --mf-max-w ladder, AND the natural pixel width
 * (calcMediaBox — WASM-backed, never upscales), floored at
 * min(MEDIA_MIN_WIDTH, naturalW) on ≥375px viewports; each item adds its
 * breakpoint padding + desktop side margin. Items missing intrinsic
 * sizes use GENERIC_DIMENSIONS defaults (conservative portrait) so a
 * partial CMS row can't silently flip to scroll mode.
 * @param c The CustomCarousel element.
 * @param observedWidth Fresh RO width when known — avoids a layout read.
 */
export function measureFit(c: CustomCarousel, observedWidth?: number) {
  if (c._forceActive) return

  if (c.items.length < 2) return

  // Groups with more than 2 items always need the scroll track + controls.
  if (c.items.length > 2) {
    if (c._isSideBySide) {
      c._isSideBySide = false

      c._updateDom()

      c._setupAfterRender()
    }

    return
  }

  const vw = typeof window !== TYPE_STRINGS.UNDEFINED ? window.innerWidth : 0

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

  // --mf-h ladder (media-figure.scss / carousel-host.scss): 70dvh minus a
  // pad below 1024, fixed $space-* steps at 1024/1440/2560.
  const vh70 = Math.round((vh * CAROUSEL_LAYOUT.MAX_HEIGHT_VH) / 100)

  const stripH =
    vw >= 2560
      ? CAROUSEL_LAYOUT.STRIP_H_2560
      : vw >= 1440
        ? CAROUSEL_LAYOUT.STRIP_H_1440
        : vw >= CAROUSEL_LAYOUT.ITEM_MARGIN_VW
          ? CAROUSEL_LAYOUT.STRIP_H_1024
          : vh70 - CAROUSEL_LAYOUT.STRIP_SUB_TABLET

  // vw ≥ 960 > MEDIA_MIN_WIDTH_VW here — the 320px floor always applies.
  const mediaMinW = CAROUSEL_LAYOUT.MEDIA_MIN_WIDTH

  // Item horizontal padding (both sides) per breakpoint — mirrors the
  // .internal-extra-item padding-inline ladder; ≥960 always lands on the
  // ≥768 rung or above so the sub-768 default has no case here.
  const itemPad =
    vw >= 1920
      ? CAROUSEL_LAYOUT.ITEM_PAD_1920
      : vw >= 1440
        ? CAROUSEL_LAYOUT.ITEM_PAD_1440
        : CAROUSEL_LAYOUT.ITEM_PAD_768

  // Desktop-only item side margins — only ≥1024 viewports pay them.
  const itemMargin = vw >= CAROUSEL_LAYOUT.ITEM_MARGIN_VW ? CAROUSEL_LAYOUT.ITEM_MARGIN_PX * 2 : 0

  // Media max-width caps: landscape items use their own --mf-max-w ladder
  // at ≥1024; regular items get the viewport-gutter cap at ≥1024 and the
  // 90vw-minus-pad cap below.
  const landscapeCap =
    vw >= 1920
      ? vw - CAROUSEL_LAYOUT.LAND_CAP_SUB_1920
      : vw >= 1440
        ? vw - CAROUSEL_LAYOUT.LAND_CAP_SUB_1440
        : vw >= 1280
          ? vw - CAROUSEL_LAYOUT.LAND_CAP_SUB_1280
          : vw - CAROUSEL_LAYOUT.LAND_CAP_SUB_1024

  const regularCap =
    vw >= CAROUSEL_LAYOUT.ITEM_MARGIN_VW
      ? vw - CAROUSEL_LAYOUT.REG_CAP_SUB
      : vw * 0.9 - CAROUSEL_LAYOUT.STRIP_SUB_TABLET

  let totalW = 0

  for (const item of c.items) {
    const w = item.size?.[0] || GENERIC_DIMENSIONS.DEFAULT_WIDTH

    const h = item.size?.[1] || GENERIC_DIMENSIONS.ITEM_FALLBACK_HEIGHT

    const cap = item?.class === STATE_STRINGS.LANDSCAPE ? landscapeCap : regularCap

    // CSS contract: height is min(stripH, naturalH) with aspect-driven
    // width capped by the breakpoint cap AND by natural width — a box can
    // never exceed the source file's pixels. calcMediaBox yields
    // w·min(cap/w, stripH/h, 1), which is exactly that rendered width.
    const boxW = calcMediaBox(w, h, cap, stripH).width

    // CSS order: max-width clamps first, then min-width can override it.
    // The floor itself is min-width: min(320px, --mf-natural-w) — a file
    // narrower than 320px keeps its own natural width, never upscaled.
    const mediaW = Math.max(boxW, Math.min(mediaMinW, w))

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
 * ensuring all slides share one uniform height. In mixed carousels on
 * mobile, the uniform height anchors to the shortest portrait item.
 * The published height is also capped at the smallest natural item
 * height — the strip may be *less* tall than the projection, but no
 * slide may ever render taller than its source file's real pixels.
 * @param c The CustomCarousel element.
 */
export function setHeightVar(c: CustomCarousel) {
  const firstSlide = c.$(CAROUSEL_SELECTORS.CAROUSEL_SLIDES_NOT_CLONE)

  if (!firstSlide) return

  const firstItem = c.items?.[0]

  let slideH

  const hostW =
    c.clientWidth ||
    (typeof window !== TYPE_STRINGS.UNDEFINED
      ? window.innerWidth
      : GENERIC_DIMENSIONS.DEFAULT_WIDTH)

  const maxH =
    typeof window !== TYPE_STRINGS.UNDEFINED
      ? Math.round((window.innerHeight * CAROUSEL_LAYOUT.MAX_HEIGHT_VH) / 100)
      : GENERIC_DIMENSIONS.ITEM_FALLBACK_HEIGHT

  if (c.isMobile) {
    if (c.isMixed) {
      const minPortraitRatio = getSmallestPortraitRatio(c.items)

      if (minPortraitRatio !== null) {
        slideH = Math.round(hostW * minPortraitRatio)
      } else if (firstItem?.size?.[0] && firstItem?.size?.[1]) {
        slideH = Math.round(calcMediaBox(firstItem.size[0], firstItem.size[1], hostW, maxH).height)
      } else {
        slideH = firstSlide.clientHeight || 0
      }
    } else if (c.landscapeRatio) {
      const ratioMultiplier = getRatioMultiplier(c.landscapeRatio)

      slideH = Math.round(hostW / ratioMultiplier)
    } else if (firstItem?.size?.[0] && firstItem?.size?.[1]) {
      slideH = Math.round(calcMediaBox(firstItem.size[0], firstItem.size[1], hostW, maxH).height)
    } else {
      slideH = firstSlide.clientHeight || 0
    }
  } else if (firstItem?.size?.[0] && firstItem?.size?.[1]) {
    slideH = Math.round(calcMediaBox(firstItem.size[0], firstItem.size[1], hostW, maxH).height)
  } else {
    slideH = firstSlide.clientHeight || 0
  }

  if (slideH <= 0) return

  // The strip may be less tall than the projection to honor the smallest
  // file: min natural height across items caps the uniform slide height,
  // so no rendered slide can exceed its source file's real pixels.
  const naturalCapH = (c.items || []).reduce(
    (minH, item) => (item.size?.[1] ? Math.min(minH, item.size[1]) : minH),
    Infinity
  )

  const finalH = Math.min(slideH, maxH, naturalCapH)

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
