/**
 * @file about/glitch.ts — analog-TV / VHS glitch for the about portrait.
 *
 * The circular Gravatar is continuously redrawn onto a 2D canvas overlaying
 * the <img>. The effect is ALWAYS ON at an ambient level and ramps to full
 * VHS corruption while the pointer is over the portrait:
 *
 *   idle  — ambient interference: faint scanlines, sparse film grain, rare
 *           small band tears and a sub-pixel channel fringe. The portrait
 *           stays put — corruption sits ON the image, never dislocates it.
 *   hover — full VHS: heavy film grain + chroma noise, band tearing, block
 *           packet-loss duplication, RGB ghosts, a rolling desaturated bar,
 *           and rare inversion flashes.
 *
 *   sliceShift  — horizontal bands torn sideways a few px (lost sync)
 *   blockTear   — small rects duplicated at an offset (dropped macroblocks)
 *   rgbSplit    — red/cyan channel ghosts composited 'lighter' at ±dx
 *   rollBar     — tall brightened band sweeping slowly (hover only)
 *   invertFlash — rare near-full inversion for one frame (hover only)
 *   scanlines   — CRT raster lines via a tiled pattern, jittered per frame
 *   grain       — film grain: per-pixel white/black/chroma speckle
 *
 * The loop is self-healing: a shadow-root re-render detaches the canvas and
 * swaps in a fresh <img>, so every tick re-verifies the canvas is connected
 * and re-resolves the live image node — the session survives re-renders
 * without leaking or going dark. All compositing is drawImage /
 * globalCompositeOperation — no pixel readback — so the cross-origin
 * Gravatar works without CORS. If the 2D context is unavailable the <img>
 * stays untouched. Reduced-motion runs nothing.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import type { AboutSection } from '../AboutSection.js'

// ── Tunables ─────────────────────────────────────────────────────────────

/** Device-pixel cap — corruption resolution beyond 2× is invisible. */
const _DPR_CAP = 2

/** Wrapper/img selector pair, resolved fresh each tick (re-render safe). */
const _PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`
const _IMG_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`

// Idle (always-on) intensity.
/** Chance an idle frame runs a small tear/fringe burst. */
const _IDLE_HIT = 0.05
/** Idle grain pixels per frame — sparse film dust. */
const _IDLE_GRAIN = 16
/** Idle RGB fringe bound in device px — sub-pixel shimmer. */
const _IDLE_RGB = 1.4
/** Idle tear distance bound as a frame-width fraction. */
const _IDLE_TEAR = 0.02
/** Idle slice-band count + height bounds (frame-height fractions). */
const _IDLE_BANDS = 2
const _IDLE_BAND_MIN = 0.006
const _IDLE_BAND_MAX = 0.03

// Hover (VHS) intensity.
/** Chance a hover frame runs the heavy corruption pass. */
const _HOVER_HIT = 0.65
/** Hover grain pixels per frame — dense film grain. */
const _HOVER_GRAIN = 460
/** Grain alpha — film noise sits visibly on the image. */
const _GRAIN_ALPHA = 0.22
/** Hover RGB ghost bounds in device px. */
const _HOVER_RGB_MIN = 1
const _HOVER_RGB_MAX = 5
/** Hover tear distance bound as a frame-width fraction. */
const _HOVER_TEAR = 0.035
/** Hover band count/height bounds (frame-height fractions). */
const _HOVER_BANDS = 6
const _HOVER_BAND_MIN = 0.01
const _HOVER_BAND_MAX = 0.06
/** Hover block-tear count/size bounds. */
const _HOVER_BLOCKS = 3
const _BLOCK_W_MAX = 0.18
const _BLOCK_H_MAX = 0.05
const _BLOCK_THROW = 0.05
/** VHS tracking bar — thin brightened horizontal strip. */
const _TRACK_H = 0.02
/** Chance per hover frame of an inversion flash. */
const _INVERT_CHANCE = 0.02

// Shared.
/** Rolling-bar height as a fraction of frame height. */
const _ROLL_H = 0.12
/** Rolling-bar sweep speed (frame-heights per second). */
const _ROLL_SPEED = 0.4
/** Scanline row period in device px + alpha. */
const _SCAN_PERIOD = 3
const _SCAN_ALPHA = 0.06
/** Hover-only chroma-noise chance inside the grain loop. */
const _CHROMA_CHANCE = 0.3
/** Un-armed retry poll rate in Hz — arms as soon as the portrait decodes. */
const _POLL_HZ = 4
/** Percent scale for parsing object-position ("50%" → 0.5). */
const _POS_PCT = 100
const _POS_CENTER = 50

