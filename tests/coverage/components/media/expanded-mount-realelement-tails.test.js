/**
 * @file expanded-mount-realelement-tails.test.js
 * @description Coverage tails for components/media/expanded/mount.ts driven
 * through REAL <media-expanded> element mounts (no genie mock). Two arms that
 * only register on the unmocked module instance: the `!localUrl` retry inside
 * loadFullRes's cache pipeline (a null disk-cache hit walks attempt(index+1)
 * into the exhausted-candidates return), and the video branch of
 * stampMediaBox (mediaItem gets `max-width: min(naturalW, 100%)` instead of a
 * definite width).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_EVENTS } from '@core/tokens/events/dom.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'
import '@website/components/media/MediaExpanded.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 160) => new Promise((r) => setTimeout(r, ms))

const ITEM_SEL = `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`

const mountExpanded = (attrs) => {
  const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))

  document.body.appendChild(el)

  return el
}

describe('expanded mount — real-element tails', () => {
  test('a falsy disk-cache hit walks the !localUrl retry into the candidates bound', async () => {
    const { localMediaCache } = await import('@core/utils/media/local-media-cache.js')
    const spy = jest.spyOn(localMediaCache, 'fetchOrGetLocalMedia').mockResolvedValue(null)
    const el = mountExpanded({
      [MEDIA_ATTRS.SOURCE]: TEST_URLS.IMG,
      [MEDIA_ATTRS.WIDTH]: '800',
      [MEDIA_ATTRS.HEIGHT]: '450',
    })

    // Double-rAF deferred mounts → loadFullRes → attempt(0) sees the null
    // localUrl, retries attempt(1), which returns on the candidates bound.
    await flush(240)

    expect(spy).toHaveBeenCalledWith(TEST_URLS.IMG)

    spy.mockRestore()
    el.remove()
  })

  test('a video source stamps max-width instead of a definite width', async () => {
    const el = mountExpanded({
      [MEDIA_ATTRS.SOURCE]: TEST_URLS.VIDEO,
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
      [MEDIA_ATTRS.WIDTH]: '1280',
      [MEDIA_ATTRS.HEIGHT]: '720',
    })

    await flush()

    const item = el.shadowRoot?.querySelector(ITEM_SEL)

    expect(item?.style.maxWidth).toContain('min(')

    el.remove()
  })

  test('a loaded video stream re-stamps from videoWidth/videoHeight', async () => {
    const el = mountExpanded({
      [MEDIA_ATTRS.SOURCE]: TEST_URLS.VIDEO,
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
      [MEDIA_ATTRS.WIDTH]: '1280',
      [MEDIA_ATTRS.HEIGHT]: '720',
    })

    await flush()

    const vid = el.shadowRoot?.querySelector(HTML_TAGS.VIDEO)

    expect(vid).not.toBeNull()

    Object.defineProperty(vid, 'videoWidth', { value: 320, configurable: true })
    Object.defineProperty(vid, 'videoHeight', { value: 240, configurable: true })
    // happy-dom rects are all-zero — a measured box lets the handler pin
    // the definite pixel width the fit-content figure hugs.
    vid.getBoundingClientRect = () => ({ width: 100 })
    vid.dispatchEvent(new Event(MEDIA_EVENTS.LOADEDDATA))

    await flush(40)

    expect(vid?.style.maxWidth).toContain('min(')
    expect(vid?.style.width).toBe(`100${CHAR_STRINGS.PX}`)

    el.remove()
  })

  test('a decoded image swaps src and re-stamps from naturalWidth', async () => {
    const { localMediaCache } = await import('@core/utils/media/local-media-cache.js')
    const { wasmMediaThreads } = await import('@core/utils/wasm/wasm-media-threads.js')
    const fetchSpy = jest
      .spyOn(localMediaCache, 'fetchOrGetLocalMedia')
      .mockResolvedValue('blob:local-copy')
    const decodeSpy = jest
      .spyOn(wasmMediaThreads, 'decodeMediaInSeparateThread')
      .mockResolvedValue(null)

    // A stub Image whose src assignment fires onload carrying real pixels —
    // exercises the swap()'s naturalWidth re-stamp arm.
    const RealImage = globalThis.Image
    globalThis.Image = class extends RealImage {
      set src(v) {
        Object.defineProperty(this, 'naturalWidth', { value: 96, configurable: true })
        Object.defineProperty(this, 'naturalHeight', { value: 54, configurable: true })
        queueMicrotask(() => this.onload?.())
      }
    }

    const el = mountExpanded({
      [MEDIA_ATTRS.SOURCE]: TEST_URLS.IMG,
      [MEDIA_ATTRS.WIDTH]: '800',
      [MEDIA_ATTRS.HEIGHT]: '450',
    })

    await flush(240)

    expect(el.currentSrc).toBe('blob:local-copy')

    globalThis.Image = RealImage
    fetchSpy.mockRestore()
    decodeSpy.mockRestore()
    el.remove()
  })
})
