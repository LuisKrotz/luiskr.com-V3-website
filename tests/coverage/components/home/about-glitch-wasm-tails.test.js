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
})
