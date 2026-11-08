/**
 * @file cardstack/deck.ts — the coverflow geometry for <card-stack>:
 * responsive tier pick, signed ring offsets → per-card 3D poses, deck
 * measurement, and the imperative style writes that drive both the drag
 * tracking frames and the CSS-transition settle.
 */

import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_LAYOUT, CARD_STACK_TIERS } from '@core/tokens/motion/card-stack.js'
import type {
  CardStackFanTier,
  CardStackStackTier,
  CardStackTier,
} from '@core/tokens/motion/card-stack.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import store from '@core/store.js'
import { viewportHeight, viewportWidth } from '@core/utils/dom.js'
import { FALLBACK_APP } from '@core/locale/fallback.js'
import { writeInfo } from './info.js'
import { stopAutoplay } from './autoplay.js'
import type { CardStackItem, CardPose } from './types.js'
import type { CardStack } from '../CardStack.js'

/** Degrees → radians for the projected-edge trigonometry. */
const DEG = Math.PI / 180

/**
 * Last pose-pass visibility per card element — a card that was hidden on
 * the previous pass and is visible now seeds its rise-and-fade entrance.
 * Keyed by element so a re-rendered card starts a fresh baseline (no
 * entrance on first paint).
 */
const _wasVisible = new WeakMap<Element, boolean>()

/**
 * Every pushed item fans in the deck — the full portfolio list in order
 * (the featured flag is decorative only; no filtering applies).
 * @param host The CardStack element.
 * @returns The deck's ordered item list.
 */
export function deckItems(host: CardStack): CardStackItem[] {
  return host.processedItems
}

/**
 * Signed ring distance of `d` modulo `len`, normalized into (-len/2, len/2]
 * so the shortest fan direction wins — fractional `d` (mid-drag) passes
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
 * The coverflow tier for a viewport — the first (widest) tier whose
 * MIN_VW the width meets; the portrait tablet tier also requires a
 * taller-than-wide viewport, mirroring the SCSS `orientation` split.
 * The final (phone) tier has MIN_VW 0 and is the unconditional floor.
 * @param vw Viewport width px.
 * @param vh Viewport height px.
 * @returns The matching tier.
 */
export function pickTier(vw: number, vh: number): CardStackTier {
  const last = CARD_STACK_TIERS.length - 1

  for (let i = 0; i < last; i++) {
    const tier = CARD_STACK_TIERS[i]

    if (vw >= tier.MIN_VW && (!tier.PORTRAIT || vh > vw)) return tier
  }

  return CARD_STACK_TIERS[last]
}

/**
 * The coverflow pose for signed offset `s` (see CardStackTier for the
 * full model). With a = |s|, the near term min(a,1) carries the big
 * front→neighbour jump (FIRST_STEP / DEPTH / the full ROT_Y turn) and
 * the far term max(a−1,0) the tight per-card stacking (STEP /
 * DEPTH_STEP, plus ROT_STEP of extra turn per level so the fan wraps
 * like a carousel wall instead of parallel planes, capped at ROT_MAX)
 * — all linear in `a`, so a fractional drag offset slides every card
 * continuously along the curve. Right-hand
 * cards (s > 0) turn by +ROT_Y, which in CSS's rotateY convention sends
 * their outer edge away from the viewer; the left side mirrors it.
 * `0 - …` keeps the front depth at +0 (never −0). Opacity steps down
 * per level (FAN_DIM_STEP, floored at FAN_DIM_FLOOR) so the outer cards
 * darken into the deck edges exactly like the reference coverflow.
 * @param s Signed ring offset (0 = front).
 * @param len Deck length — drives the z-index ladder.
 * @param w Card width px.
 * @param tier The active coverflow fan tier.
 * @param peek Visible cards per side; |s| beyond it hides the card.
 * @returns The pose record for the DOM write.
 */
