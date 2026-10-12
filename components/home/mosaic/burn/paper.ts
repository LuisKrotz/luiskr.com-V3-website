/**
 * @file mosaic/burn/paper.ts — the "paper" raster pipeline: resolve the
 * theme ink palette, re-render the h2 title onto the offscreen canvas at
 * DOM glyph fidelity, detect per-glyph burn units from the ink's alpha
 * channel, and re-anchor the session canvas as the DOM box moves. Split
 * from the monolithic burn.ts.
 */
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { syncCanvasFont, canvasTransformText } from '@core/utils/canvas/dom-font.js'
import {
  _ALPHA_STRIDE,
  _BURN_END,
  _COL_SPEED_MIN,
  _COL_SPEED_SPAN,
  _DPR_CAP,
  _IGNITE_DELAY,
  _INK_ALPHA_MIN,
  _PAD_BOTTOM,
  _PAD_TOP,
  _PAD_X,
} from './tuning.js'
import type { BurnInk, BurnSession, LetterBurn } from './types.js'

/**
 * Resolves the burn palette from the root CSS custom properties — dark
 * theme publishes a cyan-blue plasma ramp, light theme an airy
 * paper-fire ramp. Falls back to the fixed canvas inks when the
 * properties are absent (older stylesheet, non-themed host).
 * @returns The four-stop combustion ink ramp.
 */
export function readBurnInk(): BurnInk {
  const root = typeof document !== TYPE_STRINGS.UNDEFINED ? document.documentElement : null
  const cs = root ? getComputedStyle(root) : null
  const pick = (prop: string, fallback: string): string =>
    (cs?.getPropertyValue(prop) || ATTR_VALUES.EMPTY).trim() || fallback

  return {
    core: pick(THEME_CSS_PROPS.BURN_CORE, CANVAS_STRINGS.EMBER_CORE),
    mid: pick(THEME_CSS_PROPS.BURN_MID, CANVAS_STRINGS.EMBER_MID),
    edge: pick(THEME_CSS_PROPS.BURN_EDGE, CANVAS_STRINGS.EMBER_MID),
    scorch: pick(THEME_CSS_PROPS.BURN_SCORCH, CANVAS_STRINGS.BURN_SCORCH),
  }
}

/**
 * Rasterizes the h2 text into the paper canvas. Canvas can't line-wrap,
 * so words are measured and packed into lines matching the DOM box, then
 * drawn bottom-anchored like the overlay's `align-items: flex-end`.
 *
 * `cssW`/`cssH` are the title box in CSS px while the paper's backing
 * store is device px (cssW × dpr): canvas font and measureText units are
 * CSS px, so the context is scaled cssW→paper.width first — without the
 * transform the glyphs land at 1/dpr size on hidpi/fractional displays
 * (the "burn text renders smaller than the title" bug).
 * @param title The h2 element whose glyphs are re-rendered.
 * @param paper Offscreen canvas sized in device px.
 * @param cssW Title box width in CSS px.
 * @param cssH Title box height in CSS px.
 * @param ink Pre-capture resolved ink color.
 */
export function rasterizeTitle(
  title: HTMLElement,
  paper: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  ink: string
): void {
  const ctx = paper.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return

  // Map CSS-px drawing onto the device-px backing store (≈dpr, exact
  // through the rounded canvas width). One uniform scale — splitting
  // x/y over independently-rounded edges would distort the glyphs.
  const scale = paper.width / cssW

  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const st = getComputedStyle(title)

  // Full DOM typography — shorthand + stretch/variant/kerning/letter-
  // spacing/feature/variation axes — so the paper never drifts from the
  // title's real glyphs (the "effect changed the font" bug class). Ink
  // comes from the pre-hide capture: the element's live color is
  // transparent while the canvas owns the pixels.
  syncCanvasFont(ctx, st)
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'

  const text = canvasTransformText(
    (title.textContent || ATTR_VALUES.EMPTY).trim(),
    st.textTransform
  )
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line: string = ATTR_VALUES.EMPTY

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word

    if (line && ctx.measureText(trial).width > cssW) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }

  if (line) lines.push(line)
  if (!lines.length) return

  const fontPx = parseFloat(st.fontSize) || 12
  const lineH = parseFloat(st.lineHeight) || fontPx * 1.2
  const descent = fontPx * 0.22

  // Anchor the block to the paper's bottom like flex-end does in the DOM.
  const firstBase = cssH - (lines.length - 1) * lineH - descent

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, firstBase + i * lineH)
  }
}

/**
 * Reads the rasterized paper's alpha channel to locate each glyph:
 * columns that carry ink form runs — a space leaves a transparent gap,
 * so each contiguous run IS one letter (kerned pairs may fuse, which
 * just makes them burn as a unit). Builds:
 *
 *  - `colInk`: 1 where a paper-x column has any glyph pixel — ember
 *    spawning and the char band use it so nothing glows in the spaces.
 *  - `letters`: per-run ink bounds (x0..x1, y0..y1) plus a random burn
 *    speed and ignition delay. Speeds spread 0.55..1.45×, delays up to
 *    22% of total progress — letters catch at different moments and
 *    burn at different paces.
 *  - `colLetter`: paper-x → owning letter index; gap columns bind to
 *    the nearest run so the erase polygon stays coherent across spaces.
 *
 * Finally every letter's speed is normalized so the SLOWEST ignitor
 * finishes at ~98% progress — the burn ends with the description's
 * typing, never after.
 * @param s The live session — fills letters/colInk/colLetter + work size.
 */
