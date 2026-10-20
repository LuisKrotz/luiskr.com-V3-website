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
import { getSharedGpuDevice, hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'
import { bakeTraversalField } from './traversal.js'
import type { TraversalCell } from './traversal.js'
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

    // Canvas first, suppression class only after the first frame lands
    // (see drive) — hiding the DOM chars before the overlay has painted
    // leaves a one-frame gap where neither paints (the text blink).
    host.shadowRoot!.appendChild(canvas)

    drive(host, mounted, totalMs, contentEl)
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

  // Rasterization happens in DEVICE px (atlas dims are dpr-scaled), so
  // the font size given to the 2d context is cssSize·dpr — feeding it
  // the shorthand `cs.font` draws a css-px glyph into a device-px cell,
  // which then stretches ×dpr across the quad: exactly the blurry /
  // wrong-size / wrong-weight regression. Kerning + ligatures are off
  // in the DOM (.draw-text sets both so per-char spans match plain
  // text) — mirrored on the context below once it exists.
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

  // DOM text shaping parity — .draw-text disables kerning/ligatures so
  // per-char spans match plain text; the raster must match it exactly.
  if ('fontKerning' in ctx)
    (ctx as CanvasRenderingContext2D).fontKerning = CANVAS_STRINGS.FONT_KERNING_NONE

  if ('letterSpacing' in ctx) {
    try {
      ;(ctx as CanvasRenderingContext2D).letterSpacing = firstCs.letterSpacing
    } catch {
      // Engines that reject the computed spacing string keep default
      // tracking — cosmetic drift, never a prepare failure.
    }
  }

  let x = 0
  const sheet = new Float32Array(cells.length * CHAR_F32S)
  const cellSpans: TraversalCell[] = []

  chars.forEach((span, idx) => {
    const cs = getComputedStyle(span)
    const fontPx = (parseFloat(cs.fontSize) || em) * dpr

    ctx.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${fontPx}${CHAR_STRINGS.PX} ${cs.fontFamily}`

    const m = ctx.measureText(span.textContent || ATTR_VALUES.EMPTY)
    const cell = cells[idx]
    const cellW = cell.dest[2]
    const cellH = cell.dest[3]

    // Baseline placement mirrors the DOM line box: the span's box is
    // line-height tall, and half-leading centers the em box inside it —
    // baseline sits (boxH − (ascent+descent))/2 + ascent below the cell's
    // pad top. fontBoundingBox{Ascent,Descent} are the whole-em metrics
    // (the DOM strut uses them); actualBoundingBox* is the fallback.
    const ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent
    const descent = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent
    const boxH = cellH - pad * 2
    const baseline = pad + (boxH - (ascent + descent)) / 2 + ascent

    ctx.fillText(span.textContent || ATTR_VALUES.EMPTY, x + pad, baseline)

    const uv0 = x / atlasW
    const uv1 = (x + cellW) / atlasW

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

    cellSpans.push({ x0: x, x1: x + cellW })

    x += cellW
  })

  // Bake the pen-traversal field into the atlas' free R channel — the
  // reveal edge then follows the glyph's strokes, not a straight wipe.
  // getImageData is once per element at trigger time, not per frame.
  // A failed bake must abort the GPU overlay entirely: R stays 255
  // (T=1) which would hold every glyph invisible until p≈1 — the CSS
  // reveal stays the render path instead.
  try {
    const imgData = ctx.getImageData(0, 0, atlasW, atlasH)

    bakeTraversalField(imgData.data, atlasW, atlasH, cellSpans)

    ctx.putImageData(imgData, 0, 0)
  } catch {
    return false
  }

  const wasm = mounted.widget as unknown as TextDrawWasm

  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(atlas)
  } catch {
    // Rasterization failure — the CSS reveal stays the render path.
  }

  // Worker-routed widgets turn method results into promises — the
  // awaits below are no-ops on in-page mounts (plain bools wrap).
  if (!bitmap || !(await wasm.upload_atlas(bitmap))) return false

  if (!(await wasm.set_chars(sheet))) return false

  const ink = parseCssColor(firstCs.color) || [1, 1, 1]

  wasm.set_ink(ink[0], ink[1], ink[2], 1)

  // End-state probe: render one frame with every char revealed and
  // read the canvas back — a pipeline that draws nothing or fills the
  // whole quad ("slab" regression: broken atlas/bind/sheet on this
  // driver) is rejected here, BEFORE the DOM chars are suppressed, so
  // the CSS reveal stays the render path. Only once per trigger, never
  // per frame. Worker-backed handles run the readback in the render
  // worker (the canvas's texture lives there post-transfer).
  if (!(await verifyOverlay(mounted, canvas, totalMsForProbe(host, chars)))) {
    return false
  }

  // The probe advanced the stagger clock — re-anchor t0 so the reveal
  // starts from zero; the probe frame never presented (the canvas is
  // not yet in the shadow root).
  wasm.trigger()

  return true
}

/** bytesPerRow alignment required by `copyTextureToBuffer`. */
const COPY_PITCH = 256

/**
 * WebGPU usage/map-mode flag values — the DOM lib types these as plain
 * numbers (`GPUBufferUsageFlags`/`GPUMapModeFlags`); the global
 * `GPUBufferUsage`/`GPUMapMode` constant objects only exist on WebGPU
 * runtimes, so the spec values are declared here instead of touching
 * `globalThis` (which also keeps the happy-dom tests free of globals).
 */
const BUFFER_COPY_DST = 8
const BUFFER_MAP_READ = 1
const MAP_MODE_READ = 1

/**
 * Coverage ceiling for `verifyOverlay` — a glyph block's ink fills a
 * small fraction of its box; a painted-coverage ratio at/above this
 * means the draw degenerated into a full-bleed fill (the slab), and
 * zero means it produced nothing (missing text).
 */
const VERIFY_MAX_COVERAGE = 0.85

/**
 * `verifyOverlay` — arms-check for the GPU path: submits one frame at
 * the reveal's end state (every char drawn) against the detached
 * canvas, reads the painted texture back through the shared device,
 * and accepts the overlay only when the coverage sits inside the
 * glyph-block envelope (nonzero, non-full-bleed). Runs once per
 * trigger — the readback is a single mapAsync, never on the frame
 * path. Returns false on any readback/validation failure so the DOM
 * reveal remains the render path.
 * @param mounted Live widget handle.
 * @param canvas The (not-yet-attached) overlay canvas.
 * @param probeMs ms past the last char's end — forces full reveal.
 * @returns True when the probe painted a plausible glyph block.
 */
async function verifyOverlay(
  mounted: WidgetHandle,
  canvas: HTMLCanvasElement,
  probeMs: number
): Promise<boolean> {
  try {
    // Worker-backed handles own the readback — a transferred canvas's
    // texture is only reachable in the render worker.
    if (mounted.probe) {
      const coverage = await mounted.probe(probeMs)

      return coverage !== null && coverage > 0 && coverage < VERIFY_MAX_COVERAGE
    }

    if (mounted.widget.frame(probeMs / 1000) === false) return false

    const device = await getSharedGpuDevice()
    const context = canvas.getContext(CANVAS_STRINGS.CONTEXT_WEBGPU) as GPUCanvasContext | null

    if (!device || !context) return false

    const tex = context.getCurrentTexture()
    const pitch = Math.ceil((tex.width * 4) / COPY_PITCH) * COPY_PITCH

    const buf = device.createBuffer({
      size: pitch * tex.height,
      usage: BUFFER_COPY_DST | BUFFER_MAP_READ,
    })

    const enc = device.createCommandEncoder()

    enc.copyTextureToBuffer(
      { texture: tex },
      { buffer: buf, bytesPerRow: pitch, rowsPerImage: tex.height },
      [tex.width, tex.height]
    )

    device.queue.submit([enc.finish()])
    await buf.mapAsync(MAP_MODE_READ)

    const px = new Uint8Array(buf.getMappedRange())

    let painted = 0

    for (let row = 0; row < tex.height; row++) {
      const base = row * pitch

      for (let col = 0; col < tex.width; col++) {
        if (px[base + col * 4 + 3] > 0) painted++
      }
    }

    buf.unmap()
    buf.destroy()

    return painted > 0 && painted / (tex.width * tex.height) < VERIFY_MAX_COVERAGE
  } catch {
    return false
  }
}

/**
 * `totalMsForProbe` — the probe's end-state timestamp: the last
 * scheduled char's delay + its own duration, the point where every
 * glyph is fully drawn. Kept separate from the wall-clock `totalMs`
 * (which adds presentation slack) so the probe measures the real
 * "all revealed" moment.
 * @param host The draw-text element.
 * @param chars The per-char spans.
 * @returns ms after the reveal's start where all chars are drawn.
 */
function totalMsForProbe(host: DrawText, chars: NodeListOf<HTMLElement>): number {
  const last = chars[chars.length - 1]

  if (!last) return DRAW_TIMINGS.DRAW_ANIM_EXTRA_MS

  const style = last.style
  const i = parseFloat(style.getPropertyValue('--i')) || 0
  const charDelay = parseFloat(style.getPropertyValue('--char-delay')) || host.delay
  const offset = parseFloat(style.getPropertyValue('--offset')) || host.offset
  const dur =
    parseFloat(getComputedStyle(last).animationDuration) * 1000 || DRAW_TIMINGS.DRAW_ANIM_EXTRA_MS

  return offset + i * charDelay + dur + 1
}

/**
 * `drive` — the MANUAL rAF clock: advances the widget until the last
 * char lands (or the element tears down), then drops the overlay. The
 * DOM spans animate in parallel, so finish() is a same-state swap.
 * The DOM-suppression class lands on the first submitted frame — the
 * class flip and the canvas's first present composite together, so no
 * frame ever shows neither paint source (the mount blink).
 * @param host The draw-text element.
 * @param mounted Live widget handle.
 * @param totalMs Reveal span — the overlay disarms after it.
 * @param contentEl The `.draw-text` content span — receives the
 *   suppression class once the overlay has painted.
 */
function drive(
  host: DrawText,
  mounted: WidgetHandle,
  totalMs: number,
  contentEl: HTMLElement
): void {
  let last = performance.now()
  let elapsed = 0
  let painted = false

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

    if (!painted) {
      painted = true
      contentEl.classList.add(DRAW_TEXT_CLASSES.DRAW_TEXT_GPU)
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
