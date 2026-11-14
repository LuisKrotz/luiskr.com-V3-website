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

/** One placed tile box in wall coordinates — mutated by the void fill.
 * `ow`/`oh` hold the packed size so the fill's grow cap applies to the
 * total factor, never to a compounding series of single-void grows. */
interface PlacedTile {
  x: number
  y: number
  w: number
  h: number
  ow: number
  oh: number
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

    // Footprints always start on a segment boundary (placements are
    // segment starts), so a covered segment can only extend past the
    // footprint's right edge — the left remainder never occurs.
    next.push({ x: s.x, w: Math.min(sEnd, end) - s.x, y })

    if (sEnd > end) next.push({ x: end, w: sEnd - end, y: s.y })
  }

  next.sort((a, b) => a.x - b.x)

  const merged: SkySeg[] = []

  for (const s of next) {
    const last = merged[merged.length - 1]

    if (last && last.y === s.y) last.w += s.w
    else merged.push(s)
  }

  return merged
}

/**
 * One tile's lowest legal spot on the current skyline: candidates are
 * every segment start. Lowest top wins; ties take the leftmost
 * candidate. (Right-aligned ends were considered and dropped: inside
 * its own segment a right-align always ties seg.x and loses on
 * leftmost, and landing inside an earlier segment its span covers a
 * superset of that segment's tail — it can never produce a strictly
 * lower top, so the set was dead candidates.) Tiles clamp to ≤ wallW
 * and the x=0 segment always exists, so a candidate always lands.
 *
 * The resting top is measured over the tile's whole FOOTPRINT — box
 * plus the trailing GAP strip the raise will reserve — not just the
 * box span. That single rule is what keeps the wall honest:
 *   margins — a placed tile flush on the candidate's right edge lifts
 *     the strip's level, so the candidate rests BELOW the neighbour's
 *     bottom+GAP (vertical separation) instead of painting a 0px seam
 *     where the boxes' y-ranges overlap;
 *   monotonic skyline — the resting top is the MAX over the exact span
 *     the raise covers, so a raise can never stamp a covered segment
 *     lower (a pocket's GAP strip used to overwrite a taller
 *     neighbour's edge level downward, and later tiles — shrink-fits
 *     trusting the corrupted segment — landed INSIDE the neighbour's
 *     box). With a monotone profile, level(x) always equals the deepest
 *     footprint bottom covering x.
 * Left-side margins need no check: a tile ending left of a candidate
 * already raised its own GAP strip, which sits inside the candidate's
 * span and forces the same vertical separation.
 *
 * Pocket shrink-fit: a segment narrower than the tile still gets a
 * candidate — the tile downscales (aspect kept) to the segment's width
 * and rests on the deepest footprint top. Without it a leftover pocket
 * smaller than every remaining tile stays a permanent void (the "big
 * white gap" bug): e.g. a 582px pocket at top 2139 while 640-wide
 * leftovers keep stacking on the opposing 2454 column. The shrunk
 * candidate only wins when its pocket is strictly deeper than the best
 * full-size top — on a tie the bigger box always takes it — and the
 * pocket must still honor the tile floors: the segment must reach
 * max(MIN_TILE_W, half the packed width — the DIVISOR_SMALL rung
 * bound) so a tile never renders as a sliver below half its intended
 * size, and the scaled height must reach MIN_TILE_H — thin gaps stay
 * honest gutters instead of collecting squished tiles.
 * @param segs Ordered skyline segments covering [0, wallW).
 * @param s Tile box {w,h} (the packed size, before any pocket shrink).
 * @param wallW Wall content width in px.
 * @returns The best {x,y,w,h} for that tile — w/h differ from s.w/s.h
 *   only when a pocket shrink-fit won.
 */
const bestSpot = (segs: SkySeg[], s: { w: number; h: number }, wallW: number) => {
  let x = 0

  let y = Infinity

  for (const seg of segs) {
    if (seg.x + s.w > wallW) continue

    const top = skylineTop(segs, seg.x, Math.min(s.w + GAP, wallW - seg.x))

    if (top < y) {
      x = seg.x

      y = top
    }
  }

  let sx = 0

  let sy = Infinity

  let sw = 0

  const minShrinkW = Math.max(
    INTERNAL_MOSAIC.MIN_TILE_W,
    Math.ceil(s.w / INTERNAL_MOSAIC.DIVISOR_SMALL)
  )

  for (const seg of segs) {
    if (seg.w >= s.w || seg.w < minShrinkW) continue

    const sh = Math.round((s.h * seg.w) / s.w)

    if (sh < INTERNAL_MOSAIC.MIN_TILE_H) continue

    const stop = skylineTop(segs, seg.x, Math.min(seg.w + GAP, wallW - seg.x))

    if (stop < sy) {
      sx = seg.x

      sy = stop

      sw = seg.w
    }

    // A pocket ending flush on a neighbour's edge can't take the full
    // segment width — the trailing GAP strip would paint a 0px seam.
    // Backing the box off one GAP keeps the segment's own level, so the
    // shrink still lands deep in the pocket instead of losing to a
    // shallower full-size spot elsewhere.
    const sw2 = seg.w - GAP

    if (
      sw2 >= minShrinkW &&
      seg.y < sy &&
      Math.round((s.h * sw2) / s.w) >= INTERNAL_MOSAIC.MIN_TILE_H
    ) {
      sx = seg.x

      sy = seg.y

      sw = sw2
    }
  }

  if (sy < y) return { x: sx, y: sy, w: sw, h: Math.round((s.h * sw) / s.w) }

  return { x, y, w: s.w, h: s.h }
}

