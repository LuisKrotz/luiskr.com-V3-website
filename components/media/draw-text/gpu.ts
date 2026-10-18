/**
 * @file draw-text/gpu.ts — the WebGPU reveal path: when the
 * `rust/text-draw` widget mounts, each character's glyph is rasterized
 * once into an atlas, its rect/delay pushed as one storage record, and
 * the whole stagger runs as a single instanced draw on an overlay
 * canvas. The DOM char spans keep animating underneath (visibility
 * only — their CSS animation still advances) so dropping the canvas at
 * done-time lands on the identical rest state, and any mount failure
 * leaves the pure-CSS animation untouched.
 *
 * Deliberate upgrade over the CSS path: mobile degrades the DOM
 * animation to word-level (per-char spans are the scroll-jank source —
 * see draw-text/_mobile.scss); the GPU path has no per-char DOM cost,
 * so it runs the full per-char stagger on every viewport.
 *
 * Per-char record (12 f32s — mirrors rust/text-draw's CharRec):
 *   dest x,y,w,h (device px, canvas-local) · uv u0,v0,u1,v1 ·
 *   delay ms (the CSS animation-delay value, read off the span's own
 *   --i/--char-delay/--offset inline vars so the two pipelines can
 *   never drift) · dur ms · em px · pad
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DRAW_TEXT_CLASSES } from '@core/tokens/classes/draw-text.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { DRAW_TIMINGS } from '@core/tokens/media/dimensions.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'
import type { DrawText } from '../DrawText.js'

/** Char-sheet stride — mirrors rust/text-draw's `CHAR_F32S`. */
const CHAR_F32S = 12

/** Glyph overflow pad (fraction of font-size) — keeps descenders and the 0.12em rise inside the atlas cell. */
const ATLAS_PAD_EM = 0.35

/**
 * Kind-specific wasm surface for the text-draw crate — typed on top of
 * the generic WasmWidget so calls stay checked.
 */
interface TextDrawWasm {
  /** Rasterized glyph strip — one cell per char, white-on-transparent. */
  upload_atlas: (bitmap: ImageBitmap) => boolean
  /** The 12-f32-per-char storage sheet (see file doc). */
  set_chars: (values: Float32Array) => number
  /** The block's text color. */
  set_ink: (r: number, g: number, b: number, a: number) => void
  /** Anchors the stagger clock — frame() reports elapsed ms from here. */
  trigger: () => void
}

/**
 * `tryGpuDraw` — attempts the WebGPU reveal for a just-triggered
 * element. Called from `startAnimation` after the char spans mount;
 * resolves silently — on any failure the CSS animation is the render
 * path (the canvas/class are only applied once the atlas + sheet are
 * live).
 * @param host The draw-text element.
 * @param totalMs Wall-clock span of the reveal (last delay + duration)
 *   — the overlay disarms itself after it, restoring DOM paint.
 */
export function tryGpuDraw(host: DrawText, totalMs: number): void {
  if (!hasWebGpu() || host._gpuPending || host._gpuHandle) return

  const contentEl = host._rootEl

  if (!contentEl || typeof document === TYPE_STRINGS.UNDEFINED) return

  const chars = contentEl.querySelectorAll<HTMLElement>(`.${DRAW_TEXT_CLASSES.DRAW_TEXT_CHAR}`)

  if (!chars.length) return

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  canvas.className = DRAW_TEXT_CLASSES.DRAW_TEXT_CANVAS
  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

  host._gpuPending = true

  void mountWebGpuWidget(GPU_WIDGET_KINDS.TEXT_DRAW, canvas, undefined, {
    drive: GPU_WIDGET_DRIVE.MANUAL,
  }).then(async (mounted) => {
    host._gpuPending = false

    // Late-mount guards — element reset/disconnected or the CSS
    // animation already finished while the artifact fetched.
    if (!mounted || !host._isMounted || host._hasAnimated || !contentEl.isConnected) {
      mounted?.destroy()

      canvas.remove()

      return
    }

    const ready = await prepare(host, mounted, contentEl, chars, canvas)

    if (!ready) {
      mounted.destroy()

      canvas.remove()

      return
    }

    host._gpuHandle = mounted
    host._gpuCanvas = canvas

    contentEl.classList.add(DRAW_TEXT_CLASSES.DRAW_TEXT_GPU)
    host.shadowRoot!.appendChild(canvas)

    drive(host, mounted, totalMs)
  })
}

