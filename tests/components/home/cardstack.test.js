/**
 * @file cardstack.test.js
 * @description <card-stack> — the stacked featured-project deck: fan
 * geometry, drag/swipe + prev/next/dots nav, the all-projects index
 * overlay, skeleton state, and view-facing data contract.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { CardStack } from '@website/components/home/CardStack.js'
import {
  deckItems,
  ringSigned,
  fanPose,
  stackPose,
  tierPose,
  measure,
  applyPoses,
  pickTier,
  projectedEdge,
  fitPeek,
  updateChrome,
  padNum,
} from '@website/components/home/cardstack/deck.js'
import { projectHref, cardInfo, writeInfo } from '@website/components/home/cardstack/info.js'
import {
  cardIdxFromEvent,
  navigateTo,
  goTo,
  onCardClick,
  applyIndexState,
  toggleIndex,
  closeIndex,
  onKeyDown,
} from '@website/components/home/cardstack/interactions.js'
import {
  onPointerDown,
  onPointerMove,
  onPointerEnd,
} from '@website/components/home/cardstack/gestures.js'
import { bindEvents } from '@website/components/home/cardstack/events.js'
import { renderCardStack } from '@website/components/home/cardstack/render.js'
import { mount, waitFor } from '@tests/fixtures/test-constants.js'
import { CARD_STACK_CLASSES as C } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS as SEL } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_LAYOUT, CARD_STACK_TIERS } from '@core/tokens/motion/card-stack.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { KEYS } from '@core/tokens/primitives.js'
import {
  MOUSE_EVENTS,
  KEYBOARD_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import store from '@core/store.js'
import router from '@core/router/router.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const item = (n, featured = true) => ({
  link: `p-${n}`,
  image: `img-${n}`,
  label: `Project ${n}`,
  description: `Desc ${n} line one<br>line two`,
  featured,
})

/** Four-card fixture — enough for stacked/fan tier assertions. */
const ITEMS = [item(0), item(1), item(2), item(3)]

/** Selector bundle for the card/active/dot/thumb elements under assertion. */
const SELS = {
  CARD: `.${C.CARD_STACK_CARD}`,
  ACTIVE: `.${C.CARD_STACK_CARD_ACTIVE}`,
  DOT: `.${C.CARD_STACK_DOT}`,
  THUMB: `.${C.CARD_STACK_CARD_IMG_THUMB}`,
}

/** A desktop fan tier + the stacked phone tier — deterministic geometry
 *  references for the pure-math assertions (mounted decks pick their
 *  own tier from the happy-dom viewport). */
const FAN_TIER = CARD_STACK_TIERS.find((t) => !t.STACKED)

const STACK_TIER = CARD_STACK_TIERS[CARD_STACK_TIERS.length - 1]

/** Synthetic pointer-event factory — pointerId/button/coords/timestamp
 *  with per-test overrides and an optional target for delegation tests. */
const pointerEvt = (over = {}, target = null) => ({
  pointerId: 1,
  button: 0,
  clientX: 0,
  clientY: 0,
  timeStamp: 0,
  target,
  ...over,
})

/** Mounts a CardStack preloaded with ITEMS and waits for the cards to render. */
const mountDeck = async () => {
  const el = new CardStack()
  const cleanup = mount(el)
  el.processedItems = [...ITEMS]
  await waitFor(() => el.shadowRoot.querySelectorAll(SELS.CARD).length === ITEMS.length)
  return { el, cleanup }
}