export function analyzePaper(s: BurnSession): void {
  const ctx = s.paper.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return

  const pw = s.paperW
  const ph = s.paperH
  const data = ctx.getImageData(0, 0, pw, ph).data

  s.colInk = new Uint8Array(pw)
  s.colLetter = new Int16Array(pw).fill(-1)

  // Column ink extents — topmost / bottommost opaque row per column.
  const y0s = new Int32Array(pw).fill(-1)
  const y1s = new Int32Array(pw)

  for (let y = 0; y < ph; y++) {
    const row = y * pw * 4 + _ALPHA_STRIDE

    for (let x = 0; x < pw; x++) {
      if (data[row + x * 4] <= _INK_ALPHA_MIN) continue

      s.colInk[x] = 1

      if (y0s[x] < 0) y0s[x] = y

      y1s[x] = y
    }
  }

  // Ink runs → letters. A run ends where a gap column appears; trailing
  // gap columns are not part of the letter span.
  const letters: LetterBurn[] = []
  let x = 0

  while (x < pw) {
    while (x < pw && !s.colInk[x]) x++

    if (x >= pw) break

    const x0 = x
    let y0 = ph
    let y1 = 0

    while (x < pw && s.colInk[x]) {
      y0 = Math.min(y0, y0s[x])
      y1 = Math.max(y1, y1s[x])
      x++
    }

    letters.push({
      x0,
      x1: x,
      y0,
      y1,
      v: _COL_SPEED_MIN + Math.random() * _COL_SPEED_SPAN,
      delay: Math.random() * _IGNITE_DELAY,
    })
  }

  // Every column binds to its nearest letter — the gap between two runs
  // splits at its midpoint, so a front lookup inside a space still
  // resolves coherently.
  for (let li = 0; li < letters.length; li++) {
    const L = letters[li]
    const prev = letters[li - 1]
    const next = letters[li + 1]
    const lo = prev ? (prev.x1 + L.x0) >> 1 : 0
    const hi = next ? (L.x1 + next.x0) >> 1 : pw

    for (let cx = lo; cx < hi; cx++) s.colLetter[cx] = li
  }

  // Normalize: the last letter to finish lands at ~_BURN_END progress so
  // the combustion completes with the description typing. A letter's
  // finish progress is (1+delay)/v — scaling v by worst/_BURN_END pulls
  // the slowest finisher exactly onto _BURN_END (the reciprocal would
  // stretch it past progress 1 and freeze the burn mid-letter).
  let worst = 0

  for (const L of letters) worst = Math.max(worst, (1 + L.delay) / L.v)

  const norm = worst > 0 ? worst / _BURN_END : 1

  for (const L of letters) L.v *= norm

  s.letters = letters

  s.work.width = pw
  s.work.height = ph
}

/**
 * Anchors the canvas once at arm size, then tracks POSITION only. The
 * card's expand ease animates the h2's `cqw` font-size for ~0.42s after
 * hover; re-measuring the box every step baked that shrink into the
 * raster, so the burning glyphs visibly collapsed with the DOM font (the
 * reported font-reduction bug). Freezing the raster keeps the title the
 * size it was when it caught fire — only the canvas slides along the
 * moving box. `lastBox`/`lastPos` signatures skip all work when nothing
 * moved.
 * @param s The live session — owns the canvases and DOM elements.
 */
export function syncPaper(s: BurnSession): void {
  const box = s.titleEl.getBoundingClientRect()
  const oBox = s.overlayEl.getBoundingClientRect()

  if (box.width < 4 || box.height < 4 || oBox.width < 1) return

  const posSig = `${box.left - oBox.left},${box.top - oBox.top}`

  // Paper already rasterized — position-only re-anchor, never re-measure.
  if (s.lastBox) {
    if (posSig === s.lastPos) return

    s.lastPos = posSig

    s.canvas.style.left = `${box.left - oBox.left - _PAD_X}px`
    s.canvas.style.top = `${box.top - oBox.top - _PAD_TOP}px`

    return
  }

  const dpr = Math.min(_DPR_CAP, globalThis.devicePixelRatio || 1)

  s.lastBox = `${box.width},${box.height},${dpr}`
  s.lastPos = posSig

  const cssW = box.width + _PAD_X * 2
  const cssH = box.height + _PAD_TOP + _PAD_BOTTOM
  const w = Math.max(2, Math.round(cssW * dpr))
  const h = Math.max(2, Math.round(cssH * dpr))

  s.w = w
  s.h = h
  s.paperW = Math.max(2, Math.round(box.width * dpr))
  s.paperH = Math.max(2, Math.round(box.height * dpr))
  s.paperX = _PAD_X * dpr
  s.paperY = _PAD_TOP * dpr

  s.canvas.width = w
  s.canvas.height = h
  s.canvas.style.left = `${box.left - oBox.left - _PAD_X}px`
  s.canvas.style.top = `${box.top - oBox.top - _PAD_TOP}px`
  s.canvas.style.width = `${cssW}px`
  s.canvas.style.height = `${cssH}px`

  s.paper.width = s.paperW
  s.paper.height = s.paperH
  rasterizeTitle(s.titleEl, s.paper, box.width, box.height, s.inkColor)
  analyzePaper(s)
}