export function fanPose(
  s: number,
  len: number,
  w: number,
  tier: CardStackFanTier,
  peek: number = tier.PEEK
): CardPose {
  const a = Math.abs(s)

  const sign = s < 0 ? -1 : 1

  const near = Math.min(a, 1)

  const far = Math.max(a - 1, 0)

  return {
    x: sign * (near * tier.FIRST_STEP + far * tier.STEP) * w,
    y: CARD_STACK_LAYOUT.FAN_LIFT,
    depth: 0 - (near * tier.DEPTH + far * tier.DEPTH_STEP) * w,
    // Progressive wrap — neighbours sit at ROT_Y and each deeper card
    // turns ROT_STEP steeper until ROT_MAX parks it just short of
    // edge-on: the smooth carousel arc of the reference, not parallel
    // planes. The sign is INWARD — a right-side card's rotateY is
    // negative so every face converges on the deck centre (the camera
    // reads the covers nearly frontal); +sign pointed faces outward
    // into grazing slivers.
    rot: 0 - sign * Math.min(tier.ROT_MAX, near * tier.ROT_Y + far * tier.ROT_STEP),
    rotZ: 0,
    opacity: Math.max(CARD_STACK_LAYOUT.FAN_DIM_FLOOR, 1 - a * CARD_STACK_LAYOUT.FAN_DIM_STEP),
    // The active-card boost — the centre card is plainly WIDER/TALLER
    // than its fanned neighbours (the reference's hero card), easing
    // off linearly across the front→neighbour interval so a fractional
    // drag slides the size change continuously with the deal-through.
    scale: 1 + Math.max(0, 1 - a) * (CARD_STACK_LAYOUT.FRONT_SCALE - 1),
    z: Math.round((len - a) * CARD_STACK_LAYOUT.Z_STRIDE),
    visible: a <= peek,
  }
}

/**
 * The stacked-layout pose for signed offset `s` — the "entire card"
 * pile of the phone/portrait tiers, modelled as a dealt deck:
 *  - s = +1 is the DEAL slot — the next card shifted down-right so its
 *    bottom band (description + CTA) peeks below the front card's edge.
 *  - s ≥ +2 is the draw-pile FAN — each level a further step up-left,
 *    tilted counter-clockwise, so only the top-left corners sliver out
 *    into the page margins.
 *  - s < 0 are the returned cards — they slide under the pile's bottom
 *    edge (the deepest up-left slot), |s|-scaled so the swiped card
 *    travels there smoothly mid-drag; only the most recent stays lit.
 * The s > 0 path is piecewise-linear in `a` across three segments —
 * min(a,1) travels 0 → DEAL_*, clamp(a−1,0,1) travels DEAL_* → FAN_*
 * (first fan level, so the terms are the FAN−DEAL delta), and
 * max(a−2,0) adds each deeper FAN_*_STEP — a fractional drag offset
 * glides through deal/fan continuously.
 * @param s Signed ring offset (0 = front).
 * @param len Deck length — drives the z-index ladder.
 * @param w Card width px.
 * @param h Card height px.
 * @param tier The active stacked tier.
 * @param peek Visible pile depth; deeper upcoming cards hide.
 * @returns The pose record for the DOM write.
 */
export function stackPose(
  s: number,
  len: number,
  w: number,
  h: number,
  tier: CardStackStackTier,
  peek: number = tier.PEEK
): CardPose {
  const a = Math.abs(s)

  if (s < 0) {
    // Returned-to-bottom cards — parked under the pile's up-left bottom
    // edge. |s|-scaled: the front card slides there (not teleports) as
    // a drag crosses s = 0; only the freshest parked card stays lit.
    return {
      x: 0 - tier.PARK_X * a * w,
      y: 0 - tier.PARK_Y * a * h,
      depth: 0 - tier.PARK_D * a * w,
      rot: 0,
      rotZ: 0 - tier.PARK_RZ * a,
      opacity: 1,
      scale: 1,
      z: Math.round(a * CARD_STACK_LAYOUT.Z_STRIDE),
      visible: a <= 1,
    }
  }

  const deal = Math.min(a, 1)

  const fan = Math.min(Math.max(a - 1, 0), 1)

  const deep = Math.max(a - 2, 0)

  return {
    x: (tier.DEAL_X * deal + (tier.FAN_X - tier.DEAL_X) * fan + tier.FAN_X_STEP * deep) * w,
    y: (tier.DEAL_Y * deal + (tier.FAN_Y - tier.DEAL_Y) * fan + tier.FAN_Y_STEP * deep) * h,
    depth: 0 - (tier.DEAL_D * deal + (tier.FAN_D - tier.DEAL_D) * fan + tier.FAN_D_STEP * deep) * w,
    rot: 0,
    rotZ: tier.DEAL_RZ * deal + (tier.FAN_RZ - tier.DEAL_RZ) * fan + tier.FAN_RZ_STEP * deep,
    opacity: 1,
    scale: 1,
    z: Math.round((len - a) * CARD_STACK_LAYOUT.Z_STRIDE),
    visible: a <= peek,
  }
}

