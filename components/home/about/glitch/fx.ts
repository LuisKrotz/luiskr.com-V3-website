/**
 * @file about/glitch/fx.ts — the per-frame painters for the VHS glitch:
 * cover-fit geometry, channel ghosts + scanline tile builders, the base
 * draw, each corruption pass (slice tears, block tear, RGB split, roll
 * and track bars, invert flash, scanlines, grain), and the frame
 * dispatcher that gates them by intensity. Split from the monolithic
 * glitch.ts.
 */
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import {
  _BLOCK_H_MAX,
  _BLOCK_THROW,
  _BLOCK_W_MAX,
  _CHROMA_CHANCE,
  _GRAIN_ALPHA,
  _HOVER_BAND_MAX,
  _HOVER_BAND_MIN,
  _HOVER_BANDS,
  _HOVER_BLOCKS,
  _HOVER_GRAIN,
  _HOVER_HIT,
  _HOVER_RGB_MAX,
  _HOVER_RGB_MIN,
  _HOVER_TEAR,
  _IDLE_BAND_MAX,
  _IDLE_BAND_MIN,
  _IDLE_BANDS,
  _IDLE_GRAIN,
  _IDLE_HIT,
  _IDLE_RGB,
  _IDLE_TEAR,
  _INVERT_CHANCE,
  _POS_CENTER,
  _POS_PCT,
  _ROLL_H,
  _ROLL_SPEED,
  _SCAN_ALPHA,
  _SCAN_PERIOD,
  _TRACK_H,
} from './types.js'
import type { GlitchSession } from './types.js'

/**
 * Computes the cover-fit DESTINATION rect for the portrait at the given
 * canvas size — mirrors `object-fit: cover` AND the element's
 * `object-position`, read live from computed style so the canvas copy
 * always frames the portrait exactly the way the DOM <img> does.
 *
 * The draw uses the whole-image form `drawImage(img, dx, dy, dw, dh)`
 * rather than a source crop on purpose: for srcset images selected via
 * `x` density descriptors, `naturalWidth`/`naturalHeight` report
 * DENSITY-CORRECTED units (intrinsic pixels ÷ descriptor) while
 * drawImage's source rect expects intrinsic pixels — a crop computed
 * from `naturalWidth` reads a fraction of the bitmap = the "zoomed
 * corner" bug at DPR ≠ 1. Destination-rect cover sidesteps the two
 * unit systems entirely: the browser maps the full image (any intrinsic
 * size) into the rect.
 * @param img Decoded portrait element.
 * @param size Output square edge in canvas (device) px.
 * @param ox Canvas-space X origin of the square viewport.
 * @param oy Canvas-space Y origin of the square viewport.
 */
export function coverRect(
  img: HTMLImageElement,
  size: number,
  ox: number,
  oy: number
): { dx: number; dy: number; dw: number; dh: number } {
  // liveImg() gates on `naturalWidth` before any call reaches here, but
  // some sources report width before height — the height guard stays.
  const iw = img.naturalWidth
  const ih = img.naturalHeight || 1
  const scale = Math.max(size / iw, size / ih)
  const dw = iw * scale
  const dh = ih * scale

  // object-position percentages — e.g. "50% 50%" keeps the 0.5 default;
  // keywords like `right`/`top` parse to NaN and fall back to center.
  const axis = (v: string | undefined): number => {
    const n = parseFloat(v || ATTR_VALUES.EMPTY)

    return (Number.isNaN(n) ? _POS_CENTER : n) / _POS_PCT
  }

  const pos = (getComputedStyle(img).objectPosition || ATTR_VALUES.EMPTY).trim()
  const parts = pos.split(/\s+/)
  const px = axis(parts[0])
  const py = axis(parts[1])

  return { dx: ox + (size - dw) * px, dy: oy + (size - dh) * py, dw, dh }
}

/**
 * Renders a channel-isolated copy of the portrait: the image is drawn
 * cover-fit, then a pure-channel ink is multiplied over it so only that
 * RGB channel survives. Two offsets of these under 'lighter' produce a
 * true chromatic split.
 * @param s The session the channel copy is sized/drawn from.
 * @param mask The pure-channel ink (CANVAS_STRINGS.CHANNEL_*).
 */
export function buildChannel(s: GlitchSession, mask: string): HTMLCanvasElement {
  const c = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  c.width = s.w
  c.height = s.h

  const cc = c.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!cc) return c

  cc.drawImage(s.img, s.dx, s.dy, s.dw, s.dh)
  cc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_MULTIPLY
  cc.fillStyle = mask
  cc.fillRect(0, 0, s.w, s.h)

  return c
}

