/**
 * @file mentionsdeck.test.js
 * @description <mentions-deck> — the "Some mentions" strip in the contact
 * band: item/title/translations setters, card render, dot nav, drag
 * gestures, autoplay start/stop, and the visibility observer.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MentionsDeck } from '@website/components/carousel/MentionsDeck.js'
import {
  onPointerDown,
  onPointerMove,
  onPointerEnd,
} from '@website/components/carousel/mentions-deck/gestures.js'
import {
  ringSigned,
  stripPose,
  measure,
  applyPoses,
  updateChrome,
} from '@website/components/carousel/mentions-deck/deck.js'
import { goTo, cardIdxFromEvent } from '@website/components/carousel/mentions-deck/interactions.js'
import {
  startAutoplay,
  stopAutoplay,
  pauseAutoplay,
  resumeAutoplay,
  tickAutoplay,
} from '@website/components/carousel/mentions-deck/autoplay.js'
import { setupObserver } from '@website/components/carousel/mentions-deck/observer.js'
import store from '@core/store.js'
import { mount, TEST_AWARDS, TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { MENTIONS_DECK_LAYOUT } from '@core/tokens/motion/mentions-deck.js'
import { CAROUSEL_CSS_PROPS } from '@core/tokens/css/carousel.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MENTIONS_DECK_CLASSES as C } from '@core/tokens/classes/mentions-deck.js'
import { MENTIONS_DECK_SELECTORS as S } from '@core/tokens/selectors/mentions-deck.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { KEYS } from '@core/tokens/primitives.js'
import {
  KEYBOARD_EVENTS,
  MOUSE_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { LANG_MUTATIONS, MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { resetViewportCache } from '@core/utils/dom.js'

/** Generous flush — deck render/interaction queues need real timers. */
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

/** Award-row fixtures — icon-only, media, and bare-link rows cover the arms. */
const ITEMS = [
  { description: TEST_AWARDS.AWWARDS_SOTD, link: 'https://a.test', icon: '🏆' },
  { description: TEST_AWARDS.FWA_OF_THE_DAY, link: 'https://b.test' },
  {
    description: TEST_TEXT.BODY,
    link: 'https://c.test',
    media: { path: 'award.png', width: 64, height: 64 },
  },
  { link: 'https://d.test' },
]

/** Synthetic PointerEvent shape — the deck handlers only read these fields. */
const pointerEvt = (over = {}, target = null) => ({
  pointerId: 1,
  button: 0,
  clientX: 0,
  clientY: 0,
  timeStamp: 0,
  target,
  ...over,
})