/**
 * Pose dispatcher — the STACKED tiers' down-right cascade or the fan
 * tiers' left/right coverflow. Single routing site for applyPoses and
 * the skeleton renderer.
 * @param tier The active tier (narrows the pose model).
 * @param s Signed ring offset.
 * @param len Deck length.
 * @param w Card width px.
 * @param h Card height px.
 * @param peek Visible depth window.
 * @returns The pose record for the DOM write.
 */
export function tierPose(
  tier: CardStackTier,
  s: number,
  len: number,
  w: number,
  h: number,
  peek: number
): CardPose {
  return tier.STACKED ? stackPose(s, len, w, h, tier, peek) : fanPose(s, len, w, tier, peek)
}

/**
 * Screen-space x (px from the deck centre) of the outer edge of the card
 * at offset `a` on the right side, after the perspective divide.
 *
 * The card's outer edge sits at its centre x plus the half-width turned
 * by rot: X = x + (w/2)·cos(rot), Z = depth − (w/2)·sin(rot) (the turn
 * sends the outer edge back). The deck's perspective P = PERSPECTIVE·w
 * with its origin at the deck centre — the cards' own anchor — projects
 * it to X·P / (P − Z); Z ≤ 0 so the edge only ever pulls inward.
 * @param a Unsigned ring offset.
 * @param w Card width px.
 * @param tier The active coverflow fan tier.
 * @returns The projected outer-edge x in px.
 */
export function projectedEdge(a: number, w: number, tier: CardStackFanTier): number {
  const pose = fanPose(a, 1, w, tier)

  const t = pose.rot * DEG

  const p = tier.PERSPECTIVE * w

  const ex = pose.x + (w / 2) * Math.cos(t)

  const ez = pose.depth - (w / 2) * Math.sin(t)

  return (ex * p) / (p - ez)
}

/**
 * Visible cards per side — the deepest offset (≤ tier.PEEK) whose
 * projected outer edge stays inside the deck half-width × EDGE_ROOM,
 * never below PEEK_MIN. The fan is symmetric, so one count serves both
 * sides: on landscape/desktop the left-most card can't reach into the
 * text column, and on phones EDGE_ROOM > 1 lets the neighbours bleed
 * off-screen as the swipe hint.
 * @param deckW Deck width px.
 * @param w Card width px.
 * @param tier The active coverflow fan tier.
 * @returns Cards visible per side.
 */
export function fitPeek(deckW: number, w: number, tier: CardStackFanTier): number {
  const room = (deckW / 2) * tier.EDGE_ROOM

  let peek = tier.PEEK

  // Bounded count-down (≤ PEEK steps), not a traversal.
  while (peek > CARD_STACK_LAYOUT.PEEK_MIN && projectedEdge(peek, w, tier) > room) peek--

  return peek
}

/**
 * Measures the deck region and publishes the card box + tier: the card
 * width is the tier's CARD_SHARE of the deck width, capped so its height
 * (width × CARD_H_RATIO) stays inside HEIGHT_SHARE of the stage height —
 * the deck's own box, clamped to the stage budget the VIEWPORT actually
 * leaves it: the section is min-height 100dvh, so when the chrome (title
 * header, info column, foot) needs more than the window the section
 * overflows and the deck's measured height lies about the room available.
 * The stage budget subtracts the space above and below the deck inside
 * the section from the viewport, so the card shrinks on short windows
 * instead of holding a constant height while the page scrolls.
 * Pre-paint/hidden contexts report zero rects → the viewport width
 * stands in for the deck width and the height cap is skipped.
 * @param host The CardStack element.
 */
