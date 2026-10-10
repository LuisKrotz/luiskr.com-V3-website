/**
 * @file mosaic-burn-letters.test.js
 * @description Per-letter combustion tests for website/components/home/mosaic/burn.ts —
 * the "hides the entire word" and "not letter-by-letter" bug classes:
 * the raster must keep painting with the title's PRE-HIDE ink color
 * (the burning class makes the DOM color transparent — rasterizing with
 * the live color draws invisible text), letters must be detected as
 * real glyph ink-runs with independent speeds/delays, and embers must
 * spawn only where a live front meets actual ink.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HomeMosaic } from '@website/components/home/HomeMosaic.js'
import { armCardBurn } from '@website/components/home/mosaic/burn.js'
import store from '@core/store.js'
import { mount } from '@tests/fixtures/test-constants.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { MOSAIC_SELECTORS } from '@core/tokens/selectors/mosaic.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { UI_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { INPUT_STRINGS } from '@core/tokens/strings/input.js'
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'

const TITLE_COLOR = 'rgb(12, 34, 56)'
const CLEAR_COLOR = 'rgba(0, 0, 0, 0)'

const ITEMS = [
  { label: 'Burn Card', link: 'burn-card', image: 'ia', description: 'Desc A', featured: false },
]

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/**
 * A recording 2D context: `fillText` snapshots the active fillStyle (the
 * raster ink assertion), `getImageData` returns a REAL sized buffer with
 * alpha painted per the `inkAt` column map (letter-run detection needs
 * true alpha layout — a flat 4-byte stub can never produce letters),
 * `measureText` returns a char-count width, and every other method no-ops.
 */
const createRecording2D = (inkAt = null) => {
  const state = { fillStyles: [], draws: [] }
  const ctx = {
    fillText: () => {
      state.fillStyles.push(ctx.fillStyle)
    },
    measureText: (t) => ({ width: String(t).length * 10 }),
    getImageData: (_x, _y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4)

      if (inkAt) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (inkAt(x, y)) data[(y * w + x) * 4 + 3] = 255
          }
        }
      }

      return { data }
    },
    drawImage: (...a) => state.draws.push(a),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({ setTransform: () => {} }),
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

