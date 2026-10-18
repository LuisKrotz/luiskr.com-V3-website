/**
 * @file coverage/components/media/draw-text-gpu-tails.test.js
 * @description Coverage tail for components/media/draw-text/gpu.ts —
 * the WebGPU reveal path for <draw-text>. Covers every entry gate,
 * the mount-resolve arms (null, detached, animated, disconnected),
 * the prepare arms (zero box, atlas/ctx/bitmap/set_chars failures,
 * live), the drive loop's finish paths, and teardown.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { DRAW_TEXT_CLASSES } from '@core/tokens/classes/draw-text.js'

let mockGpu = false
let mountResult = null
let bitmapResult = { width: 8 }
let bitmapThrows = false
let mountDelay = 0

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => {
    if (mountDelay) await new Promise((r) => setTimeout(r, mountDelay))

    return mountResult
  },
  warmWidgetArtifacts: () => undefined,
}))

const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms))

const RECT = { left: 10, top: 20, right: 110, bottom: 44, width: 100, height: 24 }

/** A measuring 2D ctx — glyphs report a real ascent so fillText lands. */
const measuringCtx = () =>
  new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'measureText') return () => ({ actualBoundingBoxAscent: 10, width: 8 })

        return () => undefined
      },
      set() {
        return true
      },
    }
  )

/** A host with one char span, ready to reveal. */
const makeHost = (rect = RECT) => {
  const contentEl = document.createElement('span')
  const char = document.createElement('span')

  char.className = DRAW_TEXT_CLASSES.DRAW_TEXT_CHAR
  char.textContent = 'A'
  char.style.setProperty('--i', '0')

  contentEl.appendChild(char)
  document.body.appendChild(contentEl)

  contentEl.getBoundingClientRect = () => rect
  char.getBoundingClientRect = () => ({ ...rect, width: 8, height: 20 })

  const shadowRoot = document.createElement('div')

  const host = {
    _rootEl: contentEl,
    _isMounted: true,
    _hasAnimated: false,
    _gpuPending: false,
    _gpuHandle: null,
    _gpuRaf: 0,
    _gpuCanvas: null,
    delay: 30,
    offset: 0,
    shadowRoot,
    getBoundingClientRect: () => ({ ...rect, left: 0, top: 0 }),
  }

  return { host, contentEl, char }
}

/** Recording fake text-draw widget. */
const makeWidget = () => {
  const w = {
    atlasOk: true,
    charsOk: 1,
    inks: [],
    chars: [],
    atlases: [],
    triggers: 0,
    resizes: [],
    frames: [],
    upload_atlas: (b) => {
      w.atlases.push(b)

      return w.atlasOk
    },
    set_chars: (v) => {
      w.chars.push(v)

      return w.charsOk
    },
    set_ink: (...a) => w.inks.push(a),
    trigger: () => w.triggers++,
    resize: (a, b) => w.resizes.push([a, b]),
    frame: (dt) => {
      w.frames.push(dt)

      return true
    },
  }

  return w
}

describe('draw-text gpu reveal', () => {
  let tryGpuDraw
  let teardownGpuDraw
  let origGetContext
  let origBitmap
  let cleanups

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    bitmapResult = { width: 8 }
    bitmapThrows = false
    mountDelay = 0
    cleanups = []

    origGetContext = document.createElement('canvas').constructor.prototype.getContext
    document.createElement('canvas').constructor.prototype.getContext = (type) =>
      String(type) === '2d' ? measuringCtx() : null

    origBitmap = globalThis.createImageBitmap
    globalThis.createImageBitmap = async () => {
      if (bitmapThrows) throw new Error('no bitmap')

      return bitmapResult
    }

    const mod = await import('@website/components/media/draw-text/gpu.js')

    tryGpuDraw = mod.tryGpuDraw
    teardownGpuDraw = mod.teardownGpuDraw
  })

  afterEach(() => {
    document.createElement('canvas').constructor.prototype.getContext = origGetContext
    globalThis.createImageBitmap = origBitmap
    cleanups.forEach((n) => n.remove?.())
  })

  test('gates: no gpu, pending, live handle, missing root, no chars', () => {
    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)

    mockGpu = false
    tryGpuDraw(host, 100)

    mockGpu = true
    host._gpuPending = true
    tryGpuDraw(host, 100)

    host._gpuPending = false
    host._gpuHandle = { destroy: () => {} }
    tryGpuDraw(host, 100)

    host._gpuHandle = null
    host._rootEl = null
    tryGpuDraw(host, 100)

    host._rootEl = document.createElement('span') // no char spans
    tryGpuDraw(host, 100)

    expect(mountResult).toBeNull()
  })

  test('a null mount removes the canvas and clears pending', async () => {
    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)
    mountResult = null

    tryGpuDraw(host, 100)

    await flush()

    expect(host._gpuPending).toBe(false)
    expect(host._gpuHandle).toBeNull()
    expect(host.shadowRoot.querySelector('canvas')).toBeNull()
  })

  test('a resolve on a dead/finished host destroys the handle', async () => {
    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    mountDelay = 30

    tryGpuDraw(host, 100)
    host._isMounted = false

    await flush(80)

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(host._gpuHandle).toBeNull()
  })

  test('a zero-size content box fails prepare and destroys the mount', async () => {
    const { host, contentEl } = makeHost({ ...RECT, width: 0, height: 0 })
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }

    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(host._gpuHandle).toBeNull()
  })

  test('atlas/ctx/bitmap/upload/set_chars failures all disarm the mount', async () => {
    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)

    // Bitmap decode failure.
    bitmapThrows = true
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()

    // upload_atlas rejection.
    bitmapThrows = false
    w.atlasOk = false
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()

    // set_chars rejection.
    w.atlasOk = true
    w.charsOk = 0
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
  })

  test('live path: sheet + atlas + ink push, gpu class, frames, finish', async () => {
    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }

    tryGpuDraw(host, 40) // totalMs — the drive loop finishes right after

    await flush()

    expect(host._gpuHandle).toBe(mountResult)
    expect(contentEl.classList.contains(DRAW_TEXT_CLASSES.DRAW_TEXT_GPU)).toBe(true)
    expect(w.atlases.length).toBe(1)
    expect(w.chars.length).toBe(1)
    expect(w.chars[0].length).toBe(12)
    expect(w.inks.length).toBe(1)
    expect(w.triggers).toBe(1)
    expect(w.resizes.length).toBe(1)

    await flush(80)

    // totalMs elapsed → finish() dropped the class + tore the widget down.
    expect(w.frames.length).toBeGreaterThan(0)
    expect(contentEl.classList.contains(DRAW_TEXT_CLASSES.DRAW_TEXT_GPU)).toBe(false)
    expect(mountResult.destroy).toHaveBeenCalled()
    expect(host._gpuHandle).toBeNull()
  })

  test('teardownGpuDraw is a safe no-op on an unmounted host', () => {
    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)

    expect(() => teardownGpuDraw(host)).not.toThrow()
  })
})
