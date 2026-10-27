/**
 * @file nav-tails-carousel-scroll-gate.test.js
 * @description Coverage tails for the scroll-gate paths: observer entries
 * delivered mid-scroll defer WebGL-arrow mount/destroy + autoplay churn to
 * scroll-settle, and the autoplay tick parks while the window is scrolling.
 */
import { jest } from '@jest/globals'

import store from '@core/store.js'
import '@website/components/carousel/CustomCarousel.js'
import {
  stopCarouselAutoplay,
  tickCarouselAutoplay,
} from '@website/components/carousel/custom-carousel/autoplay.js'
import { checkInfiniteLoop } from '@website/components/carousel/custom-carousel/nav.js'
import { isScrolling } from '@core/utils/motion/scroll-state.js'
import { TEST_URLS, waitFor } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { CAROUSEL_SELECTORS } from '@core/tokens/selectors/carousel.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

const SLIDES = [
  { src: 'a.webp', size: [800, 450], label: 'One', canExpand: true },
  { src: 'b.webp', size: [800, 450], label: 'Two', isVideo: true },
  { src: 'c.webp', label: 'Three' },
]

const rect = (w = 300, h = 200) => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h })

const makeCarousel = (slides = SLIDES) => {
  const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

  document.body.appendChild(el)

  el.configure({ items: slides, folder: TEST_URLS.IMG })

  el.getBoundingClientRect = () => rect(600, 400)

  const track = el.shadowRoot?.querySelector(CAROUSEL_SELECTORS.CAROUSEL_TRACK)

  if (track) {
    track.getBoundingClientRect = () => rect(600, 400)
    track.querySelectorAll('*').forEach((c) => {
      c.getBoundingClientRect = () => rect(600, 400)
    })
  }

  return el
}

const cleanup = (el) => {
  el?.remove()
}

