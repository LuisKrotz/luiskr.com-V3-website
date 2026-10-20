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
let verifyPixels = null
let deviceFails = false
let deviceThrow = false
let ctx2dNull = false
let ctxExtras = false
let noFontSize = false
let probeResult = 0.5

/** A fake shared GPUDevice serving the verifyOverlay readback. */
const makeDevice = () => ({
  createBuffer: () => {
    if (deviceThrow) throw new Error('alloc denied')

    return {
      mapAsync: async () => undefined,
      getMappedRange: () => {
        // The readback scans tex.height rows at pitch-256 stride — the
        // mock buffer must cover 256×4 bytes for the 4×4 texture.
        if (verifyPixels) return verifyPixels

        const px = new Uint8Array(256 * 4)

        for (let row = 0; row < 4; row++) px[row * 256 + 3] = 255

        return px
      },
      unmap: () => undefined,
      destroy: () => undefined,
    }
  },
  createCommandEncoder: () => ({
    copyTextureToBuffer: () => undefined,
    finish: () => ({}),
  }),
  queue: { submit: () => undefined },
})

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => {
    if (mountDelay) await new Promise((r) => setTimeout(r, mountDelay))

    return mountResult
  },
  getSharedGpuDevice: async () => (deviceFails ? null : makeDevice()),
  warmWidgetArtifacts: () => undefined,
}))

const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms))

const RECT = { left: 10, top: 20, right: 110, bottom: 44, width: 100, height: 24 }

let imgDataThrows = false

