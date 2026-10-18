/**
 * @file draw-text/trigger.ts — trigger wiring (viewport observer / prop /
 * immediate) and the reveal sequence.
 *
 * The reveal mounts char spans in the visible state; the CSS staggers
 * each span via `--i · --char-delay + --offset`, and a done-timer
 * collapses them back to word nodes once the last character has landed:
 *   lastCharDelay = offset + (chars−1)·delay — when the final char starts
 *   totalMs       = lastCharDelay + EXTRA_MS (one transition duration
 *                   of slack), clamped to MAX_MS for pathological texts
 * The rootMargin on the observer starts the animation just before the
 * element is visible — text appears to be mid-reveal as it scrolls in.
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DRAW_TEXT_CLASSES } from '@core/tokens/classes/draw-text.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { stripHtml } from '@core/utils/string.js'
import { onScrollStop } from '@core/utils/motion/scroll-state.js'
import { tryGpuDraw } from './gpu.js'
import type { DrawText } from '../DrawText.js'
import { DRAW_TIMINGS } from '@core/tokens/media/dimensions.js'

/**
 * Reduced-motion gate — true when the OS/site prefers-reduced-motion flag
 * is on; draw-text skips its per-character animation in that case.
 * @returns {boolean} whether reduced motion is active
 */
function isReducedMotion(): boolean {
  return (
    typeof document !== TYPE_STRINGS.UNDEFINED &&
    document.documentElement.classList.contains(STATE_CLASSES.REDUCED_MOTION)
  )
}

/**
 * Ordered-reveal session clock. Elements carrying the `ordered` attribute
 * treat `offset` as a scheduled start time on this shared clock rather
 * than a delay after their own trigger — so a document's draw-texts
 * cascade in document order even when several enter the viewport in the
 * same frame. `_orderedT0` anchors at the first ordered trigger; when an
 * ordered element triggers late (user scrolled past un-played items),
 * elapsed time is subtracted so it starts immediately instead of waiting
 * out a stale schedule. The clock resets when the last ordered element
 * disconnects (view swap), so each page starts a fresh session.
 */
let _orderedT0: number | null = null

/** Connected `ordered` draw-texts — the session ends when this empties. */
const _orderedLive = new Set<DrawText>()

/**
 * Registers an ordered element in the reveal session. Idempotent —
 * setupTrigger re-runs on text/attr changes, the Set dedups.
 * @param host The draw-text host element.
 */
export function registerOrdered(host: DrawText): void {
  if (host.ordered) _orderedLive.add(host)
}

/**
 * Drops the element from the ordered session; resets the shared clock
 * when the set empties so the next view starts a fresh cascade.
 * @param host The draw-text host element.
 */
export function teardownTrigger(host: DrawText): void {
  _orderedLive.delete(host)

  if (_orderedLive.size === 0) _orderedT0 = null
}

/**
 * Resolves how long this element must still wait: ordered elements
 * subtract elapsed session time from their scheduled offset (never below
 * zero), unordered elements keep their raw offset semantics.
 * @param host The draw-text host element.
 * @returns The effective start offset in ms for this trigger.
 */
function resolveEffectiveOffset(host: DrawText): number {
  if (!host.ordered) return host.offset

  const now = performance.now()

  if (_orderedT0 === null) _orderedT0 = now

  return Math.max(0, host.offset - (now - _orderedT0))
}

/** Wires the active trigger mode (observer, hover, manual). */
export function setupTrigger(host: DrawText): void {
  registerOrdered(host)

  const trigger = host.triggerMode

  const text = host.text

  if (!text) return

  if (isReducedMotion()) {
    host._hasAnimated = true

    host._isVisible = true

    host._updateDom()

    return
  }

  if (trigger === COMMON_ATTRS.TRIGGER_VIEWPORT) {
    if (host._observer) host._observer.disconnect()

    host._observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || !entry.isIntersecting) return

        if (host._observer) {
          host._observer.disconnect()

          host._observer = null
        }

        // Mounting hundreds of char spans mid-scroll is the scroll-jank
        // source mobile benchmarks flag — the word-level render is already
        // on screen, so hold the reveal until the gesture settles. When the
        // window isn't scrolling, onScrollStop fires immediately (same
        // behavior as the old direct rAF).
        onScrollStop(() => {
          requestAnimationFrame(() => {
            host._startAnimation()
          })
        })
      },
      {
        threshold: DRAW_TIMINGS.DRAW_OBSERVER_THRESHOLD,
        rootMargin: QUERY_STRINGS.ROOT_MARGIN_50,
      }
    )

    host._observer.observe(host)
  } else if (trigger === COMMON_ATTRS.PROP) {
    if (host.visible) {
      host._startAnimation()
    }
  } else {
    host._startAnimation()
  }
}

/** Runs the reveal sequence (see file header for the timing math). */
export function startAnimation(host: DrawText): void {
  if (host._isVisible) return

  host._isVisible = true

  if (isReducedMotion()) {
    host._hasAnimated = true

    host._updateDom()

    return
  }

  // Ordered elements read their offset against the shared session clock —
  // resolved once here so the rendered --offset and the done-timer agree.
  const effectiveOffset = resolveEffectiveOffset(host)

  host._effectiveOffset = effectiveOffset

  // Mount the per-character spans only now, in the visible state
  host._updateDom()

  const rootEl = host._rootEl

  const chars = stripHtml(host.text).length

  const lastCharDelay = effectiveOffset + Math.max(0, chars - 1) * host.delay

  // The collapse must outlast the LAST scheduled char — clamping to a
  // fixed ceiling fired the timer mid-schedule on ordered pages (legal
  // docs schedule items seconds out), snapping every unanimated char
  // visible at once as a solid block of text.
  const totalMs = lastCharDelay + DRAW_TIMINGS.DRAW_ANIM_EXTRA_MS

  if (host._animTimer) clearTimeout(host._animTimer)

  host._animTimer = setTimeout(() => {
    host._hasAnimated = true

    if (rootEl) {
      rootEl.classList.add(DRAW_TEXT_CLASSES.DRAW_TEXT_DONE)

      rootEl.classList.remove(DRAW_TEXT_CLASSES.DRAW_TEXT_VISIBLE)
    }

    // Animation finished: collapse the char spans back into words
    host._updateDom()
  }, totalMs)

  host._animTimer?.unref?.()

  // WebGPU reveal — when the artifact mounts, the instanced-draw canvas
  // takes over the stagger (the CSS spans keep animating invisibly so
  // done-time lands on the same state). No-ops without navigator.gpu.
  tryGpuDraw(host, totalMs)
}
