/**
 * @file media-figure-domsized-tails.test.js
 * @description Coverage tails for figure/load.ts's display-sized DOM
 * bitmap path — a confirmed rung whose source far over-resolves the
 * rendered box mounts a box-covering object URL instead of the
 * full-dimension CDN file (the tall-image decode-memory fix). Arms:
 * every early-return keeps the CDN URL (zero box, under-resolved
 * source, failed fetch, decode throw, missing 2d context, null toBlob,
 * absent createObjectURL), the success arm mounts the blob + revokes
 * the superseded one, the detached-successor guard, the bitmapPath
 * capability gate, and releaseDomBlobs's early returns + destroy sweep.
 */
import '@website/components/media/MediaFigure.js'
import { releaseDomBlobs } from '@website/components/media/figure/load.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'

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

      // A second confirmed rung re-encodes and releases the first blob.
      await publish(fig)

      expect(await highSrc(fig)).toBe('blob:ds1')
      expect(revoked).toContain('blob:ds0')
      expect(fig._domBlobs.has('blob:ds1')).toBe(true)
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
})
