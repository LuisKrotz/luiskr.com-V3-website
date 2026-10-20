/**
 * @file coverage/components/home/about-glitch-wasm-tails.test.js
 * @description Coverage tail for components/home/about/glitch/wasm.ts —
 * the WebGPU backend arm of the portrait glitch. Covers pushGlitchRect's
 * passthrough, uploadGlitchBitmap's decode/upload/stale arms,
 * tryGlitchWasm's dead/null/live mount arms, and frameGlitchWasm's
 * clock, hover push, and stale-surface fallback.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

let mockGpu = false
let mountResult = null
let mountDelay = 0
let decodeResult = null

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => {
    if (mountDelay) await new Promise((r) => setTimeout(r, mountDelay))

    return mountResult
  },
  warmWidgetArtifacts: () => undefined,
}))

jest.unstable_mockModule('@core/utils/wasm/wasm-image-decoder.js', () => ({
  wasmImageDecoder: {
    decodeImageWASM: async () => decodeResult,
  },
}))

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** Builds a minimal live session + host pair. */
const makeSession = () => {
  const canvas = document.createElement('canvas')
  const img = document.createElement('img')

  img.src = 'https://cdn.example/portrait.webp'

  const s = {
    canvas,
    ctx: null,
    w: 64,
    h: 64,
    dx: 0,
    dy: 0,
    dw: 64,
    dh: 64,
    img,
    srcW: 64,
    srcH: 64,
    red: canvas,
    cyan: canvas,
    scan: canvas,
    t: 0,
    lastT: performance.now(),
    raf: 0,
    active: true,
    hover: false,
    tick: 0,
    ro: null,
    wasm: null,
  }
  const host = { _glitch: s, _isMounted: true }

  return { s, host }
}

/** Recording fake widget with the glitch surface. */
const makeWidget = () => {
  const w = {
    covers: [],
    hovers: [],
    uploads: [],
    resizes: [],
    frames: [],
    uploadOk: true,
    frameOk: true,
    set_cover: (...a) => w.covers.push(a),
    set_hover: (v) => w.hovers.push(v),
    upload: (b) => {
      w.uploads.push(b)

      return w.uploadOk
    },
    resize: (a, b) => w.resizes.push([a, b]),
    frame: (dt) => {
      w.frames.push(dt)

      return w.frameOk
    },
  }

  return w
}

