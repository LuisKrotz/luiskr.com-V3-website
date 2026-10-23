/**
 * @file media/media-modal.ts
 * @description Expand-modal open for MediaFigure — commits the media descriptor to the store and deep-links the caption slug into the path via replaceState.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { EXPAND_MODAL_CLASSES, MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ROUTE_PATHS } from '@core/tokens/routes.js'
import { ROUTE_STRINGS } from '@core/tokens/strings/routes.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { encodeMediaUrl } from '@core/utils/media.js'
import { mediaSlugSeq } from '@core/utils/index.js'
import { setMediaModalTrigger } from '../modal-trigger.js'
import type { MediaFigure } from '../MediaFigure.js'

/**
 * Resolves the figure's canonical deep-link slug — walks the tree-scope's
 * `media-figure` elements in document order applying the same
 * `mediaSlugSeq` numbering the build emit, sitemap, `checkAutoOpenModal`,
 * and the genie's `figureForUrl` use, then returns this figure's slug.
 * The raw `slugify(label)` form is NOT written: uncapped labels exceed
 * the emitted path length and un-ordinaled duplicates point nowhere, so
 * a reload would never match an item and reopen the modal.
 * @param c The <media-figure> component being opened.
 * @returns The canonical media slug, or '' when unslugifiable.
 */
const figureSeqSlug = (c: MediaFigure): string => {
  const root =
    typeof c.getRootNode === TYPE_STRINGS.FUNCTION ? (c.getRootNode() as ParentNode | null) : null

  if (!root || typeof root.querySelectorAll !== TYPE_STRINGS.FUNCTION) {
    return ATTR_VALUES.EMPTY
  }

  const seen = new Map<string, number>()

  for (const fig of Array.from(root.querySelectorAll(COMPONENT_TAGS.MEDIA_FIGURE))) {
    const label = fig.getAttribute(FORM_ATTRS.LABEL) || ATTR_VALUES.EMPTY

    // Same gate as figureForUrl: every labelled figure consumes a
    // sequence slot so DOM-order ordinals stay aligned.
    if (!label) continue

    const slug = mediaSlugSeq(seen, label)

    if (fig === c) return slug
  }

  return ATTR_VALUES.EMPTY
}

/**
 * Opens media modal.
 * @param c — the component
 */
export function openMediaModal(c: MediaFigure): void {
  if (!c.canExpand) return

  // Record the trigger so close restores focus to this figure's expand
  // control — resolved lazily (the shadow button is re-queried at
  // restore time, surviving any figure re-render while the modal sat
  // open).
  setMediaModalTrigger(() => {
    const openBtn = c.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_1}`) as HTMLElement | null

    if (openBtn?.isConnected) openBtn.focus()
  })

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
  const slug = figureSeqSlug(c)

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
