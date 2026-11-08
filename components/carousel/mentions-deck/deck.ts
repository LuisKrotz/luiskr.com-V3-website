/**
 * @file mentions-deck/deck.ts — the flat-strip geometry for
 * <mentions-deck>: signed ring offsets → per-card poses, deck measurement,
 * and the imperative style writes that drive both the drag tracking
 * frames and the CSS-transition settle.
 */

import { MENTIONS_DECK_CLASSES } from '@core/tokens/classes/mentions-deck.js'
import { MENTIONS_DECK_SELECTORS } from '@core/tokens/selectors/mentions-deck.js'
import { MENTIONS_DECK_LAYOUT } from '@core/tokens/motion/mentions-deck.js'
import { BREAKPOINTS } from '@core/tokens/layout/breakpoints.js'
import { CAROUSEL_CSS_PROPS } from '@core/tokens/css/carousel.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { flushLayout, viewportWidth } from '@core/utils/dom.js'
import type { MentionPose } from './types.js'
import type { MentionsDeck } from '../MentionsDeck.js'

/**
 * Last pose-pass signed offset per card element — a card whose offset
 * jumped by more than half the ring teleported across the strip (the
 * nav/drag crossed the ±len/2 seam) and must land without a transition
 * sweep. Keyed by element so a re-rendered card starts a fresh baseline.
 */
const _lastS = new WeakMap<Element, number>()

/**
 * Signed ring distance of `d` modulo `len`, normalized into (-len/2, len/2]
 * so the shortest strip direction wins — fractional `d` (mid-drag) passes
 * through unchanged in magnitude.
 * @param d Raw index difference (may be fractional, any sign).
 * @param len Deck length.
 * @returns Signed ring offset.
 */
export function ringSigned(d: number, len: number): number {
  if (len <= 0) return 0

  const n = ((d % len) + len) % len

  return n > len / 2 ? n - len : n
}

/**
 * The strip pose for signed offset `s` — a flat, centered row: every card
 * sits at s·step px from the deck-center anchor, aligned on one baseline
 * (no tilt/drop/scale — the strip reads as a continuous band) with a
 * small margin between neighbours. Opacity rides the edge distance: a
 * card fully inside the deck rect is opaque, then dims out over
 * fadeSpan px as it crosses the edge (wide decks pass w × FADE_FRAC —
 * invisible by the time its center leaves). The dim alone would still
 * slice the card mid-fade at the overflow boundary, so the deck's mask
 * gradient (sized to the same lane — see applyPoses) spatially dissolves
 * everything into the edge: the strip never shows a cut card. A fadeSpan
 * of 0 (mobile peek layout) skips the dissolve instead — the card stays
 * fully opaque while any pixel is inside the deck and drops only once
 * fully out, so partial neighbours show at full color under the clip.
 * Invisible cards leave the pointer/a11y tree.
 * @param s Signed ring offset (0 = front).
 * @param len Deck length — drives the z-index ladder.
 * @param w Card width px.
 * @param step Card step in px (card width + inter-card margin).
 * @param edge Px from the anchor to the deck's edge (half the deck width
 * when the anchor is centered); +∞ skips the fade for detached poses.
 * @param fadeSpan Edge-dissolve lane px — defaults to the wide-deck
 * FADE_FRAC span; 0 gives the mobile binary visibility (no dim).
 * @returns The pose record for the DOM write.
 */
export function stripPose(
  s: number,
  len: number,
  w: number,
  step: number,
  edge: number = Number.POSITIVE_INFINITY,
  fadeSpan: number = w * MENTIONS_DECK_LAYOUT.FADE_FRAC
): MentionPose {
  const a = Math.abs(s)

  // Signed distance the card's outer edge overhangs the deck edge —
  // negative while the card is fully inside the strip region.
  const overhang = a * step + w / 2 - edge

  // fadeSpan > 0 dissolves the card across the lane; fadeSpan 0 keeps it
  // fully opaque until its last inside pixel leaves (overhang = w).
  const opacity =
    fadeSpan > 0 ? Math.min(1, Math.max(0, 1 - overhang / fadeSpan)) : Number(overhang < w)

  return {
    x: s * step,
    y: 0,
    rot: 0,
    scale: 1,
    opacity,
    // Symmetric depth ladder: immediate neighbours sit one rung under the
    // front card regardless of direction — the front stays on top.
    z: Math.round((len - a) * MENTIONS_DECK_LAYOUT.Z_STRIDE),
    visible: opacity > 0,
  }
}