describe('about glitch wasm arm', () => {
  let pushGlitchRect
  let uploadGlitchBitmap
  let tryGlitchWasm
  let frameGlitchWasm
  let origGetContext

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    mountDelay = 0
    decodeResult = null

    origGetContext = document.createElement('canvas').constructor.prototype.getContext
    document.createElement('canvas').constructor.prototype.getContext = (type) =>
      String(type) === '2d' ? createMock2D() : null

    const mod = await import('@website/components/home/about/glitch/wasm.js')

    pushGlitchRect = mod.pushGlitchRect
    uploadGlitchBitmap = mod.uploadGlitchBitmap
    tryGlitchWasm = mod.tryGlitchWasm
    frameGlitchWasm = mod.frameGlitchWasm
  })

  afterEach(() => {
    document.createElement('canvas').constructor.prototype.getContext = origGetContext
  })

  test('pushGlitchRect forwards the cover rect and tolerates a bare session', () => {
    const { s } = makeSession()

    pushGlitchRect(s) // no wasm — early return

    s.wasm = { widget: makeWidget(), destroy: jest.fn() }
    pushGlitchRect(s)

    expect(s.wasm.widget.covers[0]).toEqual([0, 0, 64, 64])
  })

  test('uploadGlitchBitmap decodes, uploads, and repushes the rect', async () => {
    const { s } = makeSession()
    const w = makeWidget()

    s.wasm = { widget: w, destroy: jest.fn() }
    decodeResult = { width: 64, height: 64 }

    uploadGlitchBitmap(s)

    await flush()

    expect(w.uploads.length).toBe(1)
    expect(w.covers.length).toBe(1)
  })

  test('uploadGlitchBitmap early-returns without a widget and on a null decode', async () => {
    const { s } = makeSession()

    uploadGlitchBitmap(s)

    s.wasm = { widget: makeWidget(), destroy: jest.fn() }
    decodeResult = null
    uploadGlitchBitmap(s)

    await flush()

    expect(s.wasm.widget.uploads.length).toBe(0)
  })

  test('uploadGlitchBitmap skips a stale session swap and a rejected upload', async () => {
    const { s } = makeSession()
    const w = makeWidget()
    const first = { widget: w, destroy: jest.fn() }

    s.wasm = first
    decodeResult = { width: 1 }

    uploadGlitchBitmap(s)
    s.wasm = { widget: makeWidget(), destroy: jest.fn() } // swapped mid-decode

    await flush()

    expect(w.uploads.length).toBe(0)

    s.wasm = first
    w.uploadOk = false
    uploadGlitchBitmap(s)

    await flush()

    expect(w.uploads.length).toBe(1)
    expect(w.covers.length).toBe(0)
  })

  test('tryGlitchWasm goes live: resize + bitmap upload; hover flows through frames', async () => {
    const { s, host } = makeSession()
    const w = makeWidget()

    mountResult = { canvas: s.canvas, widget: w, destroy: jest.fn() }
    decodeResult = { width: 64 }

    tryGlitchWasm(host, s)

    await flush()

    expect(s.wasm).toBe(mountResult)
    expect(w.resizes[0]).toEqual([64, 64])
    expect(w.uploads.length).toBe(1)

    s.hover = true
    frameGlitchWasm(s)

    expect(w.hovers[w.hovers.length - 1]).toBe(1)
    expect(w.frames.length).toBe(1)
    expect(s.t).toBeGreaterThan(0)
  })

  test('tryGlitchWasm claims 2D on a null mount, and drops when even that fails', async () => {
    const { s, host } = makeSession()

    mountResult = null
    tryGlitchWasm(host, s)

    await flush()

    expect(s.ctx).not.toBeNull()
    expect(s.wasm).toBeNull()

    // Second session: the 2D claim also fails → the session drops.
    const dead = makeSession()

    document.createElement('canvas').constructor.prototype.getContext = () => null
    tryGlitchWasm(dead.host, dead.s)

    await flush()

    expect(dead.s.active).toBe(false)
    expect(dead.host._glitch).toBeNull()
  })

  test('tryGlitchWasm destroys a handle that lands on a dead session', async () => {
    const { s, host } = makeSession()
    const w = makeWidget()

    mountResult = { canvas: s.canvas, widget: w, destroy: jest.fn() }
    mountDelay = 40

    tryGlitchWasm(host, s)
    host._glitch = null // session swapped while the artifact fetched

    await flush(80)

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(s.wasm).toBeNull()
  })

  test('frameGlitchWasm drops to 2D when the surface goes stale', async () => {
    const { s } = makeSession()
    const w = makeWidget()
    const handle = { canvas: s.canvas, widget: w, destroy: jest.fn() }

    s.wasm = handle
    w.frameOk = false

    frameGlitchWasm(s)

    expect(s.wasm).toBeNull()
    expect(handle.destroy).toHaveBeenCalled()
    expect(s.ctx).not.toBeNull() // 2D backend claimed
  })

  test('frameGlitchWasm tolerates a wasm-less session', () => {
    const { s } = makeSession()

    expect(() => frameGlitchWasm(s)).not.toThrow()
  })

  test('uploadGlitchBitmap falls back to img.src when currentSrc is empty', async () => {
    const { s } = makeSession()
    const w = makeWidget()

    s.wasm = { widget: w, destroy: jest.fn() }
    s.img = { currentSrc: '', src: TEST_URLS.IMG }
    decodeResult = { width: 64 }

    uploadGlitchBitmap(s)

    await flush()

    expect(w.uploads.length).toBe(1)
  })

  test('frameGlitchWasm treats a falsy elapsed clock as .016', async () => {
    const { s } = makeSession()
    const w = makeWidget()

    s.wasm = { widget: w, destroy: jest.fn() }
    s.lastT = NaN // (now - NaN) is NaN → the dt guard substitutes .016

    frameGlitchWasm(s)

    expect(w.frames[0]).toBeCloseTo(0.016)
    expect(s.t).toBeCloseTo(0.016)
  })
})

