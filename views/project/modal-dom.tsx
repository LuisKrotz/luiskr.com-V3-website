/**
 * @file project/modal-dom.tsx
 * @description Imperative expand-modal sync for <view-project>: mirrors
 * the store's modal descriptor into the shadow DOM without re-rendering
 * (a re-render would destroy every mounted carousel). Scroll lock is
 * native — dialog.showModal() puts the page in the inert layer so the
 * document scroll stays frozen at its real position (no transform pin,
 * no shift); open mounts the media, close releases and unmounts.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { h } from '@core/jsx.js'
import store from '@core/store.js'
import type { ViewProject } from './Project.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'

/** Store → DOM modal sync (open: showModal + mount media; close: release). */
export function updateModalDOM(view: ViewProject): void {
  const modal = store.getters.getModal()

  const above: HTMLDialogElement | null =
    view.$<HTMLDialogElement>(`dialog.${MODAL_CLASSES.MODAL_ABOVE}`) ||
    view.$<HTMLDialogElement>(`.${MODAL_CLASSES.MODAL_ABOVE}`)

  if (modal?.open) {
    if (above) {
      if (typeof above.showModal === TYPE_STRINGS.FUNCTION && !above.open) {
        above.showModal()
      }

      // Check if media-expanded already mounted with same source
      const existing = above.querySelector(COMPONENT_TAGS.MEDIA_EXPANDED)

      const src = modal.media?.source || ATTR_VALUES.EMPTY

      if (!existing || existing.getAttribute(MEDIA_ATTRS.SOURCE) !== src) {
        above.replaceChildren(
          <media-expanded
            source={modal.media?.source || ATTR_VALUES.EMPTY}
            thumb={modal.media?.thumb || ATTR_VALUES.EMPTY}
            alt={modal.media?.alt || ATTR_VALUES.EMPTY}
            width={modal.media?.width || GENERIC_DIMENSIONS.DEFAULT_WIDTH}
            height={modal.media?.height || GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
            is-video={modal.media?.isVideo ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE}
          />
        )
      }
    }
  } else {
    // Release the top layer and unmount expanded media — the document
    // scroll never moved (native inert lock), so nothing restores here.
    if (above) {
      if (typeof above.close === TYPE_STRINGS.FUNCTION && above.open) {
        above.close()
      }

      above.replaceChildren()
    }
  }
}

/** Store change → reload on locale switch, otherwise sync modal DOM. */
export function onProjectStoreUpdate(view: ViewProject): void {
  const currentLocale = store.getters.getLang()

  if (view._lastLocale && view._lastLocale !== currentLocale) {
    view._lastLocale = currentLocale

    view.loadData()

    return
  }

  // Handle modal open/close imperatively to avoid destroying carousels
  view._updateModalDOM()
}