/** Live glitch session parked on `host._glitch`. */
export interface GlitchSession {
  /** Overlay canvas inside the picture wrapper. */
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** Canvas size in device px. */
  w: number
  h: number
  /** Cover-fit source crop of the portrait. */
  sx: number
  sy: number
  sw: number
  sh: number
  /** Live image element — re-resolved after shadow re-renders. */
  img: HTMLImageElement
  /** Natural size the cover crop was computed against — a srcset
   *  candidate swap changes naturalWidth while `complete` stays true,
   *  silently invalidating sx/sy/sw/sh (the stale crop then slices a
   *  corner of the larger bitmap = the "zoomed portrait" bug). */
  srcW: number
  srcH: number
  /** Precomputed red / cyan channel canvases for the RGB split. */
  red: HTMLCanvasElement
  cyan: HTMLCanvasElement
  /** Scanline tile canvas (1×_SCAN_PERIOD) used as a repeat pattern. */
  scan: HTMLCanvasElement
  /** Elapsed seconds — drives the rolling bar. */
  t: number
  lastT: number
  /** Pending rAF handle. */
  raf: number
  /** True while the loop should keep running. */
  active: boolean
  /** Intensity — idle ambient or full VHS under hover. */
  hover: boolean
  /** Frame counter — paces un-armed retry polls. */
  tick: number
  /** Wrapper ResizeObserver — the CSS canvas is width:100%, so any post-arm
   *  layout change (resize, grid reflow, mosaic expand above) would stretch
   *  the stale device-px raster into a zoomed/cropped portrait without it. */
  ro: ResizeObserver | null
}

/**
 * Computes the cover-fit crop rect for the source image at the given
 * output size — mirrors `object-fit: cover` AND the element's
 * `object-position`, read live from computed style so the canvas copy
 * always frames the portrait exactly the way the DOM <img> does
 * (e.g. a photo whose face sits right-of-center would otherwise crop
 * the middle of the source and render the face shifted).
 */
function coverCrop(
  img: HTMLImageElement,
  w: number,
  h: number
): { sx: number; sy: number; sw: number; sh: number } {
  // liveImg() gates on `naturalWidth` before any call reaches here, but
  // some sources report width before height — the height guard stays.
  const iw = img.naturalWidth
  const ih = img.naturalHeight || 1
  const scale = Math.max(w / iw, h / ih)
  const sw = w / scale
  const sh = h / scale

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

  return { sx: (iw - sw) * px, sy: (ih - sh) * py, sw, sh }
}

/**
 * Renders a channel-isolated copy of the portrait: the image is drawn
 * cover-fit, then a pure-channel ink is multiplied over it so only that
 * RGB channel survives. Two offsets of these under 'lighter' produce a
 * true chromatic split.
 */
function buildChannel(s: GlitchSession, mask: string): HTMLCanvasElement {
  const c = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  c.width = s.w
  c.height = s.h

  const cc = c.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!cc) return c

  const size = Math.min(s.w, s.h)
  const ox = (s.w - size) / 2
  const oy = (s.h - size) / 2

  cc.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, ox, oy, size, size)
  cc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_MULTIPLY
  cc.fillStyle = mask
  cc.fillRect(0, 0, s.w, s.h)

  return c
}

/** Builds the scanline tile — 1px dark raster line every period. */
function buildScanlines(): HTMLCanvasElement {
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
function clipCircle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
  ctx.clip()
}

/** Clears the frame and draws the undistorted portrait (circle-clipped). */
function drawBase(s: GlitchSession): void {
  const { ctx, w, h } = s

  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
  ctx.globalAlpha = 1
  ctx.filter = CANVAS_STRINGS.FILTER_NONE
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  clipCircle(ctx, w, h)

  const size = Math.min(w, h)
  const ox = (w - size) / 2
  const oy = (h - size) / 2

  const crop = coverCrop(s.img, size, size)

  ctx.drawImage(s.img, crop.sx, crop.sy, crop.sw, crop.sh, ox, oy, size, size)
  ctx.restore()
}

