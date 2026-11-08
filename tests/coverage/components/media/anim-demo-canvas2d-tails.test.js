/**
 * @file anim-demo-canvas2d-tails.test.js
 * @description Coverage tails for website/components/media/anim-demo/canvas2d.ts —
 * the 2D-approximation demo drivers (glitch portrait, space scene, about
 * mesh). Each mount's contract: bail cleanly without a stage canvas or a
 * 2D backend, paint exactly one settled frame under reduced motion, run
 * an allocation-free rAF loop otherwise, and cancel it on teardown.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  mountGlitchDemo,
  mountSceneDemo,
  mountMeshDemo,
} from '@website/components/media/anim-demo/canvas2d.js'
import store from '@core/store.js'
import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

/**
 * Recording 2D context — every method a no-op, property writes absorbed;
 * `drawImage`/`fillRect` calls are counted so tests can assert the paint
 * actually ran (or was skipped) without a real canvas backend.
 */
const recording2d = () => {
  const state = { drawImage: 0, fillRect: 0, fillText: 0 }
  const ctx = {
    measureText: (t) => ({ width: String(t).length * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({ setTransform: () => {} }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    drawImage: () => {
      state.drawImage++
    },
    fillRect: () => {
      state.fillRect++
    },
    fillText: () => {
      state.fillText++
    },
  }

  const proxy = new Proxy(ctx, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, v) => {
      t[prop] = v
      return true
    },
  })

  return { proxy, state }
}

describe('anim-demo canvas2d tails', () => {
  let rafQueue
  let rafSeq
  let origRaf
  let origCaf
  let origGetContext
  let stageCanvas
  let ctxState

  const CanvasProto = () => document.createElement(HTML_TAGS.CANVAS).constructor.prototype

  /** Runs every queued frame once; each pump re-arms the next callback. */
  const pump = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const pending = rafQueue.splice(0)

      for (const cb of pending) cb()
    }
  }

  /** A stage element carrying the demo canvas the drivers resolve. */
  const makeStage = (withCanvas = true) => {
    const stage = document.createElement(HTML_TAGS.DIV)

    if (withCanvas) {
      stageCanvas = document.createElement(HTML_TAGS.CANVAS)
      stageCanvas.classList.add(ANIM_DEMO_CLASSES.CANVAS)
      // A non-zero box — the glitch plate's scanline loop only iterates
      // when the portrait plate is taller than a couple of pixels.
      stageCanvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })
      stage.appendChild(stageCanvas)
    }

    return { stage }
  }

  beforeEach(() => {
    rafQueue = []
    rafSeq = 1

    origRaf = globalThis.requestAnimationFrame
    origCaf = globalThis.cancelAnimationFrame

    globalThis.requestAnimationFrame = (cb) => {
      const h = rafSeq++

      rafQueue.push(cb)

      return h
    }

    globalThis.cancelAnimationFrame = () => {}

    const rec = recording2d()

    ctxState = rec.state
    origGetContext = CanvasProto().getContext
    CanvasProto().getContext = (type) =>
      String(type) === WEBGL_STRINGS.CONTEXT_2D ? rec.proxy : null

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  afterEach(() => {
    rafQueue = []
    globalThis.requestAnimationFrame = origRaf
    globalThis.cancelAnimationFrame = origCaf
    CanvasProto().getContext = origGetContext
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('glitch demo bails without a stage canvas or a 2D backend', () => {
    expect(mountGlitchDemo(makeStage(false))()).toBeUndefined()

    CanvasProto().getContext = () => null

    expect(mountGlitchDemo(makeStage(true))()).toBeUndefined()
  })

  test('glitch demo paints one settled frame under reduced motion', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const teardown = mountGlitchDemo(makeStage(true))

    expect(ctxState.drawImage).toBe(1)
    expect(rafQueue.length).toBe(0)
    expect(teardown()).toBeUndefined()
  })

  test('glitch demo mounts the plate, slices on burst frames, and cancels', () => {
    const teardown = mountGlitchDemo(makeStage(true))

    // The offscreen plate painted at mount — frames inside the burst
    // window slice; past it the loop redraws without slicing.
    pump(12)

    expect(ctxState.drawImage).toBeGreaterThan(1)
    expect(ctxState.fillRect).toBeGreaterThan(0)
    expect(rafQueue.length).toBe(1)

    teardown()
  })

  test('glitch demo skips the plate when the offscreen ctx vanishes', () => {
    // Stage canvas resolves; the offscreen canvas's 2D returns null —
    // the mount must fall through to the loop without the plate paint.
    CanvasProto().getContext = function (type) {
      if (String(type) !== WEBGL_STRINGS.CONTEXT_2D) return null
      if (this === stageCanvas) {
        const rec = recording2d()

        ctxState = rec.state

        return rec.proxy
      }

      return null
    }

    mountGlitchDemo(makeStage(true))

    pump(2)

    expect(ctxState.drawImage).toBeGreaterThan(0)
  })

  test('scene demo bails without a stage canvas or a 2D backend', () => {
    expect(mountSceneDemo(makeStage(false))()).toBeUndefined()

    CanvasProto().getContext = () => null

    expect(mountSceneDemo(makeStage(true))()).toBeUndefined()
  })

  test('scene demo paints one settled frame under reduced motion', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const teardown = mountSceneDemo(makeStage(true))

    // The static star spread — one fillRect per star plus the ground.
    expect(ctxState.fillRect).toBeGreaterThan(0)
    expect(rafQueue.length).toBe(0)
    expect(teardown()).toBeUndefined()
  })

  test('scene demo drifts stars and recycles the ones that pass the camera', () => {
    // Near-zero random seeds park every star at the camera so the first
    // frame exercises the z<1 recycle arm; a falsy devicePixelRatio
    // exercises the ctx2d scale fallback in the same mount.
    const origRandom = Math.random
    const origDpr = window.devicePixelRatio

    Math.random = () => 0.0001
    window.devicePixelRatio = 0

    const teardown = mountSceneDemo(makeStage(true))

    pump(3)

    Math.random = origRandom
    window.devicePixelRatio = origDpr

    expect(ctxState.fillRect).toBeGreaterThan(0)
    expect(rafQueue.length).toBe(1)

    teardown()
  })

  test('mesh demo bails without a stage canvas or a 2D backend', () => {
    expect(mountMeshDemo(makeStage(false))()).toBeUndefined()

    CanvasProto().getContext = () => null

    expect(mountMeshDemo(makeStage(true))()).toBeUndefined()
  })

  test('mesh demo paints one settled frame under reduced motion', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const teardown = mountMeshDemo(makeStage(true))

    expect(ctxState.fillRect).toBeGreaterThan(0)
    expect(rafQueue.length).toBe(0)
    expect(teardown()).toBeUndefined()
  })

  test('mesh demo animates the lattice rows and guide spokes', () => {
    const teardown = mountMeshDemo(makeStage(true))

    pump(3)

    // Rows × dots + spoke runs land on fillRect every frame.
    expect(ctxState.fillRect).toBeGreaterThan(0)
    expect(rafQueue.length).toBe(1)

    teardown()
  })
})
