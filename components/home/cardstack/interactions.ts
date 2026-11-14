/**
 * @file cardstack/interactions.ts — navigation + activation for
 * <card-stack>: goTo/prev/next/dot nav, card and index-item activation,
 * the view-all index toggle, and arrow-key/Escape handling.
 */

import { KEYS } from '@core/tokens/primitives.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_LAYOUT } from '@core/tokens/motion/card-stack.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import router from '@core/router/router.js'
import { applyPoses, updateChrome } from './deck.js'
import { armOutgoingTitleBurn } from './info.js'
import { stopAutoplay } from './autoplay.js'
import { projectHref } from './info.js'
import type { CardStackItem } from './types.js'
import type { CardStack } from '../CardStack.js'

/** Re-exported — the card links and the text column share one builder. */
export { projectHref }

/**
 * Resolves the deck card element + its deck index from a DOM event, or
 * null when the event didn't land on a card.
 * @param e The DOM event.
 * @returns {el, idx} for the containing card.
 */
export function cardIdxFromEvent(e: Event): { el: Element; idx: number } | null {
  const el = (e.target as Element | null)?.closest?.(CARD_STACK_SELECTORS.CARD_STACK_CARD)

  if (!el) return null

  return { el, idx: parseInt(el.getAttribute(DATA_ATTRS.DATA_INDEX) || CHAR_STRINGS.ZERO, 10) }
}

/** SPA-navigates to a card's project route — no-op without a slug. */
export function navigateTo(host: CardStack, item: CardStackItem | undefined): void {
  const dest = item ? projectHref(item) : ATTR_VALUES.EMPTY

  if (dest) router.push(dest)
}

/**
 * Moves the fan's virtual front to `idx` — ring-normalized, so out-of-range
 * indices wrap like the carousel's clone loop does. The pose write runs
 * with CSS transitions enabled (the --dragging class is absent outside a
 * live gesture) so every card glides along the fan curve to its new slot.
 * @param host The CardStack element.
 * @param idx Target deck index — wraps via modulo.
 */
export function goTo(host: CardStack, idx: number): void {
  const len = host.deckItems.length

  if (!len) return

  host.activeIdx = ((idx % len) + len) % len

  host._dragX = 0

  // Arm the outgoing front's title burn BEFORE applyPoses drops
  // --active: the flip bottom-anchors the card's info column instantly,
  // and a post-flip mount anchors the raster to the relocated (hidden)
  // box — the burn then plays ~130px above where the title stood, on
  // top of the cover image.
  armOutgoingTitleBurn(host)

  // Poses glide on the CSS transition; updateChrome re-types the text
  // column for the new front in the same task.
  applyPoses(host)

  updateChrome(host)
}

/** Prev control — one step back along the ring; a manual step kills autoplay. */
export function onPrevClick(host: CardStack): void {
  stopAutoplay(host)

  goTo(host, host.activeIdx - 1)
}

/** Next control — one step forward along the ring; a manual step kills autoplay. */
export function onNextClick(host: CardStack): void {
  stopAutoplay(host)

  goTo(host, host.activeIdx + 1)
}

/** Dot-nav click — jumps straight to the picked card; a manual pick kills autoplay. */
export function onDotClick(host: CardStack, idx: number): void {
  stopAutoplay(host)

  goTo(host, idx)
}

/**
 * Card activation — a side card click brings it to the front (the fan
 * affordance), the front card navigates to its project route.
 */
export function onCardClick(host: CardStack, item: CardStackItem, idx: number): void {
  // Any card activation is a manual interaction — the countdown dies
  // whether the click repositions the fan or navigates to the route.
  stopAutoplay(host)

  if (idx !== host.activeIdx) {
    goTo(host, idx)

    return
  }

  navigateTo(host, item)
}

/**
 * Publishes indexOpen into the DOM without a re-render — the --index-open
 * class on the section drives the deck dim + panel reveal, the panel's
 * aria-hidden + inert and the toggle's aria-expanded track the state for
 * AT and tab order (aria-hidden alone leaves the panel's buttons/links
 * focusable inside a hidden subtree).
 * @param host The CardStack element.
 */
export function applyIndexState(host: CardStack): void {
  const section = host.$(CARD_STACK_SELECTORS.CARD_STACK)

  section?.classList.toggle(CARD_STACK_CLASSES.CARD_STACK_INDEX_OPEN, host.indexOpen)

  const panel = host.$(CARD_STACK_SELECTORS.CARD_STACK_INDEX)

  panel?.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, host.indexOpen ? ATTR_VALUES.FALSE : ATTR_VALUES.TRUE)

  if (host.indexOpen) panel?.removeAttribute(COMMON_ATTRS.INERT)
  else panel?.setAttribute(COMMON_ATTRS.INERT, ATTR_VALUES.EMPTY)

  const toggle = host.$(CARD_STACK_SELECTORS.CARD_STACK_TOGGLE)

  toggle?.setAttribute(
    ARIA_ATTRS.ARIA_EXPANDED,
    host.indexOpen ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE
  )
}

/**
 * `scrollIndexRail` — the index list is a horizontal rail on desktop and
 * a vertical sheet on mobile, so the arrows scroll whichever axis is
 * actually overflowing: one viewport-length hop per click, smoothed.
 * @param host The CardStack element.
 * @param dir Scroll direction (+1 forward, -1 backward).
 */
export function scrollIndexRail(host: CardStack, dir: number): void {
  const list = host.$(CARD_STACK_SELECTORS.CARD_STACK_INDEX_LIST) as HTMLElement | null

  if (!list) return

  const horizontal = list.scrollWidth > list.clientWidth

  list.scrollBy({
    left: horizontal ? dir * list.clientWidth * CARD_STACK_LAYOUT.INDEX_SCROLL_RATIO : 0,
    top: horizontal ? 0 : dir * list.clientHeight * CARD_STACK_LAYOUT.INDEX_SCROLL_RATIO,
    behavior: ATTR_VALUES.SMOOTH,
  })
}

/** Toggles the all-projects index overlay; the view-all interaction kills autoplay. */
export function toggleIndex(host: CardStack): void {
  stopAutoplay(host)

  host.indexOpen = !host.indexOpen

  applyIndexState(host)
}

/** Closes the index overlay — a no-op when already closed. */
export function closeIndex(host: CardStack): void {
  if (!host.indexOpen) return

  host.indexOpen = false

  applyIndexState(host)
}

/**
 * ArrowLeft/ArrowRight step the fan; Escape dismisses the index overlay.
 * Other keys pass through — Enter lands on the card anchors as a native
 * click handled by the click path.
 * @param host The CardStack element.
 * @param e The keydown event.
 */
export function onKeyDown(host: CardStack, e: Event): void {
  const key = (e as KeyboardEvent).key

  if (key === KEYS.ESCAPE) {
    closeIndex(host)

    return
  }

  if (key === KEYS.ARROW_LEFT) {
    e.preventDefault()

    onPrevClick(host)

    return
  }

  if (key === KEYS.ARROW_RIGHT) {
    e.preventDefault()

    onNextClick(host)
  }
}
