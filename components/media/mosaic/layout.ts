/**
 * @file media/mosaic/layout.ts
 * @description Layout passes for <media-mosaic> — measures the wall (or
 * estimates it from the viewport before first paint), packs tiles via the
 * skyline engine, and writes positions/heights into DOM styles. One
 * `relayout` serves both the pre-render pack and the post-measure repack:
 * it only recomputes when the wall width actually changed.
 */
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MEDIA_MOSAIC_CLASSES } from '@core/tokens/classes/media-mosaic.js'
import { calcGridGutter } from '@core/utils/wasm/wasm-layout.js'
import { viewportWidth } from '@core/utils/dom.js'
import { packMediaMosaic } from './pack.js'
import type { MediaMosaic } from '../MediaMosaic.js'

/**
 * Predicted wall width before the element is measured: viewport minus the
 * grid gutters the %MAXAREA host padding applies — the same contract the
 * project view uses for its pre-render height estimate.
 * @returns Estimated wall content width in px (0 without a viewport).
 */
export const estimateWallWidth = (): number => {
  const vw = viewportWidth()

  return vw > 0 ? vw - calcGridGutter(vw) * 2 : 0
}

/**
 * Live wall width — the packed container's content-box measurement when it
 * exists (post-render), else the viewport estimate (pre-render pack so the
 * first painted frame already carries positioned tiles).
 * @param host The MediaMosaic element.
 * @returns Wall width in px.
 */
const wallWidth = (host: MediaMosaic): number =>
  host.$(`.${MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC}`)?.clientWidth || estimateWallWidth()

/**
 * Single layout pass: repacks when the wall width changed (or tiles were
 * never packed — e.g. first configure before the wall existed) and applies
 * tile positions + wall height imperatively. Skipped on the compact
 * carousel path and on empty data. Reads (clientWidth) happen before any
 * style writes in the same pass — no write→read reflow.
 * @param host The MediaMosaic element.
 */
export function relayout(host: MediaMosaic): void {
  if (host._isCompact || !host._items.length) return

  const W = wallWidth(host)

  if (!(W > 0)) return

  if (W !== host._packedW || host.tiles.length !== host._items.length) {
    // packMediaMosaic only returns null for empty items or a non-positive
    // width — both are guarded above, so the result is always concrete.
    const packed = packMediaMosaic(host._items, W)!

    host._packedW = W

    host.tiles = packed.tiles

    host.wallH = `${packed.height}${COMMON_ATTRS.PX}`
  }

  applyTileStyles(host)
}

/** Debounced repack — resize/RO paths coalesce into one rAF. */
export function scheduleLayout(host: MediaMosaic): void {
  if (host._rafId) cancelAnimationFrame(host._rafId)

  host._rafId = requestAnimationFrame(() => relayout(host))
}

/**
 * Writes packed geometry into the DOM: wall height on the container and
 * each tile's absolute box. Post-render refreshes are no-ops when the JSX
 * already emitted the same inline styles (the pack is deterministic).
 * @param host The MediaMosaic element.
 */
export function applyTileStyles(host: MediaMosaic): void {
  const wall = host.$(`.${MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC}`)

  if (wall) wall.style.height = host.wallH

  host.$$(`.${MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC_ITEM}`).forEach((el, i) => {
    const t = host.tiles[i]?.tile

    if (t) Object.assign(el.style, t)
  })
}