describe('mosaic burn letters', () => {
  let el
  let cleanup
  let origGetContext
  let origRect
  let origGCS
  let ctxState

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

  /** Swaps in a recording 2D context with a given ink-column map. */
  const useInk = (inkAt) => {
    const rec = createRecording2D(inkAt)

    ctxState = rec.state
    CanvasProto().getContext = (type) => (String(type) === '2d' ? rec.proxy : null)
  }

  beforeEach(() => {
    store.commit(UI_MUTATIONS.SET_INPUT_METHOD, INPUT_STRINGS.MOUSE)

    origGetContext = CanvasProto().getContext
    useInk(null)

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

    origGCS = globalThis.getComputedStyle
    globalThis.getComputedStyle = (node) => {
      const st = origGCS.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'color' ? TITLE_COLOR : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    globalThis.getComputedStyle = origGCS
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    cleanup?.()
  })

  test('ink runs become letters — one burn unit per glyph, not a column grid', () => {
    // Two ink blocks (cols 2..8 and 14..20) split by a 6-col gap.
    useInk((x) => (x >= 2 && x < 8) || (x >= 14 && x < 20))
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    expect(s.letters.length).toBe(2)
    expect(s.letters[0].x0).toBe(2)
    expect(s.letters[0].x1).toBe(8)
    expect(s.letters[1].x0).toBe(14)
    expect(s.letters[1].x1).toBe(20)
  })

  test('letters track their own ink extent, speed and ignition delay', () => {
    useInk((x, y) => x >= 2 && x < 10 && y >= 5 && y < 30)
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn
    const L = s.letters[0]

    expect(L.y0).toBe(5)
    expect(L.y1).toBe(29)
    expect(L.v).toBeGreaterThan(0)
    expect(L.delay).toBeGreaterThanOrEqual(0)
    expect(L.delay).toBeLessThan(0.2)
  })

  test('gap columns bind to the nearest letter so fronts stay coherent', () => {
    useInk((x) => (x >= 2 && x < 8) || (x >= 14 && x < 20))
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // midpoint of the 6-col gap is col 11 → 8..10 bind letter 0, 11..13 letter 1.
    expect(s.colLetter[9]).toBe(0)
    expect(s.colLetter[12]).toBe(1)
    expect(s.colInk[4]).toBe(1)
    expect(s.colInk[10]).toBe(0)
  })

  test('the raster keeps the PRE-HIDE ink color — never the transparent live color', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // First rasterization used the real title color.
    expect(ctxState.fillStyles.length).toBeGreaterThan(0)
    expect(ctxState.fillStyles[0]).toBe(TITLE_COLOR)

    // The DOM ink now hides — its computed color is transparent, exactly
    // the condition that rasterized an invisible paper ("hides the word").
    globalThis.getComputedStyle = (node) => {
      const st = origGCS.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'color' ? CLEAR_COLOR : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    // Move the title box so the next frame re-rasterizes — the sig tracks
    // paper width, so only a width change forces a re-raster.
    ctxState.fillStyles.length = 0
    Element.prototype.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 190,
      bottom: 50,
      width: 180,
      height: 40,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    })

    await flush(40)

    // Re-raster still paints with the captured ink — not transparent.
    expect(ctxState.fillStyles.length).toBeGreaterThan(0)
    expect(ctxState.fillStyles[ctxState.fillStyles.length - 1]).toBe(TITLE_COLOR)
    expect(s.inkColor).toBe(TITLE_COLOR)
  })

  test('burn duration derives from the description typing time', () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // 'Desc A' = 6 chars → 6*8 + 260 = 308 → clamped to the 450ms floor.
    expect(s.dur).toBe(450)
  })

  test('empty paper (no ink) yields zero letters and no spawns', () => {
    useInk(() => false)
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    expect(s.letters.length).toBe(0)
  })

  test('each letter gets an independent burn profile (speeds differ across letters)', () => {
    useInk((x) => (x >= 2 && x < 8) || (x >= 14 && x < 20) || (x >= 26 && x < 32))
    mountMosaic()

    const rand = jest.spyOn(Math, 'random')
    let calls = 0

    // Deterministic sequence → the letters provably differ from each other.
    rand.mockImplementation(() => (calls++ % 7) / 7)

    armCardBurn(el, 0, ITEMS[0])
    rand.mockRestore()

    const s = cardEl()._burn
    const speeds = s.letters.map((L) => L.v)
    const delays = s.letters.map((L) => L.delay)

    expect(new Set(speeds).size).toBeGreaterThan(1)
    expect(new Set(delays).size).toBeGreaterThan(1)
  })

  test('a documentless readBurnInk falls back to the built-in ember palette', () => {
    mountMosaic()

    const doc = globalThis.document
    const origCreate = doc.createElement.bind(doc)
    let canvases = 0

    // The paper canvas is the LAST createElement in arm() — after it the
    // only document consumer left is readBurnInk, which then takes its
    // `typeof document === 'undefined'` arm.
    doc.createElement = (tag, ...rest) => {
      const node = origCreate(tag, ...rest)

      if (tag === HTML_TAGS.CANVAS && ++canvases === 3) globalThis.document = undefined

      return node
    }

    try {
      armCardBurn(el, 0, ITEMS[0])
    } finally {
      globalThis.document = doc
      delete doc.createElement
    }

    const s = cardEl()._burn

    expect(s).toBeTruthy()
    expect(s.ink.core).toBe(CANVAS_STRINGS.EMBER_CORE)
    expect(s.ink.mid).toBe(CANVAS_STRINGS.EMBER_MID)
    expect(s.ink.scorch).toBe(CANVAS_STRINGS.BURN_SCORCH)
  })

  test('a degenerate title/overlay box short-circuits the per-frame re-sync', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    Element.prototype.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 2,
      bottom: 2,
      width: 2,
      height: 2,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await flush(60)

    expect(s.active).toBe(true)
  })

  test('a spawn attempt landing on the gap column after a letter is skipped', async () => {
    // One-column ink run → letter span [8,9). random→0.5 rounds xp up to
    // the exclusive x1 (9) — a gap column, so colInk[xp] is falsy.
    useInk((x) => x === 8)
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn
    const rand = jest.spyOn(Math, 'random').mockReturnValue(0.5)

    await flush(80)

    rand.mockRestore()

    expect(s.active).toBe(true)
    expect(s.particles.length).toBe(0)
  })

  test('speed normalization lands the slowest letter at ~0.92 progress — the burn completes', () => {
    // Regression: the norm factor used to be _BURN_END/worst (the
    // reciprocal), which stretched the slowest finisher past progress 1
    // and froze the burn mid-letter — the "effect never finishes" bug.
    // A letter finishes at progress (1+delay)/v, so after normalization
    // the worst finisher must land ON 0.92, not 0.92²/worst.
    useInk((x) => (x >= 2 && x < 8) || (x >= 14 && x < 20) || (x >= 26 && x < 32))
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn
    const finishes = s.letters.map((L) => (1 + L.delay) / L.v)
    const last = Math.max(...finishes)

    expect(last).toBeGreaterThan(0.9)
    expect(last).toBeLessThanOrEqual(0.93)
    expect(finishes.every((f) => f <= 0.93)).toBe(true)
  })

  test('a missing work-canvas context aborts the arm and removes the overlay', () => {
    const rec = createRecording2D()
    let calls = 0

    CanvasProto().getContext = (type) =>
      String(type) === '2d' ? (calls++ === 0 ? rec.proxy : null) : null

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    expect(cardEl()._burn).toBeUndefined()
    expect(
      cardEl().querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURN}`)
    ).toBeNull()
  })

  test('a finished letter column-clears while the burn still runs, then the canvas wipes at settle', async () => {
    // Two letters — letter 0 is forced far past its finish so the next
    // frame takes the `lp >= 1` destination-out column clear (the
    // residual-lines fix) while letter 1 still burns the normal path.
    useInk((x) => (x >= 2 && x < 8) || (x >= 14 && x < 20))
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    s.letters[0].v = 1e6
    s.letters[0].delay = 0

    // Mid-burn progress (< _BURN_END): random→0 makes spawn pick letter 0,
    // whose letterFrontY returns -1 (the `p >= 1` arm) → ink-extent gate
    // rejects the emission.
    s.t = s.dur / 1000 / 2

    const rand = jest.spyOn(Math, 'random').mockReturnValue(0)

    await flush(60)
    rand.mockRestore()

    // Drive the session past _BURN_END with an empty particle list —
    // burnPaper's terminal clearRect + frame's settling wipe both run.
    s.t = s.dur
    s.particles.length = 0

    await flush(60)

    expect(s.active).toBe(true)
    expect(s.particles.length).toBe(0)
  })
})