describe('about glitch session wasm arms', () => {
  let armGlitch
  let tick
  let sizeSession
  let dropSession
  let frame

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    mountDelay = 0
    decodeResult = null

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    const origGetContext = document.createElement('canvas').constructor.prototype.getContext

    document.createElement('canvas').constructor.prototype.getContext = (type) =>
      String(type) === '2d'
        ? createMock2D()
        : origGetContext.call(document.createElement('canvas'), type)

    const mod = await import('@website/components/home/about/glitch/session.js')
    const fx = await import('@website/components/home/about/glitch/fx.js')

    armGlitch = mod.armGlitch
    tick = mod.tick
    sizeSession = mod.sizeSession
    dropSession = mod.dropSession
    frame = fx.frame
  })

  afterEach(() => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('sizeSession takes the wasm arm — widget resize + rect push, no 2D repaint', () => {
    const { s } = makeSession()
    const w = makeWidget()

    s.wasm = { widget: w, destroy: jest.fn() }
    s.ctx = createMock2D() // present — must NOT be repainted on the wasm arm

    sizeSession(s, { width: 32, height: 32 })

    expect(w.resizes.length).toBe(1) // widget.resize ran
    expect(w.covers.length).toBe(1) // pushGlitchRect followed
  })

  test('armGlitch takes the WebGPU arm — mounts the wasm widget instead of 2D', async () => {
    const wrap = document.createElement('div')
    const img = document.createElement('img')

    img.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG
    Object.defineProperty(img, 'complete', { value: true, configurable: true })
    Object.defineProperty(img, 'naturalWidth', { value: 64, configurable: true })
    wrap.appendChild(img)
    wrap.getBoundingClientRect = () => ({ width: 64, height: 64, top: 0, left: 0 })
    document.body.appendChild(wrap)

    const host = { _glitch: null, _isMounted: true }
    const w = makeWidget()

    mountResult = { canvas: document.createElement('canvas'), widget: w, destroy: jest.fn() }

    const ok = armGlitch(host, wrap)

    expect(ok).toBe(true)
    expect(host._glitch).not.toBeNull()

    await flush()

    expect(host._glitch.wasm).toBe(mountResult)

    host._glitch.active = false
    cancelAnimationFrame(host._glitch.raf)
    host._glitch.ro?.disconnect()
    wrap.remove()
  })

  test('tick re-measures on srcset drift and frames through the wasm arm', async () => {
    const { s, host } = makeSession()
    const w = makeWidget()

    s.wasm = { widget: w, destroy: jest.fn() }
    document.body.appendChild(s.canvas)

    const img = document.createElement('img')

    img.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG
    Object.defineProperty(img, 'naturalWidth', { value: 999, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 999, configurable: true })
    Object.defineProperty(img, 'currentSrc', { value: TEST_URLS.IMG, configurable: true })
    s.img = img

    const wrap = document.createElement('div')

    wrap.getBoundingClientRect = () => ({ width: 64, height: 64, top: 0, left: 0 })
    host.shadowRoot = { querySelector: () => wrap }
    decodeResult = { width: 999 }

    tick(host)
    s.active = false // stop the re-armed rAF before flushing microtasks
    cancelAnimationFrame(s.raf)

    await flush()

    expect(w.uploads.length).toBe(1) // uploadGlitchBitmap on drift
    expect(w.frames.length).toBe(1) // frameGlitchWasm + early return
    s.canvas.remove()
  })

  test('dropSession leaves a foreign session owner untouched', () => {
    const { s, host } = makeSession()
    const owner = { canvas: document.createElement('canvas') }
    const handle = { widget: makeWidget(), destroy: jest.fn() }

    s.wasm = handle
    host._glitch = owner // not `s`

    dropSession(host, s)

    expect(host._glitch).toBe(owner) // foreign owner preserved
    expect(handle.destroy).toHaveBeenCalled()
    expect(s.wasm).toBeNull()
  })

  test('frame early-returns when the 2D backend was never claimed', () => {
    expect(() => frame({ ctx: null })).not.toThrow()
  })
})
