/**
 * @file about-glitch-tails.test.js
 * @description Coverage tails for website/components/home/about/glitch.ts —
 * the 2D-canvas TV-glitch on the about portrait: arm gating (no img,
 * undecoded img, reduced motion, tiny box, null ctx), the corruption loop
 * (slice tear, block tear, RGB split, roll bar, invert flash, scanlines,
 * grain), delegated hover listeners, and teardown.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { AboutSection } from '@website/components/home/AboutSection.js'
import { armGlitch, disarmGlitch, attachGlitch } from '@website/components/home/about/glitch.js'
import store from '@core/store.js'
import { mount, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'

describe('about glitch tails', () => {
  let el
  let cleanup
  let origGetContext
  let origRect

  const CanvasProto = () => document.createElement('canvas').constructor.prototype

  const PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`
  const GLITCH_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_GLITCH}`

  const mountSection = () => {
    el = new AboutSection()
    cleanup = mount(el)
    el.aboutTranslations = { title: NAV_TEXT.ABOUT_ME, col1: [TEST_TEXT.BODY], col2: [TEST_TEXT.BODY] }
    el.profilePicture = TEST_URLS.IMG

    return el
  }

  const wrap = () => el.shadowRoot.querySelector(PIC_SEL)

  const decodeImg = () => {
    const img = wrap().querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`)

    Object.defineProperty(img, 'complete', { configurable: true, value: true })
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 320 })

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
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    cleanup?.()
  })

  test('armGlitch mounts the overlay canvas and starts the loop', async () => {
    mountSection()
    decodeImg()

    expect(armGlitch(el, wrap())).toBe(true)
    expect(el._glitch).not.toBeNull()
    expect(wrap().querySelector(GLITCH_SEL)).not.toBeNull()

    await new Promise((r) => setTimeout(r, 40))

    disarmGlitch(el)
    expect(el._glitch).toBeNull()
    expect(wrap().querySelector(GLITCH_SEL)).toBeNull()
  })

  test('armGlitch bails when the image has not decoded', () => {
    mountSection()

    expect(armGlitch(el, wrap())).toBe(false)
    expect(el._glitch).toBeNull()
  })

  test('armGlitch bails on reduced motion', () => {
    mountSection()
    decodeImg()
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    expect(armGlitch(el, wrap())).toBe(false)
  })

  test('armGlitch bails on a zero-size wrapper', () => {
    mountSection()
    decodeImg()

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

    expect(armGlitch(el, wrap())).toBe(false)
  })

  test('armGlitch bails when the 2D context is unavailable', () => {
    CanvasProto().getContext = () => null
    mountSection()
    decodeImg()

    expect(armGlitch(el, wrap())).toBe(false)
    expect(el._glitch).toBeNull()
  })

  test('armGlitch bails when no img exists in the wrapper', () => {
    el = new AboutSection()
    cleanup = mount(el)
    el.aboutTranslations = { title: NAV_TEXT.ABOUT_ME, col1: [TEST_TEXT.BODY], col2: [TEST_TEXT.BODY] }
    // No profilePicture → placeholder div instead of img.
    el.profilePicture = null

    expect(armGlitch(el, wrap())).toBe(false)
  })

  test('delegated mouseover raises intensity, mouseout drops it', async () => {
    mountSection()
    decodeImg()

    wrap().dispatchEvent(new MouseEvent(MOUSE_EVENTS.MOUSEOVER, { bubbles: true }))

    await new Promise((r) => setTimeout(r, 10))
    expect(el._glitch).not.toBeNull()
    expect(el._glitch.hover).toBe(true)

    wrap().dispatchEvent(new MouseEvent(MOUSE_EVENTS.MOUSEOUT, { bubbles: true }))

    // The session stays — always-on ambient; only the hover flag drops.
    expect(el._glitch).not.toBeNull()
    expect(el._glitch.hover).toBe(false)
  })

  test('mouseover outside the picture does not arm', () => {
    mountSection()
    decodeImg()

    el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT}`).dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.MOUSEOVER, { bubbles: true })
    )

    expect(el._glitch).toBeNull()
  })

  test('mouseout to a sibling inside the wrapper keeps the session', () => {
    mountSection()
    decodeImg()
    attachGlitch(el)

    const w = wrap()

    armGlitch(el, w)

    const inner = w.querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`)
    const out = new MouseEvent(MOUSE_EVENTS.MOUSEOUT, { bubbles: true })

    Object.defineProperty(out, 'relatedTarget', { value: inner })
    w.dispatchEvent(out)

    expect(el._glitch).not.toBeNull()
  })

  test('the corruption loop draws several frames without throwing', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    await new Promise((r) => setTimeout(r, 60))

    expect(el._glitch.t).toBeGreaterThan(0)
  })

  test('disconnect disarms the running session', () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    el.remove()

    expect(el._glitch).toBeNull()
  })

  test('armGlitch is idempotent once a session runs', () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch

    expect(armGlitch(el, wrap())).toBe(true)
    expect(el._glitch).toBe(s)
  })

  test('hover runs the heavy VHS pass (blocks, tracking, invert, roll)', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const rand = jest.spyOn(Math, 'random').mockReturnValue(0.01)

    el._glitch.hover = true

    await new Promise((r) => setTimeout(r, 60))

    rand.mockRestore()

    expect(el._glitch.t).toBeGreaterThan(0)
  })

  test('a detached canvas re-heals onto the live wrapper', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    el._glitch.canvas.remove()
    expect(wrap().querySelector(GLITCH_SEL)).toBeNull()

    await new Promise((r) => setTimeout(r, 40))

    // The tick re-attached the canvas to the still-live wrapper.
    expect(wrap().querySelector(GLITCH_SEL)).not.toBeNull()
  })

  test('heal bails while the wrapper is gone but the session survives', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch

    s.canvas.remove()
    wrap().remove()

    await new Promise((r) => setTimeout(r, 40))

    expect(el._glitch).toBe(s)
    expect(s.canvas.isConnected).toBe(false)
  })

  test('the arm poll fires once the img decodes', async () => {
    mountSection()

    // Undecoded at mount — the poll keeps retrying until decode lands.
    expect(el._glitch).toBeNull()

    await new Promise((r) => setTimeout(r, 350))
    expect(el._glitch).toBeNull()

    decodeImg()

    await new Promise((r) => setTimeout(r, 500))
    expect(el._glitch).not.toBeNull()
  })

  test('a missing scanline pattern is skipped cleanly', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch
    const orig = s.ctx.createPattern

    s.ctx.createPattern = () => null

    await new Promise((r) => setTimeout(r, 40))

    s.ctx.createPattern = orig

    expect(s.active).toBe(true)
  })

  test('tick exits when the host is unmounted without disarm', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch
    const raf = s.raf

    el._isMounted = false

    await new Promise((r) => setTimeout(r, 40))

    // The loop did not requeue — same handle, session not destroyed.
    expect(s.raf).toBe(raf)
    expect(el._glitch).toBe(s)
  })

  test('coverCrop falls back to unit height when naturalHeight is zero', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch
    const img = wrap().querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`)

    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 0 })

    // healSession re-runs sizeSession → coverCrop against the heightless img.
    s.canvas.remove()

    await new Promise((r) => setTimeout(r, 40))

    expect(s.canvas.isConnected).toBe(true)
    expect(s.sh).toBeGreaterThan(0)
  })

  test('tile builders degrade gracefully when their 2d ctx is unavailable', async () => {
    let calls = 0

    CanvasProto().getContext = (type) =>
      String(type) === '2d' ? (calls++ === 0 ? createMock2D() : null) : null

    mountSection()
    decodeImg()

    expect(armGlitch(el, wrap())).toBe(true)

    await new Promise((r) => setTimeout(r, 30))

    expect(el._glitch.active).toBe(true)
  })

  test('rollBar skips its pass while the band is offscreen', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch

    s.hover = true
    // Land the rolling band fully past the bottom: (t*0.4) % 1.3 > 1.
    s.t = 2.9

    await new Promise((r) => setTimeout(r, 40))

    expect(s.active).toBe(true)
  })

  test('scanlines skips when createPattern returns null', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch
    const base = s.ctx

    // The mock's set-trap swallows overrides — wrap it in a new Proxy.
    s.ctx = new Proxy(
      {},
      {
        get: (_t, prop) => (prop === 'createPattern' ? () => null : base[prop]),
        set: () => true,
      }
    )

    await new Promise((r) => setTimeout(r, 40))

    s.ctx = base

    expect(s.active).toBe(true)
  })

  test('hover corruption takes both sides of the random gates', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    let flip = false
    const rand = jest.spyOn(Math, 'random').mockImplementation(() => {
      flip = !flip

      return flip ? 0.01 : 0.99
    })

    el._glitch.hover = true

    await new Promise((r) => setTimeout(r, 80))

    rand.mockRestore()

    expect(el._glitch.t).toBeGreaterThan(0)
  })

  test('hover hits that fail the sub-gates skip blockTear/trackBar/invert', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    // 0.6 < _HOVER_HIT(0.65) → the hit pass runs, but 0.6 > 0.5/0.02 →
    // every per-effect gate takes its else arm deterministically.
    const rand = jest.spyOn(Math, 'random').mockReturnValue(0.6)

    el._glitch.hover = true

    await new Promise((r) => setTimeout(r, 60))

    rand.mockRestore()

    expect(el._glitch.t).toBeGreaterThan(0)
  })

  test('zero-dt frames fall back to the 16ms step', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(el._glitch.lastT)

    await new Promise((r) => setTimeout(r, 40))

    nowSpy.mockRestore()

    expect(el._glitch.t).toBeGreaterThan(0)
  })

  test('heal bails when the wrapper survives but the img is gone', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch
    const img = wrap().querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`)

    s.canvas.remove()
    img.remove()

    await new Promise((r) => setTimeout(r, 40))

    expect(el._glitch).toBe(s)
    expect(s.canvas.isConnected).toBe(false)
  })

  test('an in-flight arm poll does not double-arm after a manual arm', async () => {
    mountSection()

    // Undecoded at mount → a retry timer is already pending.
    await new Promise((r) => setTimeout(r, 60))

    decodeImg()
    armGlitch(el, wrap())

    await new Promise((r) => setTimeout(r, 350))

    expect(el._glitch).not.toBeNull()
  })

  test('disarmGlitch tolerates a cleared raf handle', () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    el._glitch.raf = 0
    disarmGlitch(el)

    expect(el._glitch).toBeNull()
  })

  test('mouseover on the wrap while armed keeps the session', async () => {
    mountSection()
    decodeImg()
    attachGlitch(el)
    armGlitch(el, wrap())

    wrap().dispatchEvent(new MouseEvent(MOUSE_EVENTS.MOUSEOVER, { bubbles: true }))

    expect(el._glitch.hover).toBe(true)
  })

  test('mouseover on the wrap with an undecoded img stays unarmed', () => {
    mountSection()
    attachGlitch(el)

    wrap().dispatchEvent(new MouseEvent(MOUSE_EVENTS.MOUSEOVER, { bubbles: true }))

    expect(el._glitch).toBeNull()
  })

  test('mouseout outside the wrapper leaves hover untouched', () => {
    mountSection()
    decodeImg()
    attachGlitch(el)
    armGlitch(el, wrap())

    el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT}`).dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.MOUSEOUT, { bubbles: true })
    )

    expect(el._glitch).not.toBeNull()
  })

  test('the ResizeObserver path re-sizes on valid entries and ignores degenerate ones', () => {
    const origRO = globalThis.ResizeObserver
    const instances = []

    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb
        instances.push(this)
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }

    try {
      mountSection()
      decodeImg()
      armGlitch(el, wrap())

      const ro = instances[0]
      const s = el._glitch

      expect(ro).toBeTruthy()

      const good = [{ contentRect: { width: 120, height: 120 } }]

      s.active = false
      ro.cb(good)
      s.active = true

      ro.cb([])
      ro.cb([{ contentRect: { width: 1, height: 120 } }])
      ro.cb([{ contentRect: { width: 120, height: 1 } }])
      ro.cb(good)

      expect(s.active).toBe(true)
    } finally {
      globalThis.ResizeObserver = origRO
    }
  })

  test('a natural-size drift without a live wrapper skips the re-size', async () => {
    mountSection()
    decodeImg()
    armGlitch(el, wrap())

    const s = el._glitch
    const img = wrap().querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`)

    wrap().remove()

    // Re-home the canvas outside the dead wrapper — the tick's heal gate
    // only reaches the drift check while the canvas stays connected.
    el.shadowRoot.appendChild(s.canvas)

    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: s.srcW + 8 })

    await new Promise((r) => setTimeout(r, 40))

    expect(s.active).toBe(true)
  })
})
