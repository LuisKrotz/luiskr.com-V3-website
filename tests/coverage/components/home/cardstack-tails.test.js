/**
 * @file cardstack-tails.test.js
 * @description Coverage tails for <card-stack>: manifest-loaded media
 * ladder arms, item-shape fallbacks, far-stack pose arms, facade
 * delegates, gesture velocity/release arms, and delegated-click misses.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { CardStack } from '@website/components/home/CardStack.js'
import {
  measure,
  applyPoses,
  updateChrome,
  fitDeckToFront,
  fanPose,
} from '@website/components/home/cardstack/deck.js'
import {
  cardIdxFromEvent,
  applyIndexState,
  onKeyDown,
  goTo,
  scrollIndexRail,
} from '@website/components/home/cardstack/interactions.js'
import {
  onPointerDown,
  onPointerMove,
  onPointerEnd,
} from '@website/components/home/cardstack/gestures.js'
import {
  armAutoplay,
  holdAutoplay,
  stopAutoplay,
  toggleAutoplay,
} from '@website/components/home/cardstack/autoplay.js'
import { autoElapsed } from '@website/components/home/cardstack/timer.js'
import { mount, waitFor } from '@tests/fixtures/test-constants.js'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'
import { writeInfo, holdBurns } from '@website/components/home/cardstack/info.js'
import { CARD_STACK_CLASSES as C } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS as SEL } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_LAYOUT, CARD_STACK_TIERS } from '@core/tokens/motion/card-stack.js'
import { CARD_STACK_CSS_PROPS } from '@core/tokens/css/card-stack.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { KEYS } from '@core/tokens/primitives.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { DRAG_EVENTS, MOUSE_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { resetViewportCache } from '@core/utils/dom.js'
import store from '@core/store.js'
import router from '@core/router/router.js'

/** Card-item factory — unique link/image/label per index, overrides merge in. */
const item = (n, over = {}) => ({
  link: `p-${n}`,
  image: `img-${n}`,
  label: `Project ${n}`,
  description: `Desc ${n}<br>more`,
  featured: true,
  ...over,
})

/** Selector bundle for the card/dot/highlight elements under assertion. */
const SELS = {
  CARD: `.${C.CARD_STACK_CARD}`,
  DOT: `.${C.CARD_STACK_DOT}`,
  HIGH: `.${C.CARD_STACK_CARD_IMG_HIGH}`,
}

/** A desktop fan tier + the stacked phone tier — deterministic geometry
 *  references (mounted decks pick their own tier from the happy-dom
 *  viewport). */
const FAN_TIER = CARD_STACK_TIERS.find((t) => !t.STACKED)

const STACK_TIER = CARD_STACK_TIERS[CARD_STACK_TIERS.length - 1]

/** Synthetic pointer-event factory — pointerId/button/coords/timestamp
 *  with per-test overrides and an optional target for delegation tests. */
const evt = (over = {}, target = null) => ({
  pointerId: 1,
  button: 0,
  clientX: 0,
  clientY: 0,
  timeStamp: 0,
  target,
  ...over,
})

/** Teardown registry — mounts push cleanup fns; afterEach drains them. */
const cleanups = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()()
})

/** Mounts a CardStack preloaded with `items` and waits for the cards to render. */
const mountItems = async (items) => {
  const el = new CardStack()
  cleanups.push(mount(el))
  el.processedItems = items
  await waitFor(() => el._cardEls.length === items.length)
  return el
}

/** Shadow-DOM lookup for the deck container element. */
const deckEl = (el) => el.shadowRoot.querySelector(SEL.CARD_STACK_DECK)

// ─── Facade delegates + non-mounted setter arms ───────────────────────────────
describe('CardStack facade tails', () => {
  test('unmounted setters store without rendering; delegates forward', async () => {
    const el = new CardStack()
    el.processedItems = [item(0)]
    el.translations = { featured: 'F' }
    expect(el.processedItems.length).toBe(1)
    expect(el.deckItems.length).toBe(1)
    cleanups.push(mount(el))
    await waitFor(() => el._cardEls.length === 1)
    expect(el.measure()).toBeUndefined()
    expect(el.applyPoses()).toBeUndefined()
    expect(el.updateChrome()).toBeUndefined()
    el.goTo(0)
    el.onCardClick(el.deckItems[0], 1) // side-card arm: repositions
    expect(el.activeIdx).toBe(0) // len 1 → wraps to 0
    el.onKeyDown({ key: 'nope', preventDefault: () => {} })
    el.onPointerDown(evt({}, deckEl(el)))
    el.onPointerMove(evt({ clientX: -40, timeStamp: 20 }, deckEl(el)))
    el.onPointerEnd(evt({ clientX: -40, timeStamp: 40 }, deckEl(el)))
    el._unsubManifest = 'not-a-function'
    el.onDestroy()
    expect(el._unsubManifest).toBe('not-a-function')
    el.toggleIndex()
    expect(el.indexOpen).toBe(true)
    el.closeIndex()
    expect(el.indexOpen).toBe(false)
    el.onPrevClick()
    el.onNextClick()
    el.onDotClick(0)
  })

  test('_t merges live translations over the fallback node', async () => {
    const el = new CardStack()
    expect(el._t.viewAll).toBe('View all')
    el.translations = { viewAll: 'Alle' }
    expect(el._t.viewAll).toBe('Alle')
    expect(el._t.deckHint).toBe('Drag or swipe cards to explore')
  })
})

