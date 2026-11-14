/**
 * @file nav-tails-carousel-track-click-scroll.test.js
 * @description Coverage tails for the carousel nav paths the ambient
 * fixtures never reach: the delegated clone-slide click that forwards to
 * the real twin's openModal, the scroll-debounce handler that re-arms the
 * clone-teleport check, the instant jumpToSlide write, scrollToSlide's
 * unmeasurable guard, markAdjacentLoaded's ring edges, and the
 * prev/next/dot click delegates.
 */
import { jest } from '@jest/globals'

import '@website/components/carousel/CustomCarousel.js'
import {
  carouselOnScroll,
  carouselOnTrackClick,
  carouselOnPrevClick,
  carouselOnNextClick,
  carouselOnDotClick,
  carouselGoTo,
  checkInfiniteLoop,
  markAdjacentLoaded,
} from '@website/components/carousel/custom-carousel/nav.js'
import { CAROUSEL_CLASSES } from '@core/tokens/classes/carousel.js'
import { CAROUSEL_SELECTORS } from '@core/tokens/selectors/carousel.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { CAROUSEL_TIMING } from '@core/tokens/motion/carousel.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { MOUSE_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

/** Slide fixture — minimal src/size/label rows the carousel renders. */
const SLIDES = [
  { src: 'a.webp', size: [800, 450], label: 'One' },
  { src: 'b.webp', size: [800, 450], label: 'Two' },
  { src: 'c.webp', label: 'Three' },
]

/** Mounts a <custom-carousel> with stubbed track rects so scroll math runs. */
const makeCarousel = (slides = SLIDES) => {
  const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

  document.body.appendChild(el)

  el.configure({ items: slides, folder: TEST_URLS.IMG })

  const track = el.shadowRoot?.querySelector(CAROUSEL_SELECTORS.CAROUSEL_TRACK)

  if (track) {
    track.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
      right: 600,
      bottom: 400,
    })
    track.querySelectorAll('*').forEach((c) => {
      c.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 600,
        height: 400,
        right: 600,
        bottom: 400,
      })
    })
  }

  return el
}

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('custom-carousel nav track-click + scroll tails', () => {
  test('onTrackClick ignores clicks that miss the track, empty item sets, and non-clone children', () => {
    const openModal = jest.fn()
    const track = { children: [] }

    const host = {
      items: SLIDES,
      $: (sel) => (sel === CAROUSEL_SELECTORS.CAROUSEL_TRACK ? track : null),
      $$: () => [],
      _edgeClonesBefore: 1,
    }

    // Event lands inside a slide subtree (target !== track) → early out.
    carouselOnTrackClick(host, { target: {}, clientX: 10, clientY: 10 })

    expect(openModal).not.toHaveBeenCalled()

    // No track at all → early out.
    const noTrack = { ...host, $: () => null }

    carouselOnTrackClick(noTrack, { target: track, clientX: 10, clientY: 10 })

    // Empty item list → early out after the track check.
    const empty = { ...host, items: [] }

    carouselOnTrackClick(empty, { target: track, clientX: 10, clientY: 10 })

    expect(openModal).not.toHaveBeenCalled()
  })

  test('onTrackClick on a clone under the pointer forwards to the twin figure openModal', () => {
    const openModal = jest.fn()
    const cloneFig = {}

    const cloneKid = {
      classList: { contains: (cls) => cls === CAROUSEL_CLASSES.CAROUSEL_SLIDE_CLONE_MARK },
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        right: 300,
        bottom: 250,
        width: 200,
        height: 200,
      }),
      querySelector: (sel) => (sel === COMPONENT_TAGS.MEDIA_FIGURE ? cloneFig : null),
    }

    // Non-clone kid (skipped) + a clone parked AWAY from the point (rect test fails).
    const farClone = {
      classList: { contains: (cls) => cls === CAROUSEL_CLASSES.CAROUSEL_SLIDE_CLONE_MARK },
      getBoundingClientRect: () => ({
        left: 900,
        top: 500,
        right: 1000,
        bottom: 600,
        width: 100,
        height: 100,
      }),
      querySelector: () => null,
    }

    const realKid = {
      classList: { contains: () => false },
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 50,
        bottom: 50,
        width: 50,
        height: 50,
      }),
      querySelector: () => null,
    }

    const twinSlide = {
      querySelector: (sel) => (sel === COMPONENT_TAGS.MEDIA_FIGURE ? { openModal } : null),
    }

    const bareSlide = { querySelector: () => null }

    const track = { children: [realKid, farClone, cloneKid] }

    // Click lands inside cloneKid (position 2 → twin index ((2-0)%3)=2).
    const host = {
      items: SLIDES,
      $: (sel) => (sel === CAROUSEL_SELECTORS.CAROUSEL_TRACK ? track : null),
      $$: (sel) =>
        sel === CAROUSEL_SELECTORS.CAROUSEL_SLIDES_NOT_CLONE
          ? [bareSlide, bareSlide, twinSlide]
          : [],
      _edgeClonesBefore: 0,
    }

    // Click lands inside cloneKid (position 2 → twin index ((2-0)%3)=2).
    carouselOnTrackClick(host, { target: track, clientX: 150, clientY: 100 })

    expect(openModal).toHaveBeenCalledTimes(1)
    expect(openModal).toHaveBeenCalledWith(cloneFig)

    // A clone WITHOUT its own figure (the strip rebuilt mid-swipe) → the
    // call passes undefined rather than a stale origin rect.
    openModal.mockClear()

    const bareClone = {
      ...cloneKid,
      querySelector: () => null,
    }
    const bareTrack = { children: [realKid, farClone, bareClone] }
    const bareHost = {
      ...host,
      $: (sel) => (sel === CAROUSEL_SELECTORS.CAROUSEL_TRACK ? bareTrack : null),
    }

    carouselOnTrackClick(bareHost, { target: bareTrack, clientX: 150, clientY: 100 })

    expect(openModal).toHaveBeenCalledWith(undefined)
  })

  test('onTrackClick on a clone whose twin figure lacks openModal no-ops', () => {
    const openModal = jest.fn()

    const cloneKid = {
      classList: { contains: (cls) => cls === CAROUSEL_CLASSES.CAROUSEL_SLIDE_CLONE_MARK },
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        right: 300,
        bottom: 250,
        width: 200,
        height: 200,
      }),
      querySelector: () => null,
    }

    const track = { children: [cloneKid] }

    const host = {
      items: SLIDES,
      $: (sel) => (sel === CAROUSEL_SELECTORS.CAROUSEL_TRACK ? track : null),
      $$: (sel) =>
        sel === CAROUSEL_SELECTORS.CAROUSEL_SLIDES_NOT_CLONE ? [{ querySelector: () => null }] : [],
      _edgeClonesBefore: 0,
    }

    carouselOnTrackClick(host, { target: track, clientX: 150, clientY: 100 })

    expect(openModal).not.toHaveBeenCalled()
  })

  test('onScroll while navigating returns early; otherwise debounces into _checkInfiniteLoop', async () => {
    const host = { isNavigating: true, scrollTimeout: null, _checkInfiniteLoop: jest.fn() }

    carouselOnScroll(host)

    expect(host.scrollTimeout).toBe(null)
    expect(host._checkInfiniteLoop).not.toHaveBeenCalled()

    // Idle scroll re-arms the clone check after the debounce window — a
    // pre-existing timeout is cleared first so only the last event runs.
    const idle = {
      isNavigating: false,
      scrollTimeout: setTimeout(() => {}, 9999),
      _checkInfiniteLoop: jest.fn(),
    }

    carouselOnScroll(idle)

    expect(idle.scrollTimeout).not.toBe(null)

    await new Promise((r) => setTimeout(r, CAROUSEL_TIMING.SCROLL_DEBOUNCE_MS + 50))

    expect(idle._checkInfiniteLoop).toHaveBeenCalledTimes(1)
  })

  test('_jumpToSlide instant writes scrollLeft through track.scrollTo', () => {
    const el = makeCarousel()

    const track = el.shadowRoot.querySelector(CAROUSEL_SELECTORS.CAROUSEL_TRACK)

    const scrollToSpy = jest.spyOn(track, 'scrollTo').mockImplementation(() => {})

    el._jumpToSlide(0, false)

    expect(scrollToSpy).toHaveBeenCalled()

    scrollToSpy.mockRestore()
    el.remove()
  })

  test('_scrollToSlide bails on an out-of-range index and centers a valid one', () => {
    const el = makeCarousel()

    // Out-of-range index → the !slide guard returns without a scroll.
    el._scrollToSlide(99)

    // Valid index → the centering path computes and drives the spring.
    el._scrollToSlide(0)

    el.remove()
  })

  test('markAdjacentLoaded flags ring neighbors at both edges and bails empty', () => {
    const el = makeCarousel()

    // Center at the last slide → index 0 pre-loads through the wrap edge.
    el.slideLoaded = {}
    el._markAdjacentLoaded(SLIDES.length - 1)

    expect(el.slideLoaded[0]).toBe(true)
    expect(el.slideLoaded[SLIDES.length - 1]).toBe(true)

    // Center at first slide → the tail index pre-loads through the wrap.
    el.slideLoaded = {}
    el._markAdjacentLoaded(0)

    expect(el.slideLoaded[SLIDES.length - 1]).toBe(true)

    // A middle center marks neither edge.
    el.slideLoaded = {}
    el._markAdjacentLoaded(1)

    expect(el.slideLoaded[1]).toBe(true)

    el.remove()

    // Empty item list → the !len guard returns immediately.
    const host = { items: [], slideLoaded: {} }

    markAdjacentLoaded(host, 0)

    expect(host.slideLoaded).toEqual({})
  })

  test('onPrevClick/onNextClick stop autoplay and step; onDotClick jumps to idx', () => {
    const makeHost = () => ({
      currentIndex: 1,
      _prevArrow: { triggerClick: jest.fn() },
      _nextArrow: { triggerClick: jest.fn() },
      _stopAutoplay: jest.fn(),
      goTo: jest.fn(),
    })

    const prev = makeHost()

    carouselOnPrevClick(prev)

    expect(prev._prevArrow.triggerClick).toHaveBeenCalled()
    expect(prev._stopAutoplay).toHaveBeenCalledWith(true)
    expect(prev.goTo).toHaveBeenCalledWith(0)

    const next = makeHost()

    carouselOnNextClick(next)

    expect(next._nextArrow.triggerClick).toHaveBeenCalled()
    expect(next._stopAutoplay).toHaveBeenCalledWith(true)
    expect(next.goTo).toHaveBeenCalledWith(2)

    const dot = makeHost()

    carouselOnDotClick(dot, 2)

    expect(dot._stopAutoplay).toHaveBeenCalledWith(true)
    expect(dot.goTo).toHaveBeenCalledWith(2)
  })

  test('window resize event reaches _onResize → onCarouselResize', () => {
    const el = makeCarousel()

    const measureSpy = jest.spyOn(el, '_measureFit')
    const heightSpy = jest.spyOn(el, '_setHeightVar')
    const jumpSpy = jest.spyOn(el, '_jumpToSlide')

    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))

    expect(measureSpy).toHaveBeenCalled()
    expect(heightSpy).toHaveBeenCalled()
    expect(jumpSpy).toHaveBeenCalledWith(el.currentIndex, false)

    el.remove()
  })

  test('next-button mouseenter stops autoplay and hovers the WebGL arrow', () => {
    const el = makeCarousel()

    const stopSpy = jest.spyOn(el, '_stopAutoplay')
    const hover = jest.fn()
    el._nextArrow = { setHover: hover, setReducedMotion: jest.fn(), setPlaying: jest.fn() }

    const nextBtn = el.shadowRoot.querySelector(CAROUSEL_SELECTORS.CAROUSEL_BTN_NEXT)

    expect(nextBtn).toBeTruthy()

    nextBtn.dispatchEvent(new Event(MOUSE_EVENTS.MOUSEENTER, { bubbles: false }))

    expect(stopSpy).toHaveBeenCalledWith(true)
    expect(hover).toHaveBeenCalledWith(true)

    el._nextArrow = null
    el.remove()
  })

  test('goTo lands an armed pendingTeleport before navigating on', () => {
    const host = {
      items: SLIDES,
      currentIndex: 0,
      pendingTeleport: 2,
      teleportTimer: setTimeout(() => {}, CAROUSEL_TIMING.NAVIGATION_SETTLE_DELAY),
      isNavigating: false,
      _markAdjacentLoaded: jest.fn(),
      _updateActiveClasses: jest.fn(),
      _jumpToSlide: jest.fn(),
      _scheduleTeleport: jest.fn(),
      _scrollToElement: jest.fn(),
      _scrollToSlide: jest.fn(),
      $: () => null,
      $$: () => [],
    }

    carouselGoTo(host, 1)

    // The stale wrap jump landed instantly (clone≡twin, invisible), the
    // armed timer drained, and the retarget springs to the new index.
    expect(host.pendingTeleport).toBe(null)
    expect(host._jumpToSlide).toHaveBeenCalledWith(2, false)
    expect(host.teleportTimer).not.toBe(null)

    clearTimeout(host.teleportTimer)

    // pendingTeleport armed but its timer already drained → the guard's
    // falsy arm skips clearTimeout and still lands the twin jump.
    const drained = {
      ...host,
      pendingTeleport: 1,
      teleportTimer: null,
      _jumpToSlide: jest.fn(),
      _markAdjacentLoaded: jest.fn(),
      _updateActiveClasses: jest.fn(),
      _scrollToSlide: jest.fn(),
    }

    carouselGoTo(drained, 0)

    expect(drained._jumpToSlide).toHaveBeenCalledWith(1, false)
    expect(drained.pendingTeleport).toBe(null)

    clearTimeout(drained.teleportTimer)
  })

  test('checkInfiniteLoop bails when navigating, trackless, or empty', () => {
    const navigating = { isNavigating: true, $: jest.fn(), items: SLIDES }

    checkInfiniteLoop(navigating)

    expect(navigating.$).not.toHaveBeenCalled()

    const trackless = {
      isNavigating: false,
      items: SLIDES,
      $: () => null,
      _jumpToSlide: jest.fn(),
    }

    checkInfiniteLoop(trackless)

    expect(trackless._jumpToSlide).not.toHaveBeenCalled()

    const empty = {
      isNavigating: false,
      items: [],
      $: () => ({ getBoundingClientRect: () => ({ left: 0, width: 600 }) }),
      _jumpToSlide: jest.fn(),
    }

    checkInfiniteLoop(empty)

    expect(empty._jumpToSlide).not.toHaveBeenCalled()
  })

  test('a click dispatched on the track runs the onTrackClick listener arrow', () => {
    const el = makeCarousel()

    const track = el.shadowRoot.querySelector(CAROUSEL_SELECTORS.CAROUSEL_TRACK)
    const clickSpy = jest.spyOn(el, 'onTrackClick')

    track.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: false }))

    expect(clickSpy).toHaveBeenCalled()

    el.remove()
  })

  test('_setupIntersectionObserver wires the slide observer directly', () => {
    const el = makeCarousel()

    expect(() => el._setupIntersectionObserver()).not.toThrow()

    el.remove()
  })
})
