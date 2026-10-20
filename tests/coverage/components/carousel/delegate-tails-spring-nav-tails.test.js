/**
 * @file delegate-tails-spring-nav-tails.test.js
 * @description Coverage tails for the scroll-spring navigation paths in
 * custom-carousel/nav.ts + arrows.ts and awards-carousel/nav.ts +
 * events.ts: the spring-settle teleport (pendingTeleport consumed, its
 * watchdog cleared — both arms), the rAF-starvation watchdog body, the
 * non-clone settle timer, the re-nav timer reset, and the
 * wheel/pointerdown gesture-takeover listeners on both tracks. Springs
 * are driven through a mocked rAF queue (happy-dom does not tick rAF
 * under jest), timer-based paths still use real-clock waits.
 */
import { jest } from '@jest/globals'

import '@website/components/carousel/CustomCarousel.js'
import '@website/components/carousel/AwardsCarousel.js'
import { TEST_URLS, waitFor } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { CAROUSEL_SELECTORS } from '@core/tokens/selectors/carousel.js'
import { CAROUSEL_CLASSES } from '@core/tokens/classes/carousel.js'
import { AWC_CLASSES } from '@core/tokens/classes/awards-carousel.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { MOUSE_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'

const SLIDES = [
  { src: 'a.webp', size: [800, 450], label: 'One', canExpand: true },
  { src: 'b.webp', size: [800, 450], label: 'Two', isVideo: true },
  { src: 'c.webp', label: 'Three' },
]

const rect = (l = 0, w = 600, h = 400) => ({
  left: l,
  top: 0,
  width: w,
  height: h,
  right: l + w,
  bottom: h,
})

/** Installs a manual rAF queue; returns a pump that drains `n` frames at `dt` ms each. */
const mockRaf = () => {
  const realRaf = globalThis.requestAnimationFrame
  const realCaf = globalThis.cancelAnimationFrame
  const q = []
  let now = 0

  globalThis.requestAnimationFrame = (cb) => (q.push(cb), q.length)
  globalThis.cancelAnimationFrame = (id) => {
    q[id - 1] = null
  }

  const pump = (n, dt = 16) => {
    for (let i = 0; i < n; i++) {
      now += dt
      const batch = [...q]
      q.length = 0
      batch.forEach((cb) => cb && cb(now))
    }
  }

  return {
    pump,
    restore: () => {
      globalThis.requestAnimationFrame = realRaf
      globalThis.cancelAnimationFrame = realCaf
    },
  }
}

const makeCarousel = () => {
  const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

  document.body.appendChild(el)

  el.configure({ items: SLIDES, folder: TEST_URLS.IMG })

  const track = el.shadowRoot?.querySelector(CAROUSEL_SELECTORS.CAROUSEL_TRACK)

  if (track) {
    track.getBoundingClientRect = () => rect(0, 600)
    track.scrollTo = jest.fn()
    track.querySelectorAll('*').forEach((c) => {
      c.getBoundingClientRect = () => rect(0, 600)
    })
  }

  return { el, track }
}

const makeAwards = () => {
  const el = document.createElement(COMPONENT_TAGS.AWARDS_CAROUSEL)

  el.items = SLIDES
  document.body.appendChild(el)

  return el
}

