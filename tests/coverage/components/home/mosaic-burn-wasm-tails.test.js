/**
 * @file mosaic-burn-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm burn particle path —
 * tryWasmBurn's mount arms (success/failure/late-teardown),
 * pushBurnSession's letters/ink/colors packs, frameBurnWasm's
 * set_stage + frame, setBurnDirWasm on arm/disarm flips,
 * liveBurnParticles' settle query, mirrorBurnGpuCanvas on re-anchor,
 * and destroyBurnWasm's handle teardown. The bridge module is mocked
 * so a fake widget stands in for the rust/burn artifact (happy-dom
 * has no WebGPU).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import store from '@core/store.js'
import { mount } from '@tests/fixtures/test-constants.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { MOSAIC_SELECTORS } from '@core/tokens/selectors/mosaic.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { UI_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { INPUT_STRINGS } from '@core/tokens/strings/input.js'
import { GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'

/** Mutable mount result the mock returns — tests swap per case. */
let mountResult = null

/** Mutable WebGPU capability flag the mock's hasWebGpu reads. */
let mockGpu = true

/** The fake wasm widget — records every kind-specific setter call. */
let fakeWidget = null

/** Mutable particle count the fake sim reports. */
let liveCount = 0

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  // Kind-aware: the mosaic also mounts the ring-sheen + corner-bracket
  // widgets — those resolve null so only the burn arm goes live.
  mountWebGpuWidget: async (kind) => (kind === GPU_WIDGET_KINDS.BURN ? mountResult : null),
  warmWidgetArtifacts: () => undefined,
}))

const BURN_SEL = `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURN}`

