/**
 * @file cardstack/events.ts — scoped listener bindings for <card-stack>:
 * delegated clicks (controls, cards, index items), keyboard nav, the
 * pointer-swipe stream (deck-gated, passive, coalesced), and resize
 * re-measurement.
 */

import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import {
  CLIPBOARD_EVENTS,
  DRAG_EVENTS,
  FORM_EVENTS,
  KEYBOARD_EVENTS,
  MOUSE_EVENTS,
  POINTER_EVENTS,
  PRINT_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { isPlainClick } from '@core/utils/dom.js'
import { holdAutoplay, toggleAutoplay } from './autoplay.js'
import {
  cardIdxFromEvent,
  closeIndex,
  goTo,
  navigateTo,
  onCardClick,
  onDotClick,
  onKeyDown,
  onNextClick,
  onPrevClick,
  scrollIndexRail,
  toggleIndex,
} from './interactions.js'
import { onPointerDown, onPointerEnd, onPointerMove } from './gestures.js'
import { preparePrint, restorePrint } from './print.js'
import type { CardStack } from '../CardStack.js'

/**
 * Click delegation for the whole shadow root — controls first (toggle,
 * close, prev, next, dots), the text column's "Check out" link, then
 * index items, then cards. Plain
 * clicks SPA-navigate (or reposition the fan); modified clicks fall
 * through to the real anchors so new-tab gestures keep working.
 */
function onDeckClick(host: CardStack, e: Event): void {
  if (host._suppressClick) {
    host._suppressClick = false

    e.preventDefault()

    return
  }

  const target = e.target as Element | null

  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_TOGGLE)) {
    toggleIndex(host)

    return
  }

  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_INDEX_CLOSE)) {
    closeIndex(host)

    return
  }

  // Rail arrows scroll the index list — they never move the fan itself.
  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_INDEX_PREV)) {
    scrollIndexRail(host, -1)

    return
  }

  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_INDEX_NEXT)) {
    scrollIndexRail(host, 1)

    return
  }

  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_PREV)) {
    onPrevClick(host)

    return
  }

  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_NEXT)) {
    onNextClick(host)

    return
  }

  // The play/pause transport is the countdown's only manual control —
  // every other nav path kills autoplay through the wrappers above.
  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_AUTOPLAY)) {
    toggleAutoplay(host)

    return
  }

  // The stacked layouts' compact index affordance — same toggle the
  // header's "view all" pill drives.
  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_NAV_INDEX)) {
    toggleIndex(host)

    return
  }

  const dot = target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_DOT)

  if (dot) {
    onDotClick(host, parseInt(dot.getAttribute(DATA_ATTRS.DATA_INDEX) || CHAR_STRINGS.ZERO, 10))

    return
  }

  // "Check out" in the text column — SPA-navigates to the front card's
  // route; modified clicks keep the real href for new-tab gestures.
  if (target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_INFO_CTA)) {
    if (!isPlainClick(e)) return

    e.preventDefault()

    navigateTo(host, host.deckItems[host.activeIdx])

    return
  }

  const indexItem = target?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_INDEX_ITEM)

  if (indexItem) {
    if (!isPlainClick(e)) return

    e.preventDefault()

    // Index picks bring the card to the front plane — the deck rotates it
    // into view; navigation is the front card's job, not the index's.
    goTo(host, parseInt(indexItem.getAttribute(DATA_ATTRS.DATA_INDEX) || CHAR_STRINGS.ZERO, 10))

    closeIndex(host)

    return
  }

  const card = cardIdxFromEvent(e)

  if (!card) return

  const item = host.deckItems[card.idx]

  if (!item) return

  if (!isPlainClick(e)) return

  e.preventDefault()

  onCardClick(host, item, card.idx)
}

/**
 * Binds every listener the deck needs — shadowRoot delegation covers
 * re-renders (nodes swap per _updateDom, listeners don't); the pointer
 * stream is deck-gated so the index panel and chrome can't drag the fan.
 * @param host The CardStack element.
 */
export function bindEvents(host: CardStack): void {
  host.addScopedListener(host.shadowRoot, MOUSE_EVENTS.CLICK, (e) => {
    onDeckClick(host, e)
  })

  host.addScopedListener(host.shadowRoot, KEYBOARD_EVENTS.KEYDOWN, (e) => {
    onKeyDown(host, e)
  })

  const deckOnly = (e: Event): boolean =>
    Boolean((e.target as Element | null)?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_DECK))

  host.addScopedListener(host.shadowRoot, POINTER_EVENTS.POINTERDOWN, (e) => {
    if (!deckOnly(e)) return

    onPointerDown(host, e)
  })

  // Passive + coalesced — the gesture never blocks the compositor; the
  // rAF-gated write in onPointerMove is the frame path (frame-budget rule).
  host.addScopedListener(
    host.shadowRoot,
    POINTER_EVENTS.POINTERMOVE,
    (e) => {
      if (!deckOnly(e)) return

      onPointerMove(host, e)
    },
    { passive: true }
  )

  host.addScopedListener(host.shadowRoot, POINTER_EVENTS.POINTERUP, (e) => {
    onPointerEnd(host, e)
  })

  host.addScopedListener(host.shadowRoot, POINTER_EVENTS.POINTERCANCEL, (e) => {
    onPointerEnd(host, e)
  })

  // Cards wrap real <a>/<img> — native drag-and-drop would fire
  // pointercancel mid-swipe and kill the gesture; prevent it entirely.
  host.addScopedListener(host.shadowRoot, DRAG_EVENTS.DRAGSTART, (e) => {
    e.preventDefault()
  })

  host.addScopedListener(window, WINDOW_EVENTS.RESIZE, () => {
    host.measure()

    host.applyPoses()
  })

  // A hidden tab freezes the countdown (banked like a user pause) and
  // resumes it on return — an unseen deck never advances its card.
  host.addScopedListener(document, CLIPBOARD_EVENTS.VISIBILITY_CHANGE, () => {
    holdAutoplay(host, document.hidden)
  })

  // The print adapter's prepare event fires inside beforeprint, ahead of
  // the media/style walk — filling card descriptions and freezing the
  // posers here lands before the snapshot strips inline geometry.
  host.addScopedListener(window, PRINT_EVENTS.PREPARE, () => {
    preparePrint(host)
  })

  // Native afterprint restores most jobs; engines that only flip the
  // print media query (emulated-print shells) never dispatch it, so the
  // query's false edge is the second restore channel — restorePrint is
  // idempotent when both fire.
  host.addScopedListener(window, CLIPBOARD_EVENTS.AFTER_PRINT, () => {
    restorePrint(host)
  })

  if (window.matchMedia) {
    host.addScopedListener(window.matchMedia(MEDIA_QUERIES.PRINT), FORM_EVENTS.CHANGE, (e) => {
      if (!(e as MediaQueryListEvent).matches) restorePrint(host)
    })
  }
}