const cleanup = (el) => el?.remove()

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('spring nav tails', () => {
  test('custom: clone nav settles through the spring and fires the armed teleport', () => {
    const { el, track } = makeCarousel()
    const raf = mockRaf()

    const cloneLast = el.shadowRoot.querySelector(CAROUSEL_SELECTORS.CAROUSEL_SLIDE_CLONE_LAST)

    // Distinct left so the spring gets real travel — its settle (not the
    // watchdog) then consumes the pending teleport.
    cloneLast.getBoundingClientRect = () => rect(900, 600)

    el.goTo(-1)

    expect(el.isNavigating).toBe(true)

    raf.pump(200)

    expect(el.pendingTeleport).toBe(null)
    expect(el.teleportTimer).toBe(null)
    expect(el.isNavigating).toBe(false)
    expect(track.classList.contains(CAROUSEL_CLASSES.CAROUSEL_TRACK_ANIMATING)).toBe(false)

    raf.restore()
    cleanup(el)
  })

  test('custom: teleport watchdog fires when the clone is unmeasurable (no spring)', async () => {
    const { el } = makeCarousel()

    const cloneLast = el.shadowRoot.querySelector(CAROUSEL_SELECTORS.CAROUSEL_SLIDE_CLONE_LAST)

    cloneLast.getBoundingClientRect = () => rect(0, 0, 0)

    el.goTo(-1)

    await waitFor(
      () => !el.isNavigating && el.pendingTeleport === null && el.teleportTimer === null
    )

    cleanup(el)
  })

  test('custom: in-range nav releases isNavigating through the settle timer', async () => {
    const { el } = makeCarousel()

    el.goTo(1)

    await waitFor(() => !el.isNavigating && el.teleportTimer === null)

    cleanup(el)
  })

  test('custom: spring settle consumes a teleport armed without a watchdog', () => {
    const { el } = makeCarousel()
    const raf = mockRaf()

    const cloneLast = el.shadowRoot.querySelector(CAROUSEL_SELECTORS.CAROUSEL_SLIDE_CLONE_LAST)

    cloneLast.getBoundingClientRect = () => rect(900, 600)

    // Direct arm — pendingTeleport set while teleportTimer stays null.
    el.pendingTeleport = 1

    el._scrollToElement(cloneLast)
    raf.pump(200)

    expect(el.pendingTeleport).toBe(null)

    raf.restore()
    cleanup(el)
  })

  test('custom: wheel + pointerdown takeover cancels the nav spring', () => {
    const { el, track } = makeCarousel()

    const spy = jest.spyOn(el, '_cancelNavSpring')

    track.dispatchEvent(new Event(MOUSE_EVENTS.WHEEL, { bubbles: true }))

    expect(spy).toHaveBeenCalled()

    track.dispatchEvent(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))

    expect(spy).toHaveBeenCalledTimes(2)

    cleanup(el)
  })

  test('awards: clone nav settles through the spring and fires the armed teleport', () => {
    const el = makeAwards()
    const raf = mockRaf()

    const track = el.shadowRoot.querySelector(`.${AWC_CLASSES.AWC_TRACK}`)
    const cloneLast = el.shadowRoot.querySelector(`.${AWC_CLASSES.AWC_SLIDE_CLONE_LAST}`)

    track.getBoundingClientRect = () => rect(0, 600)
    track.scrollTo = jest.fn()
    cloneLast.getBoundingClientRect = () => rect(900, 400)

    el.goTo(-1)
    raf.pump(200)

    expect(el.pendingTeleport).toBe(null)
    expect(el.teleportTimer).toBe(null)
    expect(el.isNavigating).toBe(false)

    raf.restore()
    cleanup(el)
  })

  test('awards: in-range nav settles with no teleport armed', () => {
    const el = makeAwards()
    const raf = mockRaf()

    const track = el.shadowRoot.querySelector(`.${AWC_CLASSES.AWC_TRACK}`)
    const slide = track?.children[2]

    track.getBoundingClientRect = () => rect(0, 600)
    slide.getBoundingClientRect = () => rect(900, 400)

    el.goTo(1)
    raf.pump(200)

    expect(el.isNavigating).toBe(false)
    expect(el.pendingTeleport).toBe(null)

    raf.restore()
    cleanup(el)
  })

  test('awards: spring settle consumes a teleport armed without a watchdog', () => {
    const el = makeAwards()
    const raf = mockRaf()

    const track = el.shadowRoot.querySelector(`.${AWC_CLASSES.AWC_TRACK}`)
    const cloneLast = el.shadowRoot.querySelector(`.${AWC_CLASSES.AWC_SLIDE_CLONE_LAST}`)

    track.getBoundingClientRect = () => rect(0, 600)
    track.scrollTo = jest.fn()
    cloneLast.getBoundingClientRect = () => rect(900, 400)

    el.pendingTeleport = 1

    el._scrollToElement(cloneLast)
    raf.pump(200)

    expect(el.pendingTeleport).toBe(null)

    raf.restore()
    cleanup(el)
  })

  test('awards: _syncBrackets is a no-op without a shadow root', () => {
    const el = makeAwards()

    Object.defineProperty(el, 'shadowRoot', { configurable: true, get: () => null })

    el._syncBrackets()

    expect(el._bracketTeardown).toBe(null)

    delete el.shadowRoot
    cleanup(el)
  })

  test('awards: a second in-range nav clears the pending settle timer', async () => {
    const el = makeAwards()

    el.goTo(1)
    el.goTo(2)

    await waitFor(() => !el.isNavigating && el.teleportTimer === null)

    cleanup(el)
  })

  test('awards: wheel + pointerdown takeover cancels the nav spring', () => {
    const el = makeAwards()

    const track = el.shadowRoot.querySelector(`.${AWC_CLASSES.AWC_TRACK}`)
    const spy = jest.spyOn(el, '_cancelNavSpring')

    track.dispatchEvent(new Event(MOUSE_EVENTS.WHEEL, { bubbles: true }))

    expect(spy).toHaveBeenCalled()

    track.dispatchEvent(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))

    expect(spy).toHaveBeenCalledTimes(2)

    cleanup(el)
  })
})
