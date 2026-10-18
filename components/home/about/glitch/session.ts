/**
 * @file about/glitch/session.ts — session lifecycle for the portrait
 * glitch: canvas sizing against the live wrapper, wrapper/img
 * re-resolution after shadow re-renders, the ResizeObserver, arming,
 * self-healing tick, and the un-armed decode poll. Split from the
 * monolithic glitch.ts.
 */
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { hasWebGpu } from '@core/utils/gpu/webgpu-widget.js'
import { buildChannel, buildScanlines, coverRect, frame } from './fx.js'
import { frameGlitchWasm, pushGlitchRect, tryGlitchWasm, uploadGlitchBitmap } from './wasm.js'
import { _DPR_CAP, _IMG_SEL, _PIC_SEL, _POLL_HZ } from './types.js'
import type { GlitchSession } from './types.js'
import type { AboutSection } from '../../AboutSection.js'

/** Sizes the canvas + caches cover crop, channel ghosts and scan tile. */
export function sizeSession(s: GlitchSession, box: DOMRect): void {
  const dpr = Math.min(_DPR_CAP, globalThis.devicePixelRatio || 1)

  s.w = Math.max(2, Math.round(box.width * dpr))
  s.h = Math.max(2, Math.round(box.height * dpr))
  s.canvas.width = s.w
  s.canvas.height = s.h

  s.srcW = s.img.naturalWidth
  s.srcH = s.img.naturalHeight

  // Destination cover rect in device px — the square viewport sits
  // centered in the canvas exactly like the DOM img's cover box.
  const size = Math.min(s.w, s.h)
  const rect = coverRect(s.img, size, (s.w - size) / 2, (s.h - size) / 2)

  s.dx = rect.dx
  s.dy = rect.dy
  s.dw = rect.dw
  s.dh = rect.dh

  if (s.wasm) {
    // WebGPU backend — the shader samples the portrait texture through
    // this same cover rect; channel ghosts/scanlines are frag ops.
    s.wasm.widget.resize(s.w, s.h)
    pushGlitchRect(s)
    return
  }

  if (!s.ctx) return

  s.red = buildChannel(s, CANVAS_STRINGS.CHANNEL_RED)
  s.cyan = buildChannel(s, CANVAS_STRINGS.CHANNEL_CYAN)
  s.scan = buildScanlines()
}

/** The live picture wrapper inside the shadow root, if rendered. */
export function picWrap(host: AboutSection): HTMLElement | null {
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
export function observeResize(s: GlitchSession, wrap: HTMLElement): ResizeObserver | null {
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
export function liveImg(wrap: HTMLElement): HTMLImageElement | null {
  const img = wrap.querySelector<HTMLImageElement>(_IMG_SEL)

  if (!img || typeof img.complete !== 'boolean' || !img.complete || !img.naturalWidth) return null

  return img
}

/**
 * Arms the session: builds the overlay canvas against the live wrapper,
 * then races the two render backends — the rust/glitch WebGPU widget
 * mounts first when `navigator.gpu` exists; anything else claims the 2D
 * context and the painter pipeline (a canvas only allows ONE context
 * mode, so the 2D claim is deferred until the wasm arm fails). Bails
 * quietly when the image isn't decoded, the wrapper is zero-size, or
 * motion is reduced — the <img> remains as the static fallback.
 * Idempotent — returns true when a session is already running.
 * @param host The <about-section> component the session parks on.
 * @param wrap The live picture wrapper element.
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

  const s: GlitchSession = {
    canvas,
    ctx: null,
    w: 0,
    h: 0,
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
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
    wasm: null,
  }

  sizeSession(s, box)

  host._glitch = s

  wrap.appendChild(canvas)

  s.ro = observeResize(s, wrap)

  s.raf = requestAnimationFrame(() => tick(host))

  if (hasWebGpu()) {
    // Async mount — the portrait shows unmodified until the widget lands
    // (the canvas stays transparent); a failed mount claims 2D inside.
    tryGlitchWasm(host, s)
    return true
  }

  if (!armCtx2d(s)) {
    dropSession(host, s)
    return false
  }

  return true
}

/**
 * Claims the 2D backend on the session canvas and rebuilds the channel
 * ghosts + scanline tile against the already-measured cover rect. Called
 * directly when WebGPU is absent and by the wasm arm on mount/upload
 * failure — the painter pipeline is the permanent fallback.
 * @param s Live session (geometry already measured).
 * @returns false when the context claim fails — the session is unusable.
 */
export function armCtx2d(s: GlitchSession): boolean {
  s.ctx = s.canvas.getContext(WEBGL_STRINGS.CONTEXT_2D) as CanvasRenderingContext2D | null

  if (!s.ctx) return false

  s.red = buildChannel(s, CANVAS_STRINGS.CHANNEL_RED)
  s.cyan = buildChannel(s, CANVAS_STRINGS.CHANNEL_CYAN)
  s.scan = buildScanlines()

  return true
}

/**
 * Tears a session down in place — stops the loop, destroys the wasm
 * widget, disconnects the observer, removes the overlay and un-parks it
 * from the host. Used by the wasm arm when every backend failed and by
 * disarmGlitch for normal teardown.
 * @param host The component the session was parked on.
 * @param s The session to kill.
 */
export function dropSession(host: AboutSection, s: GlitchSession): void {
  s.active = false

  if (s.raf) cancelAnimationFrame(s.raf)

  s.ro?.disconnect()

  s.wasm?.destroy()
  s.wasm = null

  s.canvas.remove()

  if (host._glitch === s) host._glitch = null
}

/**
 * Re-homes the session after a shadow re-render: the old wrapper/img were
 * discarded, so the canvas is re-appended to the fresh wrapper and the
 * geometry + channel ghosts are rebuilt against the new image node.
 */
export function healSession(host: AboutSection, s: GlitchSession): boolean {
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
export function tick(host: AboutSection): void {
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

    if (s.wasm) uploadGlitchBitmap(s)
  }

  if (s.wasm) {
    frameGlitchWasm(s)
    return
  }

  frame(s)
}

/**
 * The un-armed half of the loop: polls at ~4 Hz until the portrait has
 * decoded enough to arm, then hands off to the session's own raf chain.
 */
export function poll(host: AboutSection): void {
  if (!host._isMounted || host._glitch) return

  const wrap = picWrap(host)

  if (wrap && armGlitch(host, wrap)) return

  // Not ready yet — slow retry while the component stays mounted.
  setTimeout(() => {
    if (!host._glitch) requestAnimationFrame(() => poll(host))
  }, 1000 / _POLL_HZ)
}