/**
 * `prepare` — measures the char spans, rasterizes the atlas, and
 * pushes ink + sheet into the widget. Returns false when nothing
 * measurable exists (hidden block, zero-size chars — the CSS path
 * then stays authoritative).
 * @param host The draw-text element.
 * @param mounted Live widget handle.
 * @param contentEl The `.draw-text` content span.
 * @param chars The per-char spans.
 * @param canvas The overlay canvas.
 * @returns True when the widget is armed and triggered.
 */
async function prepare(
  host: DrawText,
  mounted: WidgetHandle,
  contentEl: HTMLElement,
  chars: NodeListOf<HTMLElement>,
  canvas: HTMLCanvasElement
): Promise<boolean> {
  const dpr = window.devicePixelRatio || 1
  const hostRect = host.getBoundingClientRect()
  const contentRect = contentEl.getBoundingClientRect()

  if (!contentRect.width || !contentRect.height) return false

  // Overlay box = the content span's box inside the host — inline
  // styles (px literals) mirror the divider-sheen canvas convention;
  // the canvas class only carries position/pointer-events.
  canvas.style.left = `${contentRect.left - hostRect.left}${CHAR_STRINGS.PX}`
  canvas.style.top = `${contentRect.top - hostRect.top}${CHAR_STRINGS.PX}`
  canvas.style.width = `${contentRect.width}${CHAR_STRINGS.PX}`
  canvas.style.height = `${contentRect.height}${CHAR_STRINGS.PX}`

  const w = Math.max(1, Math.round(contentRect.width * dpr))
  const h = Math.max(1, Math.round(contentRect.height * dpr))

  canvas.width = w
  canvas.height = h

  mounted.widget.resize(w, h)

  // ── Atlas + sheet ──────────────────────────────────────────────────
  // One row of cells — cell = char rect + pad on every side; the dest
  // quad expands by the same pad so glyph scale is untouched. White
  // ink: the shader multiplies by the ink uniform.
  const firstCs = getComputedStyle(chars[0])
  const em = parseFloat(firstCs.fontSize) || 16
  const pad = Math.ceil(em * ATLAS_PAD_EM * dpr)

  const cells: {
    dest: [number, number, number, number]
    delay: number
    dur: number
    em: number
  }[] = []

  let atlasW = 0
  let atlasH = 0

  chars.forEach((span) => {
    const r = span.getBoundingClientRect()
    const cw = Math.ceil(r.width * dpr) + pad * 2
    const ch = Math.ceil(r.height * dpr) + pad * 2

    atlasW += cw
    atlasH = Math.max(atlasH, ch)

    const style = span.style
    const i = parseFloat(style.getPropertyValue('--i')) || 0
    const charDelay = parseFloat(style.getPropertyValue('--char-delay')) || host.delay
    const offset = parseFloat(style.getPropertyValue('--offset')) || host.offset
    const cs = getComputedStyle(span)
    const fontEm = parseFloat(cs.fontSize) || em
    // Contexts vary the keyframe length (related-mosaic draws at 0.5s,
    // the default path at 0.8s) — read it off the live animation rather
    // than hardcoding the common one.
    const dur = parseFloat(cs.animationDuration) * 1000 || DRAW_TIMINGS.DRAW_ANIM_EXTRA_MS

    cells.push({
      dest: [
        (r.left - contentRect.left) * dpr - pad,
        (r.top - contentRect.top) * dpr - pad,
        cw,
        ch,
      ],
      delay: offset + i * charDelay,
      dur,
      em: fontEm * dpr,
    })
  })

  if (!atlasW || !atlasH) return false

  const atlas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  atlas.width = atlasW
  atlas.height = atlasH

  const ctx = atlas.getContext('2d')

  if (!ctx) return false

  ctx.fillStyle = CANVAS_STRINGS.INK_WHITE
  ctx.textBaseline = 'alphabetic'

  let x = 0
  const sheet = new Float32Array(cells.length * CHAR_F32S)

  chars.forEach((span, idx) => {
    const cs = getComputedStyle(span)

    ctx.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`

    const m = ctx.measureText(span.textContent || ATTR_VALUES.EMPTY)
    const cell = cells[idx]
    const cellW = cell.dest[2]

    // Baseline = ascent below the pad top — mirrors the span's own
    // text layout (inline-block glyph box starts at the span's top).
    ctx.fillText(span.textContent || ATTR_VALUES.EMPTY, x + pad, pad + m.actualBoundingBoxAscent)

    const uv0 = x / atlasW
    const uv1 = (x + cellW) / atlasW
    const cellH = cell.dest[3]

    const rec = idx * CHAR_F32S

    sheet[rec] = cell.dest[0]
    sheet[rec + 1] = cell.dest[1]
    sheet[rec + 2] = cell.dest[2]
    sheet[rec + 3] = cell.dest[3]
    sheet[rec + 4] = uv0
    sheet[rec + 5] = 0
    sheet[rec + 6] = uv1
    sheet[rec + 7] = cellH / atlasH
    sheet[rec + 8] = cell.delay
    sheet[rec + 9] = cell.dur
    sheet[rec + 10] = cell.em
    sheet[rec + 11] = 0

    x += cellW
  })

  const wasm = mounted.widget as unknown as TextDrawWasm

  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(atlas)
  } catch {
    // Rasterization failure — the CSS reveal stays the render path.
  }

  if (!bitmap || !wasm.upload_atlas(bitmap)) return false

  if (!wasm.set_chars(sheet)) return false

  const ink = parseCssColor(firstCs.color) || [1, 1, 1]

  wasm.set_ink(ink[0], ink[1], ink[2], 1)

  wasm.trigger()

  return true
}

/**
 * `drive` — the MANUAL rAF clock: advances the widget until the last
 * char lands (or the element tears down), then drops the overlay. The
 * DOM spans animate in parallel, so finish() is a same-state swap.
 * @param host The draw-text element.
 * @param mounted Live widget handle.
 * @param totalMs Reveal span — the overlay disarms after it.
 */
function drive(host: DrawText, mounted: WidgetHandle, totalMs: number): void {
  let last = performance.now()
  let elapsed = 0

  // performance.now() — not the rAF arg: same clock, but robust where a
  // scheduler invokes the callback timestamp-less.
  const tick = () => {
    host._gpuRaf = 0

    if (!host._gpuHandle) return

    const now = performance.now()
    const dt = (now - last) / 1000

    last = now
    elapsed += dt * 1000

    const alive = mounted.widget.frame(dt) !== false

    if (!alive || elapsed > totalMs) {
      finish(host)

      return
    }

    host._gpuRaf = requestAnimationFrame(tick)
  }

  host._gpuRaf = requestAnimationFrame(tick)
}

/**
 * `finish` — the end-state swap: drop the suppression class (the DOM
 * chars' CSS animation already completed to the same rest state), then
 * remove the canvas + widget.
 * @param host The draw-text element.
 */
function finish(host: DrawText): void {
  const contentEl = host._rootEl

  if (contentEl) contentEl.classList.remove(DRAW_TEXT_CLASSES.DRAW_TEXT_GPU)

  teardownGpuDraw(host)
}

/**
 * `teardownGpuDraw` — disarms the overlay without touching DOM paint:
 * used by reset()/disconnectedCallback (where the DOM re-renders to
 * the pending state on its own) and by `finish` (after the class drop).
 * @param host The draw-text element.
 */
export function teardownGpuDraw(host: DrawText): void {
  if (host._gpuRaf) {
    cancelAnimationFrame(host._gpuRaf)

    host._gpuRaf = 0
  }

  host._gpuHandle?.destroy()
  host._gpuHandle = null

  host._gpuCanvas?.remove()
  host._gpuCanvas = null
}
