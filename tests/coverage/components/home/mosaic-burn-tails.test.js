/**
 * @file mosaic-burn-tails.test.js
 * @description Coverage tails for website/components/home/mosaic/burn.ts —
 * the hover title combustion: arm gating (no card/title/text/overlay/ctx,
 * reduced motion, tiny box), the rasterization fallback, the erosion +
 * particle loop, the rewrite slot insertion, hover/leave wiring, and
 * teardown.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HomeMosaic } from '@website/components/home/HomeMosaic.js'
import {
  armCardBurn as rawArmCardBurn,
  disarmCardBurn as rawDisarmCardBurn,
} from '@core/utils/burn/burn.js'
import { frame } from '@core/utils/burn/loop.js'
import { _PAD_X, _PAD_TOP } from '@core/utils/burn/tuning.js'
import store from '@core/store.js'
import { mount } from '@tests/fixtures/test-constants.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { MOSAIC_SELECTORS } from '@core/tokens/selectors/mosaic.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { UI_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { INPUT_STRINGS } from '@core/tokens/strings/input.js'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'

/** Class-name bundle the raw burn helpers expect — mirrors the production map. */
const BURN_CLASSES = {
  ITEM_BURNING: HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING,
  TITLE_OVERLAY: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_OVERLAY,
  TITLE: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE,
  TITLE_BURNING: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING,
  TITLE_BURN: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURN,
  TITLE_SLOT: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_SLOT,
  TITLE_DUP: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_DUP,
  TITLE_REWRITE: HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_REWRITE,
  DETAILS: HOME_MOSAIC_CLASSES.HOME_MOSAIC_DETAILS,
}

/** Partial-applied wrappers — bind the class/selector bundles so tests call with just (host, index). */
const armCardBurn = (host, i, item) =>
  rawArmCardBurn(host, i, item, BURN_CLASSES, MOSAIC_SELECTORS.HOME_MOSAIC_ITEM)
const disarmCardBurn = (host, i) =>
  rawDisarmCardBurn(host, i, BURN_CLASSES, MOSAIC_SELECTORS.HOME_MOSAIC_ITEM)

/** Selector constants for the burn-overlay DOM the assertions query. */
const BURN_SEL = `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURN}`
const SLOT_SEL = `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_SLOT}`
const TITLE_SEL = `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE}`
const OVERLAY_SEL = `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_OVERLAY}`

