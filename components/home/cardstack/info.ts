/**
 * @file cardstack/info.ts — the active-project text column of
 * <card-stack>: splits a CMS item into title / body / route, and
 * republishes the column when the coverflow front changes. The title
 * rides the paper-burn — the old name combusts to ash, the text swaps
 * while the ink is hidden, and the same session rebuilds the new glyphs
 * (burn-out → burn-in). The description keeps its <draw-text> writer.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_LAYOUT } from '@core/tokens/motion/card-stack.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import store from '@core/store.js'
import { mountBurn } from '@core/utils/burn/mount.js'
import { frame } from '@core/utils/burn/loop.js'
import { setBurnDirWasm } from '@core/utils/burn/wasm.js'
import type { BurnCard, BurnClasses, BurnItem } from '@core/utils/burn/types.js'
import type { CardStackInfo, CardStackItem } from './types.js'
import type { CardStack } from '../CardStack.js'

/**
 * The class-name contract the burn pipeline runs against — the text
 * column doubles as the title overlay (the combustion canvas anchors
 * inside it) and the details container. ITEM_BURNED stays undefined so
 * the rebuild flip is driven by the swap callback instead of a class.
 */
const BURN_CLS: BurnClasses = {
  ITEM_BURNING: CARD_STACK_CLASSES.CARD_STACK_INFO_BURNING,
  ITEM_BURNED: undefined,
  TITLE_OVERLAY: CARD_STACK_CLASSES.CARD_STACK_INFO,
  TITLE: CARD_STACK_CLASSES.CARD_STACK_INFO_TITLE,
  TITLE_BURNING: CARD_STACK_CLASSES.CARD_STACK_INFO_TITLE_BURNING,
  TITLE_BURN: CARD_STACK_CLASSES.CARD_STACK_INFO_TITLE_BURN,
  TITLE_SLOT: CARD_STACK_CLASSES.CARD_STACK_INFO_TITLE_SLOT,
  TITLE_DUP: CARD_STACK_CLASSES.CARD_STACK_INFO_TITLE_DUP,
  TITLE_REWRITE: CARD_STACK_CLASSES.CARD_STACK_INFO_TITLE_REWRITE,
  DETAILS: CARD_STACK_CLASSES.CARD_STACK_INFO,
}

/**
 * Localized destination URL for one project card — the language prefix
 * rides in front of /portfolio/<slug> on every non-English locale.
 * @param item Project metadata containing the route slug.
 * @returns Localized portfolio URL, or an empty string without a slug.
 */
export function projectHref(item: CardStackItem): string {
  if (!item.link) return ATTR_VALUES.EMPTY

  const lang = store.getters.getLang()

  const prefix = lang === LOCALES.EN ? ATTR_VALUES.EMPTY : `${ROUTE_PATHS.ROOT}${lang}`

  return `${prefix}${ROUTE_PATHS.PORTFOLIO}${item.link}`
}

/**
 * Everything the text column shows for one item.
 * @param item The portfolio item (undefined before data lands).
 * @returns The column copy — all-empty for a missing item.
 */
export function cardInfo(item: CardStackItem | undefined): CardStackInfo {
  if (!item) {
    return {
      title: ATTR_VALUES.EMPTY,
      body: ATTR_VALUES.EMPTY,
      href: ATTR_VALUES.EMPTY,
    }
  }

  return {
    title: item.label || item.title || ATTR_VALUES.EMPTY,
    body: item.description || ATTR_VALUES.EMPTY,
    href: projectHref(item),
  }
}

/**
 * Re-targets one column slot's <draw-text> writer. Writing a new `text`
 * attribute replays the writer (DrawText resets + re-triggers on text
 * change); an unchanged value is a no-op there, so re-publishing the
 * same front never re-types. An empty text hides the whole slot — an
 * inline wrapper with no text would still take a line-height of room.
 * @param host The CardStack element.
 * @param sel The slot's selector.
 * @param text The slot's new text.
 */
function setSlotText(host: CardStack, sel: string, text: string): void {
  const slot = host.$(sel)

  if (!slot) return

  slot.toggleAttribute(COMMON_ATTRS.HIDDEN, !text)

  slot.querySelector(COMPONENT_TAGS.DRAW_TEXT)?.setAttribute(FORM_ATTRS.TEXT, text)
}

/**
 * Publishes the next project name on the title — the paper-burn owns
 * the transition: the live session (or a freshly mounted one) consumes
 * whatever raster it holds, then at the consume beat the DOM text swaps
 * and the session flips into rebuild — `lastBox` is cleared so
 * syncPaper re-rasterizes the NEW title and deposit motes knit it back.
 * A live session is re-armed rather than stacked: mid-consume navs just
 * re-aim the beat to the latest name, and a mid-rebuild nav flips back
 * to consume from exactly where the knit left off (the same rebasing
 * armCardBurn applies on re-hover). Reduced motion or a degenerate box
 * (hidden column, zero rect) swaps instantly.
 * @param host The CardStack element.
 * @param item The item the burn paces itself on (description length).
 * @param next The title text to land on.
 */
