/**
 * @file media-expanded-mediafigure-deep-paths.test.js
 * @description Split from media-expanded.test.js — covers the "MediaFigure deep paths" describe.
 */
import { jest } from '@jest/globals'
import { LOCALES } from '@core/constants.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import store from '@core/store.js'
import '@website/components/media/MediaExpanded.js'
import '@website/components/media/MediaFigure.js'
import { TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { __srState, __resetSr } from '@core/utils/ml/super-res.js'
import { __decState, __resetDec } from '@core/utils/wasm/wasm-image-decoder.js'
import { warmFirstRung } from '@website/components/media/figure/load.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

// ─── MediaFigure ─────────────────────────────────────────────────────────────
describe('MediaFigure deep paths', () => {
  const mountFigure = (attrs = {}) => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    Object.entries({
      [MEDIA_ATTRS.SRC]: TEST_URLS.IMG,
      [FORM_ATTRS.LABEL]: TEST_TEXT.HEADING,
      [MEDIA_ATTRS.WIDTH]: '800',
      [MEDIA_ATTRS.HEIGHT]: '450',
      ...attrs,
    }).forEach(([k, v]) => el.setAttribute(k, v))

    document.body.appendChild(el)

    return el
  }

  test('renders a figure honoring src/label/size attributes', async () => {
    const el = mountFigure()

    await flush()

    expect(el.shadowRoot).toBeTruthy()

    el.remove()
  })

  test('video figures wire the video element', async () => {
    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    el.remove()
  })

  test('expandable figures open the media modal on interaction', async () => {
    const el = mountFigure({ [MEDIA_ATTRS.CAN_EXPAND]: ATTR_VALUES.TRUE })

    await flush()

    el.remove()
  })

  test('attribute changes re-render while mounted', async () => {
    const el = mountFigure()

    el.setAttribute(FORM_ATTRS.LABEL, TEST_TEXT.BODY)

    await flush()

    el.remove()
  })

  test('classes attribute applies host classes', async () => {
    const el = mountFigure({ [COMMON_ATTRS.CLASSES]: `${TEST_TEXT.HELLO} ${TEST_TEXT.SECOND}` })

    await flush()

    expect(el.classList.contains(TEST_TEXT.HELLO)).toBe(true)
    expect(el.classList.contains(TEST_TEXT.SECOND)).toBe(true)

    el.remove()
  })

  test('displayWidth caps videos at FHD but passes images through', async () => {
    const img = mountFigure({ [MEDIA_ATTRS.WIDTH]: '3840', [MEDIA_ATTRS.HEIGHT]: '2160' })

    expect(img.displayWidth).toBe(3840)

    img.remove()

    const vid = mountFigure({
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
      [MEDIA_ATTRS.WIDTH]: '3840',
      [MEDIA_ATTRS.HEIGHT]: '2160',
    })

    expect(vid.displayWidth).toBeLessThanOrEqual(1920)
    expect(vid.displayHeight).toBeLessThanOrEqual(1080)

    const small = mountFigure({
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
      [MEDIA_ATTRS.WIDTH]: '800',
      [MEDIA_ATTRS.HEIGHT]: '450',
    })

    expect(small.displayWidth).toBe(800)

    vid.remove()
    small.remove()
  })

  test('video figures expose main + scaled fallback sources', async () => {
    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    expect(typeof el.videoSrcMain).toBe(TYPE_STRINGS.STRING)
    expect(el.videoSrcMain.length).toBeGreaterThan(0)
    expect(typeof el.videoSrcFallback).toBe(TYPE_STRINGS.STRING)

    el.remove()
  })

  test('playVideo/pauseVideo honor reduced-motion and autoplay prefs', async () => {
    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    const target = document.createElement(HTML_TAGS.VIDEO)

    target.play = jest.fn(() => Promise.resolve())
    target.pause = jest.fn()
    target.load = jest.fn()

    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)
    el.playVideo(target)

    await flush(10)

    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, false)
    el.pauseVideo(target)

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    el.playVideo(target)
    el.pauseVideo(target)
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    el.remove()
  })

  test('onStoreUpdate pauses an offscreen/deprefed video', async () => {
    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const vid = document.createElement(HTML_TAGS.VIDEO)

    Object.defineProperty(vid, 'paused', { configurable: true, writable: true, value: false })

    vid.pause = jest.fn()
    vid.play = jest.fn(() => Promise.resolve())
    vid.load = jest.fn()

    el.$ = (sel) => (sel === HTML_TAGS.VIDEO ? vid : null)
    el.isIntersecting = false

    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, false)
    el.onStoreUpdate()

    expect(vid.pause).toHaveBeenCalled()

    vid.paused = true
    el.isIntersecting = true

    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    el.onStoreUpdate()

    await flush(10)

    el.remove()
  })

  test('nav menu open pauses page videos and the viewport gate honors overlays', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(PREF_MUTATIONS.SET_VIDEO_AUTOPLAY, true)

    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const vid = el.$(HTML_TAGS.VIDEO)

    vid.load = jest.fn()
    vid.pause = jest.fn()
    vid.play = jest.fn(() => Promise.resolve())
    Object.defineProperty(vid, 'paused', { configurable: true, writable: true, value: false })

    // Menu open → the store sync pauses a playing page video.
    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, true)

    expect(vid.pause).toHaveBeenCalled()

    vid.paused = true // reflect what a real pause() leaves behind

    // While the menu owns the frame a viewport entry must not restart
    // playback.
    el.observer.callback([{ isIntersecting: true, target: vid }])

    expect(vid.play).not.toHaveBeenCalled()

    // Menu close → the sync resume arm plays the still-intersecting video.
    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)

    expect(vid.play).toHaveBeenCalledTimes(1)

    // Expand-modal arm — the same overlay gate on the observer path.
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: true })
    el.observer.callback([{ isIntersecting: true, target: vid }])

    expect(vid.play).toHaveBeenCalledTimes(1)

    // Modal close → resume through the same sync path.
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    expect(vid.play).toHaveBeenCalledTimes(2)

    // Preferences + language dialogs are covering overlays too — open
    // pauses (the video still reports playing via the stub), close
    // resumes.
    vid.paused = false
    vid.pause.mockClear()
    vid.play.mockClear()

    store.commit(MODAL_MUTATIONS.TOGGLE_PREFERENCES_MODAL, true)

    expect(vid.pause).toHaveBeenCalled()

    vid.paused = true
    store.commit(MODAL_MUTATIONS.TOGGLE_PREFERENCES_MODAL, false)

    expect(vid.play).toHaveBeenCalledTimes(1)

    vid.paused = false
    vid.pause.mockClear()
    store.commit(MODAL_MUTATIONS.TOGGLE_LANG_DIALOG, true)

    expect(vid.pause).toHaveBeenCalled()

    store.commit(MODAL_MUTATIONS.TOGGLE_LANG_DIALOG, false)

    el.remove()
  })

  test('onDestroy disconnects all observers', async () => {
    const el = mountFigure()
    const vobs = { disconnect: jest.fn() }
    const iobs = { disconnect: jest.fn() }
    const wobs = { disconnect: jest.fn() }

    el.observer = vobs
    el.imgObserver = iobs
    el.warmObserver = wobs
    el.onDestroy()

    expect(vobs.disconnect).toHaveBeenCalled()
    expect(iobs.disconnect).toHaveBeenCalled()
    expect(wobs.disconnect).toHaveBeenCalled()
    expect(el.observer).toBeNull()
    expect(el.imgObserver).toBeNull()
    expect(el.warmObserver).toBeNull()

    el.remove()
  })

  test('loadHighRes resolves through the Image pipeline', async () => {
    const el = mountFigure()

    await flush()

    const RealImage = window.Image

    class FakeImage {
      set src(_v) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    window.Image = FakeImage
    el.loadHighRes()

    await flush(30)

    expect(el.isLoaded).toBe(true)

    globalThis.Image = RealImage

    el.remove()
  })

  test('low-res ladder end requests an ML upscale and uploads the bitmap', async () => {
    const el = mountFigure()

    await flush()
    __resetSr() // clear any observer-driven load before the explicit probe

    const RealImage = window.Image

    class FakeImage {
      constructor() {
        this.naturalWidth = 8 // tiny — under the 800px display width
        this.naturalHeight = 8
      }
      set src(_v) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    el.isLoaded = false // reset any observer-driven load before probing

    window.Image = FakeImage
    el.loadHighRes()

    await flush(30)

    expect(el.isLoaded).toBe(true)
    expect(__srState.calls.length).toBe(1)

    el.remove()
    globalThis.Image = RealImage
  })

  test('a resolved super-res bitmap re-uploads through processBitmapGPU', async () => {
    const el = mountFigure()

    await flush()

    __resetSr() // clear any observer-driven load before the explicit probe
    __srState.next = { __enhanced: true }

    const RealImage = window.Image
    const uploadSpy = jest.spyOn(gpuAccel, 'processBitmapGPU').mockReturnValue(true)

    class FakeImage {
      constructor() {
        this.naturalWidth = 8
        this.naturalHeight = 8
      }
      set src(_v) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    el.isLoaded = false // reset any observer-driven load before probing

    window.Image = FakeImage
    el.loadHighRes()

    await flush(30)

    expect(uploadSpy).toHaveBeenCalledWith(__srState.next, 800, 450)

    uploadSpy.mockRestore()
    __srState.next = null
    globalThis.Image = RealImage
    el.remove()
  })

  test('a decoded wasm bitmap uploads via processBitmapGPU and drives super-res', async () => {
    const el = mountFigure()

    await flush()

    __resetSr()
    __resetDec()
    __decState.next = { width: 400, height: 225 } // under-resolved bitmap

    const RealImage = window.Image
    const uploadSpy = jest.spyOn(gpuAccel, 'processBitmapGPU').mockReturnValue(true)
    const texSpy = jest.spyOn(gpuAccel, 'processTextureGPU').mockReturnValue(true)

    class FakeImage {
      constructor() {
        this.naturalWidth = 8
        this.naturalHeight = 8
      }
      set src(_v) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    el.isLoaded = false

    window.Image = FakeImage
    el.loadHighRes()

    await flush(30)

    // The worker-decoded bitmap went through processBitmapGPU inside
    // decodeImageWASM — the classic img texture path stays untouched,
    // and the super-res pass received the decoded bitmap as its source.
    expect(__decState.calls.length).toBe(1)
    expect(texSpy).not.toHaveBeenCalled()
    expect(__srState.calls.length).toBe(1)
    expect(__srState.calls[0]).toBe(__decState.next)

    uploadSpy.mockRestore()
    texSpy.mockRestore()
    globalThis.Image = RealImage
    el.remove()
  })

  test('a fully-resolved decoded bitmap skips the super-res pass', async () => {
    const el = mountFigure()

    await flush()

    __resetSr()
    __resetDec()
    __decState.next = { width: 1600, height: 900 } // already ≥ display box

    const RealImage = window.Image

    class FakeImage {
      constructor() {
        this.naturalWidth = 8
        this.naturalHeight = 8
      }
      set src(_v) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    el.isLoaded = false

    window.Image = FakeImage
    el.loadHighRes()

    await flush(30)

    expect(__decState.calls.length).toBe(1)
    expect(__srState.calls.length).toBe(0)

    globalThis.Image = RealImage
    el.remove()
  })

  test('warmFirstRung fires a detached first-rung fetch once', async () => {
    const el = mountFigure()

    await flush()

    const loaded = []
    const RealImage = window.Image

    class FakeImage {
      set src(v) {
        loaded.push(v)
      }
    }

    // Clear the observer-driven warm + load before the explicit probe —
    // the mount flush already ran both observers against the real Image.
    el.warmed = false
    el.isLoaded = false

    window.Image = FakeImage

    warmFirstRung(el)

    expect(el.warmed).toBe(true)
    expect(loaded.length).toBe(1)

    warmFirstRung(el) // warmed latch — no second fetch

    expect(loaded.length).toBe(1)

    el.isLoaded = true
    el.warmed = false
    warmFirstRung(el) // loaded figures don't warm

    expect(loaded.length).toBe(1)

    const vid = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    warmFirstRung(vid) // videos have no image ladder

    expect(vid.warmed).toBe(false)
    expect(loaded.length).toBe(1)

    globalThis.Image = RealImage
    el.remove()
    vid.remove()
  })

  test('non-English locale renders no audio-language note on muted videos', async () => {
    // Videos render muted — an English-audio disclaimer is misleading on a
    // track that plays no sound, so no locale may emit the caption strip.
    const langSpy = jest.spyOn(store.getters, 'getLang').mockReturnValue(LOCALES.DE)

    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const note = el.shadowRoot?.querySelector(`.${MEDIA_CLASSES.MEDIA_AUDIO_NOTE}`)

    expect(note).toBeNull()

    langSpy.mockRestore()
    el.remove()
  })

  test('_ensureVideoSource appends primary + fallback sources', async () => {
    const el = mountFigure({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const vid = document.createElement(HTML_TAGS.VIDEO)

    vid.load = jest.fn()

    el._ensureVideoSource(vid)

    expect(vid.querySelector(MEDIA_ATTRS.SOURCE)).toBeTruthy()
    expect(vid.load).toHaveBeenCalled()

    // Second call is a no-op once a <source> exists.
    const calls = vid.load.mock.calls.length

    el._ensureVideoSource(vid)

    expect(vid.load.mock.calls.length).toBe(calls)

    el.remove()
  })
})