/**
 * Measures the deck region and publishes `_cardW/_cardH/_step/_anchor`
 * and `_fadeSpan` — the card box is the fill-fit when the whole ring
 * (cards + margins) lands inside the deck at a readable width, else the
 * viewport clamp (CARD_W_VW between floor/cap; decks under the 768 rung
 * use the MOBILE pair so a sliver of each neighbour stays on screen).
 * `_step` carries the inter-card margin, `_anchor` is the deck's
 * horizontal center (doubling as the edge distance the dissolve
 * measures against), and `_fadeSpan` is the edge-dissolve lane — card
 * width × FADE_FRAC on wide decks, 0 on mobile so partial neighbours
 * peek at full opacity instead of dimming into a vignette.
 * Pre-paint/hidden contexts report zero rects → the clamp runs against
 * viewportWidth().
 * @param host The MentionsDeck element.
 */
export function measure(host: MentionsDeck): void {
  const deck = host.$(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DECK)

  const deckW = deck ? deck.getBoundingClientRect().width : 0

  const basis = deckW || viewportWidth() || MENTIONS_DECK_LAYOUT.CARD_W_FALLBACK

  // Narrow decks run the peek layout — the MOBILE sizing pair and a
  // collapsed dissolve lane replace the wide-deck edge fade.
  const mobile = basis < BREAKPOINTS[768]

  const wMin = mobile ? MENTIONS_DECK_LAYOUT.CARD_W_MIN_MOBILE : MENTIONS_DECK_LAYOUT.CARD_W_MIN

  host._cardW = Math.min(
    Math.max(
      basis * (mobile ? MENTIONS_DECK_LAYOUT.CARD_W_VW_MOBILE : MENTIONS_DECK_LAYOUT.CARD_W_VW),
      wMin
    ),
    MENTIONS_DECK_LAYOUT.CARD_W_MAX
  )

  // Fill-fit — the widest |s| the ring can hold is floor(len/2) (odd
  // rings are symmetric; even rings lean one slot past center). Sizing
  // the card so the far card's outer edge lands flush on the deck edge —
  // maxS·(w + w·gap) + w/2 = basis/2 — fills the strip edge-to-edge with
  // every card fully inside. Below the readability floor the ring can't
  // fit and the clamp stands (extra cards dissolve out at the edges).
  const len = host.items.length

  const maxS = Math.floor(len / 2)

  const gapGrow = 1 + MENTIONS_DECK_LAYOUT.GAP_RATIO

  const fit = len >= MENTIONS_DECK_LAYOUT.FILL_MIN ? basis / (maxS * 2 * gapGrow + 1) : 0

  if (fit >= wMin * MENTIONS_DECK_LAYOUT.FILL_FLOOR) {
    host._cardW = fit
  }

  host._cardH = host._cardW * MENTIONS_DECK_LAYOUT.CARD_H_RATIO

  // Front card anchors at the deck's horizontal center — the strip
  // extends symmetrically in both directions from it.
  host._anchor = basis * MENTIONS_DECK_LAYOUT.ANCHOR_FRAC

  // Card step — width plus the small inter-card margin.
  host._step = host._cardW * gapGrow

  // The edge-dissolve lane — the deck mask fades this many px at each
  // side and stripPose dims over the same span. 0 on mobile: cards clip
  // at the boundary at full opacity (the peek layout).
  host._fadeSpan =
    host._cardW * (mobile ? MENTIONS_DECK_LAYOUT.FADE_FRAC_MOBILE : MENTIONS_DECK_LAYOUT.FADE_FRAC)

  host._sizesDirty = true
}

/** Zero-padded ordinal — "01", "08" — printed in each card's top corner. */
export function padNum(n: number): string {
  return `${n}`.padStart(MENTIONS_DECK_LAYOUT.PAD, CHAR_STRINGS.ZERO)
}

/**
 * Writes every card's pose for the current virtual front `f` — derived
 * from `activeIdx - _dragX/_step`, so a live drag slides the whole strip
 * continuously and `activeIdx` alone reproduces the rest pose. Card width/
 * height write once per measure() (_sizesDirty); the --active class and
 * a11y flags ride the same pass. Runs inside the gesture rAF — reads are
 * cached fields, writes are transform/opacity/zIndex/visibility only.
 * @param host The MentionsDeck element.
 */