function burnTitle(host: CardStack, item: BurnItem | undefined, next: string): void {
  const titleEl = host.$(CARD_STACK_SELECTORS.CARD_STACK_INFO_TITLE) as HTMLElement | null

  if (!titleEl) return

  // An empty name collapses the slot — an empty inline box would still
  // take a line-height of room (and the burn would mount on a
  // degenerate rect anyway).
  titleEl.toggleAttribute(COMMON_ATTRS.HIDDEN, !next)

  const infoEl = host.$(CARD_STACK_SELECTORS.CARD_STACK_INFO)

  const session = infoEl ? (infoEl as BurnCard)._burn : null

  // Idle fast-path — no burn pending and the ink already reads `next`.
  if (titleEl.textContent === next && !session) return

  const swap = (): void => {
    titleEl.textContent = next

    // The swap may land beats after this call — re-query so a rebuilt
    // (or removed) column is consulted, not the mount-time node.
    const live = (host.$(CARD_STACK_SELECTORS.CARD_STACK_INFO) as BurnCard | null)?._burn

    if (live && live.dir > 0) {
      // Consume beat: hand the rebuild the new raster — without this the
      // frozen arm-time paper would knit the OLD name back.
      live.lastBox = ATTR_VALUES.EMPTY

      live.dir = -1

      live.prog = 1
    }
  }

  if (session) {
    session.onBurned = swap

    if (session.dir < 0) {
      // Mid-knit — re-consume the partially rebuilt title from the point
      // the rebuild reached (prog maps back onto the forward clock), so
      // whatever text is under the needle burns out before `next` knits.
      session.dir = 1

      session.t = session.prog * (session.dur / 1000)

      setBurnDirWasm(session)

      if (!session.raf) session.raf = requestAnimationFrame(() => frame(session))
    }

    return
  }

  if (store.getters.getReducedMotion?.() || !infoEl) {
    titleEl.textContent = next

    return
  }

  if (
    !mountBurn(
      infoEl,
      infoEl as HTMLElement,
      titleEl,
      item || {},
      BURN_CLS,
      CARD_STACK_LAYOUT.BURN_SPEED,
      swap
    )
  ) {
    titleEl.textContent = next
  }
}

/**
 * The burn contract for the in-card project title — the card element
 * doubles as the session host and the canvas overlay (it is already
 * absolutely positioned, so it is the containing block the canvas
 * anchors to). ITEM_BURNED stays undefined: each card's title is
 * fixed text, so the burn only knits in / consumes — never swaps.
 */
const CARD_BURN_CLS: BurnClasses = {
  ITEM_BURNING: CARD_STACK_CLASSES.CARD_STACK_CARD_BURNING,
  ITEM_BURNED: undefined,
  TITLE_OVERLAY: CARD_STACK_CLASSES.CARD_STACK_CARD,
  TITLE: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO_TITLE,
  TITLE_BURNING: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO_TITLE_BURNING,
  TITLE_BURN: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO_TITLE_BURN,
  TITLE_SLOT: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO_TITLE_SLOT,
  TITLE_DUP: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO_TITLE_DUP,
  TITLE_REWRITE: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO_TITLE_REWRITE,
  DETAILS: CARD_STACK_CLASSES.CARD_STACK_CARD_INFO,
}

/**
 * The card element that held the front on the previous chrome pass —
 * the card whose in-card title burns OUT on the next nav. Keyed by host
 * so a re-rendered deck resets the baseline.
 */
const _burnFront = new WeakMap<CardStack, Element>()

/**
 * The in-card paper-burn on stacked tiers — the front card's title
 * knits IN (the loop runs dir −1 from prog 1: deposit motes rebuild
 * the glyphs, then teardown hands the pristine raster back to the DOM
 * ink), and the card that just left the front burns OUT (the default
 * forward consume) as it slides into the pile. Live sessions flip
 * direction rather than stack: a card mid-knit that loses the front
 * re-consumes from the knit point, and a consumed session knits back
 * when its card returns. Reduced motion or a degenerate box leaves
 * the title's plain ink.
 * @param host The CardStack element.
 */