export function measure(host: CardStack): void {
  const deck = host.$(CARD_STACK_SELECTORS.CARD_STACK_DECK)

  const rect = deck ? deck.getBoundingClientRect() : null

  const vw = viewportWidth() || CARD_STACK_LAYOUT.CARD_W_FALLBACK

  const vh = viewportHeight()

  const tier = pickTier(vw, vh)

  const deckW = rect?.width || vw

  let deckH = rect?.height || 0

  if (deck && rect?.height) {
    const section = host.$(CARD_STACK_SELECTORS.CARD_STACK)

    const secRect = section ? section.getBoundingClientRect() : null

    if (secRect) {
      const style = getComputedStyle(section as HTMLElement)

      const headerEl = (section as HTMLElement).querySelector(
        CARD_STACK_SELECTORS.CARD_STACK_HEADER
      )

      const footEl = (section as HTMLElement).querySelector(CARD_STACK_SELECTORS.CARD_STACK_FOOT)

      const boxH = (el: Element | null) => (el ? el.getBoundingClientRect().height : 0)

      const marginsOf = (el: Element | null) => {
        if (!el) return 0

        const s = getComputedStyle(el as HTMLElement)

        return (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0)
      }

      // Fixed chrome only — the section's vertical padding plus the
      // header and foot rows (with margins). Edge deltas can't be used
      // here: the one-column grid aligns its rows `space-evenly`, so
      // the slack around the deck lands inside those deltas and the
      // budget would collapse to the deck's own measured height — a
      // ratchet that only ever shrinks. The slack is the very space
      // the pile may grow into, so it must NOT count as chrome. On the
      // ≥1280 side-by-side grid (rows auto / minmax(0,1fr) / auto) the
      // slack already lives inside the deck's own track, and this same
      // fixed-chrome sum resolves identically.
      const chromeH =
        (parseFloat(style.paddingTop) || 0) +
        (parseFloat(style.paddingBottom) || 0) +
        boxH(headerEl) +
        marginsOf(headerEl) +
        boxH(footEl) +
        marginsOf(footEl)

      // The raw viewport allotment — fitDeckToFront's stage cap. Kept
      // apart from deckH (which clamps to it): the band's cap must read
      // the budget itself, not the deck's own current height, or a
      // band measured mid-overflow locks the cap to the wrong figure.
      host._stageH = Math.max(0, vh - chromeH)

      deckH = Math.min(deckH, host._stageH)
    }
  }

  const byWidth = deckW * tier.CARD_SHARE

  // The card's height-derived width input differs per layout contract:
  // the fan tiers' 1fr deck row IS the allotment, so the measured deck
  // height is the honest bound; the stacked tiers' deck row is
  // auto-height — its measurement is the band the LAST card size
  // produced, which feeds back as a sticky ratchet that can only
  // shrink. There the bound is the stage budget itself (the viewport
  // allotment after fixed chrome): the pile may grow into the
  // space-evenly slack until the band hits the cap.
  const heightRoom = tier.STACKED ? host._stageH || deckH : deckH

  const byHeight = heightRoom ? (heightRoom * tier.HEIGHT_SHARE) / tier.CARD_H_RATIO : byWidth

  // Copy-carrying stacked tiers size by width alone — the front card
  // auto-grows to its copy (height:auto in applyPoses) and the deck row
  // follows via fitDeckToFront's min-height, so the page scrolls
  // instead of crushing the card into the stage's leftover height. The
  // image-only stacked band (1024–1279 landscape) and the fan tiers
  // keep the height cap — no copy ever grows those cards, so the pile
  // must fit the bounded side-by-side stage and never push its bottom
  // edge past the section's clip boundary.
  host._cardW = Math.min(
    Math.max(
      tier.STACKED && tier.IN_CARD_INFO ? byWidth : Math.min(byWidth, byHeight),
      CARD_STACK_LAYOUT.CARD_W_MIN
    ),
    CARD_STACK_LAYOUT.CARD_W_MAX
  )

  host._cardH = host._cardW * tier.CARD_H_RATIO

  host._step = host._cardW * tier.FIRST_STEP

  host._tier = tier

  // Autoplay is fan-tier only — a resize into a stacked layout kills a
  // running countdown (stopAutoplay no-ops when nothing is armed).
  if (tier.STACKED) stopAutoplay(host)

  // The fan's peek is width-fitted to the deck edges; the stacked pile's
  // depth window is the tier's authored count (the cascade's own offsets
  // — not a horizontal fit — decide what peeks out).
  host._peek = tier.STACKED ? tier.PEEK : fitPeek(deckW, host._cardW, tier)

  host._deckW = deckW

  host._deckH = deckH

  host._sizesDirty = true
}

/** Zero-padded counter/index number — "01", "08" — shared by the deck
 *  counter and the index rows. */
