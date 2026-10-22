/**
 * @file media/expanded-close.ts
 * @description Dismissal sequence for <media-expanded>: the genie warp
 * collapses the media back into the origin figure, then the teardown
 * runs — strip the media slug from the URL (undo
 * MediaFigure.openModal's deep-link), close the native <dialog>
 * (releasing the top layer + focus trap), and restore the scroll
 * position saved in modal.transform. When the genie cannot run the
 * legacy CSS zoom-out covers the exit (GENIE_FALLBACK.CLOSE_MS delay);
 * under reduced motion the teardown is immediate — no animation, no
 * wait — so motion-sensitive users get an instant close.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { EXPAND_MODAL_CLASSES, MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { GENIE_FALLBACK } from '@core/tokens/motion/genie.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { restoreMediaModalTrigger } from '../modal-trigger.js'
import { startGenieClose } from './genie.js'
import type { MediaExpanded } from '../MediaExpanded.js'

/**
 * The modal teardown — runs on genie settle (or immediately on the
 * reduced-motion/fallback paths). Order matters: the URL is restored
 * while the dialog still owns the top layer, then `close()` releases
 * the trap, then scroll + store reset hand the page back.
 * @param el — the element
 */
const teardownExpandedModal = (el: MediaExpanded): void => {
  // 1. Restore URL by removing image slug
  const currentPath = window.location.pathname.replace(/\/$/, ATTR_VALUES.EMPTY)

  const segments = currentPath.split(CHAR_STRINGS.SLASH)

  const portIdx = segments.indexOf(ROUTE_PATHS.PORTFOLIO_SEGMENT)

  if (portIdx !== -1 && segments.length > portIdx + 2) {
    const basePath = segments.slice(0, portIdx + 2).join(CHAR_STRINGS.SLASH)

    window.history.replaceState({}, ATTR_VALUES.EMPTY, basePath)
  }

  // 2. Native dialog close
  const dialog =
    (el.closest(HTML_TAGS.DIALOG) as HTMLDialogElement | null) ||
    (document.querySelector(
      `${HTML_TAGS.DIALOG}.${MODAL_CLASSES.MODAL_ABOVE}`
    ) as HTMLDialogElement | null)

  if (dialog && typeof dialog.close === TYPE_STRINGS.FUNCTION && dialog.open) {
    dialog.close()
  }

  // 3. Restore document scroll position and modal state cleanly
  const scroll = Number(store.getters.getModal().transform) || 0

  window.scrollTo(0, scroll)

  store.commit(MODAL_MUTATIONS.SET_MODAL, {
    transform: 0,
    class: ATTR_VALUES.EMPTY,
    open: false,
    media: {
      source: ATTR_VALUES.EMPTY,
      thumb: ATTR_VALUES.EMPTY,
      alt: ATTR_VALUES.EMPTY,
      width: 0,
      height: 0,
      isVideo: false,
    },
  })

  // 4. Return focus to the control that opened the modal — the trigger
  //    closure re-queries its figure's expand button (survives figure
  //    re-renders), so AT/keyboard users land back where they started.
  restoreMediaModalTrigger()
}

/**
 * Starts expanded close.
 * @param el — the element
 */
export function startExpandedClose(el: MediaExpanded): void {
  if (el.isClosing) return

  el.isClosing = true

  // Reduced motion: AAA — no animation, no delay; the modal simply
  // closes. The store's SET_MODAL reset also clears el._genie via
  // onDestroy, so nothing dangles.
  if (store.getters.getReducedMotion()) {
    teardownExpandedModal(el)

    return
  }

  // Genie collapse — the media warps back into the origin figure; the
  // teardown is the settle callback. startGenieClose returning false
  // means the transition can't even start → legacy CSS path.
  if (startGenieClose(el, () => teardownExpandedModal(el))) return

  const content = el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT}`)

  if (content) content.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSING)

  setTimeout(() => teardownExpandedModal(el), GENIE_FALLBACK.CLOSE_MS)
}