/** Builds the scanline tile — 1px dark raster line every period. */
export function buildScanlines(): HTMLCanvasElement {
  const c = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  c.width = 1
  c.height = _SCAN_PERIOD

  const cc = c.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!cc) return c

  cc.clearRect(0, 0, 1, _SCAN_PERIOD)
  cc.globalAlpha = _SCAN_ALPHA
  cc.fillStyle = CANVAS_STRINGS.INK_BLACK
  cc.fillRect(0, 0, 1, 1)

  return c
}

/** Clips every corruption to the portrait's circle. */
export function clipCircle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
  ctx.clip()
}

/** Clears the frame and draws the undistorted portrait (circle-clipped). */
export function drawBase(s: GlitchSession): void {
  const { ctx, w, h } = s

  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
  ctx.globalAlpha = 1
  ctx.filter = CANVAS_STRINGS.FILTER_NONE
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  clipCircle(ctx, w, h)

  // Utilize the pre-calculated cover-fit destination rect — whole-image
  // draw, immune to the density-corrected naturalWidth unit mismatch.
  ctx.drawImage(s.img, s.dx, s.dy, s.dw, s.dh)
  ctx.restore()
}

/**
 * Lost-sync band tears: horizontal slices of the just-drawn frame are
 * re-blitted shifted a few px sideways — the image tears locally but never
 * dislocates as a whole. Idle tears are hair-thin; hover tears reach VHS
 * scale.
 */
export function sliceShift(s: GlitchSession): void {
  const { ctx, canvas, w, h } = s
  const heavy = s.hover
  const bands = heavy ? _HOVER_BANDS : _IDLE_BANDS
  const minH = heavy ? _HOVER_BAND_MIN : _IDLE_BAND_MIN
  const maxH = heavy ? _HOVER_BAND_MAX : _IDLE_BAND_MAX
  const tear = heavy ? _HOVER_TEAR : _IDLE_TEAR

  ctx.save()
  clipCircle(ctx, w, h)

  for (let i = 0; i < bands; i++) {
    const y = Math.random() * h
    const bh = Math.max(1, h * (minH + Math.random() * (maxH - minH)))
    const dx = (Math.random() * 2 - 1) * w * tear

    ctx.drawImage(canvas, 0, y, w, bh, dx, y, w, bh)
  }

  ctx.restore()
}

/**
 * Packet-loss blocks (hover only): small rects duplicated at a horizontal
 * offset — pixels appear twice rather than sliding, like dropped
 * macroblocks in a damaged MPEG stream.
 */
export function blockTear(s: GlitchSession): void {
  const { ctx, canvas, w, h } = s

  ctx.save()
  clipCircle(ctx, w, h)

  for (let i = 0; i < _HOVER_BLOCKS; i++) {
    const bw = w * (0.05 + Math.random() * _BLOCK_W_MAX)
    const bh = h * (0.015 + Math.random() * _BLOCK_H_MAX)
    const x = Math.random() * (w - bw)
    const y = Math.random() * (h - bh)
    const dx = (Math.random() * 2 - 1) * w * _BLOCK_THROW

    ctx.drawImage(canvas, x, y, bw, bh, x + dx, y, bw, bh)
  }

  ctx.restore()
}

/**
 * Chromatic aberration — replaces the base draw on split frames. The red
 * and cyan channel canvases are complementary: (R,0,0)+(0,G,B) sums back
 * to the exact source under 'lighter', so compositing them at opposing
 * offsets reproduces the portrait WITH the CRT fringe. Drawing them over
 * an already-composited base would double the exposure (2×R,2×G,2×B →
 * white blowout) — so this is the frame's base, never an overlay.
 */
export function drawSplitBase(s: GlitchSession): void {
  const { ctx, w, h } = s
  const dx = s.hover
    ? _HOVER_RGB_MIN + Math.random() * (_HOVER_RGB_MAX - _HOVER_RGB_MIN)
    : Math.random() * _IDLE_RGB

  // Same state reset + full clear as drawBase — 'lighter' is additive, so
  // without the clear each split frame stacks another full-brightness copy
  // on the previous frame and the circle saturates to white within a few
  // consecutive hits (the "ghost fragments on white" bug).
  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
  ctx.globalAlpha = 1
  ctx.filter = CANVAS_STRINGS.FILTER_NONE
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)

  ctx.save()
  clipCircle(ctx, w, h)
  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_LIGHTER
  ctx.drawImage(s.red, -dx, 0, w, h)
  ctx.drawImage(s.cyan, dx, 0, w, h)
  ctx.restore()
  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
}

