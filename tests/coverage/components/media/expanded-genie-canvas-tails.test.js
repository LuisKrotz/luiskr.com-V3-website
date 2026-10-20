/**
 * @file expanded-genie-canvas-tails.test.js
 * @description Coverage for website/components/media/expanded/genie-canvas.ts —
 * the universal 2D strip-warp genie backend. Covers: construction (source
 * sizing from naturalWidth/videoWidth/dest rect, accent tint parse +
 * fallback, dock-flash gradient build), the strip field (open/close
 * direction, nearBottom both ways, ghost bands without a source,
 * degenerate-band skips), the dock flash window, and dispose (overlay
 * canvas removal).
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { GENIE_WARP } from '@core/tokens/motion/genie.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { GenieCanvas2D } from '@website/components/media/expanded/genie-canvas.js'

/** A counting 2D-context stub — records draw calls, canvas backref. */
const mock2D = (canvas) => {
  const gradient = { addColorStop: () => {} }
  const calls = {
    drawImage: 0,
    fillRect: 0,
    fill: 0,
    clearRect: 0,
    setTransform: 0,
  }

  return new Proxy(
    { canvas },
    {
      get(target, prop) {
        if (prop === 'canvas') return target.canvas
        if (prop === 'calls') return calls

        return () => {
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
            return gradient
          }
          if (prop === 'measureText') return { width: 0 }
          if (prop === 'getTransform') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
          if (typeof prop === 'string' && prop in calls) calls[prop]++

          return undefined
        }
      },
      set() {
        return true
      },
    }
  )
}

const makeCanvas = () => {
  const c = document.createElement(HTML_TAGS.CANVAS)

  c.width = 800
  c.height = 600

  return c
}

/**
 * A stubbed composited sheet — `tex` is the baked surface canvas, `ctx`
 * its recording 2D stub; media/back exercise the live-restamp slots.
 */
const fakeSheet = ({ media = null, back = null, texCanvas = null, texCtx = null } = {}) => {
  const tex = texCanvas || makeCanvas()

  return {
    tex,
    ctx: texCtx || mock2D(tex),
    media,
    back,
    mediaBox: { x: 10, y: 10, w: 200, h: 120 },
    clipBox: { x: 0, y: 0, w: 400, h: 300 },
    clipRadius: 8,
  }
}

const FROM = { x: 20, y: 400, w: 120, h: 60 }
const TO = { x: 200, y: 60, w: 480, h: 270 }
const host = document.createElement(HTML_TAGS.DIV)

/** The adaptive band count drawStrips derives from a sheet height. */
const bands = (h) =>
  Math.min(
    GENIE_WARP.STRIPS,
    Math.max(GENIE_WARP.MIN_STRIPS, Math.ceil(h / GENIE_WARP.STRIP_TARGET_PX))
  )

