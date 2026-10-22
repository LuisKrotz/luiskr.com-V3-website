/**
 * @file expanded-mount-tails.test.js
 * @description Coverage tails for components/media/expanded/mount.ts —
 * the CSS-zoom fallback when the genie cannot start (`!startGenieOpen`),
 * the media-width/height `|| GENERIC_DIMENSIONS` fallbacks inside
 * fitMediaItem, the shadowRoot-less deferred-mount else arm, the video
 * markLoaded listeners, and the scroll snapback's `|| 0` parked-transform
 * fallback. The genie module is mocked so startGenieOpen deterministically
 * reports "cannot start" without touching the real warp machinery.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import store from '@core/store.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { MEDIA_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

jest.unstable_mockModule('@website/components/media/expanded/genie.js', () => ({
  startGenieOpen: jest.fn(() => false),
  startGenieClose: jest.fn(() => false),
  cancelGenie: jest.fn(),
}))

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

const CONTENT_SEL = `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT}`
const ITEM_SEL = `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`
const FIGURE_SEL = `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`

/** Real elements give getComputedStyle/classList semantics for free. */
const makeEl = (over = {}) => {
  const content = document.createElement(HTML_TAGS.DIV)

  content.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT

  const mediaItem = document.createElement(HTML_TAGS.DIV)

  mediaItem.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM

  return {
    isConnected: true,
    isVideo: false,
    source: '',
    mediaWidth: 0,
    mediaHeight: 0,
    shadowRoot: null,
    isClosing: false,
    _genie: null,
    startClose: jest.fn(),
    closest: jest.fn(() => null),
    addScopedListener: jest.fn(),
    $$: jest.fn(() => []),
    $: jest.fn((sel) => (sel === CONTENT_SEL ? content : sel === ITEM_SEL ? mediaItem : null)),
    ...over,
  }
}

describe('expanded mount tails', () => {
  afterEach(() => {
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('no-genie fallback marks content CSS-zoom + falls back to generic dims', async () => {
    const { mountMediaExpanded } = await import('@website/components/media/expanded/mount.js')
    const el = makeEl()
    const content = el.$(CONTENT_SEL)

    // boundW > 0 forces fitMediaItem past the guard with mediaWidth/
    // mediaHeight = 0 → the GENERIC_DIMENSIONS fallbacks run.
    Object.defineProperty(content, 'clientWidth', { value: 480, configurable: true })

    mountMediaExpanded(el)

    // startGenieOpen returns false (mock) → legacy CSS zoom arm.
    expect(content.classList.contains(EXPAND_MODAL_CLASSES.EXPAND_MODAL_CSS_ZOOM)).toBe(true)

    await flush()

    // Deferred mounts ran with shadowRoot null → else arm; fitMediaItem
    // stamped a fitted box from the generic dims.
    expect(el.$).toHaveBeenCalled()
  })

  test('video path wires markLoaded listeners and skips play under reduced motion', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const { mountMediaExpanded } = await import('@website/components/media/expanded/mount.js')
    const vid = document.createElement(HTML_TAGS.VIDEO)
    const add = jest.fn()
    const figure = { classList: { add } }
    const el = makeEl({
      isVideo: true,
      shadowRoot: { querySelectorAll: () => [] },
      $: jest.fn((sel) => (sel === HTML_TAGS.VIDEO ? vid : sel === FIGURE_SEL ? figure : null)),
      addScopedListener: (t, e, f, o) => t.addEventListener(e, f, o),
    })

    mountMediaExpanded(el)

    await flush()

    // markLoaded — the LOADEDDATA/ERROR terminal-state handler.
    vid.dispatchEvent(new Event(MEDIA_EVENTS.LOADEDDATA))
    vid.dispatchEvent(new Event(WINDOW_EVENTS.ERROR))

    expect(add).toHaveBeenCalledWith(EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE_LOADED)
  })

  test('video path with no <video> node skips the listeners (else arm)', async () => {
    const { mountMediaExpanded } = await import('@website/components/media/expanded/mount.js')
    const el = makeEl({
      isVideo: true,
      shadowRoot: { querySelectorAll: () => [] },
      $: jest.fn(() => null),
      source: TEST_URLS.VIDEO,
    })

    mountMediaExpanded(el)

    await flush()

    expect(el.$).toHaveBeenCalled()
  })

  test('a null media-cache hit falls through to the exhausted-candidates return', async () => {
    const { mountMediaExpanded } = await import('@website/components/media/expanded/mount.js')
    const { localMediaCache } = await import('@core/utils/media/local-media-cache.js')
    const spy = jest.spyOn(localMediaCache, 'fetchOrGetLocalMedia').mockResolvedValue(null)
    const el = makeEl({ source: TEST_URLS.IMG, shadowRoot: { querySelectorAll: () => [] } })

    mountMediaExpanded(el)

    // Double-rAF deferred mounts → loadFullRes → attempt(0) sees the null
    // localUrl, falls to attempt(1), which hits the candidates-length
    // early return.
    await flush(160)

    expect(spy).toHaveBeenCalledWith(TEST_URLS.IMG)

    spy.mockRestore()
  })

  test('scroll snapback falls back to 0 for a non-numeric parked transform', async () => {
    const { mountMediaExpanded } = await import('@website/components/media/expanded/mount.js')
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const el = makeEl({
      shadowRoot: { querySelectorAll: () => [] },
      addScopedListener: (t, e, f, o) => t.addEventListener(e, f, o),
    })

    mountMediaExpanded(el)

    // Parked transform is NaN → `Number(...) || 0` arm; scrollY > 1 keeps
    // the outer guard truthy so scrollTo(0, 0) snaps back.
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: true, transform: 'x' })

    const savedY = Object.getOwnPropertyDescriptor(window, 'scrollY')

    Object.defineProperty(window, 'scrollY', { value: 80, configurable: true })
    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

    await flush()

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)

    scrollSpy.mockRestore()
    if (savedY) Object.defineProperty(window, 'scrollY', savedY)
  })
})
