/**
 * @file about/glitch/wasm.ts — the WebGPU backend arm for the portrait
 * glitch. Mounts the rust/glitch widget on the session canvas
 * (MANUAL drive — the session's own rAF chain stays the single clock),
 * decodes the portrait through the shared wasm image pipeline
 * (fetch → worker createImageBitmap → GPU texture, zero CPU readback),
 * uploads it, and pushes the same cover rect + device size the 2D
 * painters use. Every failure arm drops back to the 2D painter path —
 * the canvas is transparent while the mount is in flight so the DOM
 * <img> carries the picture.
 *
 * The CORS note: `copyExternalImageToTexture` rejects tainted sources —
 * the decoder fetches the portrait URL directly, so a missing CORS
 * header on the CDN simply resolves null and the 2D backend (which can
 * draw a tainted <img>, since it never reads pixels back) stays live.
 */
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import { wasmImageDecoder } from '@core/utils/wasm/wasm-image-decoder.js'
import { armCtx2d, dropSession } from './session.js'
import type { GlitchSession } from './types.js'
import type { AboutSection } from '../../AboutSection.js'

/**
 * Pushes the session's cover-fit rect into the widget — device px, the
 * same rect the 2D painters draw through, so frag→uv mapping reproduces
 * `object-fit: cover` + `object-position` exactly.
 * @param s Live session with a mounted widget + measured rect.
 */
export function pushGlitchRect(s: GlitchSession): void {
  const w = s.wasm?.widget as
    { set_cover?: (x: number, y: number, w: number, h: number) => void } | undefined

  w?.set_cover?.(s.dx, s.dy, s.dw, s.dh)
}

/**
 * Decodes the live portrait URL and uploads the bitmap to the widget —
 * routed through `decodeImageWASM` so decode happens in the worker pool
 * with GPU resize hints sized to the canvas's device-px box. Re-called
 * on srcset drift (the browser swaps density candidates under a live
 * session). A null bitmap or rejected upload kills the wasm arm and
 * claims the 2D backend instead.
 * @param s Live session with a mounted widget.
 */
export function uploadGlitchBitmap(s: GlitchSession): void {
  const wasm = s.wasm

  if (!wasm) return

  const url = s.img.currentSrc || s.img.src

  void wasmImageDecoder.decodeImageWASM(url, s.w, s.h).then((bmp) => {
    if (!bmp || s.wasm !== wasm) return

    const upload = wasm.widget.upload as ((b: ImageBitmap) => boolean) | undefined

    if (!upload?.call(wasm.widget, bmp)) return

    pushGlitchRect(s)
  })
}

/**
 * Async mount — tries the rust/glitch artifact on the session canvas.
 * On success the session's `wasm` field goes live and `tick` switches
 * to `frameGlitchWasm`; on ANY failure (artifact, init, decode) the
 * 2D backend is claimed — the session stays alive either way unless
 * the 2D claim also fails, in which case the overlay is dropped and
 * the plain <img> is the final fallback.
 * @param host The component the session is parked on.
 * @param s Fresh session (ctx unclaimed, wasm null).
 */
export function tryGlitchWasm(host: AboutSection, s: GlitchSession): void {
  void mountWebGpuWidget(GPU_WIDGET_KINDS.GLITCH, s.canvas, undefined, {
    drive: GPU_WIDGET_DRIVE.MANUAL,
  }).then((h) => {
    // The session died while the artifact loaded — release the handle.
    if (h && (host._glitch !== s || !s.active)) {
      h.destroy()
      return
    }

    if (!h) {
      // No artifact/device — the 2D painters take over permanently.
      if (!armCtx2d(s)) dropSession(host, s)
      return
    }

    s.wasm = h

    h.widget.resize(s.w, s.h)
    uploadGlitchBitmap(s)
  })
}

/**
 * One wasm-backend frame — mirrors the 2D `frame()` clock (same 50ms dt
 * clamp) so the roll-bar sweep pace matches either backend. Pushes the
 * hover latch per frame (single f32 uniform — cheaper than edge-detecting
 * it) and drops to the 2D backend if the surface reports itself stale.
 * @param s Live session with `s.wasm` non-null.
 */
export function frameGlitchWasm(s: GlitchSession): void {
  const wasm = s.wasm

  if (!wasm) return

  const now = performance.now()
  const dt = Math.min(0.05, (now - s.lastT) / 1000 || 0.016)

  s.t += dt
  s.lastT = now

  const setHover = wasm.widget.set_hover as ((v: number) => void) | undefined

  setHover?.call(wasm.widget, s.hover ? 1 : 0)

  // false = surface lost/stale — destroy and hand the canvas to 2D.
  if (wasm.widget.frame(dt) === false) {
    s.wasm = null
    wasm.destroy()
    armCtx2d(s)
  }
}