// ─── deck.ts tails ─────────────────────────────────────────────────────────────
describe('deck tails', () => {
  test('measure falls back through viewport + floor when deck is absent', () => {
    const el = new CardStack() // unmounted → no deck el → viewport path
    measure(el)
    expect(el._cardW).toBeGreaterThanOrEqual(CARD_STACK_LAYOUT.CARD_W_MIN)
    // viewport 0 → CARD_W_FALLBACK arm
    const orig = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    Object.defineProperty(window, 'innerWidth', { value: 0, configurable: true })
    resetViewportCache()
    measure(el)
    expect(el._cardW).toBeGreaterThanOrEqual(CARD_STACK_LAYOUT.CARD_W_MIN)
    if (orig) Object.defineProperty(window, 'innerWidth', orig)
    resetViewportCache()
  })

  test('applyPoses: dirty=false arm, missing deckEl arm, far-card hide', async () => {
    const items = Array.from({ length: 12 }, (_, i) => item(i))
    const el = await mountItems(items)
    el._sizesDirty = false
    applyPoses(el)
    el._deckEl = null
    el._sizesDirty = true
    applyPoses(el)
    const far = el._cardEls[6] // |s| = 6 → beyond the fan's peek window
    const hidden = el._cardEls.find((c) => c.style.visibility === ATTR_VALUES.HIDDEN)
    expect(hidden).toBeTruthy()
    expect(far.style.transform).toContain('translate3d')
  })

  test('updateChrome: missing nav-index/num, missing card link, carousel fallback', async () => {
    const el = await mountItems([item(0), item(1)])
    const prev = store.state.lang.carousel
    store.state.lang.carousel = {}
    el._updateDom()
    updateChrome(el)
    // Both nav-index guard arms: the button absent entirely, and the
    // num span absent inside a present button.
    const navIndex = el.shadowRoot.querySelector(SEL.CARD_STACK_NAV_INDEX)
    navIndex.querySelector(SEL.CARD_STACK_NAV_INDEX_NUM).remove()
    updateChrome(el)
    navIndex.remove()
    const fake = document.createElement('div')
    el._cardEls.push(fake)
    updateChrome(el)
    expect(fake.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    store.state.lang.carousel = undefined
    updateChrome(el)
    store.state.lang.carousel = prev
  })

  test('updateChrome keeps the nav-index position localized', async () => {
    const el = await mountItems([item(0), item(1)])
    updateChrome(el)
    const num = el.shadowRoot.querySelector(SEL.CARD_STACK_NAV_INDEX_NUM)
    expect(num.textContent.length).toBeGreaterThan(0)
    // Second pass with a moved front exercises the deal trigger.
    el.activeIdx = 1
    updateChrome(el)
    expect(num.textContent).toContain('2')
  })

  test('fanPose keeps deepening cards that left the peek window', () => {
    const pose = fanPose(FAN_TIER.PEEK + 5, 20, 300, FAN_TIER)
    expect(pose.visible).toBe(false)
    expect(pose.depth).toBeLessThan(0)
    expect(pose.opacity).toBe(CARD_STACK_LAYOUT.FAN_DIM_FLOOR)
  })

  test('measure picks the stacked tier on a phone viewport', async () => {
    const el = await mountItems([item(0), item(1)])
    const wOrig = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const hOrig = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
    resetViewportCache()
    try {
      measure(el)
      expect(el._tier.STACKED).toBe(true)
      // The stacked pile's depth window is the tier's own count — no
      // width fitting applies.
      expect(el._peek).toBe(STACK_TIER.PEEK)
      // applyPoses rides the same tier — the stackPose branch writes.
      applyPoses(el)
      const pileCard = el._cardEls[1]
      expect(pileCard.style.transform).toContain('rotate(')
    } finally {
      if (wOrig) Object.defineProperty(window, 'innerWidth', wOrig)
      if (hOrig) Object.defineProperty(window, 'innerHeight', hOrig)
      resetViewportCache()
    }
  })

  test('measure caps the card box by the deck height share', async () => {
    // The byHeight cap is a FAN-tier rule — the stacked tiers size by
    // width alone (their front card auto-grows instead). Pin a ≥1280
    // viewport so pickTier lands on a fan band. The height budget reads
    // the viewport-derived _stageH (the measured deck row only serves
    // as the pre-paint fallback — reading it every pass ratchets the
    // auto-height band), so a 300px-tall viewport is what bounds the
    // card, not the stubbed deck rect.
    const wOrig = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const hOrig = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true })
    resetViewportCache()

    try {
      const el = await mountItems([item(0), item(1)])
      const deck = deckEl(el)
      // A real rect exercises the byHeight arm — happy-dom reports zeros,
      // which the fallback branch covers instead. The chrome clamp reads
      // top/bottom too, so the stub must carry the full box — and the deck
      // is wide enough that height (not width) is the binding constraint.
      deck.getBoundingClientRect = () => ({ width: 2000, height: 300, top: 0, bottom: 300 })
      measure(el)
      expect(el._tier.STACKED).toBe(false)
      expect(el._cardW).toBeCloseTo((300 * el._tier.HEIGHT_SHARE) / el._tier.CARD_H_RATIO)

      // A missing section node skips the chrome clamp entirely.
      const origQuery = el.$.bind(el)
      el.$ = (sel) => (sel === SEL.CARD_STACK ? null : origQuery(sel))
      measure(el)
      el.$ = origQuery
      expect(el._cardW).toBeCloseTo((300 * el._tier.HEIGHT_SHARE) / el._tier.CARD_H_RATIO)
    } finally {
      if (wOrig) Object.defineProperty(window, 'innerWidth', wOrig)
      if (hOrig) Object.defineProperty(window, 'innerHeight', hOrig)
      resetViewportCache()
    }
  })

  test('applyPoses seeds the rise entrance for a card re-entering the fan', async () => {
    const items = Array.from({ length: 12 }, (_, i) => item(i))
    const el = await mountItems(items)
    applyPoses(el) // records the far cards' hidden baseline
    const last = items.length - 1
    goTo(el, last) // the hidden card re-enters → the seed arm writes
    const front = el._cardEls[last]
    expect(front.classList.contains(C.CARD_STACK_CARD_ACTIVE)).toBe(true)
    expect(front.style.visibility).toBe(ATTR_VALUES.VISIBLE)
    expect(front.style.transform).toContain('translate3d')
  })

  test('fitDeckToFront returns early when section or front measurements are absent', async () => {
    const el = await mountItems([item(0), item(1)])
    const origQuery = el.$.bind(el)

    el.$ = () => null
    fitDeckToFront(el)
    el.$ = origQuery

    const section = el.$(SEL.CARD_STACK)

    if (section) {
      const origClosest = section.closest?.bind(section)
      section.closest = () => null
      fitDeckToFront(el)
      section.closest = origClosest
    }
  })

  test('_observeDeck reconnects, re-measures on resize, and degrades', async () => {
    const el = await mountItems([item(0), item(1)])
    const realRO = globalThis.ResizeObserver

    const observe = jest.fn()
    const disconnect = jest.fn()
    let rocb = null
    function FakeRO(cb) {
      rocb = cb
      this.observe = observe
      this.disconnect = disconnect
    }

    try {
      globalThis.ResizeObserver = FakeRO
      el._deckRO = null
      el._observeDeck(el._deckEl)
      expect(observe).toHaveBeenCalledWith(el._deckEl)

      // The callback re-measures + re-poses; an empty deck early-returns.
      rocb()
      expect(el._cardW).toBeGreaterThan(0)
      const saved = el._processedItems
      el._processedItems = []
      expect(() => rocb()).not.toThrow()
      el._processedItems = saved

      // A null deck just disconnects the observer.
      el._observeDeck(null)
      expect(disconnect).toHaveBeenCalled()

      // No ResizeObserver in the environment → the typeof guard arm.
      globalThis.ResizeObserver = undefined
      el._observeDeck(el._deckEl)
      expect(el._deckRO).toBeNull()

      // onDestroy disconnects + clears a live observer.
      globalThis.ResizeObserver = FakeRO
      el._observeDeck(el._deckEl)
      el.onDestroy()
      expect(disconnect).toHaveBeenCalled()
      expect(el._deckRO).toBeNull()
    } finally {
      globalThis.ResizeObserver = realRO
    }
  })

  test('fitDeckToFront pins a fixed band on image-only tiers, grows with copy on copy tiers', async () => {
    const el = await mountItems([item(0), item(1)])
    const deck = deckEl(el)

    if (el._tier.STACKED && !el._tier.IN_CARD_INFO) {
      // Image-only stacked tier — nothing can grow, so the live measure
      // is skipped outright: a mid-transition rect read used to feed back
      // into pileH and visibly compress/re-expand the pile on every nav.
      fitDeckToFront(el)
      expect(el._frontExtra).toBe(0)
      expect(deck.style.minHeight).toBe(
        `${el._cardH + el._cardH * CARD_STACK_LAYOUT.STACKED_DECK_PAD}${COMMON_ATTRS.PX}`
      )
    }

    // Copy tier — the front card's live height drives the band outright:
    // a copy card taller than the ratio box grows the deck (the page
    // absorbs the overflow; nothing scrolls inside the card).
    el._tier = { ...el._tier, STACKED: true, IN_CARD_INFO: true }

    const front = el._cardEls[0]

    front.getBoundingClientRect = () => ({ height: 500 })

    fitDeckToFront(el)

    const expected =
      el._cardH + Math.max(0, 500 - el._cardH) + el._cardH * CARD_STACK_LAYOUT.STACKED_DECK_PAD

    expect(deck.style.minHeight).toBe(`${expected}${COMMON_ATTRS.PX}`)
    expect(el._frontExtra).toBe(500 - el._cardH)

    // A shorter front re-fits DOWN — the signed delta shrinks pileH too.
    front.getBoundingClientRect = () => ({ height: el._cardH - 40 })
    fitDeckToFront(el)
    expect(el._frontExtra).toBe(-40)
  })
})

