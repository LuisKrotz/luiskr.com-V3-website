/**
 * @file about/hud.ts — the location-coordinate readouts orbiting the about
 * portrait ("places & locations" animation).
 *
 * Two tiny HUD clusters float just outside the wave ring — a name/detail
 * readout on the left and a LATITUDE/LONGITUDE readout on the right — and
 * cycle through the `locations` array of the pages/about CMS node every
 * HUD_TICK_MS. Each cycle fades the clusters out, swaps the text at the
 * opacity trough, and fades back in — a compositor-only transition, no
 * layout work.
 *
 * The session is self-healing like the glitch one: a shadow-root re-render
 * detaches the spans, so every write re-resolves the live nodes — index and
 * timer survive re-renders without leaking. Locations missing from the CMS
 * node leave the HUD unrendered entirely; a single location renders it
 * statically. Reduced-motion never starts the cycle.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import store from '@core/store.js'
import type { AboutSection } from '../AboutSection.js'

/** One coordinate entry of the pages/about `locations` array. */
export interface AboutLocation {
  /** Place label — e.g. 'UFSM Frederico Westphalen'. */
  name?: string
  /** DMS-formatted latitude readout — e.g. `27° 23' 50" S`. */
  latitude?: string
  /** DMS-formatted longitude readout — e.g. `53° 25' 39" W`. */
  longitude?: string
  /** Optional altitude readout — e.g. '480 m'. */
  altitude?: string
}

/** The four readout lines rendered into the two HUD clusters. */
export interface HudLines {
  name: string
  detail: string
  lat: string
  lon: string
}

/** Live HUD session parked on the host — index + timers. */
export interface HudSession {
  /** Index into host.aboutLocations currently displayed. */
  index: number
  /** The cycle interval — null when the HUD is static. */
  timer: ReturnType<typeof setInterval> | null
  /** Pending mid-fade text swap — cleared on disarm. */
  pending: ReturnType<typeof setTimeout> | null
}

/** Cycle cadence — one location every ~5s keeps the HUD readable. */
const HUD_TICK_MS = 5200

/** Fade trough before the text swap — matches the CSS opacity transition. */
const HUD_FADE_MS = 450

/** Selector for the HUD container inside the host's shadow root. */
const _HUD_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_HUD}`

/**
 * Formats one location into the four readout lines. The detail line prefers
 * the altitude record and falls back to the latitude — always a real
 * coordinate, never chrome filler.
 * @param loc the location entry
 * @returns the four HUD line strings
 */
export function hudLines(loc: AboutLocation | undefined): HudLines {
  return {
    name: loc?.name || CHAR_STRINGS.EMPTY,
    detail: loc?.altitude
      ? `${NAV_TEXT.ALTITUDE} ${loc.altitude}`
      : loc?.latitude || CHAR_STRINGS.EMPTY,
    lat: `${NAV_TEXT.LATITUDE} ${loc?.latitude || CHAR_STRINGS.EMPTY}`,
    lon: `${NAV_TEXT.LONGITUDE} ${loc?.longitude || CHAR_STRINGS.EMPTY}`,
  }
}

/**
 * Writes the session's current-index lines into the live HUD spans. Safe on
 * every render pass: re-resolves the nodes each call so a detached HUD (or
 * a session that predates the spans) just no-ops.
 * @param host The <about-section> component the session parks on.
 */
export function syncHud(host: AboutSection): void {
  const s = host._hud
  const locations = host.aboutLocations

  if (!s || !locations.length) return

  const hud = host.shadowRoot?.querySelector(_HUD_SEL)

  if (!hud) return

  const lines = hudLines(locations[s.index % locations.length])

  // Our own markup is fixed: hud children are [name cluster, coords
  // cluster], each carrying exactly two line spans — children[i] is the
  // readout pair, no probing needed.
  const name = hud.children[0]
  const coords = hud.children[1]

  name.children[0].textContent = lines.name
  name.children[1].textContent = lines.detail
  coords.children[0].textContent = lines.lat
  coords.children[1].textContent = lines.lon
}

/**
 * Advances the HUD one location: flags the clusters out, then swaps the
 * text at the opacity trough and lets the transition carry them back in.
 * @param host The <about-section> component the session parks on.
 */
export function cycleHud(host: AboutSection): void {
  const s = host._hud
  const locations = host.aboutLocations

  if (!s || locations.length < 2) return

  const hud = host.shadowRoot?.querySelector(_HUD_SEL)

  if (hud) hud.classList.add(ABOUT_CLASSES.ABOUT_HUD_OUT)

  s.pending = setTimeout(() => {
    s.pending = null
    s.index = (s.index + 1) % locations.length

    syncHud(host)

    const live = host.shadowRoot?.querySelector(_HUD_SEL)

    if (live) live.classList.remove(ABOUT_CLASSES.ABOUT_HUD_OUT)
  }, HUD_FADE_MS)
}

/**
 * Seeds the HUD session and, when the CMS carries more than one location
 * and motion is allowed, starts the cycle interval. Idempotent.
 * @param host The <about-section> component the session parks on.
 */
export function attachHud(host: AboutSection): void {
  if (!host._hud) host._hud = { index: 0, timer: null, pending: null }

  // Re-evaluated on every render pass — translations landing AFTER mount
  // must still arm the cycle once the locations array exists.
  if (host._hud.timer || host.aboutLocations.length < 2) return

  if (store.getters.getReducedMotion?.()) return

  host._hud.timer = setInterval(() => cycleHud(host), HUD_TICK_MS)
}

/**
 * Stops the cycle and clears the pending swap — the session object itself
 * stays parked so the index survives a re-arm.
 * @param host The <about-section> component the session parks on.
 */
export function disarmHud(host: AboutSection): void {
  const s = host._hud

  if (!s) return

  if (s.timer) clearInterval(s.timer)
  if (s.pending) clearTimeout(s.pending)

  s.timer = null
  s.pending = null
}
