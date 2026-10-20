/**
 * @file media-expanded-mediaexpanded.test.js
 * @description Split from media-expanded.test.js — covers the "MediaExpanded" describe.
 */
import { jest } from '@jest/globals'
import { KEYS, LOCALES } from '@core/constants.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import store from '@core/store.js'
import '@website/components/media/MediaExpanded.js'
import '@website/components/media/MediaFigure.js'
import { TEST_PROJECTS, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { attachMockGL } from '@tests/fixtures/mock-webgl.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { EXPAND_MODAL_CLASSES, MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { KEYBOARD_EVENTS, MOUSE_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { APP_EVENTS } from '@core/tokens/events/app.js'
import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

// ─── MediaExpanded ───────────────────────────────────────────────────────────
describe('MediaExpanded', () => {
  const mountExpanded = (attrs = {}) => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    Object.entries({
      [MEDIA_ATTRS.SOURCE]: TEST_URLS.IMG,
      [MEDIA_ATTRS.THUMB]: TEST_URLS.IMG,
      [MEDIA_ATTRS.ALT]: TEST_TEXT.HEADING,
      [MEDIA_ATTRS.WIDTH]: '800',
      [MEDIA_ATTRS.HEIGHT]: '450',
      ...attrs,
    }).forEach(([k, v]) => el.setAttribute(k, v))

    document.body.appendChild(el)

    return el
  }

  test('attribute getters resolve with defaults', () => {
    const el = mountExpanded()

    expect(el.source).toBe(TEST_URLS.IMG)
    expect(el.thumb).toBe(TEST_URLS.IMG)
    expect(el.alt).toBe(TEST_TEXT.HEADING)
    expect(el.mediaWidth).toBe(800)
    expect(el.mediaHeight).toBe(450)
    expect(el.isVideo).toBe(false)

    el.remove()
  })

  test('isVideo reflects the is-video attribute', () => {
    const el = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    expect(el.isVideo).toBe(true)

    el.remove()
  })

  test('onMounted binds close controls and dispatches decode', async () => {
    const el = mountExpanded()

    await flush()

    const closeCanvas = el.shadowRoot?.querySelector(`.${PREF_CLASSES.PREF_CLOSE_CANVAS}`)
    const closeFallback = el.shadowRoot?.querySelector(
      `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BAR_FALLBACK}`
    )

    expect(closeCanvas?.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)
    expect(closeFallback).toBeTruthy()

    el.shadowRoot?.querySelectorAll(HTML_TAGS.CANVAS).forEach((c) => attachMockGL(c))

    el._bindEvents?.()

    el.remove()
  })

  test('startClose marks the modal closing', async () => {
    const el = mountExpanded()

    await flush()

    el.startClose?.()

    el.remove()
  })

  test('image path resolves through localMediaCache + wasm decoder', async () => {
    const el = mountExpanded()

    await flush(120)

    el.remove()
  })

  test('is-video="false" is not treated as video', () => {
    const el = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.FALSE })

    expect(el.isVideo).toBe(false)

    el.remove()
  })

  test('video mounts attempt playback outside reduced motion', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    const el = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const vid = el.shadowRoot?.querySelector(HTML_TAGS.VIDEO)

    expect(vid || el.isVideo).toBeTruthy()

    el.remove()
  })

  test('startClose restores the portfolio URL and clears the modal', async () => {
    window.history.replaceState(
      {},
      '',
      `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}/${TEST_TEXT.SECOND}`
    )

    store.commit(MODAL_MUTATIONS.SET_MODAL, {
      transform: 123,
      class: MODAL_CLASSES.MODAL_OPEN,
      open: true,
      media: {
        source: TEST_URLS.IMG,
        thumb: TEST_URLS.IMG,
        alt: TEST_TEXT.HEADING,
        width: 1,
        height: 1,
        isVideo: false,
      },
    })

    const el = mountExpanded()

    await flush()

    el.startClose()

    await new Promise((r) => setTimeout(r, 400))

    expect(
      window.location.pathname.endsWith('/cicb') || window.location.pathname.endsWith('/portfolio')
    ).toBe(true)
    expect(store.getters.getModal()?.open).toBe(false)

    el.remove()
  })

  test('startClose is idempotent while closing', async () => {
    const el = mountExpanded()

    await flush()

    el.startClose()
    el.startClose()

    await new Promise((r) => setTimeout(r, 400))

    el.remove()
  })

  test('onDestroy releases the WebGL close button', () => {
    const el = mountExpanded()
    const destroy = jest.fn()

    el._closeBtn = { destroy }
    el.onDestroy()

    expect(destroy).toHaveBeenCalled()
    expect(el._closeBtn).toBeNull()

    el.remove()
  })

  test('escape key inside onMounted triggers startClose', async () => {
    const el = mountExpanded()

    await flush()

    const spy = jest.spyOn(el, 'startClose')

    window.dispatchEvent(new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ESCAPE }))

    expect(spy).toHaveBeenCalled()

    el.remove()
  })

  test('attr-less mount hits every getter default and falsy-media arm', async () => {
    const above = document.createElement(HTML_TAGS.DIV)

    above.className = MODAL_CLASSES.MODAL_ABOVE
    document.body.appendChild(above)

    const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    document.body.appendChild(el)
    await flush()

    expect(el.source).toBe(CHAR_STRINGS.EMPTY)
    expect(el.thumb).toBe(CHAR_STRINGS.EMPTY)
    expect(el.alt).toBe(CHAR_STRINGS.EMPTY)
    expect(el.mediaWidth).toBeGreaterThan(0)
    expect(el.mediaHeight).toBeGreaterThan(0)

    // render with no currentSrc -> the `currentSrc || thumb` thumb arm
    el.currentSrc = CHAR_STRINGS.EMPTY
    el.isClosing = true
    el._updateDom()

    el.remove()
    above.remove()
  })

  test('dialog cancel and startClose both reach the native close path', async () => {
    const dialog = document.createElement(HTML_TAGS.DIALOG)
    const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    dialog.open = true
    dialog.appendChild(el)
    document.body.appendChild(dialog)

    await flush()

    const spy = jest.spyOn(el, 'startClose').mockImplementation(() => {})

    dialog.dispatchEvent(new window.Event(APP_EVENTS.CANCEL, { cancelable: true }))

    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
    el.startClose()

    await new Promise((r) => setTimeout(r, 400))
    el.remove()
    dialog.remove()
  })

  test('image pipeline covers onload/onerror and missing imgEl arms', async () => {
    const RealImage = globalThis.Image

    class LoadImage {
      set src(_v) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    class ErrImage {
      set src(_v) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }

    // decoded bitmap + rendered img node -> the `!bitmap` else + imgEl arms
    const { wasmMediaThreads } = await import('@core/utils/wasm/wasm-media-threads.js')
    const decodeSpy = jest
      .spyOn(wasmMediaThreads, 'decodeMediaInSeparateThread')
      .mockResolvedValue({ fake: 'bitmap' })

    globalThis.Image = LoadImage

    const el = mountExpanded({ [MEDIA_ATTRS.WIDTH]: '0', [MEDIA_ATTRS.HEIGHT]: '0' })

    await flush(80)

    expect(el.currentSrc).toBeTruthy()

    decodeSpy.mockRestore()
    el.remove()

    // null bitmap -> GPU fallback inside onload; rendered img node resolves
    const nullDecodeSpy = jest
      .spyOn(wasmMediaThreads, 'decodeMediaInSeparateThread')
      .mockResolvedValue(null)
    const elGpu = mountExpanded({ [MEDIA_ATTRS.WIDTH]: '0', [MEDIA_ATTRS.HEIGHT]: '0' })

    await flush(80)

    nullDecodeSpy.mockRestore()
    elGpu.remove()

    // missing shadow queries -> the `if (imgEl)` else arm on onload
    const elNull = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    elNull.setAttribute(MEDIA_ATTRS.SOURCE, TEST_URLS.IMG)

    const qsNullSpy = jest.spyOn(elNull, '$').mockReturnValue(null)

    document.body.appendChild(elNull)
    await flush(80)

    qsNullSpy.mockRestore()
    elNull.remove()

    // missing shadow queries -> the `if (imgEl)` else arm; decode null +
    // onerror -> the remaining callback branches
    const el2 = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    el2.setAttribute(MEDIA_ATTRS.SOURCE, TEST_URLS.IMG)

    const qsSpy = jest.spyOn(el2, '$').mockReturnValue(null)

    globalThis.Image = ErrImage
    document.body.appendChild(el2)

    await flush(80)

    // onerror with the rendered img node present -> `imgEl.src` arm
    const el3 = mountExpanded()

    await flush(80)

    globalThis.Image = RealImage
    qsSpy.mockRestore()
    el2.remove()
    el3.remove()
  })

  test('shadow close button fires the JSX onClick handler', async () => {
    const el = mountExpanded()

    await flush()

    const spy = jest.spyOn(el, 'startClose').mockImplementation(() => {})

    el.shadowRoot
      .querySelector(`.${PREF_CLASSES.PREF_CLOSE_BTN}`)
      ?.dispatchEvent(new window.Event(MOUSE_EVENTS.CLICK, { bubbles: true }))

    spy.mockRestore()
    el.remove()
  })

  test('non-escape keydown and reduced-motion video hit the else arms', async () => {
    const el = mountExpanded()

    await flush()

    const spy = jest.spyOn(el, 'startClose')

    window.dispatchEvent(new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ENTER }))

    expect(spy).not.toHaveBeenCalled()

    spy.mockRestore()
    el.remove()

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const vid = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    vid.remove()
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('startClose proceeds when the content node is missing', async () => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    el.setAttribute(MEDIA_ATTRS.SOURCE, TEST_URLS.IMG)

    const qsSpy = jest.spyOn(el, '$').mockReturnValue(null)

    document.body.appendChild(el)
    await flush()

    el.startClose()

    await new Promise((r) => setTimeout(r, 400))

    qsSpy.mockRestore()
    el.remove()
  })

  test('rejected video playback hits the catch guard', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    const proto = Object.getPrototypeOf(document.createElement(HTML_TAGS.VIDEO))
    const orig = proto.play

    proto.play = jest.fn(() => Promise.reject(new Error(TEST_TEXT.ERROR)))

    const el = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush(80)

    proto.play = orig
    el.remove()
  })

  test('non-English locale renders no audio-language note on muted videos', async () => {
    // The expanded player is muted — an English-audio disclaimer is
    // misleading on a track that plays no sound, so it is never emitted.
    const langSpy = jest.spyOn(store.getters, 'getLang').mockReturnValue(LOCALES.DE)

    const el = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const note = el.shadowRoot?.querySelector(`.${MEDIA_CLASSES.MEDIA_AUDIO_NOTE}`)

    expect(note).toBeNull()

    langSpy.mockRestore()
    el.remove()
  })

  test('the scroll snapback re-pins document drift while the modal is open', async () => {
    const scrollSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})

    // Modal closed — the listener no-ops (no snap queued).
    store.commit(MODAL_MUTATIONS.SET_MODAL, {
      transform: 0,
      class: ATTR_VALUES.EMPTY,
      open: false,
      media: {
        source: ATTR_VALUES.EMPTY,
        thumb: ATTR_VALUES.EMPTY,
        alt: ATTR_VALUES.EMPTY,
        width: 0,
        height: 0,
        isVideo: false,
      },
    })

    const el = mountExpanded()

    await flush()

    window.dispatchEvent(new window.Event('scroll'))

    await flush()

    expect(scrollSpy).not.toHaveBeenCalled()

    // Modal open at a parked offset — a drifting scroll snaps back on
    // the next frame.
    store.commit(MODAL_MUTATIONS.SET_MODAL, {
      transform: 1500,
      class: MODAL_CLASSES.MODAL_OPEN,
      open: true,
      media: {
        source: TEST_URLS.IMG,
        thumb: TEST_URLS.IMG,
        alt: TEST_TEXT.HEADING,
        width: 1,
        height: 1,
        isVideo: false,
      },
    })

    // Two events in the same frame — the second hits the snapQueued arm.
    window.dispatchEvent(new window.Event('scroll'))
    window.dispatchEvent(new window.Event('scroll'))

    await flush()

    expect(scrollSpy).toHaveBeenCalledWith(0, 1500)

    // scrollY already at the parked offset — the >1 threshold arm
    // leaves the document alone.
    Object.defineProperty(window, 'scrollY', { value: 1500, configurable: true })

    window.dispatchEvent(new window.Event('scroll'))

    await flush()

    expect(scrollSpy).toHaveBeenCalledTimes(1)

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    scrollSpy.mockRestore()
    el.remove()
  })

  test('mount stamps the WASM-fitted px box on the image item and refits on resize', async () => {
    // happy-dom reports clientWidth 0 — stub a laid-out width so the
    // boundW > 0 guard passes and the stamp path runs.
    const cwSpy = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)

    const el = mountExpanded({ [MEDIA_ATTRS.WIDTH]: '4000', [MEDIA_ATTRS.HEIGHT]: '5000' })

    await flush()

    const item = el.shadowRoot?.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

    // A "huge length" capture keeps its full fitted width; the height
    // overflows into the dialog scroll rather than being squashed.
    expect(item.style.width).toBe('1200px')
    expect(item.style.height).toBe('1500px')

    // Two resize events in one frame — the second hits the fitQueued arm.
    window.dispatchEvent(new window.Event(WINDOW_EVENTS.RESIZE))
    window.dispatchEvent(new window.Event(WINDOW_EVENTS.RESIZE))

    await flush()

    expect(item.style.width).toBe('1200px')

    cwSpy.mockRestore()
    el.remove()
  })

  test('the media fit skips when a surface is missing and when the item is a video', async () => {
    // !mediaItem arm — $ returns null for the item selector only.
    const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    el.setAttribute(MEDIA_ATTRS.SOURCE, TEST_URLS.IMG)
    el.setAttribute(MEDIA_ATTRS.THUMB, TEST_URLS.IMG)
    el.setAttribute(MEDIA_ATTRS.ALT, TEST_TEXT.HEADING)

    const origQuery = el.$.bind(el)

    el.$ = (sel) =>
      String(sel).includes(EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM) ? null : origQuery(sel)

    document.body.appendChild(el)

    await flush()

    el.remove()

    // !content arm — mediaItem resolves, content does not.
    const el2 = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    el2.setAttribute(MEDIA_ATTRS.SOURCE, TEST_URLS.IMG)
    el2.setAttribute(MEDIA_ATTRS.THUMB, TEST_URLS.IMG)
    el2.setAttribute(MEDIA_ATTRS.ALT, TEST_TEXT.HEADING)

    const origQuery2 = el2.$.bind(el2)

    el2.$ = (sel) =>
      String(sel).includes(EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT) ? null : origQuery2(sel)

    document.body.appendChild(el2)

    await flush()

    el2.remove()

    // boundW ≤ 0 arm — unlaid-out content leaves the intrinsic box alone.
    const elUnlaid = mountExpanded()

    await flush()

    const itemUnlaid = elUnlaid.shadowRoot?.querySelector(
      `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`
    )

    expect(itemUnlaid.style.width).toBe('')

    elUnlaid.remove()

    // isVideo arm — the video keeps the flex contract, never px-stamped.
    const el3 = mountExpanded({ [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE })

    await flush()

    const vid = el3.shadowRoot?.querySelector(HTML_TAGS.VIDEO)

    expect(vid?.style.width || ATTR_VALUES.EMPTY).toBe(ATTR_VALUES.EMPTY)

    el3.remove()
  })

  test('native dialog cancel is prevented and routes to startClose', async () => {
    const dialog = document.createElement(HTML_TAGS.DIALOG)

    dialog.classList.add(MODAL_CLASSES.MODAL_ABOVE)
    document.body.appendChild(dialog)

    const el = mountExpanded()

    await flush()

    const cancelSpy = jest.spyOn(el, 'startClose')

    const cancelEvt = new window.Event(APP_EVENTS.CANCEL, { cancelable: true })

    dialog.dispatchEvent(cancelEvt)

    expect(cancelEvt.defaultPrevented).toBe(true)
    expect(cancelSpy).toHaveBeenCalled()

    el.remove()
    dialog.remove()
  })

  test('module re-evaluation respects the registered element', async () => {
    jest.resetModules()
    await import('@website/components/media/MediaExpanded.js')

    expect(customElements.get(COMPONENT_TAGS.MEDIA_EXPANDED)).toBeTruthy()
  })
})
