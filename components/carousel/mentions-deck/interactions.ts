/**
 * @file mentions-deck/interactions.ts — navigation + activation for
 * <mentions-deck>: ring-normalized goTo, dot nav, card activation (side
 * cards come forward; the front card's own anchor navigates outbound),
 * and arrow-key stepping.
 */

import { KEYS } from '@core/tokens/primitives.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { MENTIONS_DECK_SELECTORS } from '@core/tokens/selectors/mentions-deck.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { applyPoses, updateChrome } from './deck.js'
import type { MentionItem } from './types.js'
import type { MentionsDeck } from '../MentionsDeck.js'

/**
 * Resolves the deck card element + its deck index from a DOM event, or
 * null when the event didn't land on a card.
 * @param e The DOM event.
 * @returns {el, idx} for the containing card.
 */
export function cardIdxFromEvent(e: Event): { el: Element; idx: number } | null {
  const el = (e.target as Element | null)?.closest?.(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_CARD)

  if (!el) return null

  return { el, idx: parseInt(el.getAttribute(DATA_ATTRS.DATA_INDEX) || CHAR_STRINGS.ZERO, 10) }
}

/**
 * Moves the strip's virtual front to `idx` — ring-normalized, so out-of-range
 * indices wrap like a carousel loop does. The pose write runs with CSS
 * transitions enabled (the --dragging class is absent outside a live
 * gesture) so every card glides along the strip to its new slot. Any
 * running autoplay dwell re-bases so a manual nav always gets a full dwell.
 * @param host The MentionsDeck element.
 * @param idx Target deck index — wraps via modulo.
 */
export function goTo(host: MentionsDeck, idx: number): void {
  const len = host.items.length

  if (!len) return

  host.activeIdx = ((idx % len) + len) % len

  host._dragX = 0

  host.autoplayElapsed = 0

  host.autoplayStart = performance.now()

  applyPoses(host)

  updateChrome(host)
}

/** Dot-nav click — jumps straight to the picked card. */
export function onDotClick(host: MentionsDeck, idx: number): void {
  goTo(host, idx)
}

/**
 * Card activation — a side card click brings it to the front (the strip
 * affordance); the front card needs no handling — its anchor navigates
 * outbound natively.
 * @param host The MentionsDeck element.
 * @param _item The clicked card's data row (unused — outbound links are native).
 * @param idx The clicked card's deck index.
 */
export function onCardClick(host: MentionsDeck, _item: MentionItem, idx: number): void {
  if (idx !== host.activeIdx) goTo(host, idx)
}

/**
 * ArrowLeft/ArrowRight step the strip. Other keys pass through — Enter lands
 * on the card anchors as a native click handled by the click path.
 * @param host The MentionsDeck element.
 * @param e The keydown event.
 */
export function onKeyDown(host: MentionsDeck, e: Event): void {
  const key = (e as KeyboardEvent).key

  if (key === KEYS.ARROW_LEFT) {
    e.preventDefault()

    goTo(host, host.activeIdx - 1)

    return
  }

  if (key === KEYS.ARROW_RIGHT) {
    e.preventDefault()

    goTo(host, host.activeIdx + 1)
  }
}
