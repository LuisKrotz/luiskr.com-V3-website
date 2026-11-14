/**
 * @file media/mosaic/events.ts
 * @description Scoped listener bindings for <media-mosaic> — the
 * matchMedia breakpoint that swaps the masonry wall for the regular
 * carousel at ≤1024px, and the host ResizeObserver that repacks the wall
 * when its width moves between grid steps.
 */
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { FORM_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { INTERNAL_MOSAIC } from '@core/tokens/layout/masonry.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { printJobActive } from '@core/utils/print/print.js'
import { scheduleLayout } from './layout.js'
import type { MediaMosaic } from '../MediaMosaic.js'

/**
 * Binds the mosaic's runtime listeners: (1) the ≤1024px media query whose
 * flips re-render between the carousel and the packed wall (repack forced
 * on re-entry so a changed width can't reuse stale tile geometry), and
 * (2) a ResizeObserver on the host that repacks on real width changes —
 * sub-pixel reports under FIT_EPS_PX are dropped to avoid a re-fit storm.
 * @param host The MediaMosaic element.
 */
export function bindMediaMosaicEvents(host: MediaMosaic): void {
  host._mq =
    typeof window !== TYPE_STRINGS.UNDEFINED && typeof window.matchMedia === TYPE_STRINGS.FUNCTION
      ? window.matchMedia(`(max-width: ${INTERNAL_MOSAIC.CAROUSEL_MAX_W}${COMMON_ATTRS.PX})`)
      : null

  host._isCompact = Boolean(host._mq?.matches)

  if (host._mq) {
    host.addScopedListener(host._mq, FORM_EVENTS.CHANGE, () => {
      // Print jobs freeze the screen-time publishers — a mid-snapshot
      // re-render (compact flip to the carousel path or an absolute repack)
      // would swap the parked wall out from under the fragmentainer and
      // strand runs of empty sheets.
      if (printJobActive()) return

      const compact = Boolean(host._mq?.matches)

      if (compact === host._isCompact) return

      host._isCompact = compact

      host._packedW = 0

      host._updateDom()

      if (!compact) scheduleLayout(host)
    })
  }

  if (typeof ResizeObserver === TYPE_STRINGS.UNDEFINED) return

  host._ro = new ResizeObserver((entries) => {
    // Same freeze — the RO fires when the print layout viewport resizes to
    // the page box, which is exactly when a repack must not run.
    if (printJobActive()) return

    const width = entries[0]?.contentRect?.width || 0

    if (Math.abs(width - host._lastObservedW) < CAROUSEL_LAYOUT.FIT_EPS_PX) return

    host._lastObservedW = width

    scheduleLayout(host)
  })

  host._ro.observe(host)
}
