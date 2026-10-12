/**
 * @file mosaic/burn/paper-fx.ts — the per-frame paper compositing pass:
 * scorch band, ember-glow wash, and the destination-out consume polygon
 * that erodes the title raster letter by letter (or un-erodes it on
 * rebuild). Split from the monolithic burn.ts.
 */
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { edgeNoise, letterFrontY, letterProgress } from './front.js'
import {
  _BAND_ALPHA,
  _BAND_MIN,
  _BURN_END,
  _FRONT_STEP,
  _GLOW_ALPHA,
  _GLOW_RATIO,
  _SCORCH_RATIO,
} from './tuning.js'
import type { BurnSession } from './types.js'

/**
 * Rebuilds the burning title inside the work canvas for this frame.
 *
 * Layers, per letter (paper-space coords, i.e. 0..paperW / 0..paperH):
 *
 *  1. `paper` — the pristine glyph raster.
 *  2. Scorch — a `source-atop` band painted only over the letter's own
 *     span just above its live front; `source-atop` composites onto ink
 *     pixels only, so the glyph visibly chars dark before it erodes and
 *     the gaps between letters stay untouched.
 *  3. Ember glow — a soft `lighter` wash hugging the front, ink-clipped
 *     the same way: the glyph's still-alive lower edge smoulders.
 *  4. Consume — a `destination-out` polygon below each letter's jagged
 *     front erases the raster bottom-up at that letter's own pace.
 *
 * The composite then blits to the display canvas — the DOM ink is long
 * hidden, so what the user reads IS this raster burning through itself.
 * @param s The live session — paints into s.workCtx.
 * @param stage Global burn stage 0..1 (1 − prog on rebuild).
 * @param jagAmp Jagged-edge amplitude in device px.
 */
export function burnPaper(s: BurnSession, stage: number, jagAmp: number): void {
  const { workCtx: wc, paperW: pw, paperH: ph } = s
  const rebuild = s.dir < 0

  wc.setTransform(1, 0, 0, 1, 0, 0)
  wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
  wc.globalAlpha = 1
  wc.clearRect(0, 0, pw, ph)
  wc.drawImage(s.paper, 0, 0)

  // stage 0 only exists on the forward path — a rebuild's first frame has
  // already decremented prog below 1, so the fully-missing state paints
  // through the lp <= 0 column-clear instead.
  if (stage <= 0) return

  if (stage >= _BURN_END && !rebuild) {
    wc.clearRect(0, 0, pw, ph)
    return
  }

  // Band direction: burn chars the ink ABOVE the live front; rebuild
  // smolders BELOW it — the edge that just re-materialized.
  const bs = rebuild ? 1 : -1
  // Consume edge: burn erases below the front (ph + 1 anchor), rebuild
  // erases the still-missing top (-1 anchor).
  const edge = rebuild ? -1 : ph + 1

  for (const L of s.letters) {
    const lp = letterProgress(L, stage)

    // Skip letters with no live front: burn skips the un-ignited, rebuild
    // skips the fully restored.
    if (rebuild ? lp >= 1 : lp <= 0) continue

    const x0 = Math.max(0, L.x0 - 1)
    const x1 = Math.min(pw, L.x1 + 1)

    // Column-clear: burn's fully-consumed letter and rebuild's
    // still-missing letter both wipe the whole column.
    if (rebuild ? lp <= 0 : lp >= 1) {
      wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_DESTINATION_OUT
      wc.globalAlpha = 1
      wc.fillRect(x0, 0, x1 - x0, ph + 1)
      continue
    }

    const fy = (x: number): number => letterFrontY(s, L, x, stage, jagAmp)
    const span = L.x1 - L.x0

    // 1) Scorch band — chars the ink on the live side of the front.
    const band = Math.max(_BAND_MIN, (L.y1 - L.y0) * _SCORCH_RATIO)
    const frontTop = fy(L.x0)

    wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_ATOP
    wc.globalAlpha = _BAND_ALPHA
    wc.beginPath()
    wc.moveTo(L.x0, frontTop)

    for (let x = L.x0; x <= L.x1; x += _FRONT_STEP) wc.lineTo(x, fy(x))

    wc.lineTo(L.x1, fy(L.x1))

    for (let x = L.x1; x >= L.x0; x -= _FRONT_STEP) {
      wc.lineTo(x, fy(x) + bs * band * (1 + edgeNoise(x, s.t * 2.3) * 0.4))
    }

    wc.lineTo(L.x0, fy(L.x0) + bs * band * (1 + edgeNoise(L.x0, s.t * 2.3) * 0.4))
    wc.closePath()

    const sg = wc.createLinearGradient(0, frontTop, 0, frontTop + bs * band)

    sg.addColorStop(0, s.ink.scorch)
    sg.addColorStop(1, CANVAS_STRINGS.INK_CLEAR)
    wc.fillStyle = sg
    wc.fill()

    // 2) Ember glow — soft additive wash where the ink is alight.
    wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_ATOP
    wc.globalAlpha = _GLOW_ALPHA
    wc.beginPath()
    wc.moveTo(L.x0, frontTop)

    for (let x = L.x0; x <= L.x1; x += _FRONT_STEP) wc.lineTo(x, fy(x))

    wc.lineTo(L.x1, fy(L.x1))

    for (let x = L.x1; x >= L.x0; x -= _FRONT_STEP) {
      wc.lineTo(x, fy(x) + bs * span * _GLOW_RATIO * 0.4)
    }

    wc.lineTo(L.x0, fy(L.x0) + bs * span * _GLOW_RATIO * 0.4)
    wc.closePath()

    const eg = wc.createLinearGradient(0, frontTop, 0, frontTop + bs * band)

    eg.addColorStop(0, s.ink.mid)
    eg.addColorStop(1, CANVAS_STRINGS.INK_CLEAR)
    wc.fillStyle = eg
    wc.fill()

    // 3) Consume — burn erases below the ragged front, rebuild erases the
    // still-missing region above it so glyphs re-materialize bottom→top.
    wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_DESTINATION_OUT
    wc.globalAlpha = 1
    wc.beginPath()
    wc.moveTo(x0, edge)

    for (let x = x0; x <= x1; x += _FRONT_STEP) wc.lineTo(x, fy(x))

    wc.lineTo(x1, fy(x1))
    wc.lineTo(x1, edge)
    wc.closePath()
    wc.fill()
  }

  wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
}