/** Shadow-DOM lookup for the deck container element. */
const deckEl = (el) => el.shadowRoot.querySelector(SEL.CARD_STACK_DECK)

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/deck — pure geometry', () => {
  test('deckItems returns every pushed item regardless of flags', () => {
    const el = new CardStack()
    expect(deckItems(el)).toEqual([])
    el._processedItems = [item(0, false), item(1, true), item(2, false)]
    expect(deckItems(el).length).toBe(3)
    el._processedItems = [item(0, false), item(1, false)]
    expect(deckItems(el).length).toBe(2)
  })

  test('ringSigned normalizes into the ring distance', () => {
    expect(ringSigned(0, 4)).toBe(0)
    expect(ringSigned(1, 4)).toBe(1)
    expect(ringSigned(3, 4)).toBe(-1)
    expect(ringSigned(-1, 4)).toBe(-1)
    expect(ringSigned(5, 0)).toBe(0)
    expect(ringSigned(-0.4, 4)).toBeCloseTo(-0.4)
  })

  test('fanPose produces the front pose and the coverflow neighbours', () => {
    const front = fanPose(0, 4, 300, FAN_TIER)
    expect(front.x).toBe(0)
    // The fan-tier lift bias — the coverflow rides FAN_LIFT px above
    // the deck centre so it reads centred in the section.
    expect(front.y).toBe(CARD_STACK_LAYOUT.FAN_LIFT)
    expect(front.rot).toBe(0)
    expect(front.rotZ).toBe(0)
    expect(front.depth).toBe(0)
    expect(front.opacity).toBe(1)
    expect(front.visible).toBe(true)
    expect(front.z).toBe(4 * CARD_STACK_LAYOUT.Z_STRIDE)
    // The hero boost — the active card is plainly wider/taller than its
    // fanned neighbours; the boost eases off across the front→±1 ramp.
    expect(front.scale).toBe(CARD_STACK_LAYOUT.FRONT_SCALE)

    // ±1 takes the big FIRST_STEP jump, the full ROT_Y turn and DEPTH —
    // the sign is INWARD: a right-side card reads −ROT_Y so every face
    // converges on the deck centre (the reference's concave bowl).
    const side = fanPose(1, 4, 300, FAN_TIER)
    expect(side.x).toBeCloseTo(FAN_TIER.FIRST_STEP * 300)
    expect(side.rot).toBeCloseTo(-FAN_TIER.ROT_Y)
    expect(side.depth).toBeCloseTo(-FAN_TIER.DEPTH * 300)
    expect(side.z).toBe(3 * CARD_STACK_LAYOUT.Z_STRIDE)
    expect(side.scale).toBe(1)

    // The left side mirrors exactly — a symmetric fan.
    const left = fanPose(-1, 4, 300, FAN_TIER)
    expect(left.x).toBeCloseTo(-side.x)
    expect(left.rot).toBeCloseTo(-side.rot)
    expect(left.depth).toBeCloseTo(side.depth)

    // Deeper cards stack tightly: ±2 adds STEP + DEPTH_STEP and ROT_STEP
    // of extra turn — the progressive carousel wrap.
    const deep = fanPose(2, 4, 300, FAN_TIER)
    expect(deep.x).toBeCloseTo((FAN_TIER.FIRST_STEP + FAN_TIER.STEP) * 300)
    expect(deep.depth).toBeCloseTo(-(FAN_TIER.DEPTH + FAN_TIER.DEPTH_STEP) * 300)
    expect(deep.rot).toBeCloseTo(-(FAN_TIER.ROT_Y + FAN_TIER.ROT_STEP))

    // The wrap saturates at ROT_MAX — deep cards park just short of
    // edge-on instead of turning forever.
    const capped = fanPose(9, 4, 300, FAN_TIER, 10)
    expect(capped.rot).toBeCloseTo(-FAN_TIER.ROT_MAX)

    // Fractional drag offsets slide along the same piecewise curve.
    const mid = fanPose(0.5, 4, 300, FAN_TIER)
    expect(mid.x).toBeCloseTo(0.5 * FAN_TIER.FIRST_STEP * 300)
    expect(mid.rot).toBeCloseTo(-0.5 * FAN_TIER.ROT_Y)
    expect(mid.scale).toBeCloseTo(1 + 0.5 * (CARD_STACK_LAYOUT.FRONT_SCALE - 1))

    // Outside the peek window the card leaves the visible fan.
    const far = fanPose(FAN_TIER.PEEK + 2, 4, 300, FAN_TIER)
    expect(far.visible).toBe(false)
  })

  test('stackPose produces the deal slot, the up-left fan, and the parked dive', () => {
    // s=0 — the face-on front card of the stack.
    const front = stackPose(0, 4, 300, 390, STACK_TIER)
    expect(front.x).toBe(0)
    expect(front.y).toBe(0)
    expect(front.rotZ).toBe(0)
    expect(front.depth).toBe(0)
    expect(front.scale).toBe(1)
    expect(front.visible).toBe(true)
    expect(front.z).toBe(4 * CARD_STACK_LAYOUT.Z_STRIDE)

    // s=+1 — the DEAL slot: the next card down-right (its bottom band
    // peeks below the front card's edge).
    const deal = stackPose(1, 4, 300, 390, STACK_TIER)
    expect(deal.x).toBeCloseTo(STACK_TIER.DEAL_X * 300)
    expect(deal.y).toBeCloseTo(STACK_TIER.DEAL_Y * 390)
    expect(deal.rotZ).toBeCloseTo(STACK_TIER.DEAL_RZ)
    expect(deal.depth).toBeCloseTo(-STACK_TIER.DEAL_D * 300)
    expect(deal.visible).toBe(true)

    // s=+2 — the first draw-pile fan level, signed up-LEFT.
    const fan1 = stackPose(2, 4, 300, 390, STACK_TIER)
    expect(fan1.x).toBeCloseTo(STACK_TIER.FAN_X * 300)
    expect(fan1.y).toBeCloseTo(STACK_TIER.FAN_Y * 390)
    expect(fan1.rotZ).toBeCloseTo(STACK_TIER.FAN_RZ)
    expect(fan1.depth).toBeCloseTo(-STACK_TIER.FAN_D * 300)

    // s=+3 — one more FAN_*_STEP deeper.
    const fan2 = stackPose(3, 4, 300, 390, STACK_TIER)
    expect(fan2.x).toBeCloseTo((STACK_TIER.FAN_X + STACK_TIER.FAN_X_STEP) * 300)
    expect(fan2.y).toBeCloseTo((STACK_TIER.FAN_Y + STACK_TIER.FAN_Y_STEP) * 390)
    expect(fan2.rotZ).toBeCloseTo(STACK_TIER.FAN_RZ + STACK_TIER.FAN_RZ_STEP)
    expect(fan2.depth).toBeCloseTo(-(STACK_TIER.FAN_D + STACK_TIER.FAN_D_STEP) * 300)

    // Fractional s glides deal→fan continuously (halfway between slots).
    const mid = stackPose(1.5, 4, 300, 390, STACK_TIER)
    expect(mid.x).toBeCloseTo(
      (STACK_TIER.DEAL_X + (STACK_TIER.FAN_X - STACK_TIER.DEAL_X) * 0.5) * 300
    )

    // s<0 — returned cards dive under the pile's bottom edge, |s|-scaled
    // so the front card travels there smoothly mid-drag.
    const parked = stackPose(-1, 4, 300, 390, STACK_TIER)
    expect(parked.x).toBeCloseTo(-STACK_TIER.PARK_X * 300)
    expect(parked.y).toBeCloseTo(-STACK_TIER.PARK_Y * 390)
    expect(parked.rotZ).toBeCloseTo(-STACK_TIER.PARK_RZ)
    expect(parked.depth).toBeCloseTo(-STACK_TIER.PARK_D * 300)
    expect(parked.visible).toBe(true)
    expect(parked.z).toBeLessThan(deal.z)

    // Only the freshest parked card stays lit; deeper ones leave the pile.
    expect(stackPose(-2, 4, 300, 390, STACK_TIER).visible).toBe(false)
    expect(stackPose(STACK_TIER.PEEK + 1, 4, 300, 390, STACK_TIER).visible).toBe(false)
  })

  test('tierPose routes the pose model on the STACKED flag', () => {
    expect(tierPose(FAN_TIER, 1, 4, 300, 390, 2)).toEqual(fanPose(1, 4, 300, FAN_TIER, 2))
    expect(tierPose(STACK_TIER, 1, 4, 300, 390, 2)).toEqual(
      stackPose(1, 4, 300, 390, STACK_TIER, 2)
    )
  })

  test('pickTier selects the widest matching camera band', () => {
    expect(pickTier(2100, 1200).MIN_VW).toBe(1920)
    expect(pickTier(1440, 900).MIN_VW).toBe(1440)
    expect(pickTier(1300, 800).MIN_VW).toBe(1280)
    // 768–1279 splits on orientation — portrait stacks like a phone,
    // landscape is the 2-column tier.
    expect(pickTier(800, 1200).PORTRAIT).toBe(true)
    expect(pickTier(1200, 800).PORTRAIT).toBe(false)
    // 768–1279 landscape splits at 1024: the upper band carries the
    // image-only pile beside the text column, the lower band keeps the
    // mobile entire-card chrome.
    expect(pickTier(1200, 800).MIN_VW).toBe(1024)
    expect(pickTier(900, 700).MIN_VW).toBe(768)
    expect(pickTier(390, 844).MIN_VW).toBe(0)
  })

  test('projectedEdge projects the outer card edge through the camera', () => {
    const edge = projectedEdge(1, 300, FAN_TIER)
    expect(edge).toBeGreaterThan(0)
    // The perspective divide only ever pulls the edge inward vs its
    // untransformed x + half-width position.
    expect(edge).toBeLessThan(FAN_TIER.FIRST_STEP * 300 + 150)
  })

  test('fitPeek fills the deck room but never drops below the floor', () => {
    const wide = fitPeek(6000, 200, FAN_TIER)
    expect(wide).toBe(FAN_TIER.PEEK)
    // Half-width × EDGE_ROOM under one card → the PEEK_MIN floor.
    const tight = fitPeek(120, 200, FAN_TIER)
    expect(tight).toBe(CARD_STACK_LAYOUT.PEEK_MIN)
  })

  test('padNum zero-pads', () => {
    expect(padNum(3)).toBe('03')
    expect(padNum(12)).toBe('12')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('CardStack — mount + data contract', () => {
  let el, cleanup

  beforeEach(async () => {
    ;({ el, cleanup } = await mountDeck())
  })

  afterEach(() => cleanup())

  test('renders a card per deck item + the text column and controls', () => {
    const cards = el.shadowRoot.querySelectorAll(SELS.CARD)
    expect(cards.length).toBe(ITEMS.length)
    expect(cards[0].querySelector('a').getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('Project 0')
    // Every card carries its own copy — the "entire card" body the
    // stacked layouts show (fan tiers hide it via CSS).
    const cardTitle = cards[0].querySelector(`.${C.CARD_STACK_CARD_INFO_TITLE}`)
    expect(cardTitle.textContent).toBe('Project 0')
    // Every card owns a <draw-text> writer; on copy-carrying stacked
    // tiers writeInfo() arms only the front card's `text` so the
    // description typewrites — behind cards stay disarmed (empty
    // text). The happy-dom viewport lands on the image-only band, so
    // the arming contract is exercised against the phone tier directly.
    // The in-card writer carries the first-sentence SUMMARY (the card
    // copy is clamped to four lines) while the text column below keeps
    // the full body — same content at two lengths, both indexable.
    el._tier = STACK_TIER
    writeInfo(el)
    const frontWriter = cards[0].querySelector(
      `.${C.CARD_STACK_CARD_INFO_DESC} ${COMPONENT_TAGS.DRAW_TEXT}`
    )
    expect(frontWriter.getAttribute(FORM_ATTRS.TEXT)).toBe('Desc 0 line one')
    expect(
      cards[1]
        .querySelector(`.${C.CARD_STACK_CARD_INFO_DESC} ${COMPONENT_TAGS.DRAW_TEXT}`)
        .getAttribute(FORM_ATTRS.TEXT)
    ).toBe(ATTR_VALUES.EMPTY)
    expect(cards[0].querySelector(`.${C.CARD_STACK_CARD_INFO_CTA}`)).not.toBeNull()
    // The text column — a plain-text title (the burn owns it) + the
    // Jost description writer + the project link.
    const infoTitle = el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_TITLE)
    expect(infoTitle.textContent).toBe('Project 0')
    const infoBody = el.shadowRoot.querySelector(
      `${SEL.CARD_STACK_INFO_DESC} ${COMPONENT_TAGS.DRAW_TEXT}`
    )
    expect(infoBody.getAttribute(FORM_ATTRS.TEXT)).toBe('Desc 0 line one<br>line two')
    const cta = el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_CTA)
    expect(cta.getAttribute(LINK_ATTRS.HREF)).toBe(`${ROUTE_PATHS.PORTFOLIO}p-0`)
    expect(el.shadowRoot.querySelector(SEL.CARD_STACK_TOGGLE)).not.toBeNull()
    expect(el.shadowRoot.querySelector(SEL.CARD_STACK_NAV_INDEX_NUM)).not.toBeNull()
    expect(el.shadowRoot.querySelector(SEL.CARD_STACK_INDEX)).not.toBeNull()
    expect(el.shadowRoot.querySelectorAll(`.${C.CARD_STACK_INDEX_ITEM}`).length).toBe(ITEMS.length)
  })

  test('skeleton fan renders before data and swaps on items', () => {
    const fresh = new CardStack()
    const unmount = mount(fresh)
    const shimmerCards = fresh.shadowRoot.querySelectorAll(SELS.CARD)
    expect(shimmerCards.length).toBe(3)
    expect(fresh.shadowRoot.querySelector(SEL.CARD_STACK_TOGGLE)).toBeNull()
    unmount()
  })

  test('setters normalize + clamp', () => {
    el.activeIdx = 3
    el.processedItems = [item(0)]
    expect(el.activeIdx).toBe(0)
    el.processedItems = 'not-an-array'
    expect(el.processedItems).toEqual([])
    el.translations = { viewAll: 'SEE ALL' }
    expect(el._t.viewAll).toBe('SEE ALL')
    expect(el._t.featured).toBeTruthy()
  })

  test('storage getter proxies the store', () => {
    expect(el.storage).toBe(store.getters.getStorage())
  })

  test('onDestroy clears raf + manifest sub', () => {
    el._rafId = requestAnimationFrame(() => {})
    const unsub = jest.fn()
    el._unsubManifest = unsub
    el.onDestroy()
    expect(el._rafId).toBeNull()
    expect(unsub).toHaveBeenCalled()
  })

  test('a loaded media manifest fires the re-render subscriber on mount', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [],
    }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    const fresh = new CardStack()
    const unmount = mount(fresh)

    fresh.processedItems = ITEMS

    await waitFor(() => fresh._cardEls.length === ITEMS.length)

    // keys were already resident → onMediaManifest invoked the arrow
    // synchronously inside connectedCallback (one-shot _updateDom).
    expect(fresh._unsubManifest).toEqual(expect.any(Function))

    unmount()

    globalThis.fetch = realFetch
  })

  test('_dragTick releases the rAF slot and writes poses', () => {
    el._rafId = 7
    el._dragTick()
    expect(el._rafId).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/deck — DOM writes', () => {
  let el, cleanup

  beforeEach(async () => {
    ;({ el, cleanup } = await mountDeck())
  })

  afterEach(() => cleanup())

  test('applyPoses writes transform/opacity/z/visibility + active class', () => {
    // happy-dom's landscape viewport picks the stacked 768 tier — pin
    // the fan tier so the assertions check the coverflow's dim ladder.
    el._tier = FAN_TIER
    el._sizesDirty = true
    applyPoses(el)
    const cards = el._cardEls
    expect(cards.length).toBe(ITEMS.length)
    const front = cards[0]
    expect(front.style.transform).toContain('translate3d')
    expect(front.style.transform).toContain('rotateY')
    // The hero boost lands in the DOM transform — the active card is
    // scaled FRONT_SCALE while fanned cards stay at 1.
    expect(front.style.transform).toContain(`scale(${CARD_STACK_LAYOUT.FRONT_SCALE})`)
    expect(cards[1].style.transform).toContain('scale(1)')
    expect(front.style.width).toMatch(/px$/)
    expect(front.classList.contains(C.CARD_STACK_CARD_ACTIVE)).toBe(true)
    expect(el._sizesDirty).toBe(false)
    // A dirty pass also writes the deck's perspective camera.
    expect(el._deckEl.style.perspective).toMatch(/px$/)
    const back = cards[2]
    expect(back.classList.contains(C.CARD_STACK_CARD_ACTIVE)).toBe(false)
    // Side cards dim toward the deck edges — two levels down the ladder.
    expect(parseFloat(back.style.opacity)).toBeCloseTo(1 - 2 * CARD_STACK_LAYOUT.FAN_DIM_STEP)
    expect(parseInt(back.style.zIndex, 10)).toBeLessThan(parseInt(front.style.zIndex, 10))
  })

  test('measure computes card box, step, tier and peek', () => {
    measure(el)
    expect(el._cardW).toBeGreaterThanOrEqual(CARD_STACK_LAYOUT.CARD_W_MIN)
    expect(el._cardW).toBeLessThanOrEqual(CARD_STACK_LAYOUT.CARD_W_MAX)
    expect(el._cardH).toBeCloseTo(el._cardW * el._tier.CARD_H_RATIO)
    expect(el._step).toBeCloseTo(el._cardW * el._tier.FIRST_STEP)
    expect(el._peek).toBeGreaterThanOrEqual(CARD_STACK_LAYOUT.PEEK_MIN)
    expect(el._peek).toBeLessThanOrEqual(el._tier.PEEK)
  })

  test('applyPoses is a no-op without items', () => {
    const bare = new CardStack()
    expect(() => applyPoses(bare)).not.toThrow()
  })

  test('measure + updateChrome degrade on an unmounted element', () => {
    const bare = new CardStack()

    // No deck node → deckW 0 → the viewport/fallback basis still sizes
    // the card box, and updateChrome early-returns on the empty deck.
    measure(bare)
    updateChrome(bare)

    expect(bare._cardW).toBeGreaterThan(0)
    expect(bare._cardH).toBeGreaterThan(0)
  })

  test('updateChrome fills the nav-index position, dots and card a11y flags', () => {
    updateChrome(el)
    const navIndex = el.shadowRoot.querySelector(SEL.CARD_STACK_NAV_INDEX)
    const num = el.shadowRoot.querySelector(SEL.CARD_STACK_NAV_INDEX_NUM)
    // "1 / 4" beside the stack glyph + the "Project 1 of 4" accessible
    // name — the stacked layouts' position indicator.
    expect(num.textContent).toBe('1 / 4')
    expect(navIndex.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain('1')
    expect(navIndex.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain('4')
    const dots = el.shadowRoot.querySelectorAll(SELS.DOT)
    expect(dots[0].classList.contains(C.CARD_STACK_DOT_ACTIVE)).toBe(true)
    expect(dots[1].classList.contains(C.CARD_STACK_DOT_ACTIVE)).toBe(false)
    const frontLink = el._cardEls[0].querySelector('a')
    expect(frontLink.getAttribute(ARIA_ATTRS.TABINDEX)).toBe(ATTR_VALUES.TABINDEX_ZERO)
    const backLink = el._cardEls[2].querySelector('a')
    expect(backLink.getAttribute(ARIA_ATTRS.TABINDEX)).toBe(ATTR_VALUES.NEGATIVE_TABINDEX)
    expect(el._cardEls[2].getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
  })

  test('updateChrome returns early with no items', () => {
    const bare = new CardStack()
    expect(() => updateChrome(bare)).not.toThrow()
  })

  test('applyPoses skips the deck perspective write when the deck is gone', () => {
    // Dirty sizes + a missing deck element → the && guard's right arm.
    measure(el)
    el._deckEl = null
    expect(() => applyPoses(el)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/info — the text column', () => {
  let el, cleanup

  beforeEach(async () => {
    ;({ el, cleanup } = await mountDeck())
  })

  afterEach(() => cleanup())

  test('cardInfo splits the CMS item into title/body/route', () => {
    const info = cardInfo(ITEMS[0])
    expect(info.title).toBe('Project 0')
    expect(info.body).toBe('Desc 0 line one<br>line two')
    expect(info.summary).toBe('Desc 0 line one')
    expect(info.href).toBe(`${ROUTE_PATHS.PORTFOLIO}p-0`)

    // Missing item → the all-empty shape.
    expect(cardInfo(undefined)).toEqual({
      title: ATTR_VALUES.EMPTY,
      body: ATTR_VALUES.EMPTY,
      summary: ATTR_VALUES.EMPTY,
      href: ATTR_VALUES.EMPTY,
    })

    // A description with no cut point passes through whole — the CSS
    // four-line clamp bounds the visual box.
    expect(cardInfo({ description: 'No ender anywhere' }).summary).toBe('No ender anywhere')

    // No description → an empty body; label then title back up the name.
    expect(cardInfo({ label: 'Named' }).body).toBe(ATTR_VALUES.EMPTY)
    expect(cardInfo({ title: 'Titled' }).title).toBe('Titled')
    expect(cardInfo({}).title).toBe(ATTR_VALUES.EMPTY)
  })

  test('writeInfo re-aims the writers and the CTA on nav', () => {
    el.activeIdx = 1
    writeInfo(el)
    const title = el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_TITLE)
    expect(title.textContent).toBe('Project 1')
    const cta = el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_CTA)
    expect(cta.getAttribute(LINK_ATTRS.HREF)).toBe(`${ROUTE_PATHS.PORTFOLIO}p-1`)

    // An item with no route/body hides its slots instead of leaving
    // dead chrome (empty line-height boxes or a dead focusable link).
    el._processedItems[1] = { label: 'Bare' }
    writeInfo(el)
    expect(cta.hasAttribute(COMMON_ATTRS.HIDDEN)).toBe(true)
    expect(
      el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_DESC).hasAttribute(COMMON_ATTRS.HIDDEN)
    ).toBe(true)
    expect(
      el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_TITLE).hasAttribute(COMMON_ATTRS.HIDDEN)
    ).toBe(false)
    expect(el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_TITLE).textContent).toBe('Bare')

    // Re-publishing the same front with no session is a pure fast-path
    // no-op; an out-of-range index carries no item into the burn mount.
    writeInfo(el)
    el.activeIdx = 9
    writeInfo(el)
    expect(el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_TITLE).textContent).toBe(
      ATTR_VALUES.EMPTY
    )
    el.activeIdx = 0
  })

  test('writeInfo tolerates missing slots + a missing CTA', () => {
    el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_TITLE).remove()
    el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_CTA).remove()
    expect(() => writeInfo(el)).not.toThrow()
  })

  test('the CTA SPA-navigates; modified clicks keep the real anchor', () => {
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    const cta = el.shadowRoot.querySelector(SEL.CARD_STACK_INFO_CTA)
    cta.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(spy).toHaveBeenCalledWith(`${ROUTE_PATHS.PORTFOLIO}p-0`)
    spy.mockClear()
    cta.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, metaKey: true }))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/interactions', () => {
  let el, cleanup

  beforeEach(async () => {
    ;({ el, cleanup } = await mountDeck())
  })

  afterEach(() => cleanup())

  test('projectHref builds localized urls', () => {
    expect(projectHref({})).toBe(ATTR_VALUES.EMPTY)
    expect(projectHref({ link: 'x' })).toBe(`${ROUTE_PATHS.PORTFOLIO}x`)
    store.commit(LANG_MUTATIONS.SET_LANG, LOCALES.FR)
    expect(projectHref({ link: 'x' })).toBe(
      `${ROUTE_PATHS.ROOT}${LOCALES.FR}${ROUTE_PATHS.PORTFOLIO}x`
    )
    store.commit(LANG_MUTATIONS.SET_LANG, LOCALES.EN)
  })

  test('cardIdxFromEvent resolves cards and ignores non-cards', () => {
    expect(
      cardIdxFromEvent({ target: el.shadowRoot.querySelector(SEL.CARD_STACK_TOGGLE) })
    ).toBeNull()
    const link = el.shadowRoot.querySelector(`${SELS.CARD} a`)
    const res = cardIdxFromEvent({ target: link })
    expect(res.idx).toBe(0)
    expect(cardIdxFromEvent({ target: null })).toBeNull()
  })

  test('navigateTo pushes only real destinations', () => {
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    navigateTo(el, undefined)
    navigateTo(el, {})
    expect(spy).not.toHaveBeenCalled()
    navigateTo(el, { link: 'zz' })
    expect(spy).toHaveBeenCalledWith(`${ROUTE_PATHS.PORTFOLIO}zz`)
    spy.mockRestore()
  })

  test('goTo wraps around the ring', () => {
    goTo(el, -1)
    expect(el.activeIdx).toBe(ITEMS.length - 1)
    goTo(el, ITEMS.length)
    expect(el.activeIdx).toBe(0)
    const bare = new CardStack()
    expect(() => goTo(bare, 2)).not.toThrow()
  })

  test('onCardClick brings side cards forward; front card navigates', () => {
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    el.activeIdx = 0
    onCardClick(el, ITEMS[2], 2)
    expect(el.activeIdx).toBe(2)
    expect(spy).not.toHaveBeenCalled()
    onCardClick(el, ITEMS[2], 2)
    expect(spy).toHaveBeenCalledWith(`${ROUTE_PATHS.PORTFOLIO}p-2`)
    spy.mockRestore()
  })

  test('prev/next/dot delegates move the fan', () => {
    el.activeIdx = 0
    el.onNextClick()
    expect(el.activeIdx).toBe(1)
    el.onPrevClick()
    expect(el.activeIdx).toBe(0)
    el.onDotClick(3)
    expect(el.activeIdx).toBe(3)
  })

  test('toggleIndex + closeIndex publish the overlay state', () => {
    toggleIndex(el)
    expect(el.indexOpen).toBe(true)
    const section = el.shadowRoot.querySelector(SEL.CARD_STACK)
    expect(section.classList.contains(C.CARD_STACK_INDEX_OPEN)).toBe(true)
    const panel = el.shadowRoot.querySelector(SEL.CARD_STACK_INDEX)
    expect(panel.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.FALSE)
    const toggle = el.shadowRoot.querySelector(SEL.CARD_STACK_TOGGLE)
    expect(toggle.getAttribute(ARIA_ATTRS.ARIA_EXPANDED)).toBe(ATTR_VALUES.TRUE)
    closeIndex(el)
    expect(el.indexOpen).toBe(false)
    closeIndex(el) // second close is a no-op
    expect(panel.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    const bare = new CardStack()
    expect(() => applyIndexState(bare)).not.toThrow()
  })

  test('onKeyDown: arrows step the fan, Escape closes the index', () => {
    const kd = (key) => {
      const e = { key, preventDefault: jest.fn() }
      onKeyDown(el, e)
      return e
    }
    el.activeIdx = 1
    const left = kd(KEYS.ARROW_LEFT)
    expect(left.preventDefault).toHaveBeenCalled()
    expect(el.activeIdx).toBe(0)
    kd(KEYS.ARROW_RIGHT)
    expect(el.activeIdx).toBe(1)
    el.indexOpen = true
    kd(KEYS.ESCAPE)
    expect(el.indexOpen).toBe(false)
    const other = kd('x')
    expect(other.preventDefault).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/gestures — pointer swipe', () => {
  let el, cleanup, deck

  beforeEach(async () => {
    ;({ el, cleanup } = await mountDeck())
    deck = deckEl(el)
  })

  afterEach(() => cleanup())

  test('down ignores non-primary buttons and second pointers', () => {
    onPointerDown(el, pointerEvt({ button: 2 }, deck))
    expect(el._pointerId).toBeNull()
    onPointerDown(el, pointerEvt({}, deck))
    expect(el._pointerId).toBe(1)
    onPointerDown(el, pointerEvt({ pointerId: 9 }, deck))
    expect(el._pointerId).toBe(1)
  })

  test('move without a gesture or with a dead gesture is ignored', () => {
    onPointerMove(el, pointerEvt({ clientX: 60 }, deck))
    expect(el._dragActive).toBe(false)
    onPointerDown(el, pointerEvt({}, deck))
    onPointerMove(el, pointerEvt({ clientX: 0, clientY: 40 }, deck))
    expect(el._gestureDead).toBe(true)
    onPointerMove(el, pointerEvt({ clientX: 90 }, deck))
    expect(el._dragActive).toBe(false)
  })

  test('horizontal drag commits past slop, tracks via rAF, settles forward', async () => {
    onPointerDown(el, pointerEvt({}, deck))
    onPointerMove(
      el,
      pointerEvt(
        {
          clientX: -80,
          timeStamp: 16,
          getCoalescedEvents: () => [{ clientX: -80, clientY: 0, timeStamp: 16 }],
        },
        deck
      )
    )
    expect(el._dragActive).toBe(true)
    expect(el._dragX).toBe(-80)
    expect(deck.classList.contains(C.CARD_STACK_DECK_DRAGGING)).toBe(true)
    await waitFor(() => el._rafId === null)
    onPointerEnd(el, pointerEvt({ clientX: -80, timeStamp: 60 }, deck))
    expect(el._dragActive).toBe(false)
    expect(el.activeIdx).toBe(1)
    expect(deck.classList.contains(C.CARD_STACK_DECK_DRAGGING)).toBe(false)
    expect(el._suppressClick).toBe(true)
  })

  test('small drags snap back and stay on the front card', () => {
    onPointerDown(el, pointerEvt({}, deck))
    // Slow move — sub-slop distance AND no flick velocity → snap-back.
    onPointerMove(el, pointerEvt({ clientX: 8, timeStamp: 200 }, deck))
    expect(el._dragActive).toBe(true)
    onPointerEnd(el, pointerEvt({ clientX: 8, timeStamp: 300 }, deck))
    expect(el.activeIdx).toBe(0)
    expect(el._dragX).toBe(0)
  })

  test('drag right steps back; flick velocity carries short drags', () => {
    el.activeIdx = 1
    onPointerDown(el, pointerEvt({}, deck))
    onPointerMove(el, pointerEvt({ clientX: 140, timeStamp: 16 }, deck))
    onPointerEnd(el, pointerEvt({ clientX: 140, timeStamp: 60 }, deck))
    expect(el.activeIdx).toBe(0)

    el.activeIdx = 1
    onPointerDown(el, pointerEvt({}, deck))
    // Small drag but fast flick left → next card.
    onPointerMove(el, pointerEvt({ clientX: -10, timeStamp: 16 }, deck))
    onPointerMove(el, pointerEvt({ clientX: -30, timeStamp: 24 }, deck))
    onPointerEnd(el, pointerEvt({ clientX: -30, timeStamp: 40 }, deck))
    expect(el.activeIdx).toBe(2)
  })

  test('end ignores foreign/missing pointers', () => {
    onPointerEnd(el, pointerEvt({ pointerId: 1 }, deck))
    expect(el._dragActive).toBe(false)
    onPointerDown(el, pointerEvt({}, deck))
    onPointerEnd(el, pointerEvt({ pointerId: 99 }, deck))
    expect(el._pointerId).toBe(1)
    onPointerEnd(el, pointerEvt({ pointerId: 1 }, deck))
    expect(el._pointerId).toBeNull()
  })

  test('capture errors are swallowed', () => {
    deck.setPointerCapture = () => {
      throw new Error('nope')
    }
    deck.releasePointerCapture = () => {
      throw new Error('nope')
    }
    onPointerDown(el, pointerEvt({}, deck))
    expect(() => onPointerMove(el, pointerEvt({ clientX: -60, timeStamp: 16 }, deck))).not.toThrow()
    expect(() => onPointerEnd(el, pointerEvt({ clientX: -60, timeStamp: 30 }, deck))).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/events — delegated bindings', () => {
  let el, cleanup

  beforeEach(async () => {
    ;({ el, cleanup } = await mountDeck())
  })

  afterEach(() => cleanup())

  const click = (node, opts = {}) => {
    node.dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, composed: true, ...opts })
    )
  }

  test('toggle/prev/next/dot/close clicks drive state', () => {
    click(el.shadowRoot.querySelector(SEL.CARD_STACK_TOGGLE))
    expect(el.indexOpen).toBe(true)
    click(el.shadowRoot.querySelector(SEL.CARD_STACK_INDEX_CLOSE))
    expect(el.indexOpen).toBe(false)
    click(el.shadowRoot.querySelector(SEL.CARD_STACK_NEXT))
    expect(el.activeIdx).toBe(1)
    click(el.shadowRoot.querySelector(SEL.CARD_STACK_PREV))
    expect(el.activeIdx).toBe(0)
    click(el.shadowRoot.querySelectorAll(SELS.DOT)[2])
    expect(el.activeIdx).toBe(2)
  })

  test('expand button + front card navigate; side card repositions', () => {
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    const cards = el.shadowRoot.querySelectorAll(SELS.CARD)
    el.activeIdx = 0
    click(cards[0].querySelector('a'))
    expect(spy).toHaveBeenCalledWith(`${ROUTE_PATHS.PORTFOLIO}p-0`)
    spy.mockClear()
    click(cards[1].querySelector('a'))
    expect(el.activeIdx).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    click(cards[1].querySelector('a'))
    expect(spy).toHaveBeenCalledWith(`${ROUTE_PATHS.PORTFOLIO}p-1`)
    spy.mockClear()
    click(cards[0].querySelector('a'), { ctrlKey: true })
    expect(el.activeIdx).toBe(1)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('index item clicks bring the card to front; modified clicks pass through', () => {
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    const item = el.shadowRoot.querySelectorAll(`.${C.CARD_STACK_INDEX_ITEM}`)[1]
    el.indexOpen = true
    click(item.querySelector('a'), { ctrlKey: true })
    expect(spy).not.toHaveBeenCalled()
    click(item.querySelector('a'))
    // Index picks land on the front plane — no navigation, panel closes.
    expect(el.activeIdx).toBe(1)
    expect(el.indexOpen).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('a committed drag suppresses the trailing click once', () => {
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    el._suppressClick = true
    const before = el.activeIdx
    el.shadowRoot.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(el._suppressClick).toBe(false)
    expect(el.activeIdx).toBe(before)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('keydown delegation reaches onKeyDown', () => {
    const card = el.shadowRoot.querySelector(SELS.CARD)
    card.dispatchEvent(
      new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ARROW_RIGHT, bubbles: true })
    )
    expect(el.activeIdx).toBe(1)
  })

  test('pointer stream is deck-gated; resize re-measures', () => {
    const card = el.shadowRoot.querySelector(SELS.CARD)
    card.dispatchEvent(
      Object.assign(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }), {
        pointerId: 1,
        button: 0,
        clientX: 0,
        clientY: 0,
      })
    )
    expect(el._pointerId).toBe(1)
    card.dispatchEvent(
      Object.assign(new Event(POINTER_EVENTS.POINTERMOVE, { bubbles: true }), {
        pointerId: 1,
        clientX: -70,
        clientY: 0,
      })
    )
    expect(el._dragActive).toBe(true)
    card.dispatchEvent(
      Object.assign(new Event(POINTER_EVENTS.POINTERUP, { bubbles: true }), {
        pointerId: 1,
        clientX: -70,
        clientY: 0,
      })
    )
    expect(el.activeIdx).toBe(1)
    // pointerdown outside the deck never arms a gesture
    el.shadowRoot.querySelector(SEL.CARD_STACK_TOGGLE).dispatchEvent(
      Object.assign(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }), {
        pointerId: 5,
        button: 0,
        clientX: 0,
        clientY: 0,
      })
    )
    expect(el._pointerId).toBeNull()
    // pointercancel funnels through the same settle
    el._pointerId = 9
    el._dragActive = true
    el._dragX = -20
    el.shadowRoot.dispatchEvent(
      Object.assign(new Event(POINTER_EVENTS.POINTERCANCEL, { bubbles: true }), {
        pointerId: 9,
        clientX: -20,
        clientY: 0,
      })
    )

    expect(el._dragActive).toBe(false)
    const spy = jest.spyOn(el, 'applyPoses')
    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('bindEvents wires the shadow root once mounted', () => {
    // Mounted path already covered above; re-binding directly must not throw.
    expect(() => bindEvents(el)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('cardstack/render', () => {
  test('renders the full template against a host stub', () => {
    const el = new CardStack()
    el.processedItems = ITEMS
    el.translations = {
      featured: 'Featured',
      explore: 'View',
      deckHint: 'Drag',
      viewAll: 'All',
      allProjects: 'Every',
      projectLabel: 'Proj',
    }
    const node = renderCardStack(el)
    expect(node).toBeTruthy()
  })

  test('title falls back to empty and splits multi-line featured text', () => {
    const base = {
      explore: 'View',
      deckHint: 'Drag',
      viewAll: 'All',
      allProjects: 'Every',
      projectLabel: 'Proj',
    }

    // Empty featured → the || EMPTY arm publishes an empty title text.
    const empty = new CardStack()

    empty.processedItems = ITEMS
    empty.translations = { ...base, featured: ATTR_VALUES.EMPTY }
    expect(renderCardStack(empty)).toBeTruthy()

    // A <br>-broken featured label → the i>0 && <br> arm per extra line.
    const multi = new CardStack()

    multi.processedItems = ITEMS
    multi.translations = { ...base, featured: 'ONE<br>TWO' }
    expect(renderCardStack(multi)).toBeTruthy()
  })

  test('a single-line featured title always stacks over two lines', () => {
    const el = new CardStack()

    el.processedItems = ITEMS
    el.translations = {
      featured: 'Selected work',
      explore: 'View',
      deckHint: 'Drag',
      viewAll: 'All',
      allProjects: 'Every',
      projectLabel: 'Proj',
    }

    const title = renderCardStack(el).querySelector(`.${C.CARD_STACK_TITLE}`)

    // Plain text + one element child (the <br> line split) — the
    // section title never draws.
    expect(title.querySelectorAll(COMPONENT_TAGS.DRAW_TEXT).length).toBe(0)
    expect(title.children.length).toBe(1)
    expect(title.textContent).toContain('Selected')
    expect(title.textContent).toContain('work')
    expect(title.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('Selected work')
  })
})