// ─── gestures tails ────────────────────────────────────────────────────────────
describe('gestures tails', () => {
  test('undefined button proceeds; capture success + release success', async () => {
    const el = await mountItems([item(0), item(1)])
    const deck = deckEl(el)
    deck.setPointerCapture = jest.fn()
    deck.releasePointerCapture = jest.fn()
    onPointerDown(el, evt({ button: undefined }, deck))
    expect(el._pointerId).toBe(1)
    // No capture on down — plain taps keep click targeting on the card.
    expect(deck.setPointerCapture).not.toHaveBeenCalled()
    onPointerMove(el, evt({ pointerId: 7, clientX: -50 }, deck)) // foreign pointer
    expect(el._dragActive).toBe(false)
    onPointerMove(el, evt({ clientX: -50, timeStamp: 10 }, deck))
    // Capture arms the moment the drag commits past slop.
    expect(deck.setPointerCapture).toHaveBeenCalledWith(1)
    onPointerEnd(el, evt({ clientX: -50, timeStamp: 20 }, deck))
    expect(deck.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  test('coalesced-empty, dt=0 and raf-pending arms', async () => {
    const el = await mountItems([item(0), item(1)])
    const deck = deckEl(el)
    onPointerDown(el, evt({}, deck))
    onPointerMove(el, evt({ clientX: -30, timeStamp: 0, getCoalescedEvents: () => [] }, deck))
    expect(el._dragActive).toBe(true)
    el._rafId = 88
    onPointerMove(el, evt({ clientX: -35, timeStamp: 0 }, deck))
    expect(el._velX).toBe(0)
    cancelAnimationFrame(el._rafId)
    el._rafId = null
    onPointerEnd(el, evt({ clientX: -35, timeStamp: 30 }, deck))
  })

  test('pointerId-less end event settles; dx=0 and backtrack arms', async () => {
    const el = await mountItems([item(0), item(1)])
    const deck = deckEl(el)
    el._pointerId = 3
    el._dragActive = true
    el._dragX = -4
    onPointerEnd(el, { target: deck }) // pointerId undefined arm
    expect(el._dragActive).toBe(false)
    // drag out then back below slop (slow — no flick) → snap back
    onPointerDown(el, evt({}, deck))
    onPointerMove(el, evt({ clientX: 40, timeStamp: 10 }, deck))
    onPointerMove(el, evt({ clientX: 2, timeStamp: 400 }, deck))
    onPointerEnd(el, evt({ clientX: 2, timeStamp: 500 }, deck))
    expect(el._suppressClick).toBe(false)
    expect(el.activeIdx).toBe(0)
    // flick right carried by velocity despite small distance
    onPointerDown(el, evt({}, deck))
    onPointerMove(el, evt({ clientX: 10, timeStamp: 10 }, deck))
    onPointerMove(el, evt({ clientX: 40, timeStamp: 18 }, deck))
    onPointerEnd(el, evt({ clientX: 40, timeStamp: 26 }, deck))
    expect(el.activeIdx).toBe(1)
  })

  test('multi-step drag lands the card dragged to centre', async () => {
    const el = await mountItems([item(0), item(1), item(2), item(3), item(4)])
    const deck = deckEl(el)
    el._pointerId = 3
    el._dragActive = true
    el._step = 100
    el._velX = 0
    el._dragX = -260 // p = 2.6 → nearest-card settle advances 3 slots
    onPointerEnd(el, evt({ pointerId: 3, clientX: -260, timeStamp: 30 }, deck))
    expect(el.activeIdx).toBe(3)
  })

  test('target-without-closest arms the gesture with no capture', async () => {
    const el = await mountItems([item(0), item(1)])
    onPointerDown(el, { target: {}, pointerId: 4, clientX: 0, clientY: 0, timeStamp: 12 })
    expect(el._pointerId).toBe(4)
    onPointerMove(el, evt({ pointerId: 4, clientX: 2, clientY: 0, timeStamp: 14 }, {}))
    expect(el._dragActive).toBe(false)
    onPointerMove(el, evt({ pointerId: 4, clientX: -40, clientY: 0, timeStamp: 18 }, {}))
    expect(el._dragActive).toBe(true)
    onPointerEnd(el, { target: {}, pointerId: 4 })
    onPointerDown(el, { target: {} }) // pointerId-less → id 0 arm
    expect(el._pointerId).toBe(0)
    onPointerEnd(el, { target: null })
  })
})

// ─── events tails ─────────────────────────────────────────────────────────────
describe('events tails', () => {
  test('click misses every delegate target; dots/items without data-index', async () => {
    const el = await mountItems([item(0), item(1)])
    const hint = el.shadowRoot.querySelector(`.${C.CARD_STACK_HINT}`)
    hint.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(el.activeIdx).toBe(0)
    const dots = el.shadowRoot.querySelector(`.${C.CARD_STACK_DOTS}`)
    const fakeDot = document.createElement('button')
    fakeDot.className = C.CARD_STACK_DOT
    dots.appendChild(fakeDot)
    fakeDot.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(el.activeIdx).toBe(0)
    const list = el.shadowRoot.querySelector(`.${C.CARD_STACK_INDEX_LIST}`)
    const li = document.createElement('li')
    li.className = C.CARD_STACK_INDEX_ITEM
    const a = document.createElement('a')
    li.appendChild(a)
    list.appendChild(li)
    const spy = jest.spyOn(router, 'push').mockImplementation(() => {})
    a.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(el.activeIdx).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    const fakeCard = document.createElement('div')
    fakeCard.className = C.CARD_STACK_CARD
    fakeCard.setAttribute(DATA_ATTRS.DATA_INDEX, '99')
    el.shadowRoot.querySelector(SEL.CARD_STACK_DECK).appendChild(fakeCard)
    spy.mockClear()
    fakeCard.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(spy).not.toHaveBeenCalled()
    const bareCard = document.createElement('div')
    bareCard.className = C.CARD_STACK_CARD
    expect(cardIdxFromEvent({ target: bareCard }).idx).toBe(0)
    expect(cardIdxFromEvent({ target: null })).toBeNull()
  })

  test('index rail arrows scroll the list on whichever axis overflows', async () => {
    const el = await mountItems([item(0), item(1)])

    const list = el.shadowRoot.querySelector(SEL.CARD_STACK_INDEX_LIST)
    const scrollBy = jest.fn()

    list.scrollBy = scrollBy

    // Horizontal arm — desktop rail overflowing its client width.
    Object.defineProperty(list, 'scrollWidth', { value: 800, configurable: true })
    Object.defineProperty(list, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 60, configurable: true })

    el.shadowRoot
      .querySelector(`.${C.CARD_STACK_INDEX_NEXT}`)
      .dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))

    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 80, top: 0, behavior: ATTR_VALUES.SMOOTH })
    )

    // Vertical arm — the mobile sheet overflows downward instead.
    Object.defineProperty(list, 'scrollWidth', { value: 100, configurable: true })

    el.shadowRoot
      .querySelector(`.${C.CARD_STACK_INDEX_PREV}`)
      .dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))

    expect(scrollBy).toHaveBeenLastCalledWith(
      expect.objectContaining({ left: 0, top: -48, behavior: ATTR_VALUES.SMOOTH })
    )

    // Missing list — the !list early return.
    list.remove()
    scrollIndexRail(el, 1)
    expect(scrollBy).toHaveBeenCalledTimes(2)
  })

  test('pointermove outside the deck is ignored; dragstart is prevented', async () => {
    const el = await mountItems([item(0), item(1)])
    el._pointerId = 1
    el.shadowRoot.dispatchEvent(
      Object.assign(new Event(POINTER_EVENTS.POINTERMOVE, { bubbles: true }), {
        pointerId: 1,
        clientX: -80,
        clientY: 0,
      })
    )
    expect(el._dragActive).toBe(false)
    el._pointerId = null

    const dragEvt = new Event(DRAG_EVENTS.DRAGSTART, { bubbles: true, cancelable: true })
    el.shadowRoot.dispatchEvent(dragEvt)
    expect(dragEvt.defaultPrevented).toBe(true)
  })

  test('the nav stack icon toggles the index like the header pill', async () => {
    const el = await mountItems([item(0), item(1)])
    const icon = el.shadowRoot.querySelector(SEL.CARD_STACK_NAV_INDEX)
    expect(icon).toBeTruthy()
    icon.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(el.indexOpen).toBe(true)
  })
})