/**
 * Free vertical spans inside one x-slab — the uncovered intervals
 * between (or below) the tiles overlapping [x0, x1). Slab boundaries
 * are tile edges, so coverage is uniform across the slab width: a tile
 * either spans the whole slab or misses it entirely.
 * @param placed Placed tile boxes.
 * @param x0 Slab left edge.
 * @param x1 Slab right edge.
 * @param height Packed wall height — below it the slab is free to the
 *   wall's ragged bottom.
 * @returns Free {top,bottom} intervals, shallowest first.
 */
const slabVoids = (
  placed: PlacedTile[],
  x0: number,
  x1: number,
  height: number
): { top: number; bottom: number }[] => {
  const covering = placed.filter((t) => t.x < x1 && t.x + t.w > x0).sort((a, b) => a.y - b.y)

  const voids: { top: number; bottom: number }[] = []

  let floor = 0

  for (const t of covering) {
    if (t.y > floor) voids.push({ top: floor, bottom: t.y })

    // Covering tiles span the same slab without overlapping, so each
    // bottom is strictly below the running floor — Math.max keeps the
    // invariant readable without a dead else arm.
    floor = Math.max(floor, t.y + t.h)
  }

  if (floor < height) voids.push({ top: floor, bottom: height })

  return voids
}

/**
 * First covered top below tile `t` across the grown span — the floor the
 * grown box must not cross. The span is the grown box's sub-GAP shadow:
 * a tile ending inside it or closer than one GAP to either edge could
 * paint a sub-16px seam against the grown box once the grown height
 * dips below that neighbour's top, so their tops bound the grow too —
 * while a neighbour already a full GAP away needs no bound. Tiles at or
 * above t's own top can't bound downward growth (the placement
 * invariant keeps their bottoms above the grown band); nothing below
 * means the wall's ragged bottom, which is free space.
 * @param placed Placed tile boxes.
 * @param t The candidate tile.
 * @param x0 Grown span left edge.
 * @param x1 Grown span right edge.
 * @param height Packed wall height — the default floor.
 * @returns The bounding floor y for the grown box.
 */
const floorBelow = (
  placed: PlacedTile[],
  t: PlacedTile,
  x0: number,
  x1: number,
  height: number
): number => {
  let floor = height

  for (const u of placed) {
    if (u === t || u.y <= t.y) continue

    if (u.x < x1 + GAP && u.x + u.w > x0 - GAP && u.y < floor) floor = u.y
  }

  return floor
}

/**
 * Grows one void's left wall tile rightward into the void — the wall's
 * left bound always coincides with a tile's right edge (slab boundaries
 * are tile edges), so the fillable direction is always left-to-right: if
 * that edge tile sits inside the void band it can grow; if the region
 * left of the void is free at that band it is the same void continuing
 * into the next slab, which its own left wall already fills. The aspect
 * factor applies to height too, so the media never distorts (the figure
 * fills the tile box, so the grown box only costs display density:
 * FILL_GROW_MAX keeps it denser than the ÷2 rung the ladder paints). A
 * candidate must sit wholly inside the void band (its top at or below
 * the void's top): growing paints the tile's whole height into the new
 * columns, so a tile that reaches above the void would cover whatever
 * sits there. The grow stops GAP short of any tile that could meet the
 * grown box's top or right edge within the inter-tile rhythm —
 * straddlers and ceiling-adjacent tiles bound the grown right edge,
 * while the floor under the grown span (its whole GAP-shadow, so
 * near-adjacent neighbours count too) is discounted one GAP so the
 * grown bottom never lands closer than GAP above a tile below. The
 * bounding tests measure the GROWN band, not the void's own: the grown
 * box can dip below v.bottom, so a right-wall or covering tile bounds
 * the grow wherever its y-range can meet the grown box's reach — and
 * the ragged wall bottom stays reachable, since free space needs no
 * margin. Returns true when a tile actually grew ≥1px.
 * @param placed Placed tile boxes (mutated on success).
 * @param x0 Void slab left edge.
 * @param x1 Void slab right edge.
 * @param v The free vertical interval inside the slab.
 * @param height Packed wall height.
 * @returns Whether a tile grew.
 */
