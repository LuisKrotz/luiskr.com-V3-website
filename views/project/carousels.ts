/**
 * @file routes/views/project/carousels.ts
 * @description Carousel binding for ViewProject — configures each <custom-carousel> from the section data, eagerly for the first few and in idle batches for the rest.
 */

import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import type { ViewProject } from './Project.js'
import type { CustomCarouselElement, ProjectMediaItem } from './types.js'
import { CAROUSEL_LAYOUT, CAROUSEL_LOADING } from '@core/tokens/motion/carousel.js'
import { INTERNAL_MOSAIC } from '@core/tokens/layout/masonry.js'
import { viewportWidth } from '@core/utils/dom.js'

/**
 * Desktop downscale for one carousel item — the division calc is for
 * WIDTH, not height: each ladder step (÷2 → ÷1.5 → ÷1.75) compounds on
 * the running width while the result still clears DESKTOP_SCALE_MIN_W;
 * once the media falls under the width check (the next step would drop
 * it below the floor), the accumulated divisor is applied to height —
 * aspect preserved. A 1980px item lands ~377px wide, a 997px item
 * ~332px; small items below the first step stay natural.
 * `naturalSize` keeps the untouched CMS dims — the expand modal stamps
 * those (the modal never reduces) while `size` stays the display
 * contract for the carousel's dense-pixel render.
 * @param item The media item (mutates a shallow copy's `size` only).
 * @returns A copy with the scaled `size` + recorded `naturalSize`, or the item unchanged.
 */
export function scaleCarouselItem(item: ProjectMediaItem): ProjectMediaItem {
  const size = item.size

  if (!size || size[0] <= 0) return item

  let divisor = 1

  let w = size[0]

  for (const d of CAROUSEL_LAYOUT.DESKTOP_SCALE_STEPS) {
    const next = w / d

    if (!(next > CAROUSEL_LAYOUT.DESKTOP_SCALE_MIN_W)) break

    divisor *= d

    w = next
  }

  if (divisor === 1) return item

  return { ...item, size: [w, size[1] / divisor], naturalSize: size }
}

/**
 * Binds project carousels.
 * @param view — the view
 */
export function bindProjectCarousels(view: ViewProject): void {
  // Both media renderers share the configure({items, folder, forceActive})
  // contract — <media-mosaic> elements sit alongside <custom-carousel> in
  // document order so the eager/deferred split stays viewport-accurate.
  const carousels = view.$$<CustomCarouselElement>(
    `${COMPONENT_TAGS.CUSTOM_CAROUSEL}, ${COMPONENT_TAGS.MEDIA_MOSAIC}`
  )

  const configure = (c: CustomCarouselElement) => {
    const idx = parseInt(c.getAttribute(DATA_ATTRS.DATA_CAROUSEL_IDX) || '0', 10)

    const secIdx = parseInt(c.getAttribute(DATA_ATTRS.DATA_SEC_IDX) || '0', 10)

    const items = view.translations?.sections?.[secIdx]?.[idx] as ProjectMediaItem[] | undefined

    if (!items) return

    // Desktop carousel items render oversized — downscale intrinsic
    // sizes through the ladder (÷2 → ÷1.5 → ÷1.75) so the display box
    // stays denser than the source. Carousel path only: the mosaic wall
    // runs its own divisor ladder, and ≤640px keeps natural sizes.
    const scaleItems =
      viewportWidth() > INTERNAL_MOSAIC.CAROUSEL_MAX_W && !view.isMosaicGroup(items)

    c.configure({
      items: scaleItems ? items.map(scaleCarouselItem) : items,
      folder: view.translations?.folder || ATTR_VALUES.EMPTY,
      forceActive: view.isLandscapeGroup(items) || items.length > 2,
    })
  }

  // The first carousels can be in the initial viewport: render them now.
  // The rest (below the fold) are rendered in small idle batches so one
  // frame never has to lay out a dozen carousels at once.
  const eager = carousels.slice(0, CAROUSEL_LOADING.EAGER_COUNT)

  const deferred = carousels.slice(CAROUSEL_LOADING.EAGER_COUNT)

  eager.forEach(configure)

  if (view._bindIdle) {
    // Cancel through the same api that scheduled it (see schedule below):
    // rIC handles and timer handles are independent counters — a blind
    // clearTimeout() on an rIC id cancels an unrelated pending timer.
    if (typeof cancelIdleCallback === TYPE_STRINGS.FUNCTION) {
      cancelIdleCallback(view._bindIdle)
    } else {
      clearTimeout(view._bindIdle)
    }
  }

  const schedule = (fn: () => void): number =>
    typeof requestIdleCallback === TYPE_STRINGS.FUNCTION
      ? requestIdleCallback(fn, { timeout: CAROUSEL_LOADING.DEFERRED_TIMEOUT })
      : setTimeout(fn, CAROUSEL_LOADING.DEFERRED_TIMEOUT)

  const step = () => {
    if (!view._isMounted) return

    deferred.splice(0, CAROUSEL_LOADING.BATCH_SIZE).forEach(configure)

    view._bindIdle = deferred.length ? schedule(step) : null
  }

  view._bindIdle = deferred.length ? schedule(step) : null
}