export function padNum(n: number): string {
  return `${n}`.padStart(CARD_STACK_LAYOUT.PAD, CHAR_STRINGS.ZERO)
}

/**
 * Writes every card's pose for the current virtual front `f` — derived
 * from `activeIdx - _dragX/_step`, so a live drag slides the whole
 * coverflow continuously and `activeIdx` alone reproduces the rest pose.
 * Card width/height and the deck perspective (the tier's camera
 * distance) write once per measure() (_sizesDirty); the --active class
 * rides the same pass. Runs inside the gesture rAF — reads are cached
 * fields, writes are transform/opacity/zIndex/visibility only.
 * @param host The CardStack element.
 */
export function applyPoses(host: CardStack): void {
  const items = host.deckItems

  const len = items.length

  if (!len) return

  const f = host.activeIdx - host._dragX / host._step

  const w = host._cardW

  const h = host._cardH

  const tier = host._tier

  const cards = host._cardEls

  for (let i = 0; i < cards.length; i++) {
    const el = cards[i] as HTMLElement

    const s = ringSigned(i - f, len)

    const front = Math.abs(s) < CARD_STACK_LAYOUT.FRONT_EPS

    // EVERY stacked card rides the front card's live height: the pile's
    // sheets match the copy-sized (or stage-capped) front box, so only
    // the thin stair offsets peek out instead of a near-full second
    // image spilling below the front card's bottom edge — and on the
    // image-only band the front's own inline min-height can't defeat
    // the stage cap the way a CSS max-height would. The pose's height
    // argument follows the same live box so the stacked tiers' y
    // offsets keep their scale.
    const pileH = h + host._frontExtra

    const pose = tierPose(tier, s, len, w, pileH, host._peek)

    const wasVisible = _wasVisible.get(el)

    _wasVisible.set(el, pose.visible)

    el.classList.toggle(CARD_STACK_CLASSES.CARD_STACK_CARD_HIDDEN, !pose.visible)

    if (host._sizesDirty) {
      el.style.width = `${w}${COMMON_ATTRS.PX}`

      el.style.height = `${h}${COMMON_ATTRS.PX}`

      // Stacked "entire card" heights carry a min-height floor (cleared
      // on fan tiers, and on the stacked front card below) — the pile
      // keeps its uniform shape even if a card's own copy runs short.
      el.style.minHeight = tier.STACKED ? `${h}${COMMON_ATTRS.PX}` : ATTR_VALUES.EMPTY
    }

    if (tier.STACKED) {
      // The pile behind rides the front card's live height (pileH) so
      // a copy-grown front can't leave a taller image-only sheet
      // peeking out below it. On COPY-CARRYING tiers the FRONT card
      // drops BOTH the fixed height and the min-height floor so its
      // own copy sizes the box — descriptions never truncate, never
      // scroll, and short copy leaves no dead space; the page itself
      // absorbs any overflow past the fold. Its rendered delta
      // re-enters pose space as the SIGNED _frontExtra that sizes
      // pileH above. The image-only pile's front is pure media — an
      // absolute-positioned cover and a display:none info column
      // contribute no flow height, so auto would collapse the card to
      // a sliver: it keeps the ratio box.
      const sizesToCopy = front && tier.IN_CARD_INFO

      el.style.height = sizesToCopy ? ATTR_VALUES.AUTO : `${pileH}${COMMON_ATTRS.PX}`

      el.style.minHeight = sizesToCopy ? ATTR_VALUES.EMPTY : `${pileH}${COMMON_ATTRS.PX}`
    }

    // A card entering the fan seeds below its slot, transparent, with
    // transitions off for that one write — restoring them lets the base
    // transition carry it up into place while it fades in (the deck's
    // wrap-around "rise + fade" the boundary nav relies on). A card
    // leaving the fan simply writes opacity 0 + --hidden, and its
    // opacity/visibility transition dissolves it in place.
    if (pose.visible && wasVisible === false) {
      el.style.transition = ATTR_VALUES.NONE

      el.style.transform = `translate(-50%, -50%) translate3d(${pose.x}${COMMON_ATTRS.PX}, ${pose.y + h * CARD_STACK_LAYOUT.ENTER_RISE}${COMMON_ATTRS.PX}, ${pose.depth}${COMMON_ATTRS.PX}) rotateY(${pose.rot}deg) rotate(${pose.rotZ}deg) scale(${pose.scale})`

      el.style.opacity = CHAR_STRINGS.ZERO

      el.style.visibility = ATTR_VALUES.VISIBLE

      el.style.zIndex = `${pose.z}`

      void el.offsetWidth

      el.style.transition = ATTR_VALUES.EMPTY
    }

    // Centre-anchored: the card's own centre sits on the deck centre —
    // the perspective origin — so translate3d + the fan's rotateY (and
    // the stack cascade's rotateZ) pivot it in place and the
    // perspective divide scales it toward that point. The stacked pile
    // shares the front card's LIVE height (pileH above), so plain
    // centering keeps every card's top edge on the same line — the
    // pile never bleeds into the header when the front is capped, and
    // only the authored stair offsets peek past its edges.
    el.style.transform = `translate(-50%, -50%) translate3d(${pose.x}${COMMON_ATTRS.PX}, ${pose.y}${COMMON_ATTRS.PX}, ${pose.depth}${COMMON_ATTRS.PX}) rotateY(${pose.rot}deg) rotate(${pose.rotZ}deg) scale(${pose.scale})`

    // Opacity writes the pose value for visible cards (1) and the hidden
    // floor (0) — the entering seed's 0→1 and the leaving card's 1→0
    // dissolve both ride the stylesheet's opacity transition.
    el.style.opacity = pose.visible ? `${pose.opacity}` : CHAR_STRINGS.ZERO

    el.style.zIndex = `${pose.z}`

    el.style.visibility = pose.visible ? ATTR_VALUES.VISIBLE : ATTR_VALUES.HIDDEN

    el.classList.toggle(
      CARD_STACK_CLASSES.CARD_STACK_CARD_ACTIVE,
      pose.visible && Math.abs(s) < CARD_STACK_LAYOUT.FRONT_EPS
    )
  }

  if (host._sizesDirty && host._deckEl) {
    ;(host._deckEl as HTMLElement).style.perspective = `${tier.PERSPECTIVE * w}${COMMON_ATTRS.PX}`
  }

  host._sizesDirty = false
}

