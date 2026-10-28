/**
 * @file shared-observer-tails.test.js
 * @description Coverage tails for the pooled IntersectionObserver: pool
 * reuse/rebuild, per-target dispatch with the sole-handler fallback,
 * handle.disconnect/callback, and the deferred-start mid-scroll re-park
 * arm in mount.ts.
 */
import { jest } from '@jest/globals'

import { observeShared } from '@core/utils/dom/shared-observer.js'
import { mountMediaFigure } from '@website/components/media/figure/mount.js'
import { isScrolling } from '@core/utils/motion/scroll-state.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import store from '@core/store.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { waitFor } from '@tests/fixtures/test-constants.js'

const flushIdle = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))
})

describe('shared-observer tails', () => {
  test('pools by options signature, routes by target, sole-handler fallback, class-swap rebuild', () => {
    const IO = globalThis.IntersectionObserver
    const cbs = []
    const unobserved = []

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        cbs.push(cb)
      }
      observe() {}
      unobserve(el) {
        unobserved.push(el)
      }
      disconnect() {}
    }

    try {
      const el1 = document.createElement(HTML_TAGS.IMG)
      const el2 = document.createElement(HTML_TAGS.IMG)
      const el3 = document.createElement(HTML_TAGS.IMG)
      const hits = []
      const h1 = observeShared(el1, (e) => hits.push(['a', e]), {
        rootMargin: '10px',
        threshold: 0.5,
      })
      const h2 = observeShared(el2, (e) => hits.push(['b', e]), {
        rootMargin: '10px',
        threshold: 0.5,
      })

      // Same signature → pooled: one ctor for both elements.
      expect(cbs).toHaveLength(1)

      const dispatch = cbs[0]

      dispatch([{ isIntersecting: true, target: el1 }])
      dispatch([{ isIntersecting: true, target: el2 }])
      dispatch([{ isIntersecting: true, target: el3 }])

      expect(hits.map((h) => h[0])).toEqual(['a', 'b'])

      // A different signature builds a second pool; a target-less entry
      // still reaches its sole handler.
      const h3 = observeShared(el3, (e) => hits.push(['c', e]), { threshold: 0.9 })

      expect(cbs).toHaveLength(2)

      cbs[1]([{ isIntersecting: true }])

      expect(hits.map((h) => h[0])).toEqual(['a', 'b', 'c'])

      // Empty-options key: ?? fallbacks for rootMargin/threshold.
      const h4 = observeShared(document.createElement(HTML_TAGS.IMG), () => {}, {})

      // Class swap discards the stale pool so the next observe hits the
      // new (stubbed) ctor — test isolation for IO-mocking suites.
      const cbs2 = []

      globalThis.IntersectionObserver = class {
        constructor(cb) {
          cbs2.push(cb)
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }

      observeShared(el1, () => {}, { rootMargin: '10px', threshold: 0.5 })

      expect(cbs2).toHaveLength(1)

      // Handle surfaces: callback delivers to this element's handler;
      // disconnect unobserves and drops the handler.
      const routed = []

      h1.callback([{ isIntersecting: true }])
      hits.push(...routed)

      expect(hits[hits.length - 1][0]).toBe('a')

      h1.disconnect()

      expect(unobserved).toContain(el1)

      h2.disconnect()
      h3.disconnect()
      h4.disconnect()
    } finally {
      globalThis.IntersectionObserver = IO
    }
  })

  test('deferred video start re-parks when the idle slice lands mid-scroll', async () => {
    const IO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    const rsDesc = Object.getOwnPropertyDescriptor(document, 'readyState')

    Object.defineProperty(document, 'readyState', {
      value: STATE_STRINGS.COMPLETE,
      configurable: true,
    })

    try {
      const vid = document.createElement(HTML_TAGS.VIDEO)
      let paused = true

      Object.defineProperty(vid, 'paused', { get: () => paused, configurable: true })

      vid.play = jest.fn(() => Promise.resolve())

      const c = {
        subscribe: jest.fn(),
        classes: '',
        canExpand: false,
        isVideo: true,
        $: jest.fn((sel) => (sel === HTML_TAGS.VIDEO ? vid : null)),
        addScopedListener: jest.fn(),
        classList: { add: jest.fn() },
        displayWidth: 0,
        displayHeight: 0,
        isLoaded: false,
        imgObserver: null,
        observer: null,
        isIntersecting: false,
        poster: [],
        _ensureVideoSource: jest.fn(),
        warmed: true,
        warmObserver: null,
      }

      mountMediaFigure(c)

      // Pre-load intersection: the ambient attach parks on a one-shot
      // 'load' listener instead of stealing critical-path bytes.
      Object.defineProperty(document, 'readyState', {
        value: STATE_STRINGS.LOADING,
        configurable: true,
      })

      const listeners = {}

      c.addScopedListener = jest.fn((el, evt, cb) => {
        listeners[evt] = cb
      })

      mountMediaFigure(c)

      c.observer.callback([{ isIntersecting: true }])

      expect(c._ensureVideoSource).not.toHaveBeenCalled()

      listeners[WINDOW_EVENTS.LOAD]()

      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledWith(vid)

      c._ensureVideoSource.mockClear()

      Object.defineProperty(document, 'readyState', {
        value: STATE_STRINGS.COMPLETE,
        configurable: true,
      })

      mountMediaFigure(c)

      // Not scrolling: the entry takes the immediate idle slice, but the
      // scroll begins before the slice runs — start() must re-park on
      // scroll-stop rather than attach mid-gesture.
      c.observer.callback([{ isIntersecting: true }])

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

      await flushIdle()

      expect(c._ensureVideoSource).not.toHaveBeenCalled()

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

      await waitFor(() => !isScrolling())
      await flushIdle()
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledWith(vid)

      // Gate-off arm — already playing: the deferred start still runs
      // but the play() block is skipped (vid.paused operand false).
      paused = false

      c._ensureVideoSource.mockClear()
      vid.play.mockClear()

      c.observer.callback([{ isIntersecting: true }])

      await flushIdle()
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledWith(vid)
      expect(vid.play).not.toHaveBeenCalled()

      // Already-paused exit — the !vid.paused guard skips the pause call.
      paused = true
      vid.pause = jest.fn()

      c.observer.callback([{ isIntersecting: false }])

      expect(vid.pause).not.toHaveBeenCalled()
    } finally {
      globalThis.IntersectionObserver = IO

      if (rsDesc) Object.defineProperty(document, 'readyState', rsDesc)
    }
  })

  test('img observer ignores non-intersecting entries and loaded figures', () => {
    const IO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    try {
      const highImg = document.createElement(HTML_TAGS.IMG)
      const c = {
        subscribe: jest.fn(),
        classes: '',
        canExpand: false,
        isVideo: false,
        $: jest.fn(() => highImg),
        addScopedListener: jest.fn(),
        classList: { add: jest.fn() },
        isLoaded: false,
        isConnected: true,
        imgObserver: null,
        loadHighRes: jest.fn(),
        warmed: true,
        warmObserver: null,
      }

      mountMediaFigure(c)

      // Non-intersecting entry — the if's else arm: nothing loads, nothing
      // disconnects.
      const imgHandle = c.imgObserver

      imgHandle.callback([{ isIntersecting: false }])

      expect(c.loadHighRes).not.toHaveBeenCalled()
      expect(c.imgObserver).not.toBeNull()

      // Already-loaded figure — the && second operand short-circuits to
      // the else arm.
      c.isLoaded = true

      imgHandle.callback([{ isIntersecting: true }])

      expect(c.loadHighRes).not.toHaveBeenCalled()

      // Pre-warmed figure — the warm observer's !c.warmed guard takes
      // the else arm and skips the warm rung fetch.
      c.warmObserver.callback([{ isIntersecting: true }])
    } finally {
      globalThis.IntersectionObserver = IO
    }
  })

  test('video figure with autoplay denied and no poster skips the observer entirely', () => {
    const IO = globalThis.IntersectionObserver
    const ioSpy = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))

    globalThis.IntersectionObserver = ioSpy

    try {
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

      mountMediaFigure({
        subscribe: jest.fn(),
        classes: '',
        canExpand: false,
        isVideo: true,
        $: jest.fn((sel) =>
          sel === HTML_TAGS.VIDEO ? document.createElement(HTML_TAGS.VIDEO) : null
        ),
        addScopedListener: jest.fn(),
        classList: { add: jest.fn() },
        displayWidth: 0,
        displayHeight: 0,
        isLoaded: false,
        imgObserver: null,
        observer: null,
        isIntersecting: false,
        warmed: true,
        warmObserver: null,
      })

      expect(ioSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.IntersectionObserver = IO

      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    }
  })

  test('poster-only video sets the poster at the idle slice and never attaches a stream', async () => {
    const IO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    try {
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

      const vid = document.createElement(HTML_TAGS.VIDEO)

      Object.defineProperty(vid, 'paused', { get: () => true, configurable: true })

      vid.play = jest.fn()

      const c = {
        subscribe: jest.fn(),
        classes: '',
        canExpand: false,
        isVideo: true,
        $: jest.fn((sel) => (sel === HTML_TAGS.VIDEO ? vid : null)),
        addScopedListener: jest.fn(),
        classList: { add: jest.fn() },
        displayWidth: 0,
        displayHeight: 0,
        isLoaded: false,
        imgObserver: null,
        observer: null,
        isIntersecting: false,
        poster: ['poster.webp'],
        _ensureVideoSource: jest.fn(),
        warmed: true,
        warmObserver: null,
      }

      mountMediaFigure(c)

      c.observer.callback([{ isIntersecting: true }])

      await flushIdle()
      await flushIdle()

      // Poster applied, but the ambient stream/play is skipped entirely
      // under the reduced-motion autoplay denial.
      expect(vid.poster).toContain('poster.webp')
      expect(c._ensureVideoSource).not.toHaveBeenCalled()
      expect(vid.play).not.toHaveBeenCalled()
    } finally {
      globalThis.IntersectionObserver = IO

      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    }
  })
})
