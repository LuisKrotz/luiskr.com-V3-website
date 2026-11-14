/**
 * @file about-mesh-tails.test.js
 * @description Coverage tails for website/components/home/about/mesh.ts —
 * the portrait's light-field dot lattice. Drives the multi-frame paint
 * loop so the cached theme-ink early-return arm fires, then flips the
 * dark-mode class to force palette re-sampling (computed-var parse arm
 * vs MESH_GREY fallback arm). Also walks the `host._mesh` self-heal paths
 * (dead-canvas re-mount, missing wrap bails on both the warm and cold
 * entries), the null/throwing 2D-context guards, the zero-size paint
 * bail, reduced-motion single-frame arming, and disarmMesh teardown.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { AboutSection } from '@website/components/home/AboutSection.js'
import { attachMesh, disarmMesh } from '@website/components/home/about/mesh.js'
import { framePool } from '@core/utils/motion/frame.js'
import store from '@core/store.js'
import { mount, TEST_COLORS, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { createMock2D } from '@tests/fixtures/mock-webgl.js'

describe('about mesh tails', () => {
  let el
  let cleanup
  let origGetContext
  let origRect
  let origDpr

  const CanvasProto = () => document.createElement(HTML_TAGS.CANVAS).constructor.prototype

  const PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`

  const rect = (px) => ({
    left: 0,
    top: 0,
    right: px,
    bottom: px,
    width: px,
    height: px,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  const mountSection = () => {
    el = new AboutSection()
    cleanup = mount(el)
    el.aboutTranslations = {
      title: NAV_TEXT.ABOUT_ME,
      col1: [TEST_TEXT.BODY],
      col2: [TEST_TEXT.BODY],
    }
    el.profilePicture = TEST_URLS.IMG

    return el
  }

  /** A bare host with an open shadow root and no portrait wrapper. */
  const bareHost = () => {
    const host = document.createElement(HTML_TAGS.DIV)

    host.attachShadow({ mode: COMMON_ATTRS.OPEN })

    return host
  }

  beforeEach(() => {
    origGetContext = CanvasProto().getContext
    CanvasProto().getContext = (type) => (String(type) === '2d' ? createMock2D() : null)

    origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = () => rect(160)

    origDpr = window.devicePixelRatio
  })

  afterEach(() => {
    CanvasProto().getContext = origGetContext
    Element.prototype.getBoundingClientRect = origRect
    Object.defineProperty(window, 'devicePixelRatio', { value: origDpr, configurable: true })
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
    document.documentElement.style.removeProperty(THEME_CSS_PROPS.TEXT_MUTED)
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    cleanup?.()
  })

  test('the rAF loop paints repeated frames and the ink cache early-returns', async () => {
    document.documentElement.style.setProperty(THEME_CSS_PROPS.TEXT_MUTED, TEST_COLORS.INK)
    mountSection()

    expect(el._mesh).not.toBeNull()

    await new Promise((r) => setTimeout(r, 90))

    expect(el._mesh.canvas.isConnected).toBe(true)
  })

  test('a theme flip re-samples the dot ink and hits the fallback arm', async () => {
    mountSection()

    await new Promise((r) => setTimeout(r, 40))

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    await new Promise((r) => setTimeout(r, 40))

    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)

    await new Promise((r) => setTimeout(r, 40))

    expect(el._mesh).not.toBeNull()
  })

  test('attachMesh re-mounts a detached canvas on the live session', () => {
    mountSection()

    const s = el._mesh

    s.w = 99
    s.canvas.remove()
    // happy-dom keeps isConnected true after remove() — stub the getter so
    // the self-heal arm sees the canvas as detached.
    Object.defineProperty(s.canvas, 'isConnected', { value: false, configurable: true })

    expect(attachMesh(el)).toBe(true)
    expect(s.w).toBe(0)
    expect(el.shadowRoot.querySelector(PIC_SEL).contains(s.canvas)).toBe(true)
  })

  test('attachMesh falls back to devicePixelRatio 1 when the getter is falsy', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })
    mountSection()

    expect(el._mesh).not.toBeNull()
  })

  test('attachMesh early-returns when the session canvas is still live', () => {
    mountSection()

    expect(attachMesh(el)).toBe(true)
    expect(el._mesh.canvas.isConnected).toBe(true)
  })

  test('attachMesh bails when the wrapper is missing on warm and cold paths', () => {
    const warm = bareHost()

    warm._mesh = { canvas: document.createElement(HTML_TAGS.CANVAS) }

    expect(attachMesh(warm)).toBe(false)

    const cold = bareHost()

    expect(attachMesh(cold)).toBe(false)
  })

  test('attachMesh bails when the 2D context is null or throws', () => {
    mountSection()

    disarmMesh(el)
    CanvasProto().getContext = () => null

    expect(attachMesh(el)).toBe(false)

    CanvasProto().getContext = () => {
      throw new Error('no ctx')
    }

    expect(attachMesh(el)).toBe(false)
  })

  test('paint bails while the wrapper box is zero-size', async () => {
    Element.prototype.getBoundingClientRect = () => rect(0)
    mountSection()

    await new Promise((r) => setTimeout(r, 40))

    expect(el._mesh).not.toBeNull()
  })

  test('reduced motion arms a single static frame', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    mountSection()

    await new Promise((r) => setTimeout(r, 40))

    expect(el._mesh).not.toBeNull()
  })

  test('the paint loop parks offscreen and re-arms on intersection', async () => {
    const IO = globalThis.IntersectionObserver
    const seen = []

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb
        seen.push(this)
      }

      observe(target) {
        this.target = target
      }

      unobserve() {}

      disconnect() {}
    }

    try {
      mountSection()

      const s = el._mesh
      const io = seen.find((o) => o.target === s.canvas)

      // Empty entries → the `entries[0]?.isIntersecting` null arm parks `visible`.
      io.cb([])

      expect(s.visible).toBe(false)

      // Two visible fires — the first arms the chain (raf pending), the
      // second hits the `!s.raf` short-circuit so it can't double-schedule.
      io.cb([{ isIntersecting: true }])
      io.cb([{ isIntersecting: true }])

      expect(s.visible).toBe(true)
      expect(s.raf).not.toBe(0)

      // Leaving the viewport parks the chain at its next tick.
      io.cb([{ isIntersecting: false }])

      await new Promise((r) => setTimeout(r, 30))

      expect(s.raf).toBe(0)

      // Re-entry re-arms the parked chain.
      io.cb([{ isIntersecting: true }])

      expect(s.raf).not.toBe(0)

      // lastPaint in the future forces the paint-cap skip arm on every tick.
      s.lastPaint = Number.MAX_SAFE_INTEGER

      await new Promise((r) => setTimeout(r, 30))

      // Park the chain before teardown so no stray tick outlives the test.
      s.visible = false
      if (s.raf) framePool.cancel(s.raf)
      s.raf = 0
    } finally {
      globalThis.IntersectionObserver = IO
    }
  })

  test('attachMesh falls back to the always-on loop without IntersectionObserver', () => {
    // Other about internals instantiate IntersectionObserver unguarded, so
    // the delete has to be scoped to the attachMesh call itself — a bare
    // host + wrapper keeps the window narrow enough that nothing else runs.
    const host = bareHost()
    const wrap = document.createElement(HTML_TAGS.DIV)

    wrap.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE
    host.shadowRoot.appendChild(wrap)

    const IO = globalThis.IntersectionObserver

    delete globalThis.IntersectionObserver

    try {
      expect(attachMesh(host)).toBe(true)
      expect(host._mesh.visible).toBe(true)
      expect(host._mesh.raf).not.toBe(0)
    } finally {
      globalThis.IntersectionObserver = IO
    }

    host._mesh.visible = false
    framePool.cancel(host._mesh.raf)
  })

  test('disarmMesh tears down and no-ops without a session', () => {
    mountSection()

    const s = el._mesh
    const disconnect = jest.fn()

    s.ro = { disconnect }

    disarmMesh(el)

    expect(el._mesh).toBeNull()
    expect(disconnect).toHaveBeenCalled()
    expect(el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_MESH}`)).toBeNull()

    disarmMesh(el)

    expect(el._mesh).toBeNull()
  })
})