/** A measuring 2D ctx — glyphs report a real ascent so fillText lands. */
const measuringCtx = () =>
  new Proxy(
    // `in`-check extras: fontKerning/letterSpacing must be own props for
    // the capability arms to take their true branch.
    ctxExtras ? { fontKerning: '', letterSpacing: '' } : {},
    {
      get(_t, prop) {
        if (prop === 'measureText') return () => ({ actualBoundingBoxAscent: 10, width: 8 })

        if (prop === 'getImageData')
          return (x, y, w, h) => {
            if (imgDataThrows) throw new Error('no pixels')

            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
          }

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
  let origGcs
  let cleanups

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    bitmapResult = { width: 8 }
    bitmapThrows = false
    mountDelay = 0
    imgDataThrows = false
    ctx2dNull = false
    ctxExtras = false
    noFontSize = false
    deviceThrow = false
    probeResult = 0.5
    cleanups = []

    origGetContext = document.createElement('canvas').constructor.prototype.getContext
    document.createElement('canvas').constructor.prototype.getContext = (type) => {
      if (String(type) === '2d') return ctx2dNull ? null : measuringCtx()

      if (String(type) === 'webgpu') {
        return { getCurrentTexture: () => ({ width: 4, height: 4 }) }
      }

      return null
    }

    origGcs = globalThis.getComputedStyle
    globalThis.getComputedStyle = (el) => {
      const cs = origGcs(el)

      if (!noFontSize) return cs

      return new Proxy(cs, {
        get: (t, p) => (p === 'fontSize' ? '' : Reflect.get(t, p)),
      })
    }

    verifyPixels = null
    deviceFails = false

    // WebGPU globals for the verifyOverlay readback arm.
    globalThis.GPUBufferUsage = { COPY_DST: 8, MAP_READ: 1 }
    globalThis.GPUMapMode = { READ: 1 }

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
    globalThis.getComputedStyle = origGcs
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

    // Traversal-bake failure (getImageData threw) — the CSS path stays
    // authoritative; a partial field would hold glyphs invisible.
    w.charsOk = 1
    imgDataThrows = true
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
  })

  /** Runs one verify arm and asserts the mount was disarmed. */
  const expectDisarmed = async () => {
    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(host._gpuHandle).toBeNull()

    return w
  }

  test('verifyOverlay disarms on an empty readback — nothing painted', async () => {
    // Broken atlas/bind on this driver — the CSS reveal stays
    // authoritative instead of suppressing the DOM chars.
    verifyPixels = new Uint8Array(256 * 4)

    await expectDisarmed()
  })

  test('verifyOverlay disarms on a full-bleed paint — the slab', async () => {
    verifyPixels = new Uint8Array(256 * 4).fill(255)

    await expectDisarmed()
  })

  test('verifyOverlay disarms when the shared device is gone', async () => {
    deviceFails = true

    await expectDisarmed()
  })

  test('verifyOverlay disarms when the probe frame reports stale', async () => {
    const w = await Promise.resolve(makeWidget())

    w.frame = () => false

    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)
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

  test('sheet packs the CSS delay contract — offset + i·char-delay per char', async () => {
    const { host, contentEl } = makeHost()
    const w = makeWidget()
    const second = document.createElement('span')

    // A second char + explicit timing vars on BOTH — the sheet's
    // delay field must equal the CSS calc(var(--offset) + var(--i) *
    // var(--char-delay)) or GPU/CSS reveal orders diverge (the
    // "delays totally wrong" report).
    second.className = DRAW_TEXT_CLASSES.DRAW_TEXT_CHAR
    second.textContent = 'B'
    second.style.setProperty('--i', '1')
    second.style.setProperty('--char-delay', '25')
    second.style.setProperty('--offset', '200')
    contentEl.firstChild.style.setProperty('--char-delay', '25')
    contentEl.firstChild.style.setProperty('--offset', '200')
    contentEl.appendChild(second)
    second.getBoundingClientRect = () => ({ ...RECT, width: 8, height: 20 })

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }

    tryGpuDraw(host, 40)

    await flush()

    expect(w.chars[0].length).toBe(24)
    // Record stride 12 — [8] delay, [9] dur: char0 → 200+0·25, char1
    // → 200+1·25; durations positive (computed or fallback).
    expect(w.chars[0][8]).toBe(200)
    expect(w.chars[0][8 + 12]).toBe(225)
    expect(w.chars[0][9]).toBeGreaterThan(0)
    expect(w.chars[0][9 + 12]).toBeGreaterThan(0)
  })

  test('a falsy devicePixelRatio falls back to 1 and still goes live', async () => {
    const dprDesc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })

    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 40)

    await flush()

    expect(host._gpuHandle).toBe(mountResult)

    if (dprDesc) Object.defineProperty(window, 'devicePixelRatio', dprDesc)
  })

  test('a NaN char rect collapses atlasW — prepare bails to the CSS path', async () => {
    const { host, contentEl, char } = makeHost()
    const w = makeWidget()

    char.getBoundingClientRect = () => ({ ...RECT, width: NaN, height: 20 })
    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(host._gpuHandle).toBeNull()
  })

  test('a dead 2d atlas context fails prepare', async () => {
    ctx2dNull = true

    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: makeWidget(), destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
  })

  test('kerning/spacing-aware ctx takes the capability arms', async () => {
    ctxExtras = true

    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 40)

    await flush()

    expect(host._gpuHandle).toBe(mountResult)
    expect(w.atlases.length).toBe(1)
  })

  test('empty computed fontSize falls back to the em defaults', async () => {
    noFontSize = true

    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 40)

    await flush()

    expect(host._gpuHandle).toBe(mountResult)
    expect(w.chars.length).toBe(1)
  })

  test('an empty-text char takes the EMPTY fallbacks in measure+fill', async () => {
    const { host, contentEl, char } = makeHost()
    const w = makeWidget()

    char.textContent = ''
    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 40)

    await flush()

    expect(host._gpuHandle).toBe(mountResult)
    expect(w.atlases.length).toBe(1)
  })

  test('worker-backed handles probe the render worker — all verdict arms', async () => {
    // probe → null: verdict short-circuits on `coverage !== null`.
    const a = makeHost()

    cleanups.push(a.contentEl)
    mountResult = {
      canvas: null,
      widget: makeWidget(),
      probe: async () => null,
      destroy: jest.fn(),
    }
    tryGpuDraw(a.host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()

    // probe → 0: `coverage > 0` fails — nothing painted.
    const b = makeHost()

    cleanups.push(b.contentEl)
    mountResult = { canvas: null, widget: makeWidget(), probe: async () => 0, destroy: jest.fn() }
    tryGpuDraw(b.host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()

    // probe → 1: `coverage < VERIFY_MAX_COVERAGE` fails — the slab.
    const c = makeHost()

    cleanups.push(c.contentEl)
    mountResult = { canvas: null, widget: makeWidget(), probe: async () => 1, destroy: jest.fn() }
    tryGpuDraw(c.host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()

    // probe → 0.5: all three checks pass — the overlay goes live.
    const d = makeHost()
    const w = makeWidget()

    cleanups.push(d.contentEl)
    mountResult = { canvas: null, widget: w, probe: async () => probeResult, destroy: jest.fn() }
    tryGpuDraw(d.host, 100)

    await flush()

    expect(d.host._gpuHandle).toBe(mountResult)
  })

  test('a throwing device buffer drops into the verify catch arm', async () => {
    deviceThrow = true

    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: makeWidget(), destroy: jest.fn() }
    tryGpuDraw(host, 100)

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
  })

  test('a tick landing after teardown exits through the null-handle guard', async () => {
    const origCancel = globalThis.cancelAnimationFrame

    globalThis.cancelAnimationFrame = () => undefined

    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 40000) // long — the loop must still be armed at teardown

    await flush()

    expect(host._gpuHandle).toBe(mountResult)
    expect(host._gpuRaf).not.toBe(0)

    teardownGpuDraw(host) // armed-raf arm: cancel + zero the field

    expect(host._gpuRaf).toBe(0)
    expect(host._gpuHandle).toBeNull()

    await flush(60)

    // The orphaned tick ran with a null handle — early return, no re-arm.
    expect(host._gpuRaf).toBe(0)
    globalThis.cancelAnimationFrame = origCancel
  })

  test('finish without a content root skips the class drop', async () => {
    const { host, contentEl } = makeHost()
    const w = makeWidget()

    cleanups.push(contentEl)
    mountResult = { canvas: null, widget: w, destroy: jest.fn() }
    tryGpuDraw(host, 40)

    await flush()

    expect(host._gpuHandle).toBe(mountResult)

    host._rootEl = null // DOM root dropped between mount and finish

    await flush(100)

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(host._gpuHandle).toBeNull()
  })

  test('teardownGpuDraw is a safe no-op on an unmounted host', () => {
    const { host, contentEl } = makeHost()

    cleanups.push(contentEl)

    expect(() => teardownGpuDraw(host)).not.toThrow()
  })
})
