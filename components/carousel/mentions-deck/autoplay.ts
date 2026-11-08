/**
 * @file mentions-deck/autoplay.ts — auto-advance RAF ticker for
 * <mentions-deck>. When accumulated dwell reaches `duration` it advances
 * one card and rebases the clock — the ring offset wraps so the loop never
 * needs clone slides. pauseAutoplay/resumeAutoplay let hover and drag
 * freeze the dwell mid-cycle without losing the spent fraction.
 */

import store from '@core/store.js'
import type { MentionsDeck } from '../MentionsDeck.js'

/**
 * Starts the auto-advance ticker. Bails (and actively stops any running
 * cycle) under reduced-motion, before ≥50% visibility, or while a
 * page-covering overlay owns the frame — autoplay must never run on an
 * unseen, covered, or motion-sensitive deck. Re-bases the clock on each
 * start so a fresh cycle always gets a full dwell.
 * @param host The MentionsDeck element.
 */
export function startAutoplay(host: MentionsDeck): void {
  if (store.getters.getReducedMotion() || !host.isFullyVisible || store.getters.getOverlayOpen()) {
    host._stopAutoplay()
    return
  }

  host.autoplayRunning = true
  host.autoplayStart = performance.now()
  host.autoplayElapsed = 0

  tickAutoplay(host)
}

/**
 * Stops auto-advance (reduced-motion, offscreen, overlay). Cancels the
 * pending RAF so no stray tick survives and clears the dwell accumulation.
 * @param host The MentionsDeck element.
 */
export function stopAutoplay(host: MentionsDeck): void {
  host.autoplayRunning = false
  host.autoplayElapsed = 0

  if (host.autoplayRafId !== null) cancelAnimationFrame(host.autoplayRafId)
  host.autoplayRafId = null
}

/**
 * Freezes the dwell clock (hover, committed drag) — accumulates the
 * partially-spent dwell into autoplayElapsed and cancels the RAF, but
 * keeps autoplayRunning so resumeAutoplay can re-arm the ticker.
 * @param host The MentionsDeck element.
 */
export function pauseAutoplay(host: MentionsDeck): void {
  if (!host.autoplayRunning) return

  host.autoplayElapsed += performance.now() - (host.autoplayStart ?? 0)

  if (host.autoplayRafId !== null) cancelAnimationFrame(host.autoplayRafId)
  host.autoplayRafId = null
}

/**
 * Re-arms the dwell clock after a pause — a no-op when autoplay is not
 * running or a tick is already scheduled, and it never resurrects a cycle
 * the gates (reduced-motion, visibility, overlay) would refuse.
 * @param host The MentionsDeck element.
 */
export function resumeAutoplay(host: MentionsDeck): void {
  if (!host.autoplayRunning || host.autoplayRafId !== null) return

  if (store.getters.getReducedMotion() || !host.isFullyVisible || store.getters.getOverlayOpen()) {
    host._stopAutoplay()
    return
  }

  host.autoplayStart = performance.now()

  host.autoplayRafId = requestAnimationFrame(() => tickAutoplay(host))
}

/**
 * Autoplay RAF tick — advances once `duration` has elapsed. The elapsed
 * calculation `now - start + accumulated` lets pause/resume continue a
 * partially-spent dwell instead of restarting it. `activeIdx + 1` wraps
 * via goTo's ring normalization — no clone slides needed.
 * @param host The MentionsDeck element.
 */
export function tickAutoplay(host: MentionsDeck): void {
  if (!host.autoplayRunning) return

  const now = performance.now()
  const elapsed = now - (host.autoplayStart ?? 0) + host.autoplayElapsed

  if (elapsed >= host.duration) {
    host.goTo(host.activeIdx + 1)
    host.autoplayElapsed = 0
    host.autoplayStart = performance.now()
  }

  host.autoplayRafId = requestAnimationFrame(() => tickAutoplay(host))
}
