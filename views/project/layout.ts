/**
 * @file routes/views/project/layout.ts
 * @description Layout helpers for ViewProject — per-section height from the first media ratio, text stagger delays, and the landscape-group detector that forces carousel mode.
 */

import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { TITLE_MARQUEE } from '@core/tokens/motion/marquee.js'
import {
  calcDrawTextDelay,
  calcDrawTextOffset,
  calcGridGutter,
} from '@core/utils/wasm/wasm-layout.js'
import { stripHtml } from '@core/utils/index.js'
import { viewportWidth } from '@core/utils/dom.js'
import { hasIrregularMediaHeights, isAllLandscapeGroup } from '@core/utils/media/group.js'
import { estimateMosaicHeight } from '@website/components/media/mosaic/pack.js'
import type { ViewProject } from './Project.js'
import type { ProjectMediaItem, SectionChild } from './types.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { DRAW_TIMINGS } from '@core/tokens/media/dimensions.js'

/**
 * Per-section CSS height: the TALLEST media item's intrinsic ratio
 * applied to the viewport width — min(100vw·h/w, SKELETON_ITEM_HEIGHT) —
 * mirroring the runtime strip, which sizes every slide to the tallest
 * rendered item. Emitting the height before decode means the section
 * never reflows when media arrives; over-reserving (never under) keeps
 * the correction direction downward-only. Sections without any sized
 * media fall back to the fixed skeleton height. `toFixed(4)` keeps the
 * calc string compact while preserving sub-pixel accuracy.
 * @param c The ViewProject instance (unused — part of the method facade).
 * @param section One section's children; the media array is detected by shape.
 * @returns A CSS `min()` height expression.
 */
export function sectionItemHeight(c: ViewProject, section: SectionChild[]): string {
  const media = section.find(
    (child) => Array.isArray(child) && typeof child[0] === TYPE_STRINGS.OBJECT
  ) as ProjectMediaItem[] | undefined

  const ratio =
    media?.reduce(
      (tallest, item) =>
        item?.size?.[0] && item?.size?.[1]
          ? Math.max(tallest, item.size[1] / item.size[0])
          : tallest,
      0
    ) || 0

  if (!ratio) return CAROUSEL_LAYOUT.SKELETON_ITEM_HEIGHT

  return `min(calc(100vw * ${ratio.toFixed(4)}), ${CAROUSEL_LAYOUT.SKELETON_ITEM_HEIGHT})`
}

/**
 * Per-char draw delay for a section's text run: counts REAL characters
 * (HTML stripped — tags don't consume stagger time), then sizes the
 * interval so the whole run lands inside DRAW_TARGET_MS. Non-array input
 * gets the fallback delay so malformed CMS data still animates.
 * @param c The ViewProject instance (unused — facade signature).
 * @param items Section text items (expected string[]).
 * @returns Per-char delay in ms.
 */
export function textDelay(c: ViewProject, items: unknown): number {
  if (!Array.isArray(items)) return DRAW_TIMINGS.DRAW_FALLBACK_DELAY

  const list = items as string[]

  const totalChars =
    list.reduce((sum, str) => {
      return sum + stripHtml(str).length
    }, 0) || 1

  return calcDrawTextDelay(totalChars, DRAW_TIMINGS.DRAW_TARGET_MS)
}

/**
 * Start offset for the text run at index `idx`: cumulative real chars of
 * the preceding items × the per-char delay, plus the per-index step — so
 * sequential sections cascade rather than all starting at t=0.
 * @param c The ViewProject instance — supplies textDelay via the facade.
 * @param items Section text items (expected string[]).
 * @param idx Index of this item in the section.
 * @returns Start offset in ms (0 for non-array input).
 */
export function textOffset(c: ViewProject, items: unknown, idx: number): number {
  if (!Array.isArray(items)) return 0

  const list = items as string[]

  const delay = c.textDelay(list)

  let charsBefore = 0

  for (let i = 0; i < idx; i++) {
    charsBefore += stripHtml(list[i]).length
  }

  return calcDrawTextOffset(idx, charsBefore, delay)
}

/**
 * Whether a media group is all-landscape — those can't pair side-by-side
 * in the two-up layout, so they force the carousel into scroll mode.
 * @param c The ViewProject instance (unused — facade signature).
 * @param group A media item array (shape-checked, not trusted).
 * @returns true when every item is landscape and the group is non-empty.
 */
export function isLandscapeGroup(c: ViewProject, group: unknown): boolean {
  return isAllLandscapeGroup(group)
}

/**
 * Whether a media group renders as the natural-size masonry wall instead
 * of a carousel — the irregular-heights detector (shared predicate in
 * core/utils/media/group) decides purely from intrinsic `size` ratios:
 * mixes like half 16:9 + half 9:16, or very-wide shots beside squares,
 * spread past the RATIO_SPREAD_MIN gate. On ≤640px viewports the mosaic
 * element itself falls back to the carousel, so this is a data-only check.
 * @param c The ViewProject instance (unused — facade signature).
 * @param group A media item array (shape-checked by the predicate).
 * @returns true when the group's height variation is too irregular for a
 *   uniform carousel strip.
 */
export function isMosaicGroup(c: ViewProject, group: unknown): boolean {
  return hasIrregularMediaHeights(group)
}

/**
 * Pre-pack height reservation for a section's mosaic wall — runs the same
 * skyline packer the component uses at the predicted wall width (viewport
 * minus both grid gutters, the %MAXAREA contract) so the wrapper's
 * --media-mosaic-height min-height equals the final box and deferred
 * mosaics land without a layout shift. '' for non-mosaic sections —
 * an empty inline value removes the custom property entirely.
 * @param c The ViewProject instance (unused — facade signature).
 * @param section One section's children; the media array is detected by shape.
 * @returns 'Npx' estimate, or '' when the section keeps the carousel.
 */