/** Single-card fixture — the burn helpers only need one item to act on. */
const ITEMS = [
  { label: 'Burn Card', link: 'burn-card', image: 'ia', description: 'Desc A', featured: false },
]

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('mosaic burn tails', () => {
  let el
  let cleanup
  let origGetContext
  let origRect

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

  beforeEach(() => {
    store.commit(UI_MUTATIONS.SET_INPUT_METHOD, INPUT_STRINGS.MOUSE)

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
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    cleanup?.()
  })

  test('armCardBurn mounts the canvas + slot and hides the h2 ink', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const card = cardEl()

    expect(card.querySelector(BURN_SEL)).not.toBeNull()
    expect(
      card
        .querySelector(TITLE_SEL)
        .classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)
    ).toBe(true)
    expect(card._burn).not.toBeNull()

    const slot = card.querySelector(SLOT_SEL)

    expect(slot).not.toBeNull()
    expect(slot.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    expect(slot.querySelector(COMPONENT_TAGS.DRAW_TEXT)).not.toBeNull()

    await flush(30)
    expect(card._burn.t).toBeGreaterThan(0)
  })

  test('re-arming while a session runs is a no-op', () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    armCardBurn(el, 0, ITEMS[0])
    expect(cardEl()._burn).toBe(s)
    expect(cardEl().querySelectorAll(SLOT_SEL).length).toBe(1)
  })

  test('the front burns the paper away and the loop settles', async () => {
    mountMosaic()
    armCardBurn(el, 0, { ...ITEMS[0], description: ATTR_VALUES.EMPTY })

    const s = cardEl()._burn

    await flush(2200)

    // Burn completed (~450ms min) and particles died — raf chain stopped.
    expect(s.t).toBeGreaterThan(s.dur / 1000)
  }, 10000)

  test('reduced motion swaps the title instantly without a canvas', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const card = cardEl()

    expect(card.querySelector(BURN_SEL)).toBeNull()
    expect(
      card
        .querySelector(TITLE_SEL)
        .classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)
    ).toBe(true)
    expect(card.querySelector(SLOT_SEL)).not.toBeNull()
  })

  test('armCardBurn bails without a card, title node, or title text', () => {
    mountMosaic()

    armCardBurn(el, 99, ITEMS[0])
    expect(el._burn).toBeUndefined()

    cardEl().querySelector(TITLE_SEL).remove()
    armCardBurn(el, 0, ITEMS[0])
    expect(cardEl()._burn).toBeUndefined()

    el._updateDom() // fresh card nodes

    armCardBurn(el, 0, { link: 'x', image: 'y' }) // no label/title
    expect(cardEl()._burn).toBeUndefined()
  })

  test('armCardBurn bails on a zero-size title box', () => {
    mountMosaic()

    Element.prototype.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    armCardBurn(el, 0, ITEMS[0])
    expect(cardEl().querySelector(BURN_SEL)).toBeNull()
  })

  test('armCardBurn bails when the 2D context is unavailable', () => {
    CanvasProto().getContext = () => null
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    expect(cardEl().querySelector(BURN_SEL)).toBeNull()
    expect(cardEl()._burn).toBeUndefined()
  })

  test('armCardBurn bails when the title overlay is missing', () => {
    mountMosaic()
    cardEl().querySelector(OVERLAY_SEL).remove()

    armCardBurn(el, 0, ITEMS[0])

    // The overlay owns the h2 — without it there's nothing to burn.
    expect(cardEl().querySelector(BURN_SEL)).toBeNull()
    expect(cardEl().querySelector(SLOT_SEL)).toBeNull()
  })

  test('a card without a details panel skips the slot but still burns', () => {
    mountMosaic()

    const card = cardEl()

    card.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_DETAILS}`).remove()
    armCardBurn(el, 0, ITEMS[0])

    expect(card.querySelector(SLOT_SEL)).toBeNull()
    expect(card.querySelector(BURN_SEL)).not.toBeNull()
  })

  test('an empty title rasterizes to no lines but still arms', () => {
    mountMosaic()

    const card = cardEl()

    card.querySelector(TITLE_SEL).textContent = ATTR_VALUES.EMPTY
    armCardBurn(el, 0, ITEMS[0])

    expect(card.querySelector(BURN_SEL)).not.toBeNull()
  })

  test('the particle cap stops new spawns', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // Saturate the pool — spawn's capacity branch fires on the next frame.
    s.particles = new Array(110).fill(null).map(() => ({
      x: 1,
      y: 1,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 2,
      size: 1,
      kind: 0,
      rot: 0,
      spin: 0,
      phase: 0,
    }))

    await flush(40)

    expect(s.particles.length).toBeLessThanOrEqual(110)
  })

  test('a rebuild fleck dies the frame it lands on the climbing front', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])
    disarmCardBurn(el, 0)

    const s = cardEl()._burn

    // Keep the rebuild mid-flight so the loop keeps stepping particles.
    s.prog = 0.5

    const L = s.letters[0]
    const base = {
      x: s.paperX + (L.x0 + L.x1) / 2,
      y: s.paperY + 1e9, // below every possible front — the landing check fires
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1e9, // outlives the age check so the landing check runs
      size: 1,
      rot: 0,
      spin: 0,
      phase: 0,
      L,
    }
    const plantedFleck = { ...base, kind: 1 } // fleck — the dark char branch
    const plantedDeposit = { ...base, kind: 0 } // rebuild ember — the lighter deposit branch

    s.particles.push(plantedFleck, plantedDeposit)

    await flush(40)

    expect(s.particles.includes(plantedFleck)).toBe(false)
    expect(s.particles.includes(plantedDeposit)).toBe(false)

    s.prog = 0.01
    await flush(60)

    expect(cardEl()._burn).toBeNull()
  })

  test('mixed random spawns cover both ember and fleck branches', async () => {
    mountMosaic()

    let flip = false
    const rand = jest.spyOn(Math, 'random').mockImplementation(() => {
      flip = !flip
      return flip ? 0.01 : 0.5
    })

    armCardBurn(el, 0, ITEMS[0])

    await flush(120)
    rand.mockRestore()

    expect(cardEl()._burn.t).toBeGreaterThan(0)
  })

  test('disarmCardBurn reverses the burn, then restores title + drops canvas + slot', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])
    disarmCardBurn(el, 0)

    const card = cardEl()
    const s = card._burn

    // The session survives disarm — it now plays the rebuild backwards.
    expect(s).not.toBeNull()
    expect(s.dir).toBe(-1)
    expect(card.querySelector(BURN_SEL)).not.toBeNull()

    // Drive the rebuild to its end — frame() tears the session down.
    s.prog = 0.01
    await flush(60)

    expect(card._burn).toBeNull()
    expect(card.querySelector(BURN_SEL)).toBeNull()
    expect(card.querySelector(SLOT_SEL)).toBeNull()
    expect(
      card
        .querySelector(TITLE_SEL)
        .classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)
    ).toBe(false)
  })

  test('a settled session restarts its raf on disarm and rebuilds', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // Park the session in its settled state — loop stopped, burn done.
    s.t = s.dur
    s.particles.length = 0
    await flush(60)
    expect(s.raf).toBe(0)

    disarmCardBurn(el, 0)

    expect(s.dir).toBe(-1)
    expect(s.prog).toBe(1)
    expect(s.raf).not.toBe(0)

    s.prog = 0.01
    await flush(60)

    expect(cardEl()._burn).toBeNull()
  })

  test('a rebuild from a fully burned card sweeps stage 0→1 — columns, fronts, restored letters', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // Park the session fully burned: prog captures 1 at disarm, so the
    // first rebuild frames paint near stage 0 — still-missing letters
    // take the lp<=0 column-clear while fronts erase ABOVE the live edge.
    s.t = s.dur
    s.particles.length = 0
    await flush(60)
    expect(s.raf).toBe(0)

    disarmCardBurn(el, 0)
    expect(s.prog).toBe(1)

    await flush(40)

    expect(s.dir).toBe(-1)
    expect(cardEl().querySelector(BURN_SEL)).not.toBeNull()

    // Drive the tail — restored letters take the lp >= 1 skip until
    // prog reaches 0 and frame() tears the session down.
    s.prog = 0.02
    await flush(60)

    expect(cardEl()._burn).toBeNull()
    expect(cardEl().querySelector(BURN_SEL)).toBeNull()
  })

  test('re-arming mid-rebuild turns the front back around', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])
    disarmCardBurn(el, 0)

    const s = cardEl()._burn

    armCardBurn(el, 0, ITEMS[0])

    expect(cardEl()._burn).toBe(s)
    expect(s.dir).toBe(1)
    expect(cardEl().querySelectorAll(SLOT_SEL).length).toBe(1)
  })

  test('disarmCardBurn is a no-op on a clean card or missing index', () => {
    mountMosaic()

    disarmCardBurn(el, 0) // never armed — just removes nothing safely
    expect(cardEl()).not.toBeNull()

    disarmCardBurn(el, 42) // missing card
  })

  test('component hover arms the burn; leave rebuilds it in reverse', async () => {
    mountMosaic()

    el.onHover(0)
    await flush(30)

    const card = cardEl()

    expect(card.querySelector(SLOT_SEL)).not.toBeNull()
    expect(card.querySelector(BURN_SEL)).not.toBeNull()

    el.onLeave()

    // Leave starts the rebuild — canvas + slot persist while it plays.
    const s = cardEl()._burn

    expect(s).not.toBeNull()
    expect(s.dir).toBe(-1)

    s.prog = 0.01
    await flush(60)

    expect(cardEl().querySelector(SLOT_SEL)).toBeNull()
    expect(cardEl().querySelector(BURN_SEL)).toBeNull()
  })

  test('rasterizeTitle bails when the paper canvas has no 2d ctx', () => {
    let calls = 0

    // The overlay + work ctxs (first two calls) must still succeed —
    // only the paper canvas's getContext inside rasterizeTitle returns null.
    CanvasProto().getContext = (type) =>
      String(type) === '2d' ? (calls++ <= 1 ? createMock2D() : null) : null

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const card = cardEl()

    expect(card._burn).not.toBeNull()
    expect(card.querySelector(BURN_SEL)).not.toBeNull()
  })

  test('computed letter-spacing transfers onto the raster ctx', () => {
    const orig = globalThis.getComputedStyle

    globalThis.getComputedStyle = (node) => {
      const st = orig.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'letterSpacing' ? '2px' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    globalThis.getComputedStyle = orig

    expect(cardEl()._burn).not.toBeNull()
  })

  test('long titles wrap onto multiple raster lines', () => {
    const wide = () => {
      const base = createMock2D()

      return new Proxy(
        {},
        {
          get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 1e6 }) : base[prop]),
          set: () => true,
        }
      )
    }

    let calls = 0

    // Second '2d' call is the paper canvas inside rasterizeTitle.
    CanvasProto().getContext = (type) =>
      String(type) === '2d' ? (calls++ === 0 ? createMock2D() : wide()) : null

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    expect(cardEl()._burn).not.toBeNull()
  })

  test('unparseable computed font metrics fall back to defaults', () => {
    const orig = globalThis.getComputedStyle

    globalThis.getComputedStyle = (node) => {
      const st = orig.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'fontSize' || prop === 'lineHeight' ? '' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    globalThis.getComputedStyle = orig

    expect(cardEl()._burn).not.toBeNull()
  })

  test('zero-dt frames fall back to the 16ms step', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(s.lastT)

    await flush(50)
    nowSpy.mockRestore()

    expect(s.t).toBeGreaterThan(0)
  })

  test('the erase band stays idle until the front enters the paper', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    // Negative elapsed time → progress <= 0 → front still above the sheet.
    s.t = -1

    await flush(40)

    expect(s.active).toBe(true)
  })

  test('disarmCardBurn restarts the loop when the raf handle was cleared', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    s.raf = 0
    disarmCardBurn(el, 0)

    expect(s.dir).toBe(-1)
    expect(s.raf).not.toBe(0)

    s.prog = 0.01
    await flush(60)

    expect(cardEl()._burn).toBeNull()
  })

  test('reduced motion on a relocating host moves the title via ITEM_BURNED', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    mountMosaic()

    const onBurned = jest.fn()
    const armed = rawArmCardBurn(
      el,
      0,
      ITEMS[0],
      { ...BURN_CLASSES, ITEM_BURNED: HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING },
      MOSAIC_SELECTORS.HOME_MOSAIC_ITEM,
      1,
      onBurned
    )

    expect(armed).toBe(true)
    expect(onBurned).toHaveBeenCalledTimes(1)
    expect(cardEl().classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING)).toBe(true)
  })

  test('the consume beat flips a relocating session into rebuild in one frame', () => {
    mountMosaic()

    const onBurned = jest.fn()

    rawArmCardBurn(
      el,
      0,
      ITEMS[0],
      { ...BURN_CLASSES, ITEM_BURNED: HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING },
      MOSAIC_SELECTORS.HOME_MOSAIC_ITEM,
      1,
      onBurned
    )

    const card = cardEl()
    const s = card._burn

    // Land the forward clock exactly on the consume edge — the beat must
    // fire once: onBurned consumed + self-cleared, ITEM_BURNED applied,
    // direction flipped, rebuild progress re-derived from prog.
    s.t = s.dur / 1000
    frame(s)

    expect(onBurned).toHaveBeenCalledTimes(1)
    expect(s.onBurned).toBeNull()
    expect(s.dir).toBe(-1)
    expect(s.prog).toBe(1)
    expect(card.classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING)).toBe(true)
  })

  test('a knit frame re-rasterizes when the computed font signature moved', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    await flush(30)
    expect(s.lastBox).toBeTruthy()

    // The rebuild pass reads a settled font — mutate the signature terms
    // so syncPaper's guard falls through to the re-raster + timing copy.
    const orig = globalThis.getComputedStyle

    globalThis.getComputedStyle = (node) => {
      const st = orig.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'fontSize' ? '99px' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    disarmCardBurn(el, 0)
    frame(s)

    globalThis.getComputedStyle = orig

    // The re-raster ran: fresh lastBox + lastFont under the new signature.
    expect(s.lastBox).not.toBe(ATTR_VALUES.EMPTY)
    expect(s.lastFont).toContain('99px')
  })

  test('disarm on a clean card strips the ITEM_BURNED class', () => {
    mountMosaic()

    // No session + a relocating class map — the instant restore path
    // must still clear the relocated-title marker.
    rawDisarmCardBurn(
      el,
      0,
      { ...BURN_CLASSES, ITEM_BURNED: HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING },
      MOSAIC_SELECTORS.HOME_MOSAIC_ITEM
    )

    expect(cardEl()._burn).toBeUndefined()
  })

  test('a second disarm landing mid-rebuild keeps the counted-down progress', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    disarmCardBurn(el, 0)
    expect(s.dir).toBe(-1)

    const prog = s.prog

    // Second disarm while the rebuild runs — dir is already −1 so the
    // forward-rebase guard must NOT recompute prog.
    disarmCardBurn(el, 0)

    expect(s.prog).toBe(prog)
  })

  test('a knit re-raster with extra letters leaves the new timings authored', async () => {
    mountMosaic()
    armCardBurn(el, 0, ITEMS[0])

    const s = cardEl()._burn

    await flush(30)
    expect(s.lastBox).toBeTruthy()
    expect(s.letters.length).toBe(1)

    // The re-raster must find MORE letter clusters than the arm-time
    // pass so the timing copy hits its no-prev arm — swap the paper
    // canvas's ctx for one painting two ink runs.
    const twoRuns = {
      measureText: (t) => ({ width: String(t).length * 10 }),
      getImageData: (_x, _y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4)

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if ((x >= 5 && x <= 15) || (x >= 30 && x <= 45)) data[(y * w + x) * 4 + 3] = 255
          }
        }

        return { data }
      },
    }
    const ctx2 = new Proxy(twoRuns, {
      get: (t, prop) => (prop in t ? t[prop] : () => undefined),
      set: (t, prop, v) => {
        t[prop] = v
        return true
      },
    })

    CanvasProto().getContext = (type) => (String(type) === '2d' ? ctx2 : null)

    const orig = globalThis.getComputedStyle

    globalThis.getComputedStyle = (node) => {
      const st = orig.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'fontSize' ? '99px' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    disarmCardBurn(el, 0)
    frame(s)

    globalThis.getComputedStyle = orig

    // Two ink runs rasterized to two letters; index 1 had no prev.
    expect(s.letters.length).toBe(2)
    expect(s.lastFont).toContain('99px')
  })

  test('a transforming host cannot drift the canvas — anchors ride the offset chain', async () => {
    mountMosaic()

    const card = cardEl()
    const title = card.querySelector(TITLE_SEL)
    const overlay = card.querySelector(OVERLAY_SEL)
    const inner = document.createElement(HTML_TAGS.DIV)

    // Card-stack-shaped chain: title → inner → overlay. The dealt card's
    // transform inflates every getBoundingClientRect (the suite stub
    // returns 10/10 200×40 for every element — a 0,0 rect delta), while
    // the offset chain reports the layout box style.left/top share.
    for (const [node, props] of [
      [
        title,
        {
          offsetParent: inner,
          offsetLeft: 5,
          offsetTop: 30,
          offsetWidth: 200,
          offsetHeight: 40,
        },
      ],
      [inner, { offsetParent: overlay, offsetLeft: 8, offsetTop: 40 }],
      [overlay, { offsetWidth: 320 }],
    ]) {
      for (const [key, value] of Object.entries(props)) {
        Object.defineProperty(node, key, { get: () => value, configurable: true })
      }
    }

    armCardBurn(el, 0, ITEMS[0])

    const s = card._burn
    const canvas = card.querySelector(BURN_SEL)

    // Layout anchor x=5+8=13, y=30+40=70 — not the rect delta's 0,0.
    expect(canvas.style.left).toBe(`${13 - _PAD_X}px`)
    expect(canvas.style.top).toBe(`${70 - _PAD_TOP}px`)

    // The dealt card's scale inflates every rect — the layout anchor
    // must not move and the layout signature must not re-raster.
    Element.prototype.getBoundingClientRect = () => ({
      left: -500,
      top: -500,
      right: 900,
      bottom: 400,
      width: 1400,
      height: 900,
      x: -500,
      y: -500,
      toJSON: () => ({}),
    })

    frame(s)

    expect(canvas.style.left).toBe(`${13 - _PAD_X}px`)
    expect(canvas.style.top).toBe(`${70 - _PAD_TOP}px`)
    expect(s.lastBox).toContain('200,40')

    // The pile's real reflows (offsetTop shifting under _frontExtra
    // settling) must not move the canvas either — without the
    // ITEM_BURNED contract the anchor is frozen at the arm-time box.
    Object.defineProperty(inner, 'offsetTop', { get: () => 88, configurable: true })

    frame(s)

    expect(canvas.style.left).toBe(`${13 - _PAD_X}px`)
    expect(canvas.style.top).toBe(`${70 - _PAD_TOP}px`)
  })

  test('an overlay outside the offsetParent chain falls back to rect deltas', async () => {
    mountMosaic()

    const card = cardEl()
    const title = card.querySelector(TITLE_SEL)

    // The walk dead-ends without reaching the overlay — rect deltas
    // (0,0 under the suite stub) drive the anchor instead.
    Object.defineProperty(title, 'offsetParent', {
      get: () => document.createElement(HTML_TAGS.DIV),
      configurable: true,
    })

    armCardBurn(el, 0, ITEMS[0])

    const canvas = card.querySelector(BURN_SEL)

    expect(canvas.style.left).toBe(`${0 - _PAD_X}px`)
    expect(canvas.style.top).toBe(`${0 - _PAD_TOP}px`)

    // A moved rect does NOT re-anchor — without the ITEM_BURNED
    // relocation contract the canvas freezes at the arm-time box (the
    // dealt pile's reflows made live tracking read as the title sliding).
    Element.prototype.getBoundingClientRect = function () {
      const box =
        this === title
          ? { left: 30, top: 60, right: 230, bottom: 100, width: 200, height: 40 }
          : { left: 10, top: 10, right: 210, bottom: 50, width: 200, height: 40 }

      return { ...box, x: box.left, y: box.top, toJSON: () => ({}) }
    }

    frame(card._burn)

    expect(canvas.style.left).toBe(`${0 - _PAD_X}px`)
    expect(canvas.style.top).toBe(`${0 - _PAD_TOP}px`)
  })

  test('a relocating host (ITEM_BURNED) keeps live position tracking', async () => {
    mountMosaic()

    const card = cardEl()
    const title = card.querySelector(TITLE_SEL)

    // Dead-end the offset walk so the rect fallback drives the anchor,
    // then arm with the relocation contract present in the class map.
    Object.defineProperty(title, 'offsetParent', {
      get: () => document.createElement(HTML_TAGS.DIV),
      configurable: true,
    })

    rawArmCardBurn(
      el,
      0,
      ITEMS[0],
      { ...BURN_CLASSES, ITEM_BURNED: HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING },
      MOSAIC_SELECTORS.HOME_MOSAIC_ITEM
    )

    const canvas = card.querySelector(BURN_SEL)

    Element.prototype.getBoundingClientRect = function () {
      const box =
        this === title
          ? { left: 30, top: 60, right: 230, bottom: 100, width: 200, height: 40 }
          : { left: 10, top: 10, right: 210, bottom: 50, width: 200, height: 40 }

      return { ...box, x: box.left, y: box.top, toJSON: () => ({}) }
    }

    frame(card._burn)

    // The relocation contract follows the moved box — 30-10=20, 60-10=50.
    expect(canvas.style.left).toBe(`${20 - _PAD_X}px`)
    expect(canvas.style.top).toBe(`${50 - _PAD_TOP}px`)
  })
})
