/**
 * @file media-progressive-mediafigure-tails.test.js
 * @description Split from media-progressive.test.js — covers the "MediaFigure tails" describe.
 */
import { jest } from '@jest/globals'
import '@website/components/media/MediaFigure.js'
import store from '@core/store.js'
import { TEST_PROJECTS, TEST_TEXT, TEST_URLS, waitFor } from '@tests/fixtures/test-constants.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { IMAGE_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { MEDIA_EVENTS, MOUSE_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

// Get the actual storage URL the store is configured with
// (production Firebase Storage URL — not a mock)
const _ACTUAL_STORAGE = store.getters.getStorage?.() || CDN_URLS.CDN_BASE

// ─── MediaFigure tails ───────────────────────────────────────────────────────
describe('MediaFigure tails', () => {
  const mount = (attrs = {}) => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)

    document.body.appendChild(el)

    return el
  }

  const videoAttrs = () => ({
    [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND,
    [MEDIA_ATTRS.CAN_EXPAND]: ATTR_VALUES.TRUE,
    [FORM_ATTRS.LABEL]: TEST_TEXT.HEADING,
  })

  const stubPaused = (vid, value) => {
    try {
      Object.defineProperty(vid, 'paused', { value, writable: true, configurable: true })
    } catch {
      vid.paused = value
    }
  }

  test('video listeners drive play, pause, loadeddata and error arms', async () => {
    const el = mount({ ...videoAttrs(), [MEDIA_ATTRS.WIDTH]: '0', [MEDIA_ATTRS.HEIGHT]: '0' })
    const vid = el.$(HTML_TAGS.VIDEO)

    expect(vid).toBeTruthy()

    vid.play = () => Promise.resolve()
    vid.pause = () => {}
    vid.load = () => {}

    vid.dispatchEvent(new window.Event(MOUSE_EVENTS.MOUSEENTER))
    await Promise.resolve()
    await Promise.resolve()

    vid.play = () => Promise.reject(new Error(CHAR_STRINGS.EMPTY))
    vid.dispatchEvent(new window.Event(MOUSE_EVENTS.MOUSEENTER))
    await Promise.resolve()
    await Promise.resolve()

    vid.dispatchEvent(new window.Event(MOUSE_EVENTS.MOUSELEAVE))
    vid.dispatchEvent(new window.Event(MEDIA_EVENTS.LOADEDDATA))

    vid.removeAttribute(MEDIA_ATTRS.POSTER)
    vid.dispatchEvent(new window.Event(WINDOW_EVENTS.ERROR))

    vid.setAttribute(MEDIA_ATTRS.POSTER, TEST_URLS.A)
    vid.dispatchEvent(new window.Event(WINDOW_EVENTS.ERROR))

    el.remove()
  })

  test('ambient video exposes the toggle contract (widget role + playback state)', () => {
    const el = mount(videoAttrs())
    const vid = el.$(HTML_TAGS.VIDEO)

    // element_tabbable_role_valid: a tabbable element needs a widget
    // role — Space/Enter toggles playback. <video> accepts only the
    // application role (button is rejected by aria-allowed-role) and
    // aria-pressed is button-only and the a11y checker predates
    // aria-description, so state folds into the accessible name.
    expect(vid.getAttribute(ARIA_ATTRS.ROLE)).toBe(ARIA_ATTRS.ROLE_APPLICATION)
    expect(vid.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain(STATE_STRINGS.PAUSED)

    vid.dispatchEvent(new window.Event(MEDIA_EVENTS.PLAY))
    expect(vid.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain(STATE_STRINGS.PLAYING)

    vid.dispatchEvent(new window.Event(MEDIA_EVENTS.PAUSE))
    expect(vid.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toContain(STATE_STRINGS.PAUSED)

    el.remove()
  })

  test('_ensureVideoSource covers early return, append and no-fallback arms', () => {
    const el = mount(videoAttrs())
    const vid = el.$(HTML_TAGS.VIDEO)

    vid.load = () => {}

    el._ensureVideoSource(vid)
    el._ensureVideoSource(null)

    vid.querySelectorAll(MEDIA_ATTRS.SOURCE).forEach((s) => s.remove())
    el._ensureVideoSource(vid)

    // Two tiers → webm main, webm fallback, mp4 main, mp4 fallback.
    expect(vid.querySelectorAll(MEDIA_ATTRS.SOURCE).length).toBe(4)

    el.video = [TEST_URLS.A]
    el.videoWebm = [TEST_URLS.B]

    vid.querySelectorAll(MEDIA_ATTRS.SOURCE).forEach((s) => s.remove())
    el._ensureVideoSource(vid)

    // No-fallback arm — one webm + one mp4 source.
    expect(vid.querySelectorAll(MEDIA_ATTRS.SOURCE).length).toBe(2)

    el.remove()
  })

  test('_ensureVideoSource leads with the scaled pair when the box is small', () => {
    const el = mount({ ...videoAttrs(), [MEDIA_ATTRS.WIDTH]: '4000' })
    const vid = el.$(HTML_TAGS.VIDEO)

    vid.load = () => {}

    vid.querySelectorAll(MEDIA_ATTRS.SOURCE).forEach((s) => s.remove())

    el.video = [TEST_URLS.A, TEST_URLS.B]
    el.videoWebm = [TEST_URLS.IMG, TEST_URLS.VIDEO]
    el._ensureVideoSource(vid)

    const srcs = vid.querySelectorAll(MEDIA_ATTRS.SOURCE)

    // prefersScaledVideo arm — scaled webm + scaled mp4 lead the list,
    // then the full-quality pair, so a small box never commits to 4K.
    expect(srcs[0].src).toBe(TEST_URLS.VIDEO)
    expect(srcs[1].src).toBe(TEST_URLS.B)
    expect(srcs[2].src).toBe(TEST_URLS.IMG)
    expect(srcs[3].src).toBe(TEST_URLS.A)

    el.remove()
  })

  test('video observer arms: intersecting, leaving, paused guards', () => {
    const el = mount(videoAttrs())
    const vid = el.$(HTML_TAGS.VIDEO)

    vid.play = () => Promise.resolve()
    vid.pause = () => {}
    vid.load = () => {}

    const obs = el.observer

    expect(obs).toBeTruthy()

    stubPaused(vid, false)
    obs.callback([{ isIntersecting: false, target: vid }])
    obs.callback([{ isIntersecting: true, target: vid }])

    stubPaused(vid, true)
    obs.callback([{ isIntersecting: false, target: vid }])

    vid.play = () => Promise.reject(new Error(CHAR_STRINGS.EMPTY))
    obs.callback([{ isIntersecting: true, target: vid }])

    el.remove()
  })

  test('reduced-motion video loads only its poster after it enters view', async () => {
    const priorReduced = store.getters.getReducedMotion()
    const readyState = Object.getOwnPropertyDescriptor(document, 'readyState')

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    Object.defineProperty(document, 'readyState', {
      value: STATE_STRINGS.COMPLETE,
      configurable: true,
    })

    const el = mount(videoAttrs())
    const vid = el.$(HTML_TAGS.VIDEO)

    expect(el.observer).toBeTruthy()
    expect(vid.getAttribute(MEDIA_ATTRS.POSTER)).toBe(ATTR_VALUES.EMPTY)

    try {
      await waitFor(() => Boolean(vid.poster))

      expect(vid.querySelector(MEDIA_ATTRS.SOURCE)).toBeNull()
    } finally {
      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, priorReduced)

      if (readyState) Object.defineProperty(document, 'readyState', readyState)

      el.remove()
    }
  })

  test('onStoreUpdate handles autoplay toggles and missing video', () => {
    const el = mount(videoAttrs())
    const vid = el.$(HTML_TAGS.VIDEO)

    vid.play = () => Promise.resolve()
    vid.pause = () => {}
    vid.load = () => {}

    el.playVideo(null)
    el.pauseVideo(null)

    const bareVid = mount(videoAttrs())
    const origVidQ = bareVid.$

    bareVid.$ = () => null
    bareVid.onMounted()
    bareVid.$ = origVidQ
    bareVid.remove()

    stubPaused(vid, false)
    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, false)

    stubPaused(vid, true)
    el.onStoreUpdate()

    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)

    vid.play = () => Promise.reject(new Error(CHAR_STRINGS.EMPTY))

    el.isIntersecting = true
    el.onStoreUpdate()

    el.isIntersecting = false
    el.onStoreUpdate()

    // An open expand modal pauses background playback even with
    // autoplay on — the page is inert under the dialog's top layer.
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: true })

    let pauses = 0

    vid.pause = () => {
      pauses++
    }

    stubPaused(vid, false)
    el.isIntersecting = true
    el.onStoreUpdate()

    expect(pauses).toBe(1)

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    const origQ = el.$

    el.$ = () => null
    el.onStoreUpdate()
    el.$ = origQ

    const img = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    img.onStoreUpdate()
    img.remove()
    el.remove()
  })

  test('image observer arms: non-intersecting, loaded, disconnect guard', async () => {
    const el = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })
    const obs = el.imgObserver

    expect(obs).toBeTruthy()

    obs.callback([{ isIntersecting: false, target: el }])

    el.isLoaded = false
    obs.callback([{ isIntersecting: true, target: el }])

    el.isLoaded = true
    obs.callback([{ isIntersecting: true, target: el }])

    el.isLoaded = false
    el.imgObserver = null
    obs.callback([{ isIntersecting: true, target: el }])

    el.remove()

    const bare = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })
    const origQ = bare.$

    bare.$ = (sel) => (sel === `.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}` ? null : origQ.call(bare, sel))
    bare.onMounted()

    bare.$ = () => null
    bare.onMounted()

    bare.remove()
  })

  test('loadHighRes covers every guard and finish arm', async () => {
    const overBudgetEdge = String(Math.sqrt(IMAGE_DIMENSIONS.MAX_DECODE_PIXELS) + 1)
    const el = mount({
      [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND,
      [MEDIA_ATTRS.WIDTH]: overBudgetEdge,
      [MEDIA_ATTRS.HEIGHT]: overBudgetEdge,
    })

    const vid = mount(videoAttrs())

    const loaded = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    loaded.isLoaded = true
    await loaded.loadHighRes()
    loaded.remove()

    const nan = mount({
      [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND,
      [MEDIA_ATTRS.WIDTH]: 'nan-x',
      [MEDIA_ATTRS.HEIGHT]: 'nan-y',
    })
    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      // Over-budget source: the fetch still runs (big files must not pin
      // on the blurred thumb) — only the GPU texture upload is skipped.
      el.isLoaded = false
      await el.loadHighRes()
      inst.onload()

      expect(el.isLoaded).toBe(true)
      expect(el.highResSrc).toContain(TEST_TEXT.SECOND)

      vid.isLoaded = false
      await vid.loadHighRes()

      nan.isLoaded = false
      await nan.loadHighRes()

      nan.$(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)?.remove()
      inst.onload()

      expect(nan.isLoaded).toBe(true)

      nan.isLoaded = false
      await nan.loadHighRes()

      // webp 404 → jpg retry arm: first error swaps the probed src.
      inst.onerror()

      expect(nan.isLoaded).toBe(false)
      expect(inst.src.endsWith(MEDIA.EXT)).toBe(true)

      // jpg failure is terminal — the shimmer releases regardless.
      inst.onerror()

      expect(nan.isLoaded).toBe(true)

      nan.isLoaded = false
      delete globalThis.Image

      await nan.loadHighRes()
    } finally {
      window.Image = origImage
      globalThis.Image = origImage
    }

    nan.remove()
    vid.remove()
    el.remove()
  })

  test('loadHighRes accepts tall narrow screenshots within the pixel budget', async () => {
    const squareEdge = Math.sqrt(IMAGE_DIMENSIONS.MAX_DECODE_PIXELS)
    const width = squareEdge / 2
    const height = IMAGE_DIMENSIONS.MAX_DECODE_PIXELS / width
    const el = mount({
      [MEDIA_ATTRS.SRC]: TEST_PROJECTS.NATHALIA_BOND,
      [MEDIA_ATTRS.WIDTH]: String(width),
      [MEDIA_ATTRS.HEIGHT]: String(height),
    })
    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      el.isLoaded = false
      await el.loadHighRes()

      // The probe confirmed — highResSrc publishes the confirmed URL.
      inst.onload()

      expect(el.highResSrc).toContain(TEST_PROJECTS.NATHALIA_BOND)
    } finally {
      window.Image = origImage
      el.remove()
    }
  })

  test('loadHighRes finish() takes the updateDom arms without a high element', async () => {
    const el = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })
    const origQ = el.$
    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    el.$ = (sel) => (sel === `.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}` ? null : origQ.call(el, sel))

    try {
      el.isLoaded = false
      await el.loadHighRes()
      inst.onload()

      el.isLoaded = false
      el._isMounted = false

      await el.loadHighRes()
      inst.onload()
    } finally {
      el.$ = origQ
      window.Image = origImage
    }

    el.remove()
  })

  test('loadHighRes resolves without an Image constructor', async () => {
    const el = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })
    const origImage = window.Image
    const origGlobalImage = globalThis.Image
    let inst = null

    window.Image = null
    delete globalThis.Image

    try {
      el.isLoaded = false
      await el.loadHighRes()

      expect(el.isLoaded).toBe(true)

      globalThis.Image = class {
        constructor() {
          inst = this
        }
      }

      el.isLoaded = false
      await el.loadHighRes()
      inst?.onerror?.()
    } finally {
      window.Image = origImage
      globalThis.Image = origGlobalImage
    }

    el.remove()
  })

  test('openModal expands, deep-links and guards its branches', () => {
    const plain = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    plain.openModal()

    const vid = mount(videoAttrs())

    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_TEXT.SECOND}/media-old`)
    vid.openModal()

    const slug = vid.slugify(TEST_TEXT.HEADING)

    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_TEXT.SECOND}/${slug}`)
    vid.openModal()

    window.history.replaceState({}, '', ROUTE_PATHS.ABOUT)
    vid.openModal()

    window.history.replaceState({}, '', '/portfolio')
    vid.openModal()

    vid.removeAttribute(FORM_ATTRS.LABEL)
    vid.openModal()

    const img = mount({
      [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND,
      [MEDIA_ATTRS.CAN_EXPAND]: ATTR_VALUES.TRUE,
      [FORM_ATTRS.LABEL]: TEST_TEXT.HEADING,
    })

    img.openModal()

    vid.remove()
    img.remove()
    plain.remove()
  })

  test('render arms: hero classes, video preload and missing poster/fallback', () => {
    const hero = mount({
      ...videoAttrs(),
      [COMMON_ATTRS.CLASSES]: ` ${INTERNAL_CLASSES.INTERNAL_MAIN_ITEM} ${STATE_CLASSES.ACTIVE} `,
      [MEDIA_ATTRS.AUTO_PLAY]: ATTR_VALUES.TRUE,
    })

    hero.$(HTML_TAGS.FIGURE)?.dispatchEvent(new window.Event(MOUSE_EVENTS.CLICK))

    hero._updateDom()

    hero.video = [TEST_URLS.A]
    hero.poster = []
    hero._updateDom()

    hero.onInit()

    const wide = mount({
      ...videoAttrs(),
      [MEDIA_ATTRS.WIDTH]: '4000',
      [MEDIA_ATTRS.HEIGHT]: '2000',
    })

    expect(wide.displayHeight).toBeLessThan(2000)

    wide.remove()

    const img = mount({
      [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND,
      [COMMON_ATTRS.CLASSES]: ` ${INTERNAL_CLASSES.INTERNAL_MAIN_ITEM} ${STATE_CLASSES.ACTIVE} `,
      [FORM_ATTRS.LABEL]: TEST_TEXT.HEADING,
      [MEDIA_ATTRS.CAN_EXPAND]: ATTR_VALUES.TRUE,
    })

    img._updateDom()

    img.isLoaded = true
    img._updateDom()

    hero.remove()
    img.remove()
  })

  test('onDestroy disconnects live observers', () => {
    const vid = mount(videoAttrs())
    const img = mount({ [MEDIA_ATTRS.SRC]: TEST_TEXT.SECOND })

    vid.onDestroy()
    img.onDestroy()

    expect(vid.observer).toBeNull()
    expect(img.imgObserver).toBeNull()

    vid.remove()
    img.remove()
  })

  test('registration guard respects an existing custom element', async () => {
    jest.resetModules()

    await import('@website/components/media/MediaFigure.js')
  })
})
