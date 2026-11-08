/**
 * @file media/mosaic/pack.ts
 * @description Natural-size masonry packing engine for <media-mosaic>.
 * Pure geometry: given the wall width it returns each tile's
 * absolute-positioned style object and the packed wall height — shared
 * verbatim by the component's relayout pass and the view's
 * pre-render height estimate (zero-CLS reservation).
 *
 * Tile sizing (the "quality ladder"):
 *   display = natural ÷ 3   — every tile paints smaller than its source
 *   still too wide → ÷ 4     — wide masters shrink further to fit the wall
 *   still wider    → fit     — clamped to the wall width, aspect kept
 *   too small      → ÷ 2     — floor bump so the expand trigger stays usable
 *   still too small→ ÷ 1     — undivided (never upscaled past the source),
 *                             except extreme-wide strips, which stop at ÷ 2
 *
 * Sparse walls whose tiles never reach the right edge are shifted by
 * half the unused strip so the wall sits centered.
 *
 * Packing (the "true masonry"): a skyline/level packer — the wall is a
 * profile of occupied heights; each tile drops into the lowest span that
 * fits its own width, so natural sizes interleave instead of snapping to
 * a column grid. Footprints include the inter-tile GAP. Each step places
 * the remaining tile whose best candidate top is the global minimum —
 * strict document order would let a wide tile seal a lower pocket that
 * only narrower successors could have filled (shelf holes), so ties (and
 * only ties) resolve to document order.
 */
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { LAYOUT, INTERNAL_MOSAIC } from '@core/tokens/layout/masonry.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import type { MediaMosaicItem, MosaicTileStyle } from './types.js'

const { GAP } = LAYOUT

/** One level segment of the skyline: y is the occupied height over [x, x+w). */
interface SkySeg {
  x: number
  w: number
  y: number
}

/** Packed wall result — per-tile style objects plus the wall height (px). */
export interface PackedMosaic {
  tiles: MosaicTileStyle[]
  height: number
}

/**
 * Scales [natW, natH] down by `divisor` preserving aspect, then clamps the
 * width to the wall. Width is floored (never rounds past the bound), height
 * rounded — both stay integer CSS px.
 * @param natW Intrinsic media width.
 * @param natH Intrinsic media height.
 * @param divisor Scale divisor (3, 4, 2, or 1).
 * @param wallW Wall content width in px.
 * @returns Rounded {w,h} tile box.
 */
const sizeAt = (
  natW: number,
  natH: number,
  divisor: number,
  wallW: number
): { w: number; h: number } => {
  let w = natW / divisor

  let h = natH / divisor

  if (w > wallW) {
    h = (h * wallW) / w
    w = wallW
  }

  return { w: Math.floor(w), h: Math.round(h) }
}

/**
 * The tile box for one media item inside a `wallW`-wide wall. Ladder:
 * ÷3 for quality (display < source), ÷4 when ÷3 still overflows the wall,
 * fit-to-wall beyond that; then the expand-trigger floor — ÷2 or undivided
 * when the scaled tile would be too small for the modal-open button.
 * Missing intrinsic sizes fall back to the generic media box.
 * @param natW Intrinsic width (≤0 → generic fallback).
 * @param natH Intrinsic height (≤0 → generic fallback).
 * @param wallW Wall content width in px (≤0 → generic fallback).
 * @returns The rendered tile size in CSS px.
 */