export function sectionMosaicHeight(c: ViewProject, section: SectionChild[]): string {
  const media = section.find(
    (child) => Array.isArray(child) && typeof child[0] === TYPE_STRINGS.OBJECT
  ) as ProjectMediaItem[] | undefined

  if (!media || !hasIrregularMediaHeights(media)) return ATTR_VALUES.EMPTY

  const vw = viewportWidth()

  const wallW = vw - calcGridGutter(vw) * 2

  const height = estimateMosaicHeight(media, wallW)

  return height > 0 ? `${height}${COMMON_ATTRS.PX}` : ATTR_VALUES.EMPTY
}

/**
 * Sizes one description block: strips both promotion modifiers, then
 * measures the block at the BASE body size (measuring post-promotion
 * would read the promoted font and flip-flop). A block holding exactly
 * one paragraph that renders on a single line gets --xl (TTL_XL display
 * ramp); a single paragraph that wraps gets --md (TXT_LG); blocks with
 * more than one paragraph keep the base TXT_MD. The strip → read → apply
 * sequence runs inside one synchronous pass, so no paint ever shows the
 * un-promoted intermediate state.
 * @param block One .internal-description element.
 */
function fitDescription(block: Element): void {
  block.classList.remove(
    INTERNAL_CLASSES.INTERNAL_DESCRIPTION_XL,
    INTERNAL_CLASSES.INTERNAL_DESCRIPTION_MD
  )

  const texts = block.querySelectorAll(`.${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT}`)

  if (texts.length !== 1) return

  const p = texts[0] as HTMLElement

  const height = p.clientHeight

  // content-visibility: auto keeps off-screen blocks at zero size — the
  // ResizeObserver refits them when they reveal.
  if (!height) return

  const lineHeight = parseFloat(getComputedStyle(p).lineHeight)

  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return

  const oneLine = Math.round(height / lineHeight) <= 1

  block.classList.add(
    oneLine ? INTERNAL_CLASSES.INTERNAL_DESCRIPTION_XL : INTERNAL_CLASSES.INTERNAL_DESCRIPTION_MD
  )
}

/**
 * Description-size fit pass — classifies every .internal-description
 * block by measured line count (fitDescription) and wires the ResizeObserver
 * that refits a block when it reveals (content-visibility keeps it at
 * zero size until near the viewport) or its width changes with the
 * viewport. document.fonts.ready re-runs the pass once: the verdict is
 * line-count-based, so a late-arriving Poiret One metric could otherwise
 * leave a wrong promotion in place.
 * @param c The ViewProject instance.
 */
export function fitDescriptionSizes(c: ViewProject): void {
  if (!c._descFitObserver && typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
    c._descFitObserver = new ResizeObserver((entries) => {
      for (const entry of entries) fitDescription(entry.target as Element)
    })
  }

  // Re-render may have replaced the observed nodes — detach stale set first.
  c._descFitObserver?.disconnect()

  const blocks = c.shadowRoot?.querySelectorAll(`.${INTERNAL_CLASSES.INTERNAL_DESCRIPTION}`)

  for (const block of blocks ?? []) {
    c._descFitObserver?.observe(block)

    fitDescription(block)
  }

  if (!c._descFontsWired && typeof document !== TYPE_STRINGS.UNDEFINED && document.fonts?.ready) {
    c._descFontsWired = true

    document.fonts.ready.then(() => fitDescriptionSizes(c))
  }
}

/**
 * Grows or trims one marquee half to exactly `count` title units —
 * clones the first unit (identical "TITLE |" markup) or drops trailing
 * ones, so the strip is re-fitted in place without a re-render (which
 * would tear down every mounted carousel).
 * @param half One INTERNAL_TITLE_COPY span; its first child is the template unit.
 * @param count Target number of units.
 */
function fitTitleHalf(half: Element, count: number): void {
  const unit = half.firstElementChild as Element

  for (let i = half.childElementCount; i < count; i++) {
    half.appendChild(unit.cloneNode(true))
  }

  // Bounded drain — trims surplus units down to the target count.
  while (half.childElementCount > count) {
    ;(half.lastElementChild as Element).remove()
  }
}

/**
 * Title-marquee fit + duration sync. Measures one "TITLE |" unit and
 * repeats it ceil(viewportW ÷ unitW) + SAFETY_REPEAT times per half, so
 * each half always spans the viewport and the -50% loop never shows a
 * gap — short titles on wide screens just get more repetitions. Then
 * derives animation-duration = halfW ÷ SPEED_PX_S (halfW = count × unitW)
 * so the ticker drifts at a constant px/s regardless of title length or
 * viewport. The CSS fallback (60s) covers the pre-measure window; a
 * zero-width unit (skeleton state, hidden root) leaves everything in place.
 * @param c The ViewProject instance.
 */
export function syncTitleMarquee(c: ViewProject): void {
  const strip = c.$<HTMLElement>(`.${INTERNAL_CLASSES.INTERNAL_TITLE_STRIP}`)

  const unit = strip?.firstElementChild?.firstElementChild as HTMLElement | null | undefined

  const unitW = unit?.offsetWidth || 0

  if (!strip || unitW <= 0) return

  const count = Math.max(
    TITLE_MARQUEE.MIN_REPEAT,
    Math.ceil(viewportWidth() / unitW) + TITLE_MARQUEE.SAFETY_REPEAT
  )

  c._titleRepeat = count

  Array.from(strip.children).forEach((half) => fitTitleHalf(half, count))

  const durationS = (count * unitW) / TITLE_MARQUEE.SPEED_PX_S

  strip.style.animationDuration = `${durationS.toFixed(2)}s`
}