/**
 * Refreshes the non-pose chrome after a nav — the "PROJECT 01 OF 08"
 * counter (projectLabel + ofLabel, both localized), the dot --active
 * flags, each card's aria-hidden/tabindex so off-front cards leave the
 * tab order and AT tree, and the text column's copy for the new front.
 * @param host The CardStack element.
 */
export function updateChrome(host: CardStack): void {
  const len = host.deckItems.length

  if (!len) return

  const lang = store.getters.getCarouselLang() as { ofLabel?: string } | undefined

  const ofLabel = lang?.ofLabel || (FALLBACK_APP.carousel as { ofLabel: string }).ofLabel

  const navIndex = host.$(CARD_STACK_SELECTORS.CARD_STACK_NAV_INDEX) as HTMLElement | null

  if (navIndex) {
    const n = host.activeIdx + 1

    const num = navIndex.querySelector(CARD_STACK_SELECTORS.CARD_STACK_NAV_INDEX_NUM)

    // The "1 / 13" position rides beside the stack glyph; the button's
    // own accessible name is the localized "Project 1 of 13" phrase.
    if (num) {
      num.textContent = `${n}${CHAR_STRINGS.SPACE_CHAR}${CHAR_STRINGS.SLASH}${CHAR_STRINGS.SPACE_CHAR}${len}`
    }

    navIndex.setAttribute(ARIA_ATTRS.ARIA_LABEL, `${host._t.projectLabel} ${n} ${ofLabel} ${len}`)

    dealNavIndex(host, navIndex)
  }

  const dots = host.$$(CARD_STACK_SELECTORS.CARD_STACK_DOT)

  dots.forEach((dot, i) => {
    dot.classList.toggle(CARD_STACK_CLASSES.CARD_STACK_DOT_ACTIVE, i === host.activeIdx)
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

  writeInfo(host)

  fitDeckToFront(host)
}

/** Last chromed index per host — the nav-index deal animation's
 *  direction cue (a mount's first pass has no previous front). */
const _chromeIdx = new WeakMap<CardStack, number>()

/**
 * Deals the nav-index stack glyph after a front change — the top card
 * of the icon flings in the nav direction (forward on next, backward
 * on prev, ring-normalized so wrap-around navs read correctly) and
 * slides back under the pile, echoing the deck's own card exchange.
 * The class re-arms through a frame-boundary remove → rAF add pair so
 * a mid-animation nav restarts the keyframe without a forced reflow.
 * @param host The CardStack element.
 * @param navIndex The nav-index button carrying the glyph.
 */
function dealNavIndex(host: CardStack, navIndex: HTMLElement): void {
  const len = host.deckItems.length

  const prev = _chromeIdx.get(host)

  _chromeIdx.set(host, host.activeIdx)

  if (prev === undefined || prev === host.activeIdx || len <= 1) return

  const delta = host.activeIdx - prev

  const fwd = delta > 0 ? delta <= len / 2 : delta < -len / 2

  navIndex.classList.remove(
    CARD_STACK_CLASSES.CARD_STACK_NAV_INDEX_DEAL_NEXT,
    CARD_STACK_CLASSES.CARD_STACK_NAV_INDEX_DEAL_PREV
  )

  requestAnimationFrame(() => {
    navIndex.classList.add(
      fwd
        ? CARD_STACK_CLASSES.CARD_STACK_NAV_INDEX_DEAL_NEXT
        : CARD_STACK_CLASSES.CARD_STACK_NAV_INDEX_DEAL_PREV
    )
  })
}

/**
 * Re-fits the stacked deck's min-height to the FRONT card's rendered
 * height — applyPoses lets the front card auto-grow past the ratio
 * height so its copy never truncates and never scrolls (the page
 * itself absorbs the overflow); the measured delta parks as
 * _frontExtra (pileH's input — the behind sheets match the front's
 * live height) and the deck row stretches to the taller card so it
 * never collides with the foot. The front card's ResizeObserver
 * re-runs the fit when fonts/locale change the copy after mount.
 * Fan tiers just clear the artifact. One layout read per nav/mount —
 * same class as measure(), never per-frame.
 * @param host The CardStack element.
 */
export function fitDeckToFront(host: CardStack): void {
  const deck = host._deckEl as HTMLElement | null

  if (!host._tier?.STACKED) {
    host._frontExtra = 0

    if (deck) {
      deck.style.minHeight = ATTR_VALUES.EMPTY
    }

    return
  }

  const front = host._cardEls[host.activeIdx] as HTMLElement | undefined

  if (!front) return

  if (host._fitFront !== front) {
    host._fitRO?.disconnect()

    if (typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
      host._fitRO ??= new ResizeObserver(() => fitDeckToFront(host))

      host._fitRO.observe(front)

      // The link's box (auto-height) and the info column's content
      // box change when <draw-text> writes the description, so both
      // are watched alongside the card itself: late copy injection
      // re-runs the fit and re-anchors _frontExtra.
      const linkEl = front.querySelector(CARD_STACK_SELECTORS.CARD_STACK_CARD_LINK)

      if (linkEl) host._fitRO.observe(linkEl)

      const infoEl = front.querySelector(CARD_STACK_SELECTORS.CARD_STACK_CARD_INFO)

      if (infoEl) host._fitRO.observe(infoEl)
    }

    host._fitFront = front
  }

  const rawH = front.getBoundingClientRect().height || host._cardH

  // Content-driven height — the front card NEVER caps at the stage
  // budget: its copy sizes the box outright (height:auto in
  // applyPoses) and the deck band grows to match, so a copy-heavy
  // card simply pushes the pile + controls past the fold and the
  // PAGE scrolls. _stageH stays as measure()'s width bound for the
  // image-only band — it no longer clamps any card's height.
  const realH = rawH

  // Deck growth only ever expands (a shorter front card never squeezes
  // the pile's own band) — but the signed delta rides _frontExtra so
  // pileH follows the front's live box BOTH ways: a copy-grown or
  // short-copy front shrinks the behind sheets with it.
  const grow = Math.max(0, realH - host._cardH)

  const anchor = realH - host._cardH

  if (deck) {
    const band = host._cardH + grow + host._cardH * CARD_STACK_LAYOUT.STACKED_DECK_PAD

    deck.style.minHeight = `${band}${COMMON_ATTRS.PX}`
  }

  if (anchor !== host._frontExtra) {
    host._frontExtra = anchor

    // pileH (and every stacked card's height write) rides the delta —
    // a growth change rewrites every card's box + pose in one pass.
    applyPoses(host)
  }
}