describe('MentionsDeck', () => {
  let el
  let cleanup
  let deck

  beforeEach(async () => {
    el = new MentionsDeck()
    cleanup = mount(el)
    el.items = ITEMS
    await flush()
    deck = el.shadowRoot.querySelector(S.MENTIONS_DECK_DECK)
  })

  afterEach(() => cleanup())

  test('registers the custom element and creates a shadow root', () => {
    expect(customElements.get(COMPONENT_TAGS.MENTIONS_DECK)).toBe(MentionsDeck)
    expect(el.shadowRoot).not.toBeNull()
  })

  test('renders the skeleton strip while items is empty', async () => {
    const bare = new MentionsDeck()
    const bareCleanup = mount(bare)
    await flush()

    const shimmers = bare.shadowRoot.querySelectorAll(`.${SKELETON_CLASSES.SKELETON_SHIMMER}`)
    expect(shimmers.length).toBe(3)
    expect(bare.shadowRoot.querySelector(`.${C.MENTIONS_DECK_CARD_LINK}`)).toBeNull()

    bareCleanup()
  })

  test('items setter renders cards with ordinals + media/icon arms', () => {
    const cards = el.shadowRoot.querySelectorAll(S.MENTIONS_DECK_CARD)
    expect(cards.length).toBe(ITEMS.length)

    const nums = el.shadowRoot.querySelectorAll(`.${C.MENTIONS_DECK_CARD_NUM}`)
    const icons = el.shadowRoot.querySelectorAll(`.${C.MENTIONS_DECK_CARD_ICON}`)
    const imgs = el.shadowRoot.querySelectorAll(`.${C.MENTIONS_DECK_CARD_IMG}`)

    expect(nums[0].textContent).toBe('01')
    expect(nums[3].textContent).toBe('04')
    expect(icons.length).toBe(1)
    expect(imgs.length).toBe(1)

    // No description → the link falls back to the generic a11y label.
    const links = el.shadowRoot.querySelectorAll(`.${C.MENTIONS_DECK_CARD_LINK}`)
    expect(links[3].getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBeTruthy()
  })

  test('title + translations setters render the heading and hint', async () => {
    el.title = TEST_TEXT.HEADING
    el.translations = { deckHint: TEST_TEXT.BODY }
    await flush()

    expect(el.shadowRoot.querySelector(`.${C.MENTIONS_DECK_TITLE}`).textContent).toContain(
      TEST_TEXT.HEADING
    )
    expect(el.shadowRoot.querySelector(`.${C.MENTIONS_DECK_HINT}`).textContent).toContain(
      TEST_TEXT.BODY
    )
    expect(el.title).toBe(TEST_TEXT.HEADING)
    expect(el.translations).toEqual({ deckHint: TEST_TEXT.BODY })
  })

  test('dot click advances the strip and updates the active card', async () => {
    const dots = el.shadowRoot.querySelectorAll(S.MENTIONS_DECK_DOT)
    expect(dots.length).toBe(ITEMS.length)

    dots[1].dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    await flush()

    expect(el.activeIdx).toBe(1)

    const cards = el.shadowRoot.querySelectorAll(S.MENTIONS_DECK_CARD)
    expect(cards[1].classList.contains(C.MENTIONS_DECK_CARD_ACTIVE)).toBe(true)
    const links = el.shadowRoot.querySelectorAll(`.${C.MENTIONS_DECK_CARD_LINK}`)
    expect(links[1].getAttribute(ARIA_ATTRS.TABINDEX)).toBe('0')
    expect(links[0].getAttribute(ARIA_ATTRS.TABINDEX)).toBe('-1')
  })

  test('arrow keys step the strip through the delegated keydown', async () => {
    const key = (k) =>
      el.shadowRoot.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

    key(KEYS.ARROW_RIGHT)
    expect(el.activeIdx).toBe(1)

    key(KEYS.ARROW_LEFT)
    expect(el.activeIdx).toBe(0)

    key('x')
    expect(el.activeIdx).toBe(0)
  })

  test('a horizontal drag commits and the release settles the strip', async () => {
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
    expect(deck.classList.contains(C.MENTIONS_DECK_DECK_DRAGGING)).toBe(true)

    await flush()

    onPointerEnd(el, pointerEvt({ clientX: -80, timeStamp: 60 }, deck))
    expect(el._dragActive).toBe(false)
    expect(el.activeIdx).toBe(1)
    expect(deck.classList.contains(C.MENTIONS_DECK_DECK_DRAGGING)).toBe(false)
    expect(el._suppressClick).toBe(true)
  })

  test('taps stay capture-free so clicks reach the link; a stale suppress flag clears on the next pointerdown', () => {
    deck.setPointerCapture = jest.fn()

    onPointerDown(el, pointerEvt({}, deck))
    // No capture on down — the synthesized click keeps targeting the card anchor.
    expect(deck.setPointerCapture).not.toHaveBeenCalled()

    onPointerEnd(el, pointerEvt({}, deck))
    expect(el._dragActive).toBe(false)

    // A committed drag arms capture at the slop boundary instead.
    onPointerDown(el, pointerEvt({}, deck))
    onPointerMove(el, pointerEvt({ clientX: -30, timeStamp: 16 }, deck))
    expect(deck.setPointerCapture).toHaveBeenCalledWith(1)

    onPointerEnd(el, pointerEvt({ clientX: -30, timeStamp: 60 }, deck))

    // A swipe/cancel that synthesized no click leaves the flag armed —
    // the next fresh pointerdown must clear it so a real tap navigates.
    el._suppressClick = true
    onPointerDown(el, pointerEvt({}, deck))
    expect(el._suppressClick).toBe(false)
    onPointerEnd(el, pointerEvt({}, deck))
  })

  test('a steeper vertical track yields the gesture to page scroll', () => {
    onPointerDown(el, pointerEvt({}, deck))
    onPointerMove(el, pointerEvt({ clientX: 0, clientY: 40 }, deck))

    expect(el._gestureDead).toBe(true)
    expect(el._dragActive).toBe(false)
  })

  test('sub-slop drags never commit; release snaps back', () => {
    onPointerDown(el, pointerEvt({}, deck))
    onPointerMove(el, pointerEvt({ clientX: 3, timeStamp: 16 }, deck))
    expect(el._dragActive).toBe(false)

    onPointerMove(el, pointerEvt({ clientX: 8, timeStamp: 200 }, deck))
    expect(el._dragActive).toBe(true)
    onPointerEnd(el, pointerEvt({ clientX: 8, timeStamp: 300 }, deck))
    expect(el.activeIdx).toBe(0)
    expect(el._dragX).toBe(0)
  })

  test('autoplay start/stop and store updates tolerate both states', () => {
    const spy = jest.spyOn(el, '_tickAutoplay')

    el._startAutoplay()
    el._stopAutoplay()
    el._pauseAutoplay()
    el._resumeAutoplay()

    el.onStoreUpdate?.()
    el.onDestroy?.()

    expect(spy).not.toHaveBeenCalled()
  })

  test('a side-card click brings it to the front', async () => {
    const cards = el.shadowRoot.querySelectorAll(S.MENTIONS_DECK_CARD)
    const sideLink = cards[1].querySelector(HTML_TAGS.A)

    sideLink.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    await flush()

    expect(el.activeIdx).toBe(1)
  })

  test('covers unmounted setters, item clamping, delegates, and destroy with pending rAF', () => {
    const bare = new MentionsDeck()
    bare.items = null
    expect(bare.items).toEqual([])
    bare.items = ITEMS
    bare.items = [...ITEMS]
    bare.activeIdx = 99
    bare.items = [ITEMS[0]]
    expect(bare.activeIdx).toBe(0)

    const hintObj = { deckHint: TEST_TEXT.SECOND }
    bare.translations = hintObj
    bare.translations = hintObj
    bare.title = TEST_TEXT.HEADING
    bare.title = TEST_TEXT.HEADING
    bare.title = ''
    expect(bare.title.length).toBeGreaterThan(0)

    // Delegate methods on MentionsDeck
    el.measure()
    el.applyPoses()
    el.updateChrome()
    el.goTo(0)
    el.onDotClick(0)
    el.onCardClick(ITEMS[0], 0)
    el.onKeyDown(new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ESCAPE }))
    expect(el.cardIdxFromEvent(new Event(MOUSE_EVENTS.CLICK))).toBeNull()
    el.onPointerDown(pointerEvt({ button: 2 }, deck))
    el.onPointerMove(pointerEvt({}, deck))
    el.onPointerEnd(pointerEvt({}, deck))
    el._tickAutoplay()
    el._setupObserver()
    el._onResize()
    el._dragTick()

    el._rafId = requestAnimationFrame(() => {})
    el.onDestroy()
    expect(el._rafId).toBeNull()
    expect(el.observer).toBeNull()
    el.onDestroy()
  })

  test('covers deck geometry, ringSigned, stripPose offsets, and empty-item guards', () => {
    expect(ringSigned(2, 0)).toBe(0)
    expect(ringSigned(3, 4)).toBe(-1)
    expect(ringSigned(1, 4)).toBe(1)

    // Flat strip — neighbours sit at a small margin on one baseline (no
    // tilt, drop or shrink).
    const backPose = stripPose(-1, 4, 300, 315)
    expect(backPose.x).toBeLessThan(0)
    expect(backPose.y).toBe(0)
    expect(backPose.rot).toBe(0)
    expect(backPose.scale).toBe(1)

    // Edge dissolve — a card fully inside stays opaque, crossing the edge
    // fades it out, and past the fade span it leaves the pointer/a11y
    // tree, so the strip never shows a card cut by the boundary.
    const edge = 600
    expect(stripPose(1, 5, 300, 315, edge).opacity).toBe(1)
    expect(stripPose(1, 5, 300, 315, edge).visible).toBe(true)
    const fading = stripPose(1.7, 5, 300, 315, edge)
    expect(fading.opacity).toBeGreaterThan(0)
    expect(fading.opacity).toBeLessThan(1)
    expect(fading.visible).toBe(true)
    expect(stripPose(2.5, 5, 300, 315, edge).visible).toBe(false)

    // Mobile peek span (fadeSpan 0) — no dissolve: a card stays fully
    // opaque while any part is inside the deck (even clipped past the
    // edge) and drops out only once its last inside pixel leaves.
    expect(stripPose(1, 5, 300, 315, edge, 0).opacity).toBe(1)
    expect(stripPose(2, 5, 300, 315, edge, 0).opacity).toBe(1)
    expect(stripPose(2, 5, 300, 315, edge, 0).visible).toBe(true)
    expect(stripPose(2.5, 5, 300, 315, edge, 0).visible).toBe(false)

    const prevInnerW = window.innerWidth

    // Wide deck — the fill-fit sizes cards so the whole ring (4 items)
    // lands inside the deck edge-to-edge: cardW = basis / (2·maxS·(1+gap)
    // + 1), the step carries the margin, and the anchor sits at center.
    const gapGrow = 1 + MENTIONS_DECK_LAYOUT.GAP_RATIO
    const fillW = (basis) => basis / (4 * gapGrow + 1)

    window.innerWidth = 1200
    resetViewportCache()
    measure(el)
    expect(el._cardW).toBeCloseTo(fillW(1200))
    expect(el._step).toBeCloseTo(el._cardW * gapGrow)
    expect(el._anchor).toBeCloseTo(600)

    window.innerWidth = 1400
    resetViewportCache()
    measure(el)
    expect(el._cardW).toBeCloseTo(fillW(1400))
    expect(el._anchor).toBeCloseTo(700)

    // Narrow (mobile) deck — the peek layout: the card is a deck-width
    // fraction so a sliver of each neighbour stays on screen, and the
    // dissolve lane collapses to 0 so the partials show at full color.
    window.innerWidth = 360
    resetViewportCache()
    measure(el)
    expect(el._cardW).toBeCloseTo(360 * MENTIONS_DECK_LAYOUT.CARD_W_VW_MOBILE)
    expect(el._step).toBeCloseTo(el._cardW * gapGrow)
    expect(el._anchor).toBeCloseTo(180)
    expect(el._fadeSpan).toBe(0)

    // The narrowest phones floor at CARD_W_MIN_MOBILE; wider mobile
    // decks cap at CARD_W_MAX like the wide-deck clamp.
    window.innerWidth = 320
    resetViewportCache()
    measure(el)
    expect(el._cardW).toBe(MENTIONS_DECK_LAYOUT.CARD_W_MIN_MOBILE)

    window.innerWidth = 700
    resetViewportCache()
    measure(el)
    expect(el._cardW).toBe(MENTIONS_DECK_LAYOUT.CARD_W_MAX)

    // Empty items guards in applyPoses, updateChrome, goTo + CARD_W_FALLBACK arm
    window.innerWidth = 0
    resetViewportCache()
    const emptyEl = new MentionsDeck()
    measure(emptyEl)
    window.innerWidth = prevInnerW
    resetViewportCache()
    applyPoses(emptyEl)
    updateChrome(emptyEl)
    goTo(emptyEl, 1)

    // applyPoses when _deckEl is null
    el._sizesDirty = true
    el._deckEl = null
    applyPoses(el)

    // The edge-dissolve lane — the deck mask fades this many px at each
    // side (cardW × FADE_FRAC) so a crossing card dissolves into the
    // boundary instead of being sliced by the overflow clip. Mobile
    // decks publish 0 — the lane collapses to the clip edge so partial
    // neighbours peek at full opacity.
    window.innerWidth = 1200
    resetViewportCache()
    measure(el)
    el._sizesDirty = true
    el._deckEl = deck
    applyPoses(el)
    expect(deck.style.getPropertyValue(CAROUSEL_CSS_PROPS.MENTIONS_DECK_FADE)).toBe(
      `${el._cardW * MENTIONS_DECK_LAYOUT.FADE_FRAC}${COMMON_ATTRS.PX}`
    )

    window.innerWidth = 360
    resetViewportCache()
    measure(el)
    el._sizesDirty = true
    applyPoses(el)
    expect(deck.style.getPropertyValue(CAROUSEL_CSS_PROPS.MENTIONS_DECK_FADE)).toBe(
      `${el._fadeSpan}${COMMON_ATTRS.PX}`
    )

    window.innerWidth = prevInnerW
    resetViewportCache()
  })

  test('covers render media dimension fallbacks, label fallback, and carousel lang fallback', async () => {
    const prevCarousel = store.state.lang.carousel
    store.state.lang.carousel = null

    el.items = [
      { label: TEST_TEXT.SECOND, link: 'https://label.test', media: { path: 'bare.png' } },
      {},
    ]
    await flush()

    const img = el.shadowRoot.querySelector(`.${C.MENTIONS_DECK_CARD_IMG}`)
    expect(img).not.toBeNull()

    store.commit(LANG_MUTATIONS.SET_CAROUSEL_LANG, prevCarousel)
  })

  test('covers delegated click, pointer, hover, and resize events in events.ts', () => {
    // 1. _suppressClick branch
    el._suppressClick = true
    const supEv = new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
    deck.dispatchEvent(supEv)
    expect(supEv.defaultPrevented).toBe(true)
    expect(el._suppressClick).toBe(false)

    // 2. Dot without data-index attribute
    const dot = el.shadowRoot.querySelector(S.MENTIONS_DECK_DOT)
    dot.removeAttribute(DATA_ATTRS.DATA_INDEX)
    dot.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    expect(el.activeIdx).toBe(0)

    // 3. Click outside any card or dot
    const titleEl = el.shadowRoot.querySelector(`.${C.MENTIONS_DECK_TITLE}`)
    titleEl.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))

    // 4. Card without data-index and card with out-of-range index
    const cards = el.shadowRoot.querySelectorAll(S.MENTIONS_DECK_CARD)
    cards[0].removeAttribute(DATA_ATTRS.DATA_INDEX)
    expect(cardIdxFromEvent({ target: cards[0] })).toEqual({ el: cards[0], idx: 0 })

    cards[0].setAttribute(DATA_ATTRS.DATA_INDEX, '99')
    cards[0].dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))
    cards[0].setAttribute(DATA_ATTRS.DATA_INDEX, '0')

    // 5. Modified click on card and plain click on front card
    cards[1].dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, ctrlKey: true }))
    cards[0].dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true }))

    // 6. Pointer events inside and outside deck
    titleEl.dispatchEvent(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))
    titleEl.dispatchEvent(new Event(POINTER_EVENTS.POINTERMOVE, { bubbles: true }))
    deck.dispatchEvent(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))
    deck.dispatchEvent(new Event(POINTER_EVENTS.POINTERMOVE, { bubbles: true }))
    deck.dispatchEvent(new Event(POINTER_EVENTS.POINTERUP, { bubbles: true }))
    deck.dispatchEvent(new Event(POINTER_EVENTS.POINTERCANCEL, { bubbles: true }))

    // 7. Hover pause/resume and window resize
    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))
    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))
  })

  test('covers gesture pointer capture, flick directions, and cancel with active rAF', () => {
    deck.setPointerCapture = () => {
      throw new Error('unsupported')
    }
    deck.releasePointerCapture = () => {
      throw new Error('stale')
    }

    // pointerDown with missing pointerId & ignored second pointerDown while active
    onPointerDown(el, { clientX: 0, clientY: 0, target: deck })
    onPointerDown(el, pointerEvt({ pointerId: 2 }, deck))
    // pointerMove with wrong pointerId
    onPointerMove(el, pointerEvt({ pointerId: 99 }, deck))
    // pointerEnd with wrong pointerId
    onPointerEnd(el, pointerEvt({ pointerId: 99 }, deck))

    // Cancel pending rAF on pointerEnd + flick in negative direction (right swipe)
    onPointerMove(
      el,
      pointerEvt({ pointerId: 0, clientX: 20, timeStamp: 10, getCoalescedEvents: () => [] }, deck)
    )
    onPointerMove(el, pointerEvt({ pointerId: 0, clientX: 30, timeStamp: 10 }, deck))
    onPointerMove(el, pointerEvt({ pointerId: 0, clientX: 40, timeStamp: 20 }, deck))
    el._rafId = requestAnimationFrame(() => {})
    onPointerEnd(el, pointerEvt({ pointerId: 0, clientX: 40, timeStamp: 25 }, deck))

    // Flick false when velocity is low in both directions + null target on pointerDown/End
    onPointerDown(el, pointerEvt({ pointerId: 1, clientX: 0, timeStamp: 5 }, null))
    onPointerMove(el, pointerEvt({ pointerId: 1, clientX: -10, timeStamp: 1000 }, null))
    onPointerEnd(el, pointerEvt({ pointerId: 1, clientX: -10, timeStamp: 2000 }, null))

    delete deck.setPointerCapture
    delete deck.releasePointerCapture
  })

  test('covers autoplay lifecycle and observer visibility branches', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)

    el.isFullyVisible = true
    el.duration = 10

    startAutoplay(el)
    expect(el.autoplayRunning).toBe(true)

    // tickAutoplay when elapsed < duration vs >= duration
    el.autoplayStart = null
    el.autoplayElapsed = 0
    tickAutoplay(el)

    el.autoplayStart = performance.now() - 100
    tickAutoplay(el)

    // pauseAutoplay with null autoplayStart, then second pauseAutoplay with null rafId, then resumeAutoplay
    el.autoplayStart = null
    pauseAutoplay(el)
    pauseAutoplay(el)
    expect(el.autoplayRafId).toBeNull()

    resumeAutoplay(el)
    expect(el.autoplayRafId).not.toBeNull()
    // Calling resumeAutoplay again while rafId !== null is a no-op
    resumeAutoplay(el)

    await flush(30)

    // resumeAutoplay when gate refuses (isFullyVisible = false while running)
    pauseAutoplay(el)
    el.isFullyVisible = false
    resumeAutoplay(el)
    expect(el.autoplayRunning).toBe(false)

    // startAutoplay when gate refuses (isFullyVisible = false)
    startAutoplay(el)
    expect(el.autoplayRunning).toBe(false)

    // onStoreUpdate branches
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    el.isFullyVisible = true
    el.autoplayRunning = false
    el.onStoreUpdate()
    expect(el.autoplayRunning).toBe(true)

    el.isFullyVisible = false
    el.autoplayRunning = true
    el.onStoreUpdate()
    stopAutoplay(el)

    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, true)
    el.onStoreUpdate()
    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)

    // tickAutoplay when not running
    tickAutoplay(el)

    // Observer callback + missing IntersectionObserver fallback
    const OrigIO = globalThis.IntersectionObserver
    let ioCb = null
    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe() {}
      disconnect() {}
    }

    setupObserver(el)
    ioCb([
      { isIntersecting: true, intersectionRatio: 0.6 },
      { isIntersecting: false, intersectionRatio: 0 },
    ])
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    ioCb([{ isIntersecting: true, intersectionRatio: 0.8 }])

    globalThis.IntersectionObserver = undefined
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    setupObserver(el)
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    setupObserver(el)

    globalThis.IntersectionObserver = OrigIO
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    stopAutoplay(el)
  })
})
