/**
 * @file about-glitch-crop.test.js
 * @description Framing-fidelity tests for website/components/home/about/glitch.ts —
 * the persistent "zoomed portrait" bug class: the canvas copy must draw the
 * SAME cover-fit region the DOM <img> shows, at every natural size, on every
 * frame — a stale or mis-framed rect is exactly what rendered a zoomed
 * fragment of the face instead of the centered portrait. The draw uses the
 * whole-image destination-rect form because srcset `x`-descriptor images
 * report density-corrected naturalWidth while drawImage source coords take
 * intrinsic pixels — source-crop math zooms a corner at DPR ≠ 1.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { AboutSection } from '@website/components/home/AboutSection.js'
import { armGlitch } from '@website/components/home/about/glitch.js'
import store from '@core/store.js'
import { mount, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'

describe('about glitch crop framing', () => {
  let el
  let cleanup
  let origGetContext
  let origRect
  let origGCS

  const CanvasProto = () => document.createElement('canvas').constructor.prototype

  const PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`
  const IMG_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`

  const mountSection = () => {
    el = new AboutSection()
    cleanup = mount(el)
    el.aboutTranslations = { title: NAV_TEXT.ABOUT_ME, col1: [TEST_TEXT.BODY], col2: [TEST_TEXT.BODY] }
    el.profilePicture = TEST_URLS.IMG

    return el
  }

  const wrap = () => el.shadowRoot.querySelector(PIC_SEL)

  const decodeImg = (nw = 320, nh = 320) => {
    const img = wrap().querySelector(IMG_SEL)

    Object.defineProperty(img, 'complete', { configurable: true, value: true })
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: nw })
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: nh })

    return img
  }

  beforeEach(() => {
    origGetContext = CanvasProto().getContext
    CanvasProto().getContext = (type) => (String(type) === '2d' ? createMock2D() : null)

    origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 160,
      bottom: 160,
      width: 160,
      height: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    origGCS = globalThis.getComputedStyle
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    globalThis.getComputedStyle = origGCS
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    cleanup?.()
  })

  test('a square portrait fills the viewport 1:1 — no crop, no zoom', () => {
    mountSection()
    decodeImg(320, 320)
    armGlitch(el, wrap())

    const s = el._glitch

    // For a square source in a square 160px viewport, cover-fit is the
    // identity — the dest rect IS the viewport. Any tighter rect is the
    // zoomed-fragment regression.
    expect(s.dx).toBe(0)
    expect(s.dy).toBe(0)
    expect(s.dw).toBe(160)
    expect(s.dh).toBe(160)
  })

  test('a wide portrait overflows symmetrically like object-fit:cover', () => {
    mountSection()
    decodeImg(640, 320)
    armGlitch(el, wrap())

    const s = el._glitch

    // scale = max(160/640, 160/320) = 0.5 → dw = 320 (80px overflow each
    // side), dh = 160. The centered negative dx IS the cover crop.
    expect(s.dw).toBe(320)
    expect(s.dh).toBe(160)
    expect(s.dx).toBe(-80)
    expect(s.dy).toBe(0)
  })

  test('object-position shifts the cover focus like the DOM img', () => {
    globalThis.getComputedStyle = (node) => {
      const st = origGCS.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'objectPosition' ? '100% 50%' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    mountSection()
    decodeImg(640, 320)
    armGlitch(el, wrap())

    const s = el._glitch

    // object-position:100% pins the source's right edge to the box's
    // right edge — dx slides the full 160px overflow left.
    expect(s.dx).toBe(-160)
    expect(s.dw).toBe(320)
  })

  test('an unparseable object-position falls back to centered', () => {
    globalThis.getComputedStyle = (node) => {
      const st = origGCS.call(globalThis, node)

      return new Proxy(st, {
        get: (t, prop) => {
          const v = prop === 'objectPosition' ? 'right center' : t[prop]

          return typeof v === 'function' ? v.bind(t) : v
        },
      })
    }

    mountSection()
    decodeImg(640, 320)
    armGlitch(el, wrap())

    expect(el._glitch.dx).toBe(-80)
  })

  test('a srcset candidate swap re-fits on the next frame — no stale zoom', async () => {
    mountSection()
    const img = decodeImg(640, 320)

    armGlitch(el, wrap())

    const s = el._glitch

    expect(s.dx).toBe(-80)

    // Browser picks a different density candidate → natural size drifts.
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 480 })

    await new Promise((r) => setTimeout(r, 50))

    // The drift detector re-ran sizeSession — the rect tracks the new
    // bitmap: dw = 480×0.5 = 240, dx = (160−240)×0.5 = −40.
    expect(s.srcW).toBe(480)
    expect(s.dx).toBe(-40)
    expect(s.dw).toBe(240)
  })

  test('drawBase re-resolves the cover rect per frame from the LIVE image', async () => {
    mountSection()
    const img = decodeImg(640, 320)

    armGlitch(el, wrap())

    const s = el._glitch
    const seen = []

    // Record every drawImage call the loop paints.
    s.ctx = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === 'drawImage') {
            return (...a) => seen.push(a.slice(0, 9))
          }

          return (..._a) =>
            prop === 'createPattern'
              ? { setTransform: () => {} }
              : prop === 'createLinearGradient'
                ? { addColorStop: () => {} }
                : undefined
        },
        set: () => true,
      }
    )

    await new Promise((r) => setTimeout(r, 50))

    seen.length = 0
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 480 })

    await new Promise((r) => setTimeout(r, 50))

    // Base draws must reflect the new 480-wide source — never the stale 640.
    const baseDraws = seen.filter((a) => a[0] === img)

    expect(baseDraws.length).toBeGreaterThan(0)

    const last = baseDraws[baseDraws.length - 1]

    expect(last[3]).toBe(240) // dw tracks the live source width
    expect(last[1]).toBe(-40) // dx re-centered for the 480-wide source
  })

  test('a non-square wrapper frames the circle diameter without zooming the square portrait', () => {
    Element.prototype.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 160,
      bottom: 360,
      width: 160,
      height: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    mountSection()
    decodeImg(320, 320)
    armGlitch(el, wrap())

    const s = el._glitch

    // Canvas is 160×360 device px; the square viewport (diameter 160) is
    // centered → oy = 100. A 320×320 source scales 0.5 → fills 160×160.
    expect(s.dx).toBe(0)
    expect(s.dy).toBe(100)
    expect(s.dw).toBe(160)
    expect(s.dh).toBe(160)
  })
})