export function burnCardTitles(host: CardStack): void {
  const tier = host._tier

  // Image-only stacked bands (768–1279 landscape) hide the in-card
  // copy — mounting a session on invisible titles just burns rAF.
  if (!tier?.STACKED || !tier.IN_CARD_INFO) return

  const cards = host._cardEls

  const front = cards[host.activeIdx]

  const prev = _burnFront.get(host)

  _burnFront.set(host, front)

  const spin = (cardEl: Element, want: number): void => {
    const card = cardEl as BurnCard

    const s = card._burn

    if (s) {
      if (s.dir !== want) {
        s.dir = want

        if (want < 0) s.prog = 1
        else s.t = s.prog * (s.dur / 1000)

        setBurnDirWasm(s)
      }

      // _burnHeld gates the re-arm — an off-screen nav retimes the
      // session but the draw-in stays banked until holdBurns releases.
      if (!s.raf && !host._burnHeld) s.raf = requestAnimationFrame(() => frame(s))

      return
    }

    if (store.getters.getReducedMotion?.()) return

    const titleEl = cardEl.querySelector(
      CARD_STACK_SELECTORS.CARD_STACK_CARD_INFO_TITLE
    ) as HTMLElement | null

    if (!titleEl) return

    const idx = cards.indexOf(cardEl)

    if (
      !mountBurn(
        cardEl,
        cardEl as HTMLElement,
        titleEl,
        host.deckItems[idx] || {},
        CARD_BURN_CLS,
        CARD_STACK_LAYOUT.BURN_SPEED,
        null
      )
    ) {
      return
    }

    const ns = card._burn

    if (ns && want < 0) {
      ns.dir = -1

      ns.prog = 1

      setBurnDirWasm(ns)
    }

    // mountBurn self-arms its first frame — a mount taken while the
    // section is held off-screen gets banked immediately so the
    // draw-in waits for the re-entry release.
    if (ns && host._burnHeld && ns.raf) {
      cancelAnimationFrame(ns.raf)

      ns.raf = 0
    }
  }

  if (prev && prev !== front) spin(prev, 1)

  if (front) spin(front, -1)
}

/**
 * Scroll-visibility hold for every burn session the deck owns — the
 * in-card title knits/consumes AND the text column's burn swap. The
 * section's IntersectionObserver calls it with the inverse of
 * isIntersecting: a hold cancels each live session's rAF in place
 * (prog/dir survive — the knit freezes exactly where it was, which
 * also stops an off-screen mount's first frame spending the draw-in
 * before the user ever sees it), and a release re-arms any session
 * still active so the draw animation plays out on the frame the
 * deck scrolls back into view. Sessions that already ran to
 * completion (`active` false) stay parked — a finished burn must not
 * resurrect on re-entry.
 * @param host The CardStack element.
 * @param held True while the section is off-screen.
 */
export function holdBurns(host: CardStack, held: boolean): void {
  host._burnHeld = held

  if (held) {
    for (const cardEl of host._cardEls) {
      const s = (cardEl as BurnCard)._burn

      if (s?.raf) {
        cancelAnimationFrame(s.raf)

        s.raf = 0
      }
    }

    const info = (host.$(CARD_STACK_SELECTORS.CARD_STACK_INFO) as BurnCard | null)?._burn

    if (info?.raf) {
      cancelAnimationFrame(info.raf)

      info.raf = 0
    }

    return
  }

  // Release — the live pairing re-aims through burnCardTitles (each
  // spin re-reads front/prev so a nav taken while held resolves to the
  // current pairing, not a stale one). A nav taken WHILE held also
  // orphans the previous front's parked session — _burnFront already
  // advanced, so spin never visits it again — so every remaining
  // parked session sweeps up with a direct re-arm alongside the text
  // column's own (which has no spin caller either).
  burnCardTitles(host)

  for (const cardEl of host._cardEls) {
    const s = (cardEl as BurnCard)._burn

    if (s && !s.raf && s.active) {
      s.raf = requestAnimationFrame(() => frame(s))
    }
  }

  const info = (host.$(CARD_STACK_SELECTORS.CARD_STACK_INFO) as BurnCard | null)?._burn

  if (info && !info.raf && info.active) {
    info.raf = requestAnimationFrame(() => frame(info))
  }
}

/**
 * Publishes the front card's copy into the text column without a
 * re-render — the title burns out/in, the description writer re-types,
 * and the "Check out" link follows the new route (`hidden` when the
 * item has none, so no dead link stays focusable). On stacked tiers
 * the same burn also fires on the in-card project titles.
 * @param host The CardStack element.
 */
export function writeInfo(host: CardStack): void {
  const item = host.deckItems[host.activeIdx]

  const info = cardInfo(item)

  burnTitle(host, item, info.title)

  setSlotText(host, CARD_STACK_SELECTORS.CARD_STACK_INFO_DESC, info.body)

  const cta = host.$(CARD_STACK_SELECTORS.CARD_STACK_INFO_CTA)

  if (!cta) return

  cta.setAttribute(LINK_ATTRS.HREF, info.href)

  cta.toggleAttribute(COMMON_ATTRS.HIDDEN, !info.href)

  burnCardTitles(host)
}