const ITEMS = [
  { label: 'Burn Card', link: 'burn-card', image: 'ia', description: 'Desc A', featured: false },
]

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('mosaic burn wasm tails', () => {
  let el
  let cleanup
  let origGetContext
  let origRect
  let frameWasm
  let liveWasm
  let destroyWasm
  let mirrorWasm
  let setDirWasm
  let pushWasm
  let tryWasm
  let HomeMosaic
  let armCardBurn
  let disarmCardBurn

  const CanvasProto = () => document.createElement(HTML_TAGS.CANVAS).constructor.prototype

  const cardEl = (i = 0) =>
    el.shadowRoot.querySelector(
      `${MOSAIC_SELECTORS.HOME_MOSAIC_ITEM}[${DATA_ATTRS.DATA_INDEX}="${i}"]`
    )

  const mountMosaic = () => {
    el = new HomeMosaic()
    cleanup = mount(el)
    el.processedItems = ITEMS
    el._updateDom()

    return el
  }

  /** Seeds a glyph + ink column so packLetters/set_ink run their arms. */
  const seedSessionData = (s) => {
    s.letters = [{ x0: 0, y0: 0, x1: 10, y1: 12, v: 1.0, delay: 0.1 }]
    s.colInk = new Uint8Array([1, 1, 1, 0, 0, 1])
  }

  beforeEach(async () => {
    store.commit(UI_MUTATIONS.SET_INPUT_METHOD, INPUT_STRINGS.MOUSE)

    mountResult = null
    mockGpu = true
    liveCount = 0

    fakeWidget = {
      calls: {
        begin: [],
        letters: 0,
        ink: 0,
        colors: 0,
        dir: [],
        stage: [],
        frame: [],
        size: [],
        dev: [],
      },
      begin: (dir, ox, oy, seed) => fakeWidget.calls.begin.push([dir, ox, oy, seed]),
      set_letters: () => fakeWidget.calls.letters++,
      set_ink: () => fakeWidget.calls.ink++,
      set_colors: () => fakeWidget.calls.colors++,
      set_dir: (d) => fakeWidget.calls.dir.push(d),
      set_stage: (st, j) => fakeWidget.calls.stage.push([st, j]),
      live_particles: () => liveCount,
      frame: (dt) => fakeWidget.calls.frame.push(dt),
      set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
      resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
    }

    mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }

    origGetContext = CanvasProto().getContext
    CanvasProto().getContext = (type) => (String(type) === '2d' ? createMock2D() : null)

    origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      return {
        left: 10,
        top: 10,
        right: 210,
        bottom: 50,
        width: 200,
        height: 40,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      }
    }

    // Dynamic imports — the oxc transform does not hoist
    // unstable_mockModule, so the module graph must instantiate AFTER
    // the mock call above has executed.
    const mod = await import('@website/components/home/mosaic/burn/wasm.js')
    const burn = await import('@website/components/home/mosaic/burn.js')

    HomeMosaic = (await import('@website/components/home/HomeMosaic.js')).HomeMosaic
    armCardBurn = burn.armCardBurn
    disarmCardBurn = burn.disarmCardBurn

    frameWasm = mod.frameBurnWasm
    liveWasm = mod.liveBurnParticles
    destroyWasm = mod.destroyBurnWasm
    mirrorWasm = mod.mirrorBurnGpuCanvas
    setDirWasm = mod.setBurnDirWasm
    pushWasm = mod.pushBurnSession
    tryWasm = mod.tryWasmBurn
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    cleanup?.()
  })

  test('mount success stacks the GPU canvas and pushes the session tables', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush()

    expect(s.wasm).not.toBeNull()
    expect(s.gpuCanvas).not.toBeUndefined()
    expect(cardEl().querySelectorAll(BURN_SEL).length).toBe(2)

    expect(fakeWidget.calls.begin.length).toBe(1)
    expect(fakeWidget.calls.begin[0][0]).toBe(1)
    expect(fakeWidget.calls.letters).toBe(1)
    expect(fakeWidget.calls.ink).toBe(1)
    expect(fakeWidget.calls.colors).toBe(1)
    expect(fakeWidget.calls.size.length).toBe(1)
    expect(fakeWidget.calls.dev.length).toBe(1)

    // The session's leftover 2D motes were dropped on handoff.
    expect(s.particles.length).toBe(0)

    s.active = false
  })

  test('the wasm frame arm pushes stage + ticks the sim', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush()

    const before = fakeWidget.calls.stage.length

    frameWasm(s, 0.4, 3, 0.016)

    // The session's own loop also pushes stage — assert on the tail.
    const last = fakeWidget.calls.stage[fakeWidget.calls.stage.length - 1]

    expect(last[0]).toBe(0.4)
    expect(last[1]).toBe(3)
    expect(fakeWidget.calls.frame[fakeWidget.calls.frame.length - 1]).toBe(0.016)

    // A dead handle is a no-op.
    s.wasm = null
    frameWasm(s, 0.4, 3, 0.016)
    expect(fakeWidget.calls.stage.length).toBe(before + 1)
  })

  test('disarm + re-arm push set_dir flips into the sim', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush()

    disarmCardBurn(el, 0)

    expect(fakeWidget.calls.dir[0]).toBe(-1)

    armCardBurn(el, 0, ITEMS[0])

    expect(fakeWidget.calls.dir[1]).toBe(1)

    s.active = false
  })

  test('liveBurnParticles reports the crate count and 0 when unmounted', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush()

    liveCount = 7

    expect(liveWasm(s)).toBe(7)

    s.wasm = null
    expect(liveWasm(s)).toBe(0)
  })

  test('mirrorBurnGpuCanvas copies the paper canvas box', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush()

    s.canvas.style.left = '42px'
    s.canvas.style.top = '9px'
    s.canvas.style.width = '300px'
    s.canvas.style.height = '60px'

    mirrorWasm(s)

    expect(s.gpuCanvas.style.left).toBe('42px')
    expect(s.gpuCanvas.style.top).toBe('9px')
    expect(s.gpuCanvas.style.width).toBe('300px')
    expect(s.gpuCanvas.style.height).toBe('60px')

    // No gpuCanvas → no-op.
    const orphan = { gpuCanvas: undefined }

    mirrorWasm(orphan)

    s.active = false
  })

  test('mount failure leaves the session on the 2D particle path', async () => {
    mountResult = null

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    await flush()

    expect(s.wasm).toBeUndefined()
    expect(s.wasmFailed).toBe(true)
    expect(s.gpuCanvas).toBeUndefined()
    expect(cardEl().querySelectorAll(BURN_SEL).length).toBe(1)

    s.active = false
  })

  test('a teardown during the in-flight mount releases the late handle', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // Teardown while the artifact is in flight.
    s.active = false

    await flush()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(s.wasm).toBeUndefined()
    expect(s.gpuCanvas).toBeUndefined()
  })

  test('destroyBurnWasm releases the handle and removes the canvas', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush()

    destroyWasm(s)

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(s.wasm).toBeNull()
    expect(s.gpuCanvas).toBeUndefined()
    expect(cardEl().querySelectorAll(BURN_SEL).length).toBe(1)

    s.active = false
  })

  test('no WebGPU never creates the GPU canvas', async () => {
    mockGpu = false

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    await flush()

    expect(s.wasm).toBeUndefined()
    expect(s.gpuCanvas).toBeUndefined()
    expect(cardEl().querySelectorAll(BURN_SEL).length).toBe(1)

    s.active = false
  })

  test('setBurnDirWasm + pushBurnSession tolerate unmounted sessions', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // No wasm mounted — the helpers are safe no-ops. Kept fully
    // synchronous so the in-flight mount cannot resolve mid-test.
    setDirWasm(s)
    pushWasm(s)
    destroyWasm(s)

    expect(fakeWidget.calls.dir).toEqual([])
    expect(fakeWidget.calls.begin).toEqual([])

    s.active = false
  })

  test('pushBurnSession skips empty tables + the missing-canvas arm', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // No seeds — the analyzer still resolves whatever glyph geometry
    // the DOM offers; the table pushes land with that data.
    await flush()

    expect(fakeWidget.calls.begin.length).toBe(1)
    expect(fakeWidget.calls.ink).toBe(1)
    expect(fakeWidget.calls.colors).toBe(1)

    // The empty-tables arm — a stub session with no letters AND no
    // ink column skips both optional pushes.
    const sparse = {
      wasm: s.wasm,
      gpuCanvas: s.gpuCanvas,
      dir: 1,
      paperX: 0,
      paperY: 0,
      w: 4,
      h: 4,
      letters: [],
      colInk: new Uint8Array(0),
      ink: { core: '', mid: '', edge: '', scorch: '' },
    }
    const beforeInk = fakeWidget.calls.ink
    const beforeLetters = fakeWidget.calls.letters

    pushWasm(sparse)

    expect(fakeWidget.calls.letters).toBe(beforeLetters)
    expect(fakeWidget.calls.ink).toBe(beforeInk)
    expect(fakeWidget.calls.colors).toBe(2)

    // The missing-canvas arm — a handle without its stacked canvas
    // returns before any table push.
    const orphan = { wasm: s.wasm, gpuCanvas: undefined }
    const before = fakeWidget.calls.begin.length

    pushWasm(orphan)

    expect(fakeWidget.calls.begin.length).toBe(before)

    s.active = false
  })

  test('tryWasmBurn early-returns on pending, mounted, and failed states', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // In-flight — a second attempt while wasmPending is a no-op.
    expect(s.wasmPending).toBe(true)
    tryWasm(s)
    expect(cardEl().querySelectorAll(BURN_SEL).length).toBe(1)

    await flush()

    // Mounted — s.wasm is set, another attempt exits immediately.
    tryWasm(s)
    expect(s.wasm).not.toBeNull()

    s.active = false

    // Failed — a session stamped wasmFailed never retries.
    const stale = { wasmFailed: true }

    tryWasm(stale)
    expect(stale.wasmPending).toBeUndefined()
  })

  test('the wasm loop arm drives frames through frame()', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    seedSessionData(s)

    await flush(60)

    // The session's own rAF loop has ticked the wasm path at least once.
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.stage.length).toBeGreaterThan(0)

    s.active = false
  })
})