// ─── render tails — manifest-loaded ladder + item variants ───────────────────
describe('render tails — manifest + variants', () => {
  test('manifest-proven covers emit webp/sources/ladder; variants render', async () => {
    const realFetch = globalThis.fetch
    const stem = 'covers/img-0'
    const thumb = `${stem}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}`
    const stem1 = 'covers/img-1'
    const thumb1 = `${stem1}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}`
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        `${thumb}${MEDIA.EXT}`,
        `${thumb}${MEDIA.WEBP_EXT}`,
        `${thumb}${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`,
        `${thumb}${MEDIA.MOBILE_SUFFIX}${MEDIA.WEBP_EXT}`,
        `${stem}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        `${stem}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`,
        `${stem}${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`,
        `${stem}${MEDIA.MOBILE_SUFFIX}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        `${stem}${MEDIA.MOBILE_SUFFIX}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`,
        // jpg-only mobile thumb + jpg-only mobile rung + original-only desktop rung
        `${thumb1}${MEDIA.EXT}`,
        `${thumb1}${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`,
        `${stem1}${MEDIA.EXT}`,
        `${stem1}${MEDIA.MOBILE_SUFFIX}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        'covers/img-2' + MEDIA.MOZ + MEDIA.THUMB_SUFFIX + MEDIA.EXT, // thumb only — no ladder arms
      ],
    }))
    const { initMediaManifest } = await import('@core/utils/media/manifest.js')
    await initMediaManifest()
    globalThis.fetch = realFetch

    const el = await mountItems([
      item(0),
      item(1, { category: 'Footwear', label: undefined, title: 'Titled' }),
      item(2, {
        link: undefined,
        label: undefined,
        title: undefined,
        description: undefined,
        subtitle: 'Sub',
      }),
    ])
    el.translations = { featuredTitle: '', featured: 'Featured' }
    await waitFor(() => el.shadowRoot.querySelectorAll('source').length > 0)
    const high = el.shadowRoot.querySelector(SELS.HIGH)
    expect(high).toBeTruthy()
    el._loadedCovers.set(
      `${el.storage}covers/img-0${MEDIA.EXT}`,
      `${el.storage}covers/img-0${MEDIA.EXT}`
    )
    el._updateDom()
    await waitFor(() => el.shadowRoot.querySelector(SELS.HIGH))
    const high2 = el.shadowRoot.querySelector(SELS.HIGH)
    high2.dispatchEvent(new Event('load'))
    const subs = el.shadowRoot.querySelectorAll(`.${C.CARD_STACK_INDEX_SUB}`)
    expect(subs.length).toBe(2)
    const idxItems = el.shadowRoot.querySelectorAll(`.${C.CARD_STACK_INDEX_ITEM}`)
    expect(idxItems.length).toBe(3)
  })

  test('indexOpen renders the open class + aria-visible panel', async () => {
    const el = new CardStack()
    el.indexOpen = true
    cleanups.push(mount(el))
    el.processedItems = [item(0)]
    await waitFor(() => el._cardEls.length === 1)
    const section = el.shadowRoot.querySelector(SEL.CARD_STACK)
    expect(section.classList.contains(C.CARD_STACK_INDEX_OPEN)).toBe(true)
    const panel = el.shadowRoot.querySelector(SEL.CARD_STACK_INDEX)
    expect(panel.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.FALSE)
  })

  test('Escape on a closed index is a no-op; foreign-key paths stay inert', async () => {
    const el = await mountItems([item(0), item(1)])
    onKeyDown(el, { key: KEYS.ESCAPE, preventDefault: () => {} })
    expect(el.indexOpen).toBe(false)
    applyIndexState(el)
    goTo(el, 0)
    expect(cardIdxFromEvent({ target: el.shadowRoot })).toBeNull()
    expect(cardIdxFromEvent({ target: null })).toBeNull()
  })

  test('module re-import skips the define guard', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('@website/components/home/CardStack.js')
    })
    expect(customElements.get('card-stack')).toBe(CardStack)
  })
})

// ─── info.ts burn tails — the title paper-burn on the text column ────────────
describe('info burn tails', () => {
  const CanvasProto = () => document.createElement(HTML_TAGS.CANVAS).constructor.prototype

  let origGetContext
  let origRect

  beforeEach(() => {
    // A 2D-capable canvas + real rects let mountBurn actually mount —
    // same rig the mosaic burn tails use.
    origGetContext = CanvasProto().getContext
    CanvasProto().getContext = (type) => (String(type) === '2d' ? createMock2D() : null)
    origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 210,
      bottom: 50,
      width: 200,
      height: 40,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    })
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  const infoEl = (el) => el.shadowRoot.querySelector(SEL.CARD_STACK_INFO)

  test('writeInfo mounts a title burn and re-arms the live session', async () => {
    const el = await mountItems([item(0), item(1)])
    const info = infoEl(el)
    const title = info.querySelector(SEL.CARD_STACK_INFO_TITLE)

    el.activeIdx = 1
    writeInfo(el)
    const s = info._burn
    expect(s).toBeTruthy()

    // Re-publishing while a session runs only re-aims the consume beat.
    writeInfo(el)
    expect(s.onBurned).toEqual(expect.any(Function))

    // The consume beat swaps the ink and hands the rebuild the new
    // raster (the live.dir > 0 arm).
    s.onBurned()
    expect(title.textContent).toBe('Project 1')
    expect(s.dir).toBe(-1)
    expect(s.prog).toBe(1)

    // The same swap with the session no longer consuming — with no
    // session at all, and with the column gone — still lands the text.
    const cb = s.onBurned
    s.dir = -1
    cb()
    info._burn = null
    cb()
    info.remove()
    cb()
    el.shadowRoot.querySelector(SEL.CARD_STACK).appendChild(info)
    info._burn = s

    // Mid-rebuild nav flips the session back to consume and schedules
    // the loop when no frame is pending.
    s.dir = -1
    s.prog = 0.5
    s.raf = 0
    el.activeIdx = 0
    writeInfo(el)
    expect(s.dir).toBe(1)
    expect(s.raf).not.toBe(0)

    // Let the rescheduled frame actually run, then park the loop.
    await new Promise((r) => setTimeout(r, 50))

    // A pending frame survives the re-arm (the !session.raf guard).
    cancelAnimationFrame(s.raf)
    s.dir = -1
    s.raf = 777
    writeInfo(el)
    expect(s.raf).toBe(777)
    s.raf = 0
  })

  test('writeInfo instant-swaps when the info column is gone', async () => {
    const el = await mountItems([item(0), item(1)])
    const info = infoEl(el)
    const title = info.querySelector(SEL.CARD_STACK_INFO_TITLE)

    // Title survives outside the column → the !infoEl instant arm.
    el.shadowRoot.querySelector(SEL.CARD_STACK).appendChild(title)
    info.remove()

    el.activeIdx = 1
    writeInfo(el)
    expect(title.textContent).toBe('Project 1')
  })

  test('writeInfo instant-swaps under reduced motion', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    const el = await mountItems([item(0), item(1)])
    const info = infoEl(el)
    const title = info.querySelector(SEL.CARD_STACK_INFO_TITLE)

    el.activeIdx = 1
    writeInfo(el)
    expect(title.textContent).toBe('Project 1')
    expect(info._burn).toBeFalsy()
  })

  test('onDestroy cancels a live title burn + a parked one', async () => {
    const el = await mountItems([item(0), item(1)])
    const info = infoEl(el)

    const session = {
      raf: requestAnimationFrame(() => {}),
      active: true,
      canvas: document.createElement(HTML_TAGS.CANVAS),
      cardEl: info,
      cls: {
        TITLE: C.CARD_STACK_INFO_TITLE,
        TITLE_BURNING: C.CARD_STACK_INFO_TITLE_BURNING,
        ITEM_BURNING: C.CARD_STACK_INFO_BURNING,
        TITLE_SLOT: C.CARD_STACK_INFO_TITLE_SLOT,
      },
      wasm: null,
      particles: [],
    }

    info._burn = session

    // The stacked tiers' in-card sessions drain through the same loop —
    // one card carries a live raf, another a parked (raf 0) session, a
    // third none (the !s skip arm).
    const cardSession = (cardEl) => ({
      raf: requestAnimationFrame(() => {}),
      active: true,
      canvas: document.createElement(HTML_TAGS.CANVAS),
      cardEl,
      cls: {
        TITLE: C.CARD_STACK_CARD_INFO_TITLE,
        TITLE_BURNING: C.CARD_STACK_CARD_INFO_TITLE_BURNING,
        ITEM_BURNING: C.CARD_STACK_CARD_BURNING,
        TITLE_SLOT: C.CARD_STACK_CARD_INFO_TITLE_SLOT,
      },
      wasm: null,
      particles: [],
    })

    el._cardEls[0]._burn = cardSession(el._cardEls[0])
    el._cardEls[1]._burn = { ...cardSession(el._cardEls[1]), raf: 0 }

    el.onDestroy()

    expect(info._burn).toBeNull()
    expect(el._cardEls[0]._burn).toBeNull()
    expect(el._cardEls[1]._burn).toBeNull()
  })
})

// ─── in-card burn tails — the stacked tiers' per-card title burn ─────────────
describe('in-card burn tails', () => {
  const CanvasProto = () => document.createElement(HTML_TAGS.CANVAS).constructor.prototype

  let origGetContext
  let origRect

  beforeEach(() => {
    origGetContext = CanvasProto().getContext
    CanvasProto().getContext = (type) => (String(type) === '2d' ? createMock2D() : null)
    origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 210,
      bottom: 50,
      width: 200,
      height: 40,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    })
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('front card knits in, previous front burns out, sessions flip live', async () => {
    const el = await mountItems([item(0), item(1), item(2)])
    el._tier = STACK_TIER

    writeInfo(el) // first stacked publish — the front card mounts + knits
    const front = el._cardEls[0]
    const s0 = front._burn
    expect(s0).toBeTruthy()
    expect(s0.dir).toBe(-1)
    expect(s0.prog).toBe(1)
    expect(el._cardEls[1]._burn).toBeFalsy()

    // Nav — the outgoing front flips mid-knit to consume; the new front
    // mounts its own session already reversed into the knit.
    el.activeIdx = 1
    writeInfo(el)
    expect(s0.dir).toBe(1)
    const s1 = el._cardEls[1]._burn
    expect(s1).toBeTruthy()
    expect(s1.dir).toBe(-1)

    // A live session whose raf already settled reschedules on the flip.
    s1.raf = 0
    el.activeIdx = 2
    writeInfo(el)
    expect(s1.dir).toBe(1)
    expect(s1.raf).not.toBe(0)
    expect(el._cardEls[2]._burn.dir).toBe(-1)

    // Same-front re-publish — the prev !== front skip arm.
    writeInfo(el)
    expect(el._cardEls[2]._burn.dir).toBe(-1)

    // A consumed card returning to the front re-knits live — dir flips
    // back to -1 and prog resets to 1 (the want<0 live-session arm).
    s1.raf = 0
    el.activeIdx = 1
    writeInfo(el)
    expect(s1.dir).toBe(-1)
    expect(s1.prog).toBe(1)
    expect(s1.raf).not.toBe(0)

    // Let the rescheduled frame() actually run — covers the raf arrow.
    await new Promise((r) => setTimeout(r, 50))
  })

  test('in-card burn skips under reduced motion and on missing/degenerate titles', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    const el = await mountItems([item(0), item(1)])
    el._tier = STACK_TIER

    writeInfo(el)
    expect(el._cardEls[0]._burn).toBeFalsy()

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    // No in-card title on the front card — the !titleEl early return.
    el._cardEls[0].querySelector(SEL.CARD_STACK_CARD_INFO_TITLE).remove()
    writeInfo(el)
    expect(el._cardEls[0]._burn).toBeFalsy()

    // A degenerate rect — mountBurn declines on the new front, plain
    // ink stays (and the previous front still skips on its missing title).
    Element.prototype.getBoundingClientRect = origRect
    el.activeIdx = 1
    writeInfo(el)
    expect(el._cardEls[1]._burn).toBeFalsy()
  })

  test('a stale prev mounts a consume session; an out-of-range front skips', async () => {
    const el = await mountItems([item(0), item(1)])
    el._tier = STACK_TIER

    writeInfo(el)

    // _burnFront holds card-0 while _cardEls drops it — indexOf misses
    // (the `|| {}` mount item) and the want=1 fresh mount skips the
    // knit aim (`ns && want < 0` false arm).
    const stale = el._cardEls[0]
    stale._burn = null
    el._cardEls = el._cardEls.slice(1)
    writeInfo(el)
    expect(stale._burn.dir).toBe(1)
    expect(el._cardEls[0]._burn.dir).toBe(-1)

    // activeIdx out of range — front is undefined, the `if (front)`
    // skip arm (the stale prev still spins its consume flip).
    el.activeIdx = 99
    writeInfo(el)
  })

  test('holdBurns banks live sessions off-screen and releases them on re-entry', async () => {
    const el = await mountItems([item(0), item(1), item(2)])
    el._tier = STACK_TIER

    writeInfo(el) // mounts the front knit (dir -1, live raf)
    const s0 = el._cardEls[0]._burn
    expect(s0.raf).not.toBe(0)

    // Hold — the live raf cancels in place; prog/dir survive, and a nav
    // taken while held retimes sessions without re-arming either of them
    // (the mount-arm cancel + the !host._burnHeld spin gate).
    holdBurns(el, true)
    expect(el._burnHeld).toBe(true)
    expect(s0.raf).toBe(0)
    expect(s0.dir).toBe(-1)

    s0.prog = 0.5
    el.activeIdx = 1
    writeInfo(el)
    expect(s0.dir).toBe(1)
    expect(s0.raf).toBe(0)
    const s1 = el._cardEls[1]._burn
    expect(s1).toBeTruthy()
    expect(s1.dir).toBe(-1)
    expect(s1.raf).toBe(0)

    // Release — held sessions re-arm on the CURRENT pairing.
    holdBurns(el, false)
    expect(el._burnHeld).toBe(false)
    expect(s0.raf).not.toBe(0)
    expect(s1.raf).not.toBe(0)

    // The text column's own session rides the same hold/release — live
    // raf parks, then the direct re-arm fires since it has no spin caller.
    const info = el.shadowRoot.querySelector(SEL.CARD_STACK_INFO)
    info._burn = { raf: requestAnimationFrame(() => {}), active: true, dir: 1, prog: 0.4 }
    const infoS = info._burn
    holdBurns(el, true)
    expect(infoS.raf).toBe(0)
    holdBurns(el, false)
    expect(infoS.raf).not.toBe(0)

    // The synthetic session lacks frame()'s fields — cancel the re-arm
    // before the queued callback can run.
    cancelAnimationFrame(infoS.raf)
    infoS.raf = 0

    // A session that already finished (active:false) and a parked one
    // (raf:0 with the hold skipping the cancel) stay untouched.
    info._burn = { raf: 0, active: false, dir: 1, prog: 0 }
    holdBurns(el, true)
    holdBurns(el, false)
    expect(info._burn.raf).toBe(0)

    // The synthetic session isn't a real burn — drop it before unmount
    // so teardown doesn't try to detach fields it never had.
    info._burn = null
  })
})

// ─── render tails — the touch-only hint copy ────────────────────────────────
describe('render tails — hint copy', () => {
  test('touch input swaps the drag hint for the swipe copy', async () => {
    const prev = store.state.inputMethod
    store.state.inputMethod = COMMON_ATTRS.TOUCH

    const el = new CardStack()
    cleanups.push(mount(el))
    el.processedItems = [item(0)]
    el.translations = { deckHint: 'Drag it', swipeHint: 'Swipe it' }
    await waitFor(() => el._cardEls.length === 1)
    expect(el.shadowRoot.querySelector(`.${C.CARD_STACK_HINT}`).textContent).toContain('Swipe it')

    // An empty swipeHint falls back to the deck copy (the && arm).
    el.translations = { deckHint: 'Drag it', swipeHint: '' }
    el._updateDom()
    expect(el.shadowRoot.querySelector(`.${C.CARD_STACK_HINT}`).textContent).toContain('Drag it')

    store.state.inputMethod = prev
  })
})

// ─── render tails — phone-class viewport ladder ──────────────────────────────
describe('render tails — phone viewport', () => {
  test('mobile rungs enter the cover ladder under a small viewport', async () => {
    const orig = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    resetViewportCache()
    try {
      // Two items — img-0's mobile rung is webp+jpg, img-1's jpg-only —
      // so both `webp || jpg` arms of the ≤768 ladder write.
      const el = await mountItems([item(0), item(1)])
      expect(el._cardEls.length).toBe(2)
    } finally {
      if (orig) Object.defineProperty(window, 'innerWidth', orig)
      resetViewportCache()
    }
  })
})

// ─── autoplay tails — the countdown clock + the progress paint ───────────────
describe('autoplay tails', () => {
  test('the countdown paint writes --card-stack-timer-p on the host and a hold freezes it', async () => {
    const el = await mountItems([item(0), item(1)])
    el._tier = FAN_TIER // the countdown only arms on desktop fan tiers

    // Off — the clock reads zero and the var is absent.
    expect(autoElapsed(el)).toBe(0)
    expect(el.style.getPropertyValue(CARD_STACK_CSS_PROPS.CARD_STACK_TIMER_P)).toBe(
      ATTR_VALUES.EMPTY
    )

    armAutoplay(el)

    // Armed — the paint rAF runs and the host carries a live progress
    // value both rings read through shadow inheritance.
    expect(el._autoOn).toBe(true)
    expect(el._autoRaf).not.toBe(0)
    expect(el.style.getPropertyValue(CARD_STACK_CSS_PROPS.CARD_STACK_TIMER_P)).not.toBe(
      ATTR_VALUES.EMPTY
    )
    expect(el.shadowRoot.querySelector(SEL.CARD_STACK).classList.contains(C.CARD_STACK_AUTO)).toBe(
      true
    )

    // An over-lap bank clamps the clock at the lap's end.
    el._autoBank = CARD_STACK_LAYOUT.AUTOPLAY_MS + 1
    expect(autoElapsed(el)).toBe(CARD_STACK_LAYOUT.AUTOPLAY_MS)

    holdAutoplay(el, true)
    holdAutoplay(el, true) // same-state call no-ops before the flag write

    // Held — the writer loop is cancelled and one frozen write holds the
    // fill mid-lap (the paused paint is the same gradient, unmoving).
    expect(el._autoHeld).toBe(true)
    expect(el._autoRaf).toBe(0)
    expect(el.style.getPropertyValue(CARD_STACK_CSS_PROPS.CARD_STACK_TIMER_P)).not.toBe(
      ATTR_VALUES.EMPTY
    )

    holdAutoplay(el, false)

    // Released — the writer resumes (the banked clock keeps going).
    expect(el._autoHeld).toBe(false)
    expect(el._autoRaf).not.toBe(0)

    stopAutoplay(el)

    // Stopped — the var comes off entirely so the rings render nothing.
    expect(el._autoOn).toBe(false)
    expect(el._autoRaf).toBe(0)
    expect(el.style.getPropertyValue(CARD_STACK_CSS_PROPS.CARD_STACK_TIMER_P)).toBe(
      ATTR_VALUES.EMPTY
    )
  })

  test('the transport toggle pauses and resumes the banked countdown', async () => {
    const el = await mountItems([item(0)])
    el._tier = FAN_TIER

    toggleAutoplay(el) // off → a fresh arm on the current card
    expect(el._autoOn).toBe(true)
    expect(el._autoPaused).toBe(false)

    toggleAutoplay(el) // running → pause (the in-flight span banks)
    expect(el._autoPaused).toBe(true)
    expect(el._autoTimer).toBe(null)
    expect(el._autoRaf).toBe(0)

    toggleAutoplay(el) // paused → resume from the frozen point
    expect(el._autoPaused).toBe(false)
    expect(el._autoRaf).not.toBe(0)

    stopAutoplay(el)
    stopAutoplay(el) // already stopped — the early-return arm
  })

  test('the countdown expiry advances the deck and stale ticks no-op', async () => {
    const el = await mountItems([item(0), item(1), item(2)])
    el._tier = FAN_TIER

    jest.useFakeTimers()

    try {
      // A live tick advances the fan one card and re-arms the countdown.
      armAutoplay(el)
      jest.advanceTimersByTime(CARD_STACK_LAYOUT.AUTOPLAY_MS + 1)
      expect(el.activeIdx).toBe(1)
      expect(el._autoOn).toBe(true)

      // The guard's arms — a timeout that outlives its countdown state
      // (stopped/paused/held flags set after the clock armed) fires the
      // tick into a no-op instead of advancing a dead deck.
      el._autoOn = false
      jest.advanceTimersByTime(CARD_STACK_LAYOUT.AUTOPLAY_MS + 1)
      expect(el.activeIdx).toBe(1)

      armAutoplay(el)
      el._autoPaused = true // flag-only pause — the armed tick still fires
      jest.advanceTimersByTime(CARD_STACK_LAYOUT.AUTOPLAY_MS + 1)
      expect(el.activeIdx).toBe(1)

      armAutoplay(el)
      el._autoHeld = true // same for the off-screen hold
      jest.advanceTimersByTime(CARD_STACK_LAYOUT.AUTOPLAY_MS + 1)
      expect(el.activeIdx).toBe(1)

      stopAutoplay(el)
    } finally {
      jest.useRealTimers()
    }
  })

  test('a stacked tier or empty deck never arms the countdown', async () => {
    const el = await mountItems([item(0)])
    el._tier = STACK_TIER

    armAutoplay(el)
    toggleAutoplay(el)
    holdAutoplay(el, true) // unarmed — the _autoOn early-return arm
    expect(el._autoOn).toBe(false)

    // The empty-deck arm of the gate — items dropped, tier still a fan.
    el._tier = FAN_TIER
    el.processedItems = []
    armAutoplay(el)
    expect(el._autoOn).toBe(false)
  })
})
