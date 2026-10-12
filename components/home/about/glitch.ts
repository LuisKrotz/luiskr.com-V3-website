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
 *
 * The pipeline is split into ./glitch/* modules — types + tunables, the
 * per-frame painters, and session lifecycle — leaving this file as the
 * attach/disarm orchestrator.
 */

import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { _PIC_SEL } from './glitch/types.js'
import { armGlitch, poll } from './glitch/session.js'
import type { AboutSection } from '../AboutSection.js'

export { armGlitch } from './glitch/session.js'
export type { GlitchSession } from './glitch/types.js'

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
