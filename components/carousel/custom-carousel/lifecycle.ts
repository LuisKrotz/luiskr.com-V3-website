/**
 * @file carousel-lifecycle.ts — mount/update/teardown for
 * <custom-carousel>: initial relayout, the resize listener, store
 * subscription side-effects (reduced-motion + modal open → autoplay
 * gating), and widget/observer teardown.
 */

import store from '@core/store.js'
import { onMediaManifest } from '@core/utils/media/manifest.js'
import type { CustomCarousel } from '../CustomCarousel.js'

/**
 * Mount: first render pass, resize binding, fit observer, store sub.
 * `_markAdjacentLoaded(0)` pre-flags the first neighborhood before the
 * observer's first callback so slide media starts loading immediately.
 */
export function onMounted(host: CustomCarousel): void {
  if (host.items && host.items.length) {
    host._updateDom()
  }

  host._markAdjacentLoaded(0)

  host._setupAfterRender()

  host._startFitObserver()

  host.subscribe(store)

  // The covers manifest is boot-idle-deferred — the first slide render
  // emits originals-only <img>s; on arrival the rebuild emits proven
  // webp thumbs and the browser re-fetches the light variants.
  host._unsubManifest = onMediaManifest(() => {
    host._updateDom()
  })
}

/** Disconnects the ResizeObserver tracking the host width. */
export function onUnmounted(host: CustomCarousel): void {
  if (host._fitObserver) {
    host._fitObserver.disconnect()

    host._fitObserver = null
  }
}

/**
 * Store change → propagate reduced-motion to both arrows and gate
 * autoplay on reduced-motion / any open overlay (expand modal, nav
 * menu, preferences or language dialog). The resume arm requires BOTH
 * `isActive` (carousel mode, not side-by-side) and `isFullyVisible` —
 * an overlay closing must not revive a carousel that's offscreen.
 */
export function onStoreUpdate(host: CustomCarousel): void {
  const isReduced = store.getters.getReducedMotion()

  const isOverlay = store.getters.getOverlayOpen()

  host._prevArrow?.setReducedMotion(isReduced)

  host._nextArrow?.setReducedMotion(isReduced)

  if (isReduced || isOverlay) {
    host._stopAutoplay()
  } else if (host.isActive && host.isFullyVisible) {
    host._startAutoplay()
  }
}

/** Teardown: autoplay clock, WebGL arrows, observers, timers — every async handle released so nothing fires after disconnect. */
export function onDestroy(host: CustomCarousel): void {
  host._stopAutoplay()

  if (host._prevArrow) {
    host._prevArrow.destroy()

    host._prevArrow = null
  }

  if (host._nextArrow) {
    host._nextArrow.destroy()

    host._nextArrow = null
  }

  if (host.observer) {
    host.observer.disconnect()

    host.observer = null
  }

  host._cancelNavSpring()

  host._unsubManifest?.()

  host._unsubManifest = null
}
