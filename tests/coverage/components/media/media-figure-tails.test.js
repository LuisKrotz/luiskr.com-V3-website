/**
 * @file media-figure-tails.test.js
 * @description Coverage tails for components/media/figure/modal.ts +
 * components/media/figure/mount.ts — openMediaModal's
 * `r && r.width > 0 ? origin : null` truthy arm (a laid-out figure yields a
 * real genie origin rect), mountMediaFigure's `if (openBtn)` else arm
 * (expandable figure without the open button skips bracket mounting), and
 * figureSeqSlug's root/label/match arms (the deep-link slug written into
 * the address bar must be the canonical mediaSlugSeq form), plus
 * modal-trigger.ts's watch-page title helpers — setMediaPageTitle
 * appends the label once (rebasing on the parked title, never stacking)
 * and restoreMediaPageTitle hands it back on modal close.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { openMediaModal } from '@website/components/media/figure/modal.js'
import { playVideo } from '@website/components/media/figure/video.js'
import {
  restoreMediaModalTrigger,
  setMediaPageTitle,
  restoreMediaPageTitle,
} from '@website/components/media/modal-trigger.js'
import { mountMediaFigure } from '@website/components/media/figure/mount.js'
import store from '@core/store.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import {
  KEYBOARD_EVENTS,
  MOUSE_EVENTS,
  MEDIA_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { KEYS } from '@core/tokens/primitives.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_PROJECTS, TEST_TEXT, TEST_URLS, waitFor } from '@tests/fixtures/test-constants.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { slugify } from '@core/utils/index.js'
import { isScrolling } from '@core/utils/motion/scroll-state.js'

describe('media figure modal + mount tails', () => {
  test('playVideo swallows a rejected playback promise', () => {
    const priorReduced = store.getters.getReducedMotion()
    const priorAutoplay = store.getters.getVideoAutoplay()
    const catchHandler = jest.fn()
    const target = {
      play: jest.fn(() => ({
        then: () => ({
          catch: (handler) => {
            handler()
            catchHandler()
          },
        }),
      })),
    }
    const fig = {
      _ensureVideoSource: jest.fn(),
      displayWidth: 0,
      displayHeight: 0,
    }

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)

    try {
      playVideo(fig, target)

      expect(target.play).toHaveBeenCalled()
      expect(catchHandler).toHaveBeenCalled()
    } finally {
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, priorReduced)
      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, priorAutoplay)
    }
  })

  test('openMediaModal returns early when the figure cannot expand', () => {
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    openMediaModal({ canExpand: false })

    expect(store.getters.getModal()?.open).toBe(false)
  })

  test('openMediaModal captures the genie origin when the figure has a real rect', () => {
    const fig = {
      getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 50 }),
    }
    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      slugify: () => TEST_TEXT.HEADING,
      $: jest.fn((sel) => (sel === HTML_TAGS.FIGURE ? fig : null)),
    }

    openMediaModal(c)

    const modal = store.getters.getModal?.()

    // The origin arm must carry the figure's rect — null would make the
    // genie warp start from the viewport center instead of the thumbnail.
    if (modal && typeof modal === 'object') {
      expect(modal.origin).toEqual({ x: 10, y: 20, w: 100, h: 50 })
    }

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('mountMediaFigure without an open button skips bracket mounting', () => {
    const fig = document.createElement(HTML_TAGS.FIGURE)
    const c = {
      subscribe: jest.fn(),
      classes: '',
      canExpand: true,
      isVideo: false,
      $: jest.fn((sel) => (sel === HTML_TAGS.FIGURE ? fig : null)),
      addScopedListener: jest.fn(),
      openModal: jest.fn(),
      loadHighRes: jest.fn(),
      isLoaded: false,
      imgObserver: null,
    }

    mountMediaFigure(c)

    // The click binding still lands on the figure; only the brackets
    // mount is skipped (openBtn resolved null).
    expect(c.addScopedListener).toHaveBeenCalled()
    expect(c._expandBrackets).toBeUndefined()
  })

  test('modal close restores focus to the trigger figure open button', () => {
    const openBtn = { isConnected: true, focus: jest.fn() }

    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      slugify: () => TEST_TEXT.HEADING,
      $: jest.fn((sel) =>
        typeof sel === 'string' && sel.includes(EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_1)
          ? openBtn
          : null
      ),
    }

    openMediaModal(c)

    restoreMediaModalTrigger()

    expect(openBtn.focus).toHaveBeenCalled()

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('modal focus restore tolerates a missing expand button', () => {
    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      getRootNode: () => null,
      $: jest.fn(() => null),
    }

    openMediaModal(c)
    restoreMediaModalTrigger()

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('openMediaModal deep-links the canonical mediaSlugSeq slug', () => {
    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    const prior = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    prior.setAttribute(FORM_ATTRS.LABEL, TEST_TEXT.HEADING)

    const unlabelled = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      getAttribute: (name) => (name === FORM_ATTRS.LABEL ? TEST_TEXT.HEADING : null),
      getRootNode: () => ({
        querySelectorAll: () => [prior, unlabelled, c],
      }),
      $: jest.fn(() => null),
    }

    openMediaModal(c)

    // The prior same-label figure consumes the first sequence slot, so
    // this figure's canonical slug gains the `-2` ordinal — matching the
    // build emit, sitemap, checkAutoOpenModal, and figureForUrl.
    expect(window.location.pathname).toBe(
      `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}${ROUTE_PATHS.ROOT}${slugify(TEST_TEXT.HEADING)}-2`
    )

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('figureSeqSlug returns empty when the root is not queryable or the figure is absent', () => {
    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    const base = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      getAttribute: (name) => (name === FORM_ATTRS.LABEL ? TEST_TEXT.HEADING : null),
      $: jest.fn(() => null),
    }

    // getRootNode() → null root.
    openMediaModal({ ...base, getRootNode: () => null })

    // A non-ParentNode root (no querySelectorAll).
    openMediaModal({ ...base, getRootNode: () => ({}) })

    // The figure is absent from its own tree — no slot resolves.
    openMediaModal({
      ...base,
      getRootNode: () => ({
        querySelectorAll: () => [document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)],
      }),
    })

    // No resolvable slug → the address bar stays on the bare project path.
    expect(window.location.pathname).toBe(`${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('video arm wires play/pause listeners and the loadeddata terminal state', () => {
    const fig = document.createElement(HTML_TAGS.FIGURE)
    const vid = document.createElement(HTML_TAGS.VIDEO)
    const listeners = {}

    // The global MockIntersectionObserver fires its callback on a timer —
    // the video observer arm needs these stubs when it lands.
    vid.play = jest.fn(() => Promise.resolve())

    const c = {
      subscribe: jest.fn(),
      classes: '',
      canExpand: false,
      isVideo: true,
      $: jest.fn((sel) => (sel === HTML_TAGS.FIGURE ? fig : sel === HTML_TAGS.VIDEO ? vid : null)),
      addScopedListener: jest.fn((el, evt, cb) => {
        listeners[evt] = cb
      }),
      openModal: jest.fn(),
      playVideo: jest.fn(),
      pauseVideo: jest.fn(),
      classList: { add: jest.fn() },
      displayWidth: 0,
      displayHeight: 0,
      isLoaded: false,
      imgObserver: null,
      observer: null,
      isIntersecting: false,
      _ensureVideoSource: jest.fn(),
    }

    mountMediaFigure(c)

    // Pause arm — mouseleave/mouseout route to pauseVideo with the target.
    listeners[MOUSE_EVENTS.MOUSELEAVE]({ target: vid })

    expect(c.pauseVideo).toHaveBeenCalledWith(vid)

    // Terminal arm — first decoded frame drops the shimmer and hands the
    // video to the GPU path.
    listeners[MEDIA_EVENTS.LOADEDDATA]({ target: vid })

    expect(c.classList.add).toHaveBeenCalledWith(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)
  })

  test('video arm covers keydown/error/play/pause listeners and the autoplay observer gate', async () => {
    const IO = globalThis.IntersectionObserver
    const ioCbs = []

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCbs.push(cb)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    const rsDesc = Object.getOwnPropertyDescriptor(document, 'readyState')

    Object.defineProperty(document, 'readyState', {
      value: STATE_STRINGS.COMPLETE,
      configurable: true,
    })

    try {
      const fig = document.createElement(HTML_TAGS.FIGURE)
      const vid = document.createElement(HTML_TAGS.VIDEO)
      const listeners = {}
      let paused = true

      Object.defineProperty(vid, 'paused', { get: () => paused, configurable: true })

      vid.play = jest.fn(() => {
        paused = false

        return Promise.resolve()
      })
      vid.pause = jest.fn(() => {
        paused = true
      })

      const c = {
        subscribe: jest.fn(),
        // Trailing space feeds the `if (cls)` false arm of the class split.
        classes: `${TEST_TEXT.STALE} `,
        canExpand: false,
        isVideo: true,
        $: jest.fn((sel) =>
          sel === HTML_TAGS.FIGURE ? fig : sel === HTML_TAGS.VIDEO ? vid : null
        ),
        addScopedListener: jest.fn((el, evt, cb) => {
          listeners[evt] = cb
        }),
        openModal: jest.fn(),
        playVideo: jest.fn(),
        pauseVideo: jest.fn(),
        classList: { add: jest.fn() },
        displayWidth: 0,
        displayHeight: 0,
        isLoaded: false,
        imgObserver: null,
        observer: null,
        isIntersecting: false,
        _ensureVideoSource: jest.fn(),
        // warmFirstRung parks its own warmObserver on the component —
        // pre-warmed so its callback short-circuits here.
        warmed: true,
        warmObserver: null,
      }

      mountMediaFigure(c)

      // Pooled observers share one IntersectionObserver across figures —
      // the handle's callback delivers entries to this figure's handler
      // the same way its old private observer did.
      const ioCb = (entries) => c.observer.callback(entries)

      expect(c.classList.add).toHaveBeenCalledWith(TEST_TEXT.STALE)

      // Play arm — hover/press listeners route to playVideo with the target.
      listeners[MOUSE_EVENTS.MOUSEENTER]({ target: vid })

      expect(c.playVideo).toHaveBeenCalledWith(vid)

      // Non-toggle keys early-return without preventDefault.
      const otherKey = { key: TEST_TEXT.STALE, preventDefault: jest.fn() }

      listeners[KEYBOARD_EVENTS.KEYDOWN](otherKey)

      expect(otherKey.preventDefault).not.toHaveBeenCalled()

      // Space on a paused video primes sources then plays.
      listeners[KEYBOARD_EVENTS.KEYDOWN]({ key: KEYS.SPACE, preventDefault: jest.fn() })

      expect(c._ensureVideoSource).toHaveBeenCalledWith(vid)
      expect(vid.play).toHaveBeenCalledTimes(1)

      // Enter on a playing video pauses it.
      paused = false
      listeners[KEYBOARD_EVENTS.KEYDOWN]({ key: KEYS.ENTER, preventDefault: jest.fn() })

      expect(vid.pause).toHaveBeenCalledTimes(1)

      // Error arm — terminal shimmer release; poster removal only when set.
      listeners[WINDOW_EVENTS.ERROR]({ target: null })
      vid.setAttribute(MEDIA_ATTRS.POSTER, TEST_URLS.IMG)
      listeners[WINDOW_EVENTS.ERROR]({ target: vid })

      expect(vid.hasAttribute(MEDIA_ATTRS.POSTER)).toBe(false)

      // Play/pause mirror into the accessible name (aria-label) — the
      // checker rejects aria-description on <video>.
      listeners[MEDIA_EVENTS.PLAY]()

      expect(vid.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain(STATE_STRINGS.PLAYING)

      listeners[MEDIA_EVENTS.PAUSE]()

      expect(vid.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain(STATE_STRINGS.PAUSED)

      // Observer gate — intersecting primes sources; the autoplay+overlay+
      // paused trio allows playback, each operand's false arm blocks it.
      // The IO attach+play defers to an idle slice (no requestIdleCallback
      // in happy-dom → setTimeout(0) — flush macrotasks between drives).
      const flushIdle = () => new Promise((r) => setTimeout(r, 0))

      paused = true
      ioCb([{ isIntersecting: true }])
      await flushIdle()

      expect(vid.play).toHaveBeenCalledTimes(2)

      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, false)
      ioCb([{ isIntersecting: true }])
      await flushIdle()
      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)
      store.state.preferencesOpen = true
      ioCb([{ isIntersecting: true }])
      await flushIdle()
      store.state.preferencesOpen = false
      ioCb([{ isIntersecting: false }])

      expect(vid.pause).toHaveBeenCalledTimes(2)

      paused = true
      ioCb([{ isIntersecting: false }])

      // Rejected playback promises still settle through .catch(() => {}).
      vid.play = jest.fn(() => Promise.reject(new Error(TEST_TEXT.STALE)))
      listeners[KEYBOARD_EVENTS.KEYDOWN]({ key: KEYS.SPACE, preventDefault: jest.fn() })
      ioCb([{ isIntersecting: true }])
      await flushIdle()

      await Promise.resolve()

      // Load-window gate — while the document is still loading, an
      // intersecting entry parks the ambient attach on a one-shot 'load'
      // listener instead of stealing critical-path bytes; the attach
      // lands only once the window finishes loading.
      Object.defineProperty(document, 'readyState', {
        value: STATE_STRINGS.LOADING,
        configurable: true,
      })

      let ensured = c._ensureVideoSource.mock.calls.length
      ioCb([{ isIntersecting: true }])
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledTimes(ensured)

      listeners[WINDOW_EVENTS.LOAD]()
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledTimes(ensured + 1)

      Object.defineProperty(document, 'readyState', {
        value: STATE_STRINGS.COMPLETE,
        configurable: true,
      })

      // Stale-position bail — an entry that left the viewport before its
      // deferred slice runs must not attach a stream or start playback.
      ensured = c._ensureVideoSource.mock.calls.length
      const playCalls = vid.play.mock.calls.length
      ioCb([{ isIntersecting: true }])
      ioCb([{ isIntersecting: false }])
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledTimes(ensured)
      expect(vid.play).toHaveBeenCalledTimes(playCalls)

      // Scroll-gesture park — an intersect that lands mid-scroll waits
      // for the gesture to settle before the attach+decode runs (scroll
      // frames own the budget). scrollend fires it; the 150ms sleep also
      // covers the debounce fallback on engines without scrollend.
      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
      ensured = c._ensureVideoSource.mock.calls.length
      ioCb([{ isIntersecting: true }])
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledTimes(ensured)

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))
      await new Promise((r) => setTimeout(r, 150))
      await flushIdle()

      expect(c._ensureVideoSource).toHaveBeenCalledTimes(ensured + 1)
    } finally {
      globalThis.IntersectionObserver = IO

      if (rsDesc) Object.defineProperty(document, 'readyState', rsDesc)
    }
  })

  test('video arm skips the observer under reduced motion and saveData budgets', () => {
    const IO = globalThis.IntersectionObserver
    const ioSpy = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() }))

    globalThis.IntersectionObserver = ioSpy

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    })

    try {
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
      mountMediaFigure({
        subscribe: jest.fn(),
        classes: '',
        isVideo: false,
        $: jest.fn(() => null),
      })

      expect(ioSpy).not.toHaveBeenCalled()

      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
      mountMediaFigure({
        subscribe: jest.fn(),
        classes: '',
        isVideo: true,
        $: jest.fn(() => document.createElement(HTML_TAGS.VIDEO)),
        addScopedListener: jest.fn(),
      })

      expect(ioSpy).not.toHaveBeenCalled()

      // Video component without a <video> node skips listener wiring.
      mountMediaFigure({
        subscribe: jest.fn(),
        classes: '',
        isVideo: true,
        $: jest.fn(() => null),
      })
    } finally {
      delete navigator.connection
      globalThis.IntersectionObserver = IO
    }
  })

  test('expand arm mounts corner brackets and routes figure clicks to openModal', () => {
    const fig = document.createElement(HTML_TAGS.FIGURE)
    const openBtn = document.createElement(HTML_TAGS.BUTTON)
    const listeners = {}
    const c = {
      subscribe: jest.fn(),
      classes: '',
      canExpand: true,
      isVideo: false,
      $: jest.fn((sel) =>
        sel === HTML_TAGS.FIGURE
          ? fig
          : sel === `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_1}`
            ? openBtn
            : null
      ),
      addScopedListener: jest.fn((el, evt, cb) => {
        listeners[evt] = cb
      }),
      openModal: jest.fn(),
      classList: { add: jest.fn() },
      isLoaded: true,
      imgObserver: null,
      loadHighRes: jest.fn(),
      warmed: true,
      warmObserver: null,
      _expandBrackets: null,
    }

    mountMediaFigure(c)

    listeners[MOUSE_EVENTS.CLICK]()

    expect(c.openModal).toHaveBeenCalled()
  })

  test('img arm defers high-res loading until scrolling settles', async () => {
    const IO = globalThis.IntersectionObserver
    const ioCbs = []

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCbs.push(cb)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
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
        isLoaded: true,
        isConnected: true,
        imgObserver: null,
        loadHighRes: jest.fn(),
        // warmFirstRung parks its own warmObserver on the component —
        // pre-warmed so its callback short-circuits here.
        warmed: true,
        warmObserver: null,
      }

      mountMediaFigure(c)

      // Pooled observers share one IntersectionObserver across figures —
      // the handle's callback delivers entries to this figure's handler
      // the same way its old private observer did, including after the
      // one-shot disconnect clears the field.
      const imgHandle = c.imgObserver

      const imgCb = (entries) => imgHandle.callback(entries)

      // Already-loaded figure ignores the intersecting entry.
      imgCb([{ isIntersecting: true }])

      expect(c.loadHighRes).not.toHaveBeenCalled()

      // The first intersection parks the quality climb until scroll-end and
      // disconnects; subsequent entries hit the cleared-observer arm.
      c.isLoaded = false

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
      imgCb([{ isIntersecting: true }])

      expect(c.loadHighRes).not.toHaveBeenCalled()
      expect(c.imgObserver).toBeNull()

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

      await waitFor(() => c.loadHighRes.mock.calls.length === 1)

      expect(c.loadHighRes).toHaveBeenCalledTimes(1)

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
      imgCb([{ isIntersecting: true }])
      c.isLoaded = true
      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

      await waitFor(() => !isScrolling())

      expect(c.loadHighRes).toHaveBeenCalledTimes(1)

      c.isLoaded = false
      c.isConnected = true
      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
      imgCb([{ isIntersecting: true }])
      c.isConnected = false
      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))

      await waitFor(() => !isScrolling())

      expect(c.loadHighRes).toHaveBeenCalledTimes(1)

      imgCb([{ isIntersecting: false }])
    } finally {
      globalThis.IntersectionObserver = IO
    }
  })

  test('poster-only video decoding waits for a visible scroll-stop idle slice', async () => {
    const IO = globalThis.IntersectionObserver
    const readyState = Object.getOwnPropertyDescriptor(document, 'readyState')
    const requestIdleCallback = window.requestIdleCallback
    let ioCb
    let idleCallback = null

    globalThis.IntersectionObserver = class {
      constructor(callback) {
        ioCb = callback
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    window.requestIdleCallback = (callback) => {
      idleCallback = callback

      return 1
    }

    Object.defineProperty(document, 'readyState', {
      value: STATE_STRINGS.COMPLETE,
      configurable: true,
    })
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const video = document.createElement(HTML_TAGS.VIDEO)
    video.poster = ATTR_VALUES.EMPTY

    const c = {
      subscribe: jest.fn(),
      classes: '',
      canExpand: false,
      isVideo: true,
      poster: [TEST_URLS.IMG],
      _scaledVideo: false,
      $: jest.fn((selector) => (selector === HTML_TAGS.VIDEO ? video : null)),
      addScopedListener: jest.fn(),
      isConnected: true,
      isIntersecting: false,
      observer: null,
      _ensureVideoSource: jest.fn(),
    }

    try {
      mountMediaFigure(c)

      expect(video.poster).toBe(ATTR_VALUES.EMPTY)

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
      ioCb([{ isIntersecting: true }])

      expect(video.poster).toBe(ATTR_VALUES.EMPTY)

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))
      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
      idleCallback?.()

      expect(video.poster).toBe('')

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))
      idleCallback?.()

      await waitFor(() => video.poster === TEST_URLS.IMG)

      expect(c._ensureVideoSource).not.toHaveBeenCalled()
    } finally {
      globalThis.IntersectionObserver = IO
      window.requestIdleCallback = requestIdleCallback
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

      if (readyState) Object.defineProperty(document, 'readyState', readyState)

      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLLEND))
    }
  })

  test('media deep-link title — the label appends once and restore hands the page title back', () => {
    // Clear any stash a prior open left parked so the assertions are
    // order-independent, then park the page's own title as the base.
    restoreMediaPageTitle()
    document.title = TEST_TEXT.LUIS_KROTZ

    setMediaPageTitle(TEST_TEXT.HEADING)

    expect(document.title).toBe(
      `${TEST_TEXT.LUIS_KROTZ} ${CHAR_STRINGS.PIPE_SEP} ${TEST_TEXT.HEADING}`
    )

    // A second open rebases on the parked title instead of stacking
    // suffixes — the media slug swapped, not appended onto a slug.
    setMediaPageTitle(TEST_TEXT.SECOND)

    expect(document.title).toBe(
      `${TEST_TEXT.LUIS_KROTZ} ${CHAR_STRINGS.PIPE_SEP} ${TEST_TEXT.SECOND}`
    )

    restoreMediaPageTitle()

    expect(document.title).toBe(TEST_TEXT.LUIS_KROTZ)
  })

  test('media deep-link title — falsy label keeps the title and a bare restore is a no-op', () => {
    restoreMediaPageTitle()
    document.title = TEST_TEXT.HEADING

    setMediaPageTitle('')

    expect(document.title).toBe(TEST_TEXT.HEADING)

    // Nothing was parked — restore must leave the document untouched.
    restoreMediaPageTitle()

    expect(document.title).toBe(TEST_TEXT.HEADING)
  })

  test('degenerate ladder — warm probe and small-box climb skip the original rung', async () => {
    const { warmFirstRung, loadHighRes } = await import('@website/components/media/figure/load.js')
    const { initMediaManifest } = await import('@core/utils/media/manifest.js')
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ['covers/deg.jpg'],
    }))

    // The manifest proves ONLY the original — rung 0 is the uncompressed
    // file itself, so warmFirstRung's `first.jpg === stem` guard returns
    // before any probe fires.
    await initMediaManifest()

    const probes = []
    const origImage = window.Image

    window.Image = class {
      constructor() {
        probes.push(this)
      }
    }

    try {
      const fig = {
        isVideo: false,
        isLoaded: false,
        warmed: false,
        mediaSrc: 'covers/deg',
        _ladderBox: -1,
        clientWidth: 0,
        $$: () => [],
        classList: { add: () => {} },
      }

      // Warm arm — degenerate entry rung returns without a probe.
      warmFirstRung(fig)
      expect(probes.length).toBe(0)
      expect(fig.warmed).toBe(true)

      // Small-box climb arm — same degenerate ladder under a ≤768px box
      // returns from loadHighRes before probing (the `smallMediaBox`
      // operand needs a positive width, so stub the memoized box read).
      fig._ladderBox = 320
      fig.highResSrc = ''
      await loadHighRes(fig)
      expect(probes.length).toBe(0)
    } finally {
      window.Image = origImage
      globalThis.fetch = realFetch
    }
  })

  test('IO video attach rides requestIdleCallback when the API exists', async () => {
    const vid = document.createElement(HTML_TAGS.VIDEO)

    vid.play = jest.fn(() => Promise.resolve())
    vid.load = () => {}

    let ioCb = null
    const IO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe() {}
      disconnect() {}
    }

    const ricCalls = []
    const savedRic = window.requestIdleCallback

    window.requestIdleCallback = (cb) => {
      ricCalls.push(cb)
      cb()
    }

    try {
      const c = {
        subscribe: jest.fn(),
        classes: '',
        canExpand: false,
        isVideo: true,
        $: jest.fn((sel) => (sel === HTML_TAGS.VIDEO ? vid : null)),
        addScopedListener: jest.fn(),
        openModal: jest.fn(),
        playVideo: jest.fn(),
        pauseVideo: jest.fn(),
        classList: { add: jest.fn() },
        displayWidth: 0,
        displayHeight: 0,
        isLoaded: false,
        imgObserver: null,
        observer: null,
        isIntersecting: false,
        _ensureVideoSource: jest.fn(),
        warmed: true,
        warmObserver: null,
      }

      mountMediaFigure(c)

      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)
      store.state.preferencesOpen = false

      ioCb([{ isIntersecting: true }])

      expect(ricCalls.length).toBe(1)
      expect(c._ensureVideoSource).toHaveBeenCalledWith(vid)

      // Store sync while NOT intersecting — syncVideoPlayback's pause
      // arm: a preference flip on a parked video must not start it.
      ioCb([{ isIntersecting: false }])
      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, false)
      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)

      // Fallback arm — engines without requestIdleCallback take the
      // setTimeout(0) defer instead.
      delete window.requestIdleCallback
      ioCb([{ isIntersecting: true }])
      await new Promise((r) => setTimeout(r, 0))

      expect(c._ensureVideoSource).toHaveBeenCalledTimes(2)
    } finally {
      window.requestIdleCallback = savedRic
      globalThis.IntersectionObserver = IO
      vid.remove()
    }
  })

  test('IO deferred start drops a superseded observer and tolerates non-promise play', () => {
    const vid = document.createElement(HTML_TAGS.VIDEO)

    vid.play = jest.fn(() => Promise.resolve())
    vid.load = () => {}

    let ioCb = null
    const IO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe() {}
      disconnect() {}
    }

    // The rIC stub CAPTURES the deferred start instead of running it —
    // the test controls exactly when the queued frame lands.
    const queued = []
    const savedRic = window.requestIdleCallback

    window.requestIdleCallback = (cb) => queued.push(cb)

    const mountable = () => ({
      subscribe: jest.fn(),
      classes: '',
      canExpand: false,
      isVideo: true,
      $: jest.fn((sel) => (sel === HTML_TAGS.VIDEO ? vid : null)),
      addScopedListener: jest.fn(),
      openModal: jest.fn(),
      playVideo: jest.fn(),
      pauseVideo: jest.fn(),
      classList: { add: jest.fn() },
      displayWidth: 0,
      displayHeight: 0,
      isLoaded: false,
      imgObserver: null,
      observer: null,
      isIntersecting: false,
      _ensureVideoSource: jest.fn(),
      warmed: true,
      warmObserver: null,
    })

    try {
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
      store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)
      store.state.preferencesOpen = false

      const c = mountable()

      mountMediaFigure(c)

      // Stale arm — the observer is replaced before the queued start
      // runs, so the deferred work must bail: no source attach, no play.
      ioCb([{ isIntersecting: true }])
      c.observer = { disconnect: jest.fn() }
      queued.shift()()

      expect(c._ensureVideoSource).not.toHaveBeenCalled()
      expect(vid.play).not.toHaveBeenCalled()

      // Non-promise arm — a play() that returns undefined has no
      // rejection surface; the deferred start must not throw chaining
      // .catch on it (older WebKit + stub media elements).
      const c2 = mountable()

      mountMediaFigure(c2)
      Object.defineProperty(vid, 'paused', { value: true, configurable: true })
      vid.play = jest.fn(() => undefined)
      ioCb([{ isIntersecting: true }])
      queued.shift()()

      expect(c2._ensureVideoSource).toHaveBeenCalledWith(vid)
      expect(vid.play).toHaveBeenCalled()
    } finally {
      window.requestIdleCallback = savedRic
      globalThis.IntersectionObserver = IO
      vid.remove()
    }
  })
})
