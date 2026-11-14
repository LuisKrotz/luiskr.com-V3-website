/**
 * @file media-figure-domsized-tails.test.js
 * @description Coverage tails for figure/load.ts's display-sized DOM
 * bitmap path — a confirmed rung whose source far over-resolves the
 * rendered box mounts a box-covering object URL instead of the
 * full-dimension CDN file (the tall-image decode-memory fix). Arms:
 * every early-return keeps the CDN URL (zero box, under-resolved
 * source, failed fetch, decode throw, missing 2d context, null toBlob,
 * absent createObjectURL), the success arm mounts the blob and the
 * retired layer's blob revokes on fade end, the detached-successor guard, the bitmapPath
 * capability gate, and releaseDomBlobs's early returns + destroy sweep.
 */
import '@website/components/media/MediaFigure.js'
import { releaseDomBlobs } from '@website/components/media/figure/load.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ANIMATION_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'

/**
 * Stubs the bitmap pipeline globals; returns the mutable refs plus the
 * restore function. Each test tweaks the stubs before driving a publish.
 */
const stubBitmapEnv = () => {
  const canvasProto = document.createElement('canvas').constructor.prototype

  const saved = {
    fetch: globalThis.fetch,
    createImageBitmap: globalThis.createImageBitmap,
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
    getContext: canvasProto.getContext,
    toBlob: canvasProto.toBlob,
  }

  const ctx = { drawImage: () => {} }
  const created = []

  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) })
  globalThis.createImageBitmap = async () => ({ width: 50, height: 50, close: () => {} })
  URL.createObjectURL = () => {
    const url = `blob:ds${created.length}`

    created.push(url)

    return url
  }
  URL.revokeObjectURL = () => {}
  canvasProto.getContext = () => ctx
  canvasProto.toBlob = function (cb) {
    cb(new Blob())
  }

  const restore = () => {
    globalThis.fetch = saved.fetch
    globalThis.createImageBitmap = saved.createImageBitmap
    URL.createObjectURL = saved.createObjectURL
    URL.revokeObjectURL = saved.revokeObjectURL
    canvasProto.getContext = saved.getContext
    canvasProto.toBlob = saved.toBlob
  }

  return { ctx, created, restore, canvasProto }
}

