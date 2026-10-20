/**
 * @file media/media-modal.ts
 * @description Expand-modal open for MediaFigure — commits the media descriptor to the store and deep-links the caption slug into the path via replaceState.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ROUTE_PATHS } from '@core/tokens/routes.js'
import { ROUTE_STRINGS } from '@core/tokens/strings/routes.js'
import store from '@core/store.js'
import { encodeMediaUrl } from '@core/utils/media.js'
import type { MediaFigure } from '../MediaFigure.js'

/**
 * Opens media modal.
 * @param c — the component
 */
export function openMediaModal(c: MediaFigure): void {
  if (!c.canExpand) return

  const scrollY = window.scrollY

  const storage = store.getters.getStorage()

  // The genie warp needs the figure's viewport rect — captured before
  // the page pin (translateY(−scrollY) preserves viewport coords, so
  // the snapshot stays valid for the whole modal lifetime).
  const fig = c.$(HTML_TAGS.FIGURE)

  const r = fig?.getBoundingClientRect()

  const origin = r && r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null

  store.commit(MODAL_MUTATIONS.SET_MODAL, {
    transform: scrollY,
    class: MODAL_CLASSES.MODAL_OPEN,
    open: true,
    origin,
    media: {
      source: c.isVideo
        ? c.video[0]
        : encodeMediaUrl(storage + c.mediaSrc + MEDIA.MOZ + MEDIA.Q100 + MEDIA.EXT),
      thumb: c.isVideo
        ? c.poster[0]
        : encodeMediaUrl(storage + c.mediaSrc + MEDIA.MOZ + MEDIA.THUMB_SUFFIX + MEDIA.EXT),
      alt: c.label,
      width: c.mediaWidth,
      height: c.mediaHeight,
      isVideo: c.isVideo,
    },
  })

  // Deep-link the open media: append the caption slug to the current
  // path (base = '/portfolio/<project>' — strips any prior media slug
  // via the segment splice) so a refresh/share reopens this figure.
  // replaceState, not pushState — expanding media isn't a navigation.
  const slug = c.slugify(c.label)

  if (slug) {
    const currentPath = window.location.pathname.replace(/\/$/, ATTR_VALUES.EMPTY)

    const segments = currentPath.split(ROUTE_PATHS.ROOT)

    const portIdx = segments.indexOf(ROUTE_STRINGS.PORTFOLIO)

    let basePath = currentPath

    if (portIdx !== -1 && segments.length > portIdx + 1) {
      basePath = segments.slice(0, portIdx + 2).join(ROUTE_PATHS.ROOT)
    }

    const newPath = `${basePath}${ROUTE_PATHS.ROOT}${slug}`

    if (window.location.pathname !== newPath) {
      window.history.replaceState({}, ATTR_VALUES.EMPTY, newPath)
    }
  }
}
