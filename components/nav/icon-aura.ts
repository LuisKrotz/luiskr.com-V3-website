/**
 * @file nav/icon-aura.ts
 * @description The WASM aura over <app-nav>'s strip chips — reuses
 * `mountRingFill` (WebGPU, gated behind ?debug=webgpuWidgets:active) to
 * draw the comet-tail + spark trail on the search and gear chip outlines
 * on hover. Each chip is a "tile"; pointerenter/pointerleave drives
 * `setProgress` so the light path sweeps the chip's rounded-rect
 * perimeter the way the route-search field's ring-fill works. The CSS
 * trail inside the SVG is the fallback when WebGPU is off.
 */

import { mountRingFill, type RingFillSession } from '@core/utils/gpu/ring-fill.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { ANIMATION_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'

/** Tile selector — the two aura-eligible chips inside the strip. */
const TILES = `.${NAV_CLASSES.NAV_SEARCH_BTN}, .${NAV_CLASSES.NAV_GEAR_BTN}`

/** Host surface — the strip element plus the session field. */
export interface NavIconAuraHost {
  /** Live aura session (null while unmounted / WebGPU off). */
  _navIconAura: RingFillSession | null
}

/**
 * Mounts the ring-fill aura over the strip chips — one instanced
 * WebGPU canvas on the strip container, two tiles (search + gear).
 * Pointer enter/leave on each chip drives `setProgress` so the comet
 * tail sweeps the hovered chip's perimeter. Returns null silently when
 * WebGPU is off — the static SVG trails stay the visible cue.
 * @param host the AppNav element
 * @returns the live aura session, or null
 */
export const mountNavIconAura = (host: HTMLElement & NavIconAuraHost): RingFillSession | null => {
  if (host._navIconAura) return host._navIconAura

  const strip = host.shadowRoot?.querySelector<HTMLElement>(`.${NAV_CLASSES.NAV_MOBILE_STRIP}`)

  if (!strip) return null

  const session = mountRingFill(strip, TILES, NAV_CLASSES.NAV_ICON_AURA_CANVAS)

  if (!session) return null

  // Hover drives the aura — enter fills the chip, leave collapses it.
  strip.querySelectorAll<HTMLElement>(TILES).forEach((tile, i) => {
    tile.addEventListener(POINTER_EVENTS.POINTERENTER, () => session.setProgress(i, 1), {
      passive: true,
    })

    tile.addEventListener(POINTER_EVENTS.POINTERLEAVE, () => session.setProgress(i, 0), {
      passive: true,
    })

    // The chip expands on hover (label pour-in) — re-measure the tile's
    // settled box once the padding transition lands so the aura ring
    // hugs the expanded pill, not the collapsed circle.
    tile.addEventListener(ANIMATION_EVENTS.TRANSITIONEND, () => session.refresh(), {
      passive: true,
    })
  })

  host._navIconAura = session

  return session
}

/** Tears down the aura session + its canvas. */
export const destroyNavIconAura = (host: NavIconAuraHost): void => {
  host._navIconAura?.destroy()

  host._navIconAura = null
}
