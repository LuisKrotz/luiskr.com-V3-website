/**
 * @file mosaic/burn/wasm.ts — the WebGPU particle backend for the paper-
 * combustion title effect. Mounts the per-widget burn artifact (~50KB)
 * on a dedicated canvas stacked over the 2D paper canvas — the paper
 * raster/erode/scorch pipeline stays on 2D (canvas contexts are
 * mutually exclusive per element); the ember/fleck/deposit particle
 * layer moves wholesale into the crate's instanced-quad renderer, one
 * draw call for the whole mote field.
 *
 * Unit contract: the session works in DEVICE px end-to-end (paperW,
 * letters, colInk, paperX/Y, jagAmp all derive from the backing-store
 * scale), so the crate is fed device-px values verbatim — set_size and
 * set_ink share that space, which keeps viewport projection and sim
 * math in one unit with zero conversion.
 */

import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import type { BurnSession, LetterBurn } from './types.js'

/**
 * Kind-specific wasm surface for the burn crate — typed on top of the
 * generic WasmWidget so calls stay checked.
 */
interface BurnWasm {
  begin: (dir: number, ox: number, oy: number, seed: number) => void
  set_letters: (flat: Float32Array) => void
  set_ink: (ink: Uint8Array) => void
  set_colors: (flat: Float32Array) => void
  set_dir: (dir: number) => void
  set_stage: (stage: number, jagAmp: number) => void
  live_particles: () => number
}

/**
 * Packs the session's letter table into the crate's flat layout —
 * 6 f32s per glyph: x0, y0, x1, y1 (paper device px), v (speed
 * multiplier), delay (ignition fraction). Mirrors
 * `sim::BurnSim::set_letters` field-for-field.
 * @param s The live session — letters were filled by analyzePaper.
 * @returns Flat letter table, or null when analysis produced none.
 */
function packLetters(s: BurnSession): Float32Array | null {
  if (!s.letters.length) return null

  const flat = new Float32Array(s.letters.length * 6)

  s.letters.forEach((L: LetterBurn, i: number) => {
    const o = i * 6

    flat[o] = L.x0
    flat[o + 1] = L.y0
    flat[o + 2] = L.x1
    flat[o + 3] = L.y1
    flat[o + 4] = L.v
    flat[o + 5] = L.delay
  })

  return flat
}

/**
 * Packs the four burn inks into the crate's [core, mid, edge, scorch]
 * × rgba table. parseCssColor yields 0..1 rgb triples; alpha is 1 —
 * the JS sim paints particles fully opaque and fades via globalAlpha,
 * which the crate folds into the emitted tint instead.
 * @param s The live session — ink was resolved by readBurnInk.
 * @returns 16 f32s for `set_colors`.
 */
function packColors(s: BurnSession): Float32Array {
  const flat = new Float32Array(16)
  const inks = [s.ink.core, s.ink.mid, s.ink.edge, s.ink.scorch]

  inks.forEach((str, i) => {
    const rgb = parseCssColor(str) || [1, 1, 1]
    const o = i * 4

    flat[o] = rgb[0]
    flat[o + 1] = rgb[1]
    flat[o + 2] = rgb[2]
    flat[o + 3] = 1
  })

  return flat
}

/**
 * Pushes the session's static tables into a freshly mounted widget —
 * begin() creates the sim (dir + paper origin + deterministic seed),
 * then letters/ink/colors land once. Called from the mount callback
 * after the artifact's init has resolved.
 * @param s The live session.
 */
export function pushBurnSession(s: BurnSession): void {
  const w = s.wasm?.widget as BurnWasm | undefined

  if (!w || !s.gpuCanvas) return

  // Seed from the mount clock — sessions vary, replays stay coherent.
  w.begin(s.dir, s.paperX, s.paperY, (performance.now() | 0) >>> 0)

  // Device-px viewport (see module doc) — matches the paper canvas's
  // backing store exactly, so particles land pixel-identically to the
  // 2D path.
  s.wasm?.widget.set_size(s.w, s.h)

  s.wasm?.widget.resize(s.w, s.h)

  const letters = packLetters(s)

  if (letters) w.set_letters(letters)

  if (s.colInk.length) w.set_ink(s.colInk)

  w.set_colors(packColors(s))
}

