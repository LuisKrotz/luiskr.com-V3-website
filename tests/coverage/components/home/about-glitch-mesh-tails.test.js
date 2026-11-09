/**
 * @file about-glitch-mesh-tails.test.js
 * @description Coverage tails for the about-portrait sessions: mesh.ts's
 * lattice paint loop + session lifecycle (attachMesh/size/disarmMesh and
 * the RO + reduced-motion arms) and the glitch session pipeline —
 * poll/armGlitch/armCtx2d/sizeSession/observeResize/tick/healSession/
 * dropSession plus glitch.ts's delegated hover handlers — all driven
 * through a real mounted <about-section> with a stubbed 2D context,
 * decoded portrait, ResizeObserver and rAF.
 */
import { jest } from '@jest/globals'
import '@website/components/home/AboutSection.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Fixture portrait URL. */
const TEST_PIC = 'https://www.gravatar.com/avatar/test?d=mp'

/** All-purpose 2D context stub — any unknown method is a no-op. */
const fake2d = () => {
  const gradient = { addColorStop: () => undefined }
  const factories = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
    createPattern: () => gradient,
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: [] }),
  }

  return new Proxy(
    { globalAlpha: 1, globalCompositeOperation: '', fillStyle: '' },
    {
      get: (t, k) => (k in t ? t[k] : factories[k] || (() => undefined)),
      set: (t, k, v) => {
        t[k] = v
        return true
      },
    }
  )
}

/** Decodes the rendered portrait img and gives the wrapper a real box. */
const armPortrait = (el) => {
  const wrap = el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`)
  const img = wrap?.querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`)

  if (img) {
    Object.defineProperty(img, 'complete', { configurable: true, value: true })
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 800 })
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 800 })
  }

  if (wrap) {
    wrap.getBoundingClientRect = () => ({
      width: 200,
      height: 200,
      top: 0,
      left: 0,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
    })
  }

  return { wrap, img }
}

describe('about glitch + mesh session tails', () => {
  test('mounted portrait arms the mesh + glitch sessions and tears them down', async () => {
    const canvasProto = document.createElement('canvas').constructor.prototype
    const realGetContext = canvasProto.getContext
    const realRO = globalThis.ResizeObserver
    const roCbs = []

    canvasProto.getContext = function (kind) {
      return kind === '2d' ? fake2d() : null
    }

    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb
        roCbs.push(cb)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    el.aboutTranslations = { title: 't' }
    el.profilePicture = TEST_PIC
    document.body.appendChild(el)
    await flush()

    const { wrap, img } = armPortrait(el)

    expect(wrap).not.toBeNull()

    try {
      // The poll retries at ~4 Hz — a decode lands within one flush window.
      await flush(300)

      expect(el._mesh).not.toBeNull()
      expect(el._glitch).not.toBeNull()
      expect(el._glitch.ctx).not.toBeNull()

      // Let a few rAF frames paint the mesh lattice + glitch frame.
      await flush(60)

      // The mesh canvas reads zero-size in happy-dom — give it a real box
      // so paint() runs the lattice body.
      const mc = el._mesh.canvas

      mc.getBoundingClientRect = () => ({ width: 200, height: 200 })
      el._mesh.w = 0
      el._mesh.h = 0

      await flush(60)

      // ResizeObserver callback arms on BOTH sessions (mesh + glitch):
      // empty entries, tiny box, real box.
      for (const roCb of roCbs) {
        roCb([])
        roCb([{ contentRect: { width: 1, height: 1 } }])
        roCb([{ contentRect: { width: 50, height: 50 } }])
      }

      // Hover toggles the glitch intensity flag through both delegates.
      wrap.dispatchEvent(new MouseEvent(MOUSE_EVENTS.MOUSEOVER, { bubbles: true }))
      expect(el._glitch.hover).toBe(true)
      wrap.dispatchEvent(
        new MouseEvent(MOUSE_EVENTS.MOUSEOUT, { bubbles: true, relatedTarget: document.body })
      )
      expect(el._glitch.hover).toBe(false)

      // srcset drift arm — naturalWidth change re-sizes the session.
      Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 1200 })

      await flush(60)

      // Self-heal arm — a re-render detaches the overlay canvases; the next
      // tick re-homes them on the fresh nodes.
      el._updateDom()
      await flush(30)
      armPortrait(el)
      await flush(60)

      el.remove()
      await flush(30)

      // Post-disarm RO fire — the `!s.active` early-return arm.
      for (const roCb of roCbs) roCb([{ contentRect: { width: 50, height: 50 } }])

      expect(el._mesh).toBeNull()
      expect(el._glitch).toBeNull()
    } finally {
      canvasProto.getContext = realGetContext
      globalThis.ResizeObserver = realRO
      el.remove()
    }
  })
})
