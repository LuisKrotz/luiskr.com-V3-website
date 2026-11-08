/**
 * @file mentions-deck/events.ts — scoped listener bindings for
 * <mentions-deck>: delegated clicks (dots, cards), keyboard nav, the
 * pointer-swipe stream (deck-gated, passive, coalesced), hover autoplay
 * pauses, and resize re-measurement.
 */

import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { MENTIONS_DECK_SELECTORS } from '@core/tokens/selectors/mentions-deck.js'
import {
  DRAG_EVENTS,
  KEYBOARD_EVENTS,
  MOUSE_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { isPlainClick } from '@core/utils/dom.js'
import { cardIdxFromEvent, onCardClick, onDotClick, onKeyDown } from './interactions.js'
import { onPointerDown, onPointerEnd, onPointerMove } from './gestures.js'
import { pauseAutoplay, resumeAutoplay } from './autoplay.js'
import type { MentionsDeck } from '../MentionsDeck.js'

/**
 * Click delegation for the whole shadow root — dots first, then cards.
 * Side-card clicks reposition the strip (the anchor's outbound navigation
 * is suppressed); front-card clicks fall through to the real anchor so
 * the award link opens natively — plain clicks only, modified/middle
 * clicks keep anchor semantics either way.
 * @param host The MentionsDeck element.
 * @param e The click event.
 */
function onDeckClick(host: MentionsDeck, e: Event): void {
  if (host._suppressClick) {
    host._suppressClick = false

    e.preventDefault()

    return
  }

  const target = e.target as Element | null

  const dot = target?.closest?.(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DOT)

  if (dot) {
    onDotClick(host, parseInt(dot.getAttribute(DATA_ATTRS.DATA_INDEX) || CHAR_STRINGS.ZERO, 10))

    return
  }

  const card = cardIdxFromEvent(e)

  if (!card) return

  const item = host.items[card.idx]

  if (!item) return

  if (!isPlainClick(e)) return

  if (card.idx !== host.activeIdx) {
    // Side card — the strip repositions; its anchor must not navigate.
    e.preventDefault()
  }

  onCardClick(host, item, card.idx)
}

/**
 * Binds every listener the deck needs — shadowRoot delegation covers
 * re-renders (nodes swap per _updateDom, listeners don't); the pointer
 * stream is deck-gated so the dots and heading can't drag the strip.
 * @param host The MentionsDeck element.
 */
export function bindEvents(host: MentionsDeck): void {
  host.addScopedListener(host.shadowRoot, MOUSE_EVENTS.CLICK, (e) => {
    onDeckClick(host, e)
  })

  host.addScopedListener(host.shadowRoot, KEYBOARD_EVENTS.KEYDOWN, (e) => {
    onKeyDown(host, e)
  })

  const deckOnly = (e: Event): boolean =>
    Boolean((e.target as Element | null)?.closest?.(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DECK))

  host.addScopedListener(host.shadowRoot, POINTER_EVENTS.POINTERDOWN, (e) => {
    if (!deckOnly(e)) return

    onPointerDown(host, e)
  })

  // Cards wrap real <a>/<img> — native drag-and-drop fires pointercancel
  // mid-swipe and kills the gesture; prevent it entirely.
  host.addScopedListener(host.shadowRoot, DRAG_EVENTS.DRAGSTART, (e) => {
    e.preventDefault()
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

  // Hover freezes the dwell clock so the strip never advances out from
  // under a pointing user; leaving hands the partially-spent dwell back.
  host.addScopedListener(host, POINTER_EVENTS.POINTERENTER, () => {
    pauseAutoplay(host)
  })

  host.addScopedListener(host, POINTER_EVENTS.POINTERLEAVE, () => {
    resumeAutoplay(host)
  })

  host.addScopedListener(window, WINDOW_EVENTS.RESIZE, () => {
    host._onResize()
  })
}