/**
 * VHS rolling band (hover only): a tall strip re-blitted slightly torn and
 * brightened, sweeping slowly down the frame like bad vertical hold.
 */
export function rollBar(s: GlitchSession): void {
  const { ctx, canvas, w, h } = s
  const bh = h * _ROLL_H
  const y = ((s.t * _ROLL_SPEED) % 1.3) * (h + bh) - bh

  if (y > h || y + bh < 0) return

  ctx.save()
  clipCircle(ctx, w, h)
  ctx.filter = CANVAS_STRINGS.FILTER_ROLL
  ctx.drawImage(canvas, 0, y, w, bh, (Math.random() - 0.5) * w * _HOVER_TEAR, y, w, bh)
  ctx.restore()
}

/**
 * VHS tracking bar (hover only): a thin bright strip at a fixed-ish
 * jittered height — the white tracking line at the tape head switch.
 */
export function trackBar(s: GlitchSession): void {
  const { ctx, w, h } = s

  ctx.save()
  clipCircle(ctx, w, h)
  ctx.globalAlpha = 0.3
  ctx.fillStyle = CANVAS_STRINGS.INK_WHITE
  ctx.fillRect(0, Math.random() * h, w, Math.max(1, h * _TRACK_H))
  ctx.restore()
  ctx.globalAlpha = 1
}

/** One-frame near-total inversion — the classic bad-signal flash. */
export function invertFlash(s: GlitchSession): void {
  const { ctx, w, h } = s

  ctx.save()
  clipCircle(ctx, w, h)
  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_DIFFERENCE
  ctx.fillStyle = CANVAS_STRINGS.INVERT_FILL
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
}

/** CRT raster lines via a repeated tile, jittered vertically each frame. */
export function scanlines(s: GlitchSession): void {
  const { ctx, w, h } = s
  const jit = Math.floor(Math.random() * _SCAN_PERIOD)
  const pattern = ctx.createPattern(s.scan, 'repeat')

  if (!pattern) return

  ctx.save()
  clipCircle(ctx, w, h)
  ctx.translate(0, jit)
  ctx.fillStyle = pattern
  ctx.fillRect(0, -jit, w, h)
  ctx.restore()
}

/**
 * Film grain — scattered single-pixel speckle. Idle frames get sparse
 * black/white dust; hover frames get dense grain plus chroma noise
 * (red/cyan speckle like color noise on aged tape).
 */
export function grain(s: GlitchSession): void {
  const { ctx, w, h } = s
  const count = s.hover ? _HOVER_GRAIN : _IDLE_GRAIN
  const alpha = s.hover ? _GRAIN_ALPHA : _SCAN_ALPHA * 1.6

  ctx.save()
  clipCircle(ctx, w, h)
  ctx.globalAlpha = alpha

  for (let i = 0; i < count; i++) {
    let ink: string = Math.random() < 0.5 ? CANVAS_STRINGS.INK_WHITE : CANVAS_STRINGS.INK_BLACK

    // VHS chroma noise — occasional red/cyan speckle.
    if (s.hover && Math.random() < _CHROMA_CHANCE) {
      ink = Math.random() < 0.5 ? CANVAS_STRINGS.CHANNEL_RED : CANVAS_STRINGS.CHANNEL_CYAN
    }

    ctx.fillStyle = ink
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1)
  }

  ctx.restore()
  ctx.globalAlpha = 1
}

/** One frame: base redraw → gated corruption pass → raster artifacts. */
export function frame(s: GlitchSession): void {
  const now = performance.now()

  s.t += Math.min(0.05, (now - s.lastT) / 1000 || 0.016)
  s.lastT = now

  const hit = Math.random() < (s.hover ? _HOVER_HIT : _IDLE_HIT)

  if (hit) {
    // Split frames composite the channel pair INSTEAD of the base —
    // drawSplitBase reproduces the portrait with the fringe, then tears
    // shift slices of the already-split frame.
    drawSplitBase(s)
    sliceShift(s)

    if (s.hover) {
      if (Math.random() < 0.5) blockTear(s)
      if (Math.random() < 0.5) trackBar(s)
      if (Math.random() < _INVERT_CHANCE) invertFlash(s)
    }
  } else {
    drawBase(s)
  }

  if (s.hover) rollBar(s)

  scanlines(s)
  grain(s)
}