const fillVoid = (
  placed: PlacedTile[],
  x0: number,
  x1: number,
  v: { top: number; bottom: number },
  height: number
): boolean => {
  const inside = (t: PlacedTile): boolean => t.y >= v.top && t.y < v.bottom

  const left = placed
    .filter((t) => t.x + t.w <= x0 && x0 - t.x - t.w <= GAP && inside(t))
    .sort((a, b) => b.x + b.w - (a.x + a.w))[0]

  if (!left) return false

  // Grown-edge bound: any tile right of left.x that can come within one
  // GAP of the grown box's TOP edge must stay one GAP right of the grown
  // right edge. Two families qualify — straddlers (their box crosses
  // left.y, so the grown band always overlaps them vertically) and
  // ceiling tiles (their bottom edge sits within GAP above left.y:
  // growing right under such a tile — e.g. a covering tile whose left
  // edge IS the slab's x0 — paints a sub-16px vertical seam). Tiles
  // below left.y need no edge bound: floorBelow already holds the grown
  // bottom one GAP above their tops, so vertical separation holds at
  // any edge. The slab's own right edge caps the rest.
  let growRight = x1

  for (const u of placed) {
    if (u === left || u.x <= left.x || u.y > left.y || u.y + u.h <= left.y - GAP) continue

    if (u.x - GAP < growRight) growRight = u.x - GAP
  }

  const fw = (growRight - left.x) / left.w

  const grownFloor = floorBelow(placed, left, left.x, growRight, height)

  const bottomBound = grownFloor < height ? grownFloor - GAP : height

  const fh = (bottomBound - left.y) / left.h

  // The cap binds against the packed size (ow), not the already-grown w —
  // successive void fills otherwise compound past FILL_GROW_MAX.
  const f = Math.min(fw, fh, (INTERNAL_MOSAIC.FILL_GROW_MAX * left.ow) / left.w)

  if (Math.round(left.w * f) <= left.w) return false

  left.w = Math.round(left.w * f)

  left.h = Math.round(left.h * f)

  return true
}

/**
 * Post-pack void fill — the skyline can strand dead regions no pending
 * tile could legally enter: canyons between a high tile and its support,
 * a right-edge strip when the rightmost ladder box lands short, and deep
 * pockets wider than every leftover. Those read as broken margins. The
 * wall is partitioned into x-slabs at tile edges; inside each slab the
 * free vertical spans are refilled by growing the tiles that wall them,
 * aspect kept, until no significant void remains. Growth only ever
 * enlarges a box into free space — no tile moves, shrinks, or overlaps.
 * @param placed Placed tile boxes (mutated).
 * @param wallW Wall content width in px.
 * @param height Packed wall height.
 */
const fillMosaicVoids = (placed: PlacedTile[], wallW: number, height: number): void => {
  const edges = new Set<number>([0, wallW])

  for (const t of placed) {
    edges.add(t.x)

    edges.add(t.x + t.w)
  }

  const xs = [...edges].sort((a, b) => a - b)

  for (let s = 0; s < xs.length - 1; s++) {
    const x0 = xs[s]

    const x1 = xs[s + 1]

    if (x1 - x0 < INTERNAL_MOSAIC.FILL_MIN_W) continue

    // Each grow strictly covers ≥1px of void, so the refit loop always
    // terminates; re-deriving voids after a grow lets the next wall tile
    // at a different height fill the rest of a tall canyon.
    for (let grew = true; grew;) {
      grew = false

      const voids = slabVoids(placed, x0, x1, height).filter(
        (v) => v.bottom - v.top >= INTERNAL_MOSAIC.FILL_MIN_H
      )

      for (const v of voids) {
        if (fillVoid(placed, x0, x1, v, height)) {
          grew = true

          break
        }
      }
    }
  }
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

  const placed: PlacedTile[] = sizes.map(() => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    ow: 0,
    oh: 0,
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

    const { i } = pending.splice(pick, 1)[0]

    // The placed box is the spot's own w/h — equal to the packed size
    // except when a pocket shrink-fit won (see bestSpot). ow/oh snapshot
    // it so the void fill's grow cap measures the total factor.
    placed[i] = { x: best.x, y: best.y, w: best.w, h: best.h, ow: best.w, oh: best.h }

    segs = raiseSkyline(segs, best.x, Math.min(best.w + GAP, wallW - best.x), best.y + best.h + GAP)

    if (best.y + best.h > height) height = best.y + best.h

    if (best.x + best.w > right) right = best.x + best.w
  }

  // Post-pack fill: the skyline can strand narrow canyons, a right-edge
  // strip, and deep pockets no remaining tile could legally enter — dead
  // regions that read as broken margins. Wall tiles widen into them
  // (aspect kept, GAP rhythm kept) so the wall only gains coverage.
  fillMosaicVoids(placed, wallW, height)

  right = 0

  for (const p of placed) if (p.x + p.w > right) right = p.x + p.w

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