/**
 * Per-frame wasm arm — pushes direction, stage + jagged amplitude and
 * ticks the sim once. `set_dir` clears live particles inside the crate
 * (a flip restarts the mote stream), so it is only forwarded when the
 * session's dir actually changed.
 * @param s The live session.
 * @param stage Global burn stage 0..1 (climbs in both directions).
 * @param jagAmp Jagged-edge amplitude in device px.
 * @param dt Seconds since the previous frame.
 */
export function frameBurnWasm(s: BurnSession, stage: number, jagAmp: number, dt: number): void {
  const w = s.wasm?.widget as BurnWasm | undefined

  if (!w) return

  w.set_stage(stage, jagAmp)

  s.wasm?.widget.frame(dt)
}

/**
 * The loop's settle check for the wasm path — the session idles once
 * the front is spent AND the crate's last mote died (mirroring the JS
 * `particles.length === 0` condition).
 * @param s The live session.
 * @returns Live particle count in the crate's sim.
 */
export function liveBurnParticles(s: BurnSession): number {
  const w = s.wasm?.widget as BurnWasm | undefined

  return w?.live_particles?.() ?? 0
}

/**
 * Attempts the wasm mount: creates the stacked particle canvas (same
 * class/box as the paper canvas — it paints above it by DOM order) and
 * mounts the burn artifact on it with MANUAL drive — this module keeps
 * the session's own RAF loop, so the bridge only initializes the
 * surface. On any failure the 2D particle path simply keeps running.
 * @param s The live session — must already be laid out (syncPaper ran).
 */
export function tryWasmBurn(s: BurnSession): void {
  if (s.wasmPending || s.wasm || s.wasmFailed || !hasWebGpu()) return

  s.wasmPending = true

  const gpuCanvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  gpuCanvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  gpuCanvas.className = HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURN
  gpuCanvas.width = s.w
  gpuCanvas.height = s.h
  gpuCanvas.style.left = s.canvas.style.left
  gpuCanvas.style.top = s.canvas.style.top
  gpuCanvas.style.width = s.canvas.style.width
  gpuCanvas.style.height = s.canvas.style.height

  void mountWebGpuWidget(GPU_WIDGET_KINDS.BURN, gpuCanvas, undefined, {
    drive: GPU_WIDGET_DRIVE.MANUAL,
  }).then((handle) => {
    s.wasmPending = false

    if (!handle) {
      gpuCanvas.remove()

      s.wasmFailed = true

      return
    }

    if (!s.active) {
      // The session tore down while the artifact was in flight —
      // release the freshly-mounted widget; nothing else owns it.
      handle.destroy()

      gpuCanvas.remove()

      return
    }

    s.wasm = handle

    s.gpuCanvas = gpuCanvas

    // Above the paper canvas — embers must paint over the glyphs.
    s.canvas.after(gpuCanvas)

    pushBurnSession(s)

    // Live 2D motes would freeze mid-air once the loop switches arms —
    // drop them; the crate starts its own stream this frame.
    s.particles.length = 0
  })
}

/** Pushes a dir flip into the crate (burn ↔ rebuild) when mounted. */
export function setBurnDirWasm(s: BurnSession): void {
  const w = s.wasm?.widget as BurnWasm | undefined

  w?.set_dir(s.dir)
}

/** Mirrors the paper canvas's CSS box onto the particle canvas. */
export function mirrorBurnGpuCanvas(s: BurnSession): void {
  if (!s.gpuCanvas) return

  s.gpuCanvas.style.left = s.canvas.style.left
  s.gpuCanvas.style.top = s.canvas.style.top
  s.gpuCanvas.style.width = s.canvas.style.width
  s.gpuCanvas.style.height = s.canvas.style.height
}

/**
 * Releases the wasm handle + removes the particle canvas — teardown
 * path only; a pending mount drops its canvas when it resolves.
 * @param s The session being torn down.
 */
export function destroyBurnWasm(s: BurnSession): void {
  s.wasm?.destroy()

  s.wasm = null

  s.gpuCanvas?.remove()

  s.gpuCanvas = undefined
}