export const mosaicTileSize = (
  natW: number,
  natH: number,
  wallW: number
): { w: number; h: number } => {
  const srcW = natW > 0 ? natW : GENERIC_DIMENSIONS.DEFAULT_WIDTH

  const srcH = natH > 0 ? natH : GENERIC_DIMENSIONS.DEFAULT_HEIGHT

  const bound = wallW > 0 ? wallW : GENERIC_DIMENSIONS.DEFAULT_WIDTH

  let s = sizeAt(srcW, srcH, INTERNAL_MOSAIC.DIVISOR_DEFAULT, bound)

  if (srcW / INTERNAL_MOSAIC.DIVISOR_DEFAULT > bound) {
    s = sizeAt(srcW, srcH, INTERNAL_MOSAIC.DIVISOR_WIDE, bound)
  }

  const extremeWide = srcW / srcH >= INTERNAL_MOSAIC.EXTREME_WIDE_RATIO

  if (s.w < INTERNAL_MOSAIC.MIN_TILE_W || s.h < INTERNAL_MOSAIC.MIN_TILE_H) {
    const s2 = sizeAt(srcW, srcH, INTERNAL_MOSAIC.DIVISOR_SMALL, bound)

    const fits = s2.w >= INTERNAL_MOSAIC.MIN_TILE_W && s2.h >= INTERNAL_MOSAIC.MIN_TILE_H

    // Extreme-wide strips stop at half size: their short axis can't meet
    // the height floor without the tile swallowing the whole wall width.
    if (fits || extremeWide) return s2
  }

  if (s.w < INTERNAL_MOSAIC.MIN_TILE_W || s.h < INTERNAL_MOSAIC.MIN_TILE_H) {
    const s1 = sizeAt(srcW, srcH, 1, bound)

    s = s1.w > s.w ? s1 : s
  }

  return s
}

/**
 * Style object for one placed tile — absolute box at (x,y) sized w×h;
 * overflow hidden keeps the figure's radius/shadow inside the tile.
 * @param x Placement x (px).
 * @param y Placement y (px).
 * @param w Tile width (px).
 * @param h Tile height (px).
 * @returns The tile style object.
 */
const tileStyle = (x: number, y: number, w: number, h: number): MosaicTileStyle => ({
  tile: {
    position: STATE_STRINGS.ABSOLUTE,
    top: `${y}${COMMON_ATTRS.PX}`,
    left: `${x}${COMMON_ATTRS.PX}`,
    width: `${w}${COMMON_ATTRS.PX}`,
    height: `${h}${COMMON_ATTRS.PX}`,
    overflow: STATE_STRINGS.HIDDEN,
  },
})

/**
 * Occupied height across [x, x+w) — the tallest skyline segment the span
 * touches; the tile rests on that peak.
 * @param segs Ordered skyline segments covering [0, wallW).
 * @param x Span start.
 * @param w Span width.
 * @returns The peak y under the span.
 */
const skylineTop = (segs: SkySeg[], x: number, w: number): number => {
  let top = 0

  for (const s of segs) {
    if (s.x < x + w && s.x + s.w > x && s.y > top) top = s.y
  }

  return top
}

/**
 * Raises the skyline to `y` over [x, x+w) — splits covered segments,
 * preserves uncovered margins, then merges adjacent equal-height spans so
 * the segment list stays small (O(segs) per placement).
 * @param segs Ordered skyline segments covering [0, wallW).
 * @param x Footprint start.
 * @param w Footprint width.
 * @param y New height for the covered span.
 * @returns The updated ordered segment list.
 */
const raiseSkyline = (segs: SkySeg[], x: number, w: number, y: number): SkySeg[] => {
  const next: SkySeg[] = []

  const end = x + w

  for (const s of segs) {
    const sEnd = s.x + s.w

    if (sEnd <= x || s.x >= end) {
      next.push(s)
      continue
    }

    if (s.x < x) next.push({ x: s.x, w: x - s.x, y: s.y })

    const cx = Math.max(s.x, x)

    next.push({ x: cx, w: Math.min(sEnd, end) - cx, y })

    if (sEnd > end) next.push({ x: end, w: sEnd - end, y: s.y })
  }

  next.sort((a, b) => a.x - b.x)

  const merged: SkySeg[] = []

  for (const s of next) {
    if (s.w <= 0) continue

    const last = merged[merged.length - 1]

    if (last && last.y === s.y) last.w += s.w
    else merged.push(s)
  }

  return merged
}