export function applyPoses(host: MentionsDeck): void {
  const items = host.items

  const len = items.length

  if (!len) return

  const f = host.activeIdx - host._dragX / host._step

  const w = host._cardW

  const h = host._cardH

  const cards = host._cardEls

  for (let i = 0; i < cards.length; i++) {
    const el = cards[i] as HTMLElement

    const s = ringSigned(i - f, len)

    const pose = stripPose(s, len, w, host._step, host._anchor, host._fadeSpan)

    // Ring wrap — an offset that jumped by more than half the ring is a
    // teleport across the strip (the ±len/2 seam). Pin the card at its
    // new slot with transitions off so it never sweeps visibly across
    // the row, then restore so the next settle glides again.
    const prevS = _lastS.get(el)

    _lastS.set(el, s)

    const wrapped = prevS !== undefined && Math.abs(s - prevS) > len / 2

    if (wrapped) el.style.transition = ATTR_VALUES.NONE

    if (host._sizesDirty) {
      el.style.width = `${w}${COMMON_ATTRS.PX}`

      el.style.height = `${h}${COMMON_ATTRS.PX}`

      // The anchor x is shared across cards — written once per measure so
      // translate(-50%,-50%) places each card's center on it.
      el.style.left = `${host._anchor}${COMMON_ATTRS.PX}`
    }

    el.style.transform = `translate(-50%, -50%) translate3d(${pose.x}${COMMON_ATTRS.PX}, ${pose.y}${COMMON_ATTRS.PX}, 0) rotate(${pose.rot}deg) scale(${pose.scale})`

    el.style.opacity = `${pose.opacity}`

    el.style.zIndex = `${pose.z}`

    el.style.visibility = pose.visible ? ATTR_VALUES.VISIBLE : ATTR_VALUES.HIDDEN

    el.classList.toggle(
      MENTIONS_DECK_CLASSES.MENTIONS_DECK_CARD_ACTIVE,
      pose.visible && Math.abs(s) < MENTIONS_DECK_LAYOUT.FRONT_EPS
    )

    if (wrapped) {
      // Commit the teleported pose — the sanctioned flush makes the
      // transition:none write take effect before transitions restore.
      void flushLayout(el)

      el.style.transition = ATTR_VALUES.EMPTY
    }
  }

  if (host._sizesDirty && host._deckEl) {
    const deckStyle = (host._deckEl as HTMLElement).style

    deckStyle.height = `${h * MENTIONS_DECK_LAYOUT.DECK_H_RATIO}${COMMON_ATTRS.PX}`

    // The edge-dissolve lane width measured with the card box — the
    // deck's mask gradient fades this many px at each side so a crossing
    // card dissolves into the boundary instead of being sliced by the
    // clip. 0 on mobile collapses the lane to the clip edge.
    deckStyle.setProperty(
      CAROUSEL_CSS_PROPS.MENTIONS_DECK_FADE,
      `${host._fadeSpan}${COMMON_ATTRS.PX}`
    )
  }

  host._sizesDirty = false
}

/**
 * Refreshes the non-pose chrome after a nav — the dot --active flags and
 * each card's aria-hidden/tabindex so off-strip cards leave the tab order
 * and AT tree.
 * @param host The MentionsDeck element.
 */
export function updateChrome(host: MentionsDeck): void {
  if (!host.items.length) return

  const dots = host.$$(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DOT)

  dots.forEach((dot, i) => {
    dot.classList.toggle(MENTIONS_DECK_CLASSES.MENTIONS_DECK_DOT_ACTIVE, i === host.activeIdx)
  })

  host._cardEls.forEach((card, i) => {
    const front = i === host.activeIdx

    card.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, front ? ATTR_VALUES.FALSE : ATTR_VALUES.TRUE)

    const link = card.querySelector(HTML_TAGS.A)

    ;(link as HTMLElement | null)?.setAttribute(
      ARIA_ATTRS.TABINDEX,
      front ? ATTR_VALUES.TABINDEX_ZERO : ATTR_VALUES.NEGATIVE_TABINDEX
    )
  })
}