describe('media-figure dom-sized bitmap tails', () => {
  const mount = () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, TEST_TEXT.SECOND)

    document.body.appendChild(fig)

    return fig
  }

  const highSrc = async (fig) => {
    await new Promise((r) => setTimeout(r, 0))

    const highs = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

    return highs[highs.length - 1]?.getAttribute(MEDIA_ATTRS.SRC)
  }

  /**
   * Drives one probe confirm through loadHighRes with a stubbed Image
   * carrying the given natural dims, then flushes the async src assign.
   */
  const publish = async (fig, dims = { w: 1920, h: 5654 }) => {
    const origImage = window.Image
    const insts = []

    window.Image = class {
      constructor() {
        this.naturalWidth = dims.w
        this.naturalHeight = dims.h
        insts.push(this)
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()
      insts[insts.length - 1].onload()
    } finally {
      window.Image = origImage
    }

    await new Promise((r) => setTimeout(r, 0))
  }

  test('an over-resolved source mounts the box-sized object URL and revokes the superseded blob', async () => {
    const env = stubBitmapEnv()
    const revoked = []

    URL.revokeObjectURL = (u) => revoked.push(u)

    const fig = mount()

    Object.defineProperty(fig, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 100, configurable: true })

    try {
      await publish(fig)

      const firstSrc = await highSrc(fig)

      expect(firstSrc).toBe('blob:ds0')
      expect(fig._domBlobs.has('blob:ds0')).toBe(true)

      // A second confirmed rung re-encodes — the first blob stays live
      // while its mounted layer is still painting (revoking an in-flight
      // blob fetch hard-fails the img).
      await publish(fig)

      expect(await highSrc(fig)).toBe('blob:ds1')
      expect(revoked).not.toContain('blob:ds0')
      expect(fig._domBlobs.has('blob:ds1')).toBe(true)
      expect(fig._domBlobs.size).toBe(2)

      // Retiring the superseded layer releases its blob — no live img
      // references it anymore.
      const highs = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)
      const top = highs[highs.length - 1]

      top.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))
      top.dispatchEvent(new Event(ANIMATION_EVENTS.TRANSITIONEND))

      expect(revoked).toContain('blob:ds0')
      expect(fig._domBlobs.size).toBe(1)

      // Destroy sweeps the live blob.
      fig.remove()

      expect(revoked).toContain('blob:ds1')
      expect(fig._domBlobs.size).toBe(0)
    } finally {
      env.restore()
      fig.remove()
    }
  })

  test('a zero-measured box keeps the CDN url', async () => {
    const env = stubBitmapEnv()
    const fig = mount()

    try {
      await publish(fig)

      expect(await highSrc(fig)).toBe(fig.highResSrc)
      expect(fig._domBlobs.size).toBe(0)
    } finally {
      env.restore()
      fig.remove()
    }
  })

  test('a source that already fits the box keeps the CDN url', async () => {
    const env = stubBitmapEnv()
    const fig = mount()

    Object.defineProperty(fig, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 100, configurable: true })

    try {
      await publish(fig, { w: 10, h: 10 })

      expect(await highSrc(fig)).toBe(fig.highResSrc)
    } finally {
      env.restore()
      fig.remove()
    }
  })

  test('failed fetch, decode throw, missing ctx and null toBlob all keep the CDN url', async () => {
    const env = stubBitmapEnv()

    const fig = mount()

    Object.defineProperty(fig, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 100, configurable: true })

    try {
      // !res.ok arm.
      globalThis.fetch = async () => ({ ok: false })
      await publish(fig)

      expect(await highSrc(fig)).toBe(fig.highResSrc)

      // createImageBitmap throw → the catch arm.
      globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) })
      globalThis.createImageBitmap = async () => {
        throw new Error(TEST_TEXT.STALE)
      }
      await publish(fig)

      expect(await highSrc(fig)).toBe(fig.highResSrc)

      // No 2d context → bitmap closes and the CDN url mounts.
      globalThis.createImageBitmap = async () => ({ width: 50, height: 50, close: () => {} })
      env.canvasProto.getContext = () => null
      await publish(fig)

      expect(await highSrc(fig)).toBe(fig.highResSrc)

      // Null toBlob → the CDN url mounts.
      env.canvasProto.getContext = () => env.ctx
      env.canvasProto.toBlob = function (cb) {
        cb(null)
      }
      await publish(fig)

      expect(await highSrc(fig)).toBe(fig.highResSrc)
    } finally {
      env.restore()
      fig.remove()
    }
  })

  test('the capability gate keeps the synchronous assign when createObjectURL is absent or dims are zero', async () => {
    const env = stubBitmapEnv()
    const fig = mount()

    Object.defineProperty(fig, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 100, configurable: true })

    try {
      // URL.createObjectURL absent → bitmapPath false → sync CDN assign.
      delete URL.createObjectURL
      await publish(fig)

      expect(await highSrc(fig)).toBe(fig.highResSrc)

      URL.createObjectURL = () => 'blob:late'

      // naturalHeight 0 → bitmapPath false → sync CDN assign.
      await publish(fig, { w: 100, h: 0 })

      expect(await highSrc(fig)).toBe(fig.highResSrc)
    } finally {
      env.restore()
      fig.remove()
    }
  })

  test('a successor detached mid-encode exits without a src', async () => {
    const env = stubBitmapEnv()
    const fig = mount()

    Object.defineProperty(fig, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 100, configurable: true })

    const origImage = window.Image
    const insts = []

    window.Image = class {
      constructor() {
        this.naturalWidth = 1920
        this.naturalHeight = 5654
        insts.push(this)
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()
      insts[insts.length - 1].onload()

      // The wholesale rebuild detaches the successor before the
      // encode resolves — the .then guard exits without a src write.
      fig._updateDom()
      await new Promise((r) => setTimeout(r, 0))

      const highs = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)
      const high = highs[highs.length - 1]

      expect(high.getAttribute(MEDIA_ATTRS.SRC)).toBe(fig.highResSrc)
      expect(high.getAttribute(MEDIA_ATTRS.SRC).startsWith('blob:')).toBe(false)
    } finally {
      window.Image = origImage
      env.restore()
      fig.remove()
    }
  })

  test('releaseDomBlobs early-returns on a blob-less fig or a missing revoke api', () => {
    const env = stubBitmapEnv()

    try {
      // No _domBlobs field — the guard exits before touching the set.
      releaseDomBlobs({})
      expect(true).toBe(true)

      // revokeObjectURL missing — the api guard exits with the set intact.
      delete URL.revokeObjectURL

      const fig = { _domBlobs: new Set(['blob:x']) }

      releaseDomBlobs(fig)
      expect(fig._domBlobs.size).toBe(1)

      // Normal sweep — both entries revoked, set emptied.
      URL.revokeObjectURL = () => {}
      releaseDomBlobs(fig)
      expect(fig._domBlobs.size).toBe(0)
    } finally {
      env.restore()
    }
  })

  test('mid-scroll confirms coalesce the queued publish onto the latest rung', async () => {
    const key = 'queue/arm'
    const realFetch = globalThis.fetch

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => [
        `${key}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        `${key}${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
      ],
    })

    const { initMediaManifest } = await import('@core/utils/media/manifest.js')

    await initMediaManifest()

    const env = stubBitmapEnv()
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, key)
    fig.setAttribute(MEDIA_ATTRS.WIDTH, '4000')
    fig.setAttribute(MEDIA_ATTRS.HEIGHT, '4000')
    document.body.appendChild(fig)

    // Wide box keeps ladderCeiling at the top rung so both confirms land.
    Object.defineProperty(fig, 'clientWidth', { value: 1000, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 1000, configurable: true })

    const insts = []
    const origImage = window.Image

    window.Image = class {
      constructor() {
        this.naturalWidth = 4000
        this.naturalHeight = 4000
        insts.push(this)
      }
    }

    try {
      window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))

      fig.isLoaded = false
      await fig.loadHighRes()

      // Both rung confirms land while the scroll flag is up — the second
      // publish hits the publishQueued early-return and only its URL
      // overwrites pendingUrl.
      insts[0].onload()
      insts[1].onload()

      await new Promise((r) => setTimeout(r, 200))

      expect(fig.isLoaded).toBe(true)
      expect(await highSrc(fig)).toBeTruthy()
    } finally {
      window.Image = origImage
      env.restore()
      globalThis.fetch = realFetch
      fig.remove()
    }
  })

  test('the SSR window guard and zero-dpr fallback cap the bitmap at 1x', async () => {
    const env = stubBitmapEnv()
    const fig = mount()

    Object.defineProperty(fig, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(fig, 'clientHeight', { value: 100, configurable: true })

    const winDesc = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const origImage = window.Image
    const insts = []

    window.Image = class {
      constructor() {
        this.naturalWidth = 4000
        this.naturalHeight = 4000
        insts.push(this)
      }
    }

    try {
      fig.isLoaded = false
      const done = fig.loadHighRes()

      // The window-free arm — domSizedSrc's typeof guard is the only
      // window read on the publish path, so undefining mid-flight is safe.
      Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })

      insts[insts.length - 1].onload()
      await done
      await new Promise((r) => setTimeout(r, 0))
    } finally {
      if (winDesc) Object.defineProperty(globalThis, 'window', winDesc)
    }

    expect(await highSrc(fig)).toBe('blob:ds0')

    // The falsy-dpr arm — `devicePixelRatio || 1` right operand.
    const dprDesc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })

    try {
      fig.isLoaded = false
      const insts2 = []

      window.Image = class {
        constructor() {
          this.naturalWidth = 4000
          this.naturalHeight = 4000
          insts2.push(this)
        }
      }

      await fig.loadHighRes()
      insts2[insts2.length - 1].onload()
      await new Promise((r) => setTimeout(r, 0))

      expect(await highSrc(fig)).toBe('blob:ds1')
    } finally {
      if (dprDesc) {
        Object.defineProperty(window, 'devicePixelRatio', dprDesc)
      } else {
        delete window.devicePixelRatio
      }

      window.Image = origImage
      env.restore()
      fig.remove()
    }
  })
})