/**
 * One tile's lowest legal spot on the current skyline: candidates are
 * every segment start AND every right-aligned end (seg.x+seg.w−s.w) —
 * the second set lets narrow tiles pack flush against taller right
 * edges instead of stranding a gutter. Lowest top wins; ties take the
 * leftmost candidate. A tile too wide for every segment falls back to
 * the full-width floor (its clamps already bound it to the wall).
 * @param segs Ordered skyline segments covering [0, wallW).
 * @param s Tile box {w,h}.
 * @param wallW Wall content width in px.
 * @returns The best {x,y} for that tile on this skyline.
 */
const bestSpot = (segs: SkySeg[], s: { w: number; h: number }, wallW: number) => {
  let x = 0

  let y = Infinity

  for (const seg of segs) {
    for (const cx of [seg.x, seg.x + seg.w - s.w]) {
      if (cx < 0 || cx + s.w > wallW) continue

      const top = skylineTop(segs, cx, s.w)

      if (top < y || (top === y && cx < x)) {
        x = cx

        y = top
      }
    }
  }

  if (y === Infinity) {
    x = 0

    y = skylineTop(segs, 0, wallW)
  }

  return { x, y }
}

/**
 * Full packing pass: each step evaluates every remaining tile's lowest
 * legal spot and places the one whose top is the global minimum — ties
 * resolve to the earliest in document order, so the wall reads
 * left-to-right like the carousel it replaces while a narrow tile can
 * still slip into a pocket a wider predecessor would have sealed over
 * (a placed footprint's whole span rises to its top, erasing any lower
 * pocket it covers — picking the deepest *fit* each step is what keeps
 * those shelf holes from stranding as visible gaps). Footprints carry
 * the GAP on the right and bottom (clamped at the wall edge).
 * @param items Media items (intrinsic sizes via item.size).
 * @param wallW Wall content width in px.
 * @returns {tiles, height} or null for empty/degenerate input.
 */
export const packMediaMosaic = (items: MediaMosaicItem[], wallW: number): PackedMosaic | null => {
  if (!Array.isArray(items) || !items.length || !(wallW > 0)) return null

  const sizes = items.map((item) =>
    mosaicTileSize(item?.size?.[0] || 0, item?.size?.[1] || 0, wallW)
  )

  let segs: SkySeg[] = [{ x: 0, w: wallW, y: 0 }]

  const pending = sizes.map((s, i) => ({ s, i }))

  const placed: { x: number; y: number; w: number; h: number }[] = sizes.map(() => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }))

  let height = 0

  let right = 0

  while (pending.length) {
    let pick = 0

    let best = bestSpot(segs, pending[0].s, wallW)

    for (let q = 1; q < pending.length; q++) {
      const spot = bestSpot(segs, pending[q].s, wallW)

      if (spot.y < best.y) {
        pick = q

        best = spot
      }
    }

    const { s, i } = pending.splice(pick, 1)[0]

    placed[i] = { x: best.x, y: best.y, w: s.w, h: s.h }

    segs = raiseSkyline(segs, best.x, Math.min(s.w + GAP, wallW - best.x), best.y + s.h + GAP)

    if (best.y + s.h > height) height = best.y + s.h

    if (best.x + s.w > right) right = best.x + s.w
  }

  // Sparse walls (tiles never reach the right edge) shift by half the
  // unused strip so the wall sits centered instead of hugging the left.
  const offset = Math.floor((wallW - right) / 2)

  const tiles = placed.map((p) => tileStyle(p.x + offset, p.y, p.w, p.h))

  return { tiles, height }
}

/**
 * Pre-render height estimate — the packed wall height at a predicted
 * width (the view's section wrapper publishes it as --media-mosaic-height
 * so a deferred mosaic reserves its final box). 0 when unpacking.
 * @param items Media items.
 * @param wallW Predicted wall width in px.
 * @returns Estimated wall height in px.
 */
export const estimateMosaicHeight = (items: MediaMosaicItem[], wallW: number): number =>
  packMediaMosaic(items, wallW)?.height || 0
