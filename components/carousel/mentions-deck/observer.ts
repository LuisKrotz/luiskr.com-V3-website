/**
 * @file mentions-deck/observer.ts — the visibility gate for autoplay and
 * the resize refit for <mentions-deck>.
 */

import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import type { MentionsDeck } from '../MentionsDeck.js'

/**
 * Autoplay only runs while ≥50% of the deck is on screen (threshold
 * [0, 0.5] gives a clean two-state signal); below that or under
 * reduced-motion it pauses — offscreen animation would burn frames the
 * user can't see. When IntersectionObserver itself is absent (very old
 * engines, some test DOMs) the deck degrades to always-visible so content
 * still shows.
 * @param host The MentionsDeck element.
 */
export function setupObserver(host: MentionsDeck): void {
  if (typeof IntersectionObserver === TYPE_STRINGS.UNDEFINED) {
    host.isFullyVisible = true
    host.isEnteredViewport = true
    if (!store.getters.getReducedMotion() && !store.getters.getOverlayOpen()) host._startAutoplay()
    return
  }

  if (host.observer) {
    host.observer.disconnect()
    host.observer = null
  }

  host.observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          host.isEnteredViewport = true
        }
        const isFullyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5
        host.isFullyVisible = isFullyVisible

        if (isFullyVisible) {
          if (!store.getters.getReducedMotion() && !store.getters.getOverlayOpen()) {
            host._startAutoplay()
          }
        } else {
          host._stopAutoplay()
        }
      })
    },
    { threshold: [0, 0.5] }
  )
  host.observer.observe(host)
}

/**
 * Refits on container resize — re-measures the card box and rewrites
 * poses against the new geometry without animation.
 * @param host The MentionsDeck element.
 */
export function onResize(host: MentionsDeck): void {
  host.measure()

  host.applyPoses()
}