/**
 * Lost-sync band tears: horizontal slices of the just-drawn frame are
 * re-blitted shifted a few px sideways — the image tears locally but never
 * dislocates as a whole. Idle tears are hair-thin; hover tears reach VHS
 * scale.
 */
function sliceShift(s: GlitchSession): void {
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
function blockTear(s: GlitchSession): void {
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
function drawSplitBase(s: GlitchSession): void {
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
function rollBar(s: GlitchSession): void {
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
function trackBar(s: GlitchSession): void {
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
function invertFlash(s: GlitchSession): void {
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
function scanlines(s: GlitchSession): void {
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
function grain(s: GlitchSession): void {
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
function frame(s: GlitchSession): void {
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

/** Sizes the canvas + caches cover crop, channel ghosts and scan tile. */
function sizeSession(s: GlitchSession, box: DOMRect): void {
  const dpr = Math.min(_DPR_CAP, globalThis.devicePixelRatio || 1)

  s.w = Math.max(2, Math.round(box.width * dpr))
  s.h = Math.max(2, Math.round(box.height * dpr))
  s.canvas.width = s.w
  s.canvas.height = s.h

  s.srcW = s.img.naturalWidth
  s.srcH = s.img.naturalHeight

  const size = Math.min(s.w, s.h)

  const crop = coverCrop(s.img, size, size)

  s.sx = crop.sx
  s.sy = crop.sy
  s.sw = crop.sw
  s.sh = crop.sh
  s.red = buildChannel(s, CANVAS_STRINGS.CHANNEL_RED)
  s.cyan = buildChannel(s, CANVAS_STRINGS.CHANNEL_CYAN)
  s.scan = buildScanlines()
}

/** The live picture wrapper inside the shadow root, if rendered. */
function picWrap(host: AboutSection): HTMLElement | null {
  return host.shadowRoot?.querySelector<HTMLElement>(_PIC_SEL) || null
}

/**
 * Watches the picture wrapper for geometry changes: the session's device-px
 * canvas is pinned to `width:100%`, so it must be re-rastered whenever the
 * CSS box moves (resize, grid reflow, sibling expand) — otherwise the stale
 * raster stretches into a zoomed/cropped portrait. Skips no-op callbacks.
 * @param s Live glitch session (rebuilds cover crop + channel ghosts).
 * @param wrap The wrapper element to observe.
 * @returns The armed observer, or null where RO isn't available.
 */
function observeResize(s: GlitchSession, wrap: HTMLElement): ResizeObserver | null {
  if (typeof ResizeObserver !== TYPE_STRINGS.FUNCTION) return null

  const ro = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect

    if (!s.active || !box || box.width < 2 || box.height < 2) return

    sizeSession(s, box as DOMRect)
  })

  ro.observe(wrap)

  return ro
}

/**
 * The live decoded portrait, if the current DOM node is usable —
 * duck-typed because instanceof HTMLImageElement isn't reliable across
 * realms (happy-dom exposes the class only on the window it created).
 */
function liveImg(wrap: HTMLElement): HTMLImageElement | null {
  const img = wrap.querySelector<HTMLImageElement>(_IMG_SEL)

  if (!img || typeof img.complete !== 'boolean' || !img.complete || !img.naturalWidth) return null

  return img
}

/**
 * Arms the session: builds the overlay canvas + context against the live
 * wrapper. Bails quietly when the image isn't decoded, the wrapper is
 * zero-size, the 2D context is unavailable, or motion is reduced — the
 * <img> remains as the static fallback. Idempotent — returns true when a
 * session is already running.
 */
export function armGlitch(host: AboutSection, wrap: HTMLElement): boolean {
  if (host._glitch) return true

  if (store.getters.getReducedMotion?.()) return false

  const img = liveImg(wrap)

  if (!img) return false

  const box = wrap.getBoundingClientRect()

  if (box.width < 2 || box.height < 2) return false

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  canvas.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_GLITCH

  const ctx = canvas.getContext(WEBGL_STRINGS.CONTEXT_2D) as CanvasRenderingContext2D | null

  if (!ctx) {
    canvas.remove()
    return false
  }

  const s: GlitchSession = {
    canvas,
    ctx,
    w: 0,
    h: 0,
    sx: 0,
    sy: 0,
    sw: 0,
    sh: 0,
    img,
    srcW: 0,
    srcH: 0,
    red: canvas,
    cyan: canvas,
    scan: canvas,
    t: 0,
    lastT: performance.now(),
    raf: 0,
    active: true,
    hover: false,
    tick: 0,
    ro: null,
  }

  sizeSession(s, box)

  host._glitch = s

  wrap.appendChild(canvas)

  s.ro = observeResize(s, wrap)

  s.raf = requestAnimationFrame(() => tick(host))

  return true
}

/**
 * Re-homes the session after a shadow re-render: the old wrapper/img were
 * discarded, so the canvas is re-appended to the fresh wrapper and the
 * geometry + channel ghosts are rebuilt against the new image node.
 */
function healSession(host: AboutSection, s: GlitchSession): boolean {
  const wrap = picWrap(host)

  if (!wrap) return false

  const img = liveImg(wrap)

  if (!img) return false

  s.img = img

  wrap.appendChild(s.canvas)
  sizeSession(s, wrap.getBoundingClientRect())

  // The old wrapper was discarded by the re-render — the observer must
  // re-attach to the fresh node or the next resize crops the portrait.
  s.ro?.disconnect()
  s.ro = observeResize(s, wrap)

  return true
}

/**
 * Self-maintaining tick — always running while mounted:
 *   no session      → retry the arm at ~4 Hz (covers lazy image decode
 *                     and the first render landing before data).
 *   session detached→ heal against the fresh wrapper/img (re-render-safe).
 *   healthy session → draw the frame.
 */
function tick(host: AboutSection): void {
  const s = host._glitch

  if (!s || !s.active || !host._isMounted) return

  s.raf = requestAnimationFrame(() => tick(host))

  if (!s.canvas.isConnected) {
    // Shadow re-render dropped the overlay — re-attach to the new nodes.
    healSession(host, s)
    return
  }

  // srcset drift — the browser can swap to a sharper candidate (lazy
  // decode, viewport change) which silently grows naturalWidth and
  // invalidates the cached crop → recompute before the frame draws it.
  if (s.img.naturalWidth !== s.srcW || s.img.naturalHeight !== s.srcH) {
    const wrap = picWrap(host)

    if (wrap) sizeSession(s, wrap.getBoundingClientRect())
  }

  frame(s)
}

/**
 * The un-armed half of the loop: polls at ~4 Hz until the portrait has
 * decoded enough to arm, then hands off to the session's own raf chain.
 */
function poll(host: AboutSection): void {
  if (!host._isMounted || host._glitch) return

  const wrap = picWrap(host)

  if (wrap && armGlitch(host, wrap)) return

  // Not ready yet — slow retry while the component stays mounted.
  setTimeout(() => {
    if (!host._glitch) requestAnimationFrame(() => poll(host))
  }, 1000 / _POLL_HZ)
}

/** Stops the loop and removes the overlay. */
export function disarmGlitch(host: AboutSection): void {
  const s = host._glitch

  if (!s) return

  s.active = false

  if (s.raf) cancelAnimationFrame(s.raf)

  s.ro?.disconnect()

  s.canvas.remove()
  host._glitch = null
}

/**
 * Binds the always-on glitch: starts the arm poll immediately (the effect
 * runs ambient interference as soon as the portrait decodes — no hover
 * needed) and the delegated hover handlers that only flip the intensity
 * flag. Listeners live on the shadow root, so they survive _updateDom
 * re-renders.
 */
export function attachGlitch(host: AboutSection): void {
  // Continuous ambient — arm as soon as the portrait is decodable.
  poll(host)

  host.addScopedListener(host.shadowRoot, MOUSE_EVENTS.MOUSEOVER, (e) => {
    const wrap = (e.target as Element | null)?.closest?.(_PIC_SEL) as HTMLElement | null

    if (!wrap) return

    // Backup arm path — the poll usually beats the pointer, but a
    // late-decoding image can still be armed by the first hover.
    if (!host._glitch) armGlitch(host, wrap)

    if (host._glitch) host._glitch.hover = true
  })

  host.addScopedListener(host.shadowRoot, MOUSE_EVENTS.MOUSEOUT, (e) => {
    const from = (e.target as Element | null)?.closest?.(_PIC_SEL)
    const to = (e as MouseEvent).relatedTarget as Element | null

    // Pointer moving between children of the same wrapper stays hot.
    if (from && to?.closest?.(_PIC_SEL) === from) return

    if (from && host._glitch) host._glitch.hover = false
  })
}