afterEach(() => {
  // Release any parked scroll-settle work so the flag can't leak into the
  // next test — scrollend where supported, the 120ms debounce otherwise.
  window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('carousel scroll-gate tails', () => {
  test('observer entries during scroll defer arrow mount and autoplay until scroll-end', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    const el = makeCarousel()

    el._setupIntersectionObserver()

    const mount = jest.spyOn(el, '_mountWebGLArrows')
    const destroy = jest.spyOn(el, '_destroyWebGLArrows')

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

    el.observer.callback([{ isIntersecting: true, intersectionRatio: 1, target: el }])

    expect(el.isInViewport).toBe(true)
    expect(el.isFullyVisible).toBe(true)
    expect(el._scrollSettleQueued).toBe(true)
    expect(mount).not.toHaveBeenCalled()
    expect(el.autoplayRunning).not.toBe(true)

    // A second crossing while still scrolling must not re-arm the settle pass.
    el.observer.callback([{ isIntersecting: true, intersectionRatio: 0.5, target: el }])

    expect(el._scrollSettleQueued).toBe(true)

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

    await waitFor(() => !isScrolling())
    await waitFor(() => el._scrollSettleQueued === false)

    expect(mount).toHaveBeenCalled()
    expect(el.isEnteredViewport).toBe(true)

    // Exit mid-scroll likewise defers the arrow release + autoplay stop.
    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

    el.observer.callback([{ isIntersecting: false, intersectionRatio: 0, target: el }])

    expect(el.isInViewport).toBe(false)
    expect(el.isFullyVisible).toBe(false)

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

    await waitFor(() => !isScrolling())

    expect(destroy).toHaveBeenCalled()
    expect(el.autoplayRunning).not.toBe(true)

    cleanup(el)
  })

  test('observer entries with no scroll apply visibility immediately', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    const el = makeCarousel()

    el._setupIntersectionObserver()

    const mount = jest.spyOn(el, '_mountWebGLArrows')

    el.observer.callback([{ isIntersecting: true, intersectionRatio: 1, target: el }])

    expect(el._scrollSettleQueued).toBe(false)
    expect(mount).toHaveBeenCalled()

    cleanup(el)
  })

  test('tickCarouselAutoplay parks while scrolling and re-arms on scroll-end', async () => {
    const host = {
      autoplayRunning: true,
      autoplayStart: 0,
      autoplayElapsed: 50,
      ringProgress: 0,
      rafId: 42,
      currentIndex: 0,
      circumference: 100,
      _autoplayPermanentlyStopped: false,
      _isRegressing: false,
      _prevArrow: null,
      _nextArrow: null,
      _ringFills: null,
      goTo: jest.fn(),
      $$: () => [],
    }

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

    tickCarouselAutoplay(host, 200)

    expect(host.rafId).toBe(null)
    expect(host.autoplayRunning).toBe(true)

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

    await waitFor(() => !isScrolling())
    await waitFor(() => typeof host.rafId === 'number')

    expect(host.rafId).not.toBe(null)

    window.cancelAnimationFrame(host.rafId)
  })

  test('parked tick does not re-arm when autoplay stopped during the park', async () => {
    const host = {
      autoplayRunning: true,
      autoplayStart: 0,
      autoplayElapsed: 50,
      ringProgress: 0,
      rafId: 42,
      currentIndex: 0,
      circumference: 100,
      _autoplayPermanentlyStopped: false,
      _isRegressing: false,
      _prevArrow: null,
      _nextArrow: null,
      _ringFills: null,
      goTo: jest.fn(),
      $$: () => [],
    }

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

    tickCarouselAutoplay(host, 200)

    host.autoplayRunning = false

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

    await waitFor(() => !isScrolling())

    expect(host.rafId).toBe(null)
  })

  test('checkInfiniteLoop teleports at both clone edges', () => {
    const makeHost = (lastLeft, firstLeft) => ({
      isNavigating: false,
      currentIndex: 1,
      items: SLIDES,
      $: (sel) =>
        ({
          [CAROUSEL_SELECTORS.CAROUSEL_TRACK]: {
            getBoundingClientRect: () => ({ left: 0, width: 600 }),
          },
          [CAROUSEL_SELECTORS.CAROUSEL_SLIDE_CLONE_LAST]: {
            getBoundingClientRect: () => ({ left: lastLeft, width: 100 }),
          },
          [CAROUSEL_SELECTORS.CAROUSEL_SLIDE_CLONE_FIRST]: {
            getBoundingClientRect: () => ({ left: firstLeft, width: 100 }),
          },
        })[sel],
      _jumpToSlide: jest.fn(),
      _updateActiveClasses: jest.fn(),
    })

    // cloneLast parked at track center → wrap to the real last slide.
    const lastHost = makeHost(250, -8000)

    checkInfiniteLoop(lastHost)

    expect(lastHost.currentIndex).toBe(SLIDES.length - 1)
    expect(lastHost._jumpToSlide).toHaveBeenCalled()

    // cloneFirst parked at track center → wrap to the real first slide.
    const firstHost = makeHost(-8000, 250)

    checkInfiniteLoop(firstHost)

    expect(firstHost.currentIndex).toBe(0)
    expect(firstHost._jumpToSlide).toHaveBeenCalled()
  })

  test('stopCarouselAutoplay releases arrows, cancels raf, and drains the ring', () => {
    const prev = { setPlaying: jest.fn() }
    const next = { setPlaying: jest.fn() }
    const host = {
      autoplayRunning: true,
      autoplayStart: 0,
      autoplayElapsed: 100,
      ringProgress: 0.4,
      rafId: 7,
      currentIndex: 0,
      circumference: 50,
      _autoplayPermanentlyStopped: false,
      _isRegressing: false,
      _prevArrow: prev,
      _nextArrow: next,
      _ringFills: null,
      goTo: jest.fn(),
      $$: () => [],
    }

    stopCarouselAutoplay(host)

    expect(host.autoplayRunning).toBe(false)
    expect(prev.setPlaying).toHaveBeenCalledWith(false)
    expect(next.setPlaying).toHaveBeenCalledWith(false)
    expect(host.rafId).toBe(null)
    expect(host._isRegressing).toBe(true)
  })
})