describe('expanded genie canvas tails', () => {
  let origGetContext

  beforeEach(() => {
    origGetContext = document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext

    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = function (type) {
      return String(type) === '2d' ? mock2D(this) : null
    }
  })

  afterEach(() => {
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = origGetContext
  })

  const build = ({ sheet = null, opening = true, from = FROM, to = TO } = {}) => {
    const canvas = makeCanvas()
    const ctx = mock2D(canvas)

    return {
      canvas,
      ctx,
      r: new GenieCanvas2D(canvas, ctx, sheet, from, to, opening, host),
    }
  }

  test('the baked sheet texture supplies the strip source dims', () => {
    const { r } = build({ sheet: fakeSheet() })

    expect(r).toBeTruthy()
    expect(r.src).toBeTruthy()
    expect(r.srcW).toBe(800)
    expect(r.srcH).toBe(600)
  })

  test('null sheet falls back to the destination box and draws ghost bands', () => {
    const { ctx, r } = build()

    r.frame(0.016, 0.5)

    expect(ctx.calls.fill).toBe(bands(TO.h))
    // No sheet texture → no strip drawImage calls at all.
    expect(ctx.calls.drawImage).toBe(0)
  })

  test('draws one drawImage slice per adaptive band when a sheet texture exists', () => {
    const { ctx, r } = build({ sheet: fakeSheet() })

    r.frame(0.016, 0.5)

    expect(ctx.calls.drawImage).toBe(bands(TO.h))
  })

  test('frame clears the canvas exactly once', () => {
    const { ctx, r } = build()

    r.frame(0.016, 0.5)

    expect(ctx.calls.clearRect).toBe(1)
  })

  test('rest endpoints draw strips only — no flash at p=0 or p=1', () => {
    const { ctx, r } = build({ sheet: fakeSheet() })

    r.frame(0.016, 0)
    expect(ctx.calls.drawImage).toBe(bands(TO.h))
    expect(ctx.calls.fillRect).toBe(0)

    // p=1 — the sheet converges onto the figure rect (every row lands
    // inside the card), so all bands still draw.
    r.frame(0.016, 1)
    expect(ctx.calls.drawImage).toBe(bands(TO.h) * 2)
    expect(ctx.calls.fillRect).toBe(0)
  })

  test('the dock flash stamps inside the landing window only', () => {
    const { ctx, r } = build({ sheet: fakeSheet() })

    r.frame(0.016, 0.9)

    // One full-surface gradient stamp on top of the strips.
    expect(ctx.calls.fillRect).toBe(1)

    r.frame(0.016, 0.5)

    expect(ctx.calls.fillRect).toBe(1)
  })

  test('the video media slot restamps into the sheet every frame', () => {
    const vid = { videoWidth: 320, videoHeight: 240 }
    const texCanvas = makeCanvas()
    const tctx = mock2D(texCanvas)
    const sheet = fakeSheet({ media: vid, texCanvas, texCtx: tctx })

    const { r } = build({ sheet })

    r.frame(0.016, 0.5)

    // The restamp drawImage on the sheet ctx — video pixels live-update.
    expect(tctx.calls.drawImage).toBe(1)

    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(2)
  })

  test('an undecoded img restamps once on decode then drops its slot', () => {
    const img = {}
    const texCanvas = makeCanvas()
    const tctx = mock2D(texCanvas)
    const sheet = fakeSheet({ media: img, texCanvas, texCtx: tctx })

    const { r } = build({ sheet })

    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(0)

    img.naturalWidth = 80
    img.naturalHeight = 40
    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(1)

    // Static bitmap — the slot retired after the upgrade stamp.
    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(1)
  })

  test('the poster standby fills in while the video decodes', () => {
    const vid = {}
    const poster = { naturalWidth: 64, naturalHeight: 36 }
    const texCanvas = makeCanvas()
    const tctx = mock2D(texCanvas)
    const sheet = fakeSheet({ media: vid, back: poster, texCanvas, texCtx: tctx })

    const { r } = build({ sheet })

    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(1)

    // The poster drops after stamping; the video still owns its slot.
    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(1)

    vid.videoWidth = 320
    vid.videoHeight = 240
    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(2)
  })

  test('a video with only width reports no restamp until height lands', () => {
    const vid = { videoWidth: 320 }
    const texCanvas = makeCanvas()
    const tctx = mock2D(texCanvas)
    const sheet = fakeSheet({ media: vid, texCanvas, texCtx: tctx })

    const { r } = build({ sheet })

    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(0)
  })

  test('the restamp clip falls back to a square path when radius is 0', () => {
    const vid = { videoWidth: 320, videoHeight: 240 }
    const texCanvas = makeCanvas()
    const tctx = mock2D(texCanvas)
    const sheet = fakeSheet({ media: vid, texCanvas, texCtx: tctx })

    sheet.clipRadius = 0

    const { r } = build({ sheet })

    r.frame(0.016, 0.5)
    expect(tctx.calls.drawImage).toBe(1)
  })

  test('the restamp clip falls back to a square path without roundRect', () => {
    const vid = { videoWidth: 320, videoHeight: 240 }
    const texCanvas = makeCanvas()
    // A 2D context without roundRect support (older canvas impls).
    const tctx = new Proxy(
      { canvas: texCanvas, roundRect: undefined },
      {
        get(target, prop) {
          if (prop in target) return target[prop]

          return () => undefined
        },
        set() {
          return true
        },
      }
    )
    const sheet = fakeSheet({ media: vid, texCanvas, texCtx: tctx })

    const { r } = build({ sheet })

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('a zero media box skips the restamp entirely', () => {
    const vid = { videoWidth: 320, videoHeight: 240 }
    const sheet = fakeSheet({ media: vid })

    sheet.mediaBox = { x: 0, y: 0, w: 0, h: 0 }

    const { r } = build({ sheet })

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('a sheet without a texture paints the ghost silhouette', () => {
    const sheet = fakeSheet()

    sheet.tex = null

    const { ctx, r } = build({ sheet })

    r.frame(0.016, 0.5)

    expect(ctx.calls.fill).toBe(bands(TO.h))
  })

  test('close direction mirrors the fold — nearBottom from below destination', () => {
    // S = `from` on close — the adaptive count derives from FROM's height.
    const { ctx, r } = build({ opening: false, from: FROM, to: TO })

    r.frame(0.016, 0.5)

    expect(ctx.calls.fill).toBe(bands(FROM.h))
  })

  test('nearBottom false arm — origin above destination', () => {
    // S = `to` on open — swapped so the origin sits above the modal.
    const { ctx, r } = build({ from: TO, to: FROM })

    r.frame(0.016, 0.5)

    expect(ctx.calls.fill).toBe(bands(FROM.h))
  })

  test('frame returns true on a live context', () => {
    const { r } = build()

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('the dock flash falls back to the accent tint when --white is unset', () => {
    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => ({
      getPropertyValue: (p) => (p === THEME_CSS_PROPS.WHITE ? '' : 'rgb(255, 0, 0)'),
    })

    const { ctx, r } = build({ sheet: fakeSheet() })

    globalThis.getComputedStyle = origGCS

    r.frame(0.016, 0.9)

    expect(ctx.calls.fillRect).toBe(1)
  })

  test('a zero-scale base transform falls back to raw canvas dims', () => {
    const canvas = makeCanvas()
    const ctx = new Proxy(
      { canvas },
      {
        get(target, prop) {
          if (prop in target) return target[prop]
          if (prop === 'getTransform') return () => ({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 })
          if (prop === 'createRadialGradient') return () => ({ addColorStop: () => {} })

          return () => undefined
        },
        set() {
          return true
        },
      }
    )

    const r = new GenieCanvas2D(canvas, ctx, fakeSheet(), FROM, TO, true, host)

    expect(r.frame(0.016, 0.9)).toBe(true)
  })

  test('the dock flash degrades when the ctx lacks gradient support', () => {
    const canvas = makeCanvas()
    const ctx = new Proxy(
      { canvas, createRadialGradient: undefined },
      {
        get(target, prop) {
          if (prop in target) return target[prop]

          return () => undefined
        },
        set() {
          return true
        },
      }
    )

    const r = new GenieCanvas2D(canvas, ctx, fakeSheet(), FROM, TO, true, host)

    expect(r.frame(0.016, 0.9)).toBe(true)
  })

  test('the media slot upgrades the texture when a better source decodes', () => {
    const dead = { videoWidth: 0, videoHeight: 0 }
    const live = { naturalWidth: 16, naturalHeight: 8 }

    const canvas = makeCanvas()
    const c2 = mock2D(canvas)
    const texCanvas = makeCanvas()
    const tctx = mock2D(texCanvas)
    const sheet = fakeSheet({ media: dead, back: live, texCanvas, texCtx: tctx })

    const r = new GenieCanvas2D(canvas, c2, sheet, FROM, TO, true, host)

    r.frame(0.016, 0.5)

    // Video still undecoded → the standby poster stamped instead.
    expect(tctx.calls.drawImage).toBe(1)

    // The video's pixels land — it takes the slot back every frame.
    dead.videoWidth = 32
    dead.videoHeight = 18
    r.frame(0.016, 0.5)

    expect(tctx.calls.drawImage).toBe(2)
  })

  test('a missing sheet keeps the ghost silhouette', () => {
    const canvas = makeCanvas()
    const ctx = mock2D(canvas)
    const r = new GenieCanvas2D(canvas, ctx, null, FROM, TO, true, host)

    r.frame(0.016, 0.5)

    expect(ctx.calls.fill).toBe(bands(TO.h))
  })

  test('source dims fall back to 1 with no texture and a zero rect', () => {
    const { r } = build({ to: { x: 0, y: 0, w: 0, h: 0 } })

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('a resolved accent var tints the untextured ghost', () => {
    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => ({ getPropertyValue: () => 'rgb(255, 0, 0)' })

    const { r } = build()

    globalThis.getComputedStyle = origGCS

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('tint falls back to white when the accent var is unparseable', () => {
    const badHost = document.createElement(HTML_TAGS.DIV)
    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => ({ getPropertyValue: () => 'not-a-color' })

    const r = new GenieCanvas2D(makeCanvas(), mock2D(makeCanvas()), null, FROM, TO, true, badHost)

    globalThis.getComputedStyle = origGCS

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('a context without getTransform keeps the identity base', () => {
    const canvas = makeCanvas()
    const ctx = new Proxy(
      { canvas, getTransform: undefined },
      {
        get(target, prop) {
          if (prop in target) return target[prop]
          if (prop === 'createRadialGradient') return () => ({ addColorStop: () => {} })

          return () => undefined
        },
        set() {
          return true
        },
      }
    )

    const r = new GenieCanvas2D(canvas, ctx, fakeSheet(), FROM, TO, true, host)

    expect(r.frame(0.016, 0.5)).toBe(true)
  })

  test('a zero-height destination clamps every band to a sliver', () => {
    const { ctx, r } = build({
      // Ghost sheet — band fills are the only fill() calls. With iH=0
      // every band's hh collapses under MIN_BAND_PX; the sliver clamp
      // keeps them painting (no hairline gaps) instead of skipping.
      sheet: null,
      from: { x: 50, y: 300, w: 400, h: 0 },
    })

    r.frame(0.016, 1)

    expect(ctx.calls.fill).toBe(bands(TO.h))
  })

  test('a zero-width destination skips every degenerate band', () => {
    const { ctx, r } = build({
      // Ghost sheet — with iW ≈ 0 every band width stays at or under
      // the overdraw epsilon, so fill === 0 proves the width guard.
      sheet: null,
      from: { x: 50, y: 300, w: 0, h: 400 },
    })

    r.frame(0.016, 1)

    expect(ctx.calls.fill).toBe(0)
  })

  test('dispose removes the overlay canvas', () => {
    const parent = document.createElement(HTML_TAGS.DIV)
    const { canvas, r } = build()

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    expect(parent.children.length).toBe(1)

    r.dispose()

    expect(parent.children.length).toBe(0)

    parent.remove()
  })
})
