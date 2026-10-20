/**
 * @file expanded-genie-texture-tails.test.js
 * @description Coverage for website/components/media/expanded/genie-texture.ts —
 * the bounded media-card sheet baker. Covers: the extent chain (figure →
 * item → content, all-collapsed null guard), the texture ctx refusal, the
 * TEX_MAX_PX scale cap, stampFigure (missing/zero figure, rounded vs
 * square clip, placeholder present/missing-dims, item
 * present/absent/decoded/undecoded), the chrome-exclusion contract, the
 * live-media slot wiring (video restamp, undecoded img, poster standby)
 * and fitContain's zero-dims arm.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'
import { buildGenieSheet, fitContain } from '@website/components/media/expanded/genie-texture.js'

/** A counting 2D-context stub — every method is a no-op, records calls. */
const mock2D = (canvas, props = {}) => {
  const gradient = { addColorStop: () => {} }
  const calls = { drawImage: 0, fillRect: 0, fill: 0, fillText: 0, clip: 0 }

  return new Proxy(
    { canvas, ...props },
    {
      get(target, prop) {
        if (prop === 'calls') return calls
        if (prop in target) return target[prop]

        return (..._args) => {
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return gradient
          if (prop === 'measureText') return { width: 0 }
          if (typeof prop === 'string' && prop in calls) calls[prop]++

          return undefined
        }
      },
      set(target, prop, value) {
        target[prop] = value

        return true
      },
    }
  )
}

const rectOf = (r) => ({
  left: r.x,
  top: r.y,
  right: r.x + r.w,
  bottom: r.y + r.h,
  width: r.w,
  height: r.h,
  x: r.x,
  y: r.y,
  toJSON: () => ({}),
})

const CONTENT_RECT = { x: 0, y: 0, w: 800, h: 600 }

/** A modal-content stub — content root with a real rect, children added per test. */
const makeContent = () => {
  const c = document.createElement(HTML_TAGS.DIV)

  c.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT
  c.getBoundingClientRect = () => rectOf(CONTENT_RECT)

  return c
}

const addFigure = (content, { item = 'img', itemDims = true } = {}) => {
  const fig = document.createElement(HTML_TAGS.FIGURE)

  fig.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE
  fig.getBoundingClientRect = () => rectOf({ x: 200, y: 40, w: 400, h: 300 })

  const mediaItem = document.createElement(item === 'video' ? HTML_TAGS.VIDEO : HTML_TAGS.IMG)

  mediaItem.className =
    item === 'video'
      ? `${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM} ${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM_VIDEO}`
      : EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM
  mediaItem.getBoundingClientRect = () => rectOf({ x: 200, y: 40, w: 400, h: 300 })

  if (itemDims) {
    Object.defineProperty(mediaItem, item === 'video' ? 'videoWidth' : 'naturalWidth', {
      value: 640,
      configurable: true,
    })
    Object.defineProperty(mediaItem, item === 'video' ? 'videoHeight' : 'naturalHeight', {
      value: 360,
      configurable: true,
    })
  }

  fig.appendChild(mediaItem)
  content.appendChild(fig)

  return { fig, mediaItem }
}

describe('expanded genie texture tails', () => {
  let origGetContext

  beforeEach(() => {
    origGetContext = document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext

    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = function (type) {
      return String(type) === WEBGL_STRINGS.CONTEXT_2D ? mock2D(this) : null
    }
  })

  afterEach(() => {
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = origGetContext
  })

  test('returns null when the content box is empty', () => {
    const c = makeContent()

    c.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    expect(buildGenieSheet(c, 2)).toBeNull()
  })

  test('returns null when the texture canvas refuses a 2D context', () => {
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = () => null

    expect(buildGenieSheet(makeContent(), 2)).toBeNull()
  })

  test('bakes the sheet and reports the texture', () => {
    const sheet = buildGenieSheet(makeContent(), 2)

    expect(sheet.tex).toBeTruthy()
    expect(sheet.ctx).toBeTruthy()
    // 800×600 CSS-px sheet at dpr 2 → 1600×1200 texture px.
    expect(sheet.tex.width).toBe(1600)
    expect(sheet.tex.height).toBe(1200)
    // No figure → nothing stamped (no fullscreen bg fill — the sheet
    // is the bounded card, not the viewport glass).
    expect(sheet.ctx.calls.fillRect).toBe(0)
    expect(sheet.media).toBeNull()
    expect(sheet.back).toBeNull()
  })

  test('the scale caps at TEX_MAX_PX on huge viewports', () => {
    const c = makeContent()

    c.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 8000, h: 4000 })

    const sheet = buildGenieSheet(c, 2)

    expect(Math.max(sheet.tex.width, sheet.tex.height)).toBeLessThanOrEqual(2560)
  })

  test('the figure stamps its rounded clip, placeholder and decoded item', () => {
    const c = makeContent()
    const { mediaItem } = addFigure(c)

    const ph = document.createElement(HTML_TAGS.IMG)

    ph.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_PLACEHOLDER
    Object.defineProperty(ph, 'naturalWidth', { value: 32, configurable: true })
    Object.defineProperty(ph, 'naturalHeight', { value: 18, configurable: true })
    c.appendChild(ph)

    const sheet = buildGenieSheet(c, 2)

    // placeholder drawImage + media drawImage.
    expect(sheet.ctx.calls.drawImage).toBe(2)
    // Decoded static img → no live slot needed.
    expect(sheet.media).toBeNull()
    expect(sheet.mediaBox.w).toBe(400)
    expect(sheet.clipBox.w).toBe(400)
    expect(mediaItem.tagName).toBe('IMG')
  })

  test('a zero-size figure yields empty geometry but still resolves the item', () => {
    const c = makeContent()
    const { fig } = addFigure(c, { itemDims: false })

    fig.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    const sheet = buildGenieSheet(c, 2)

    expect(sheet.mediaBox.w).toBe(0)
    // Undecoded img → keeps the live slot for the mid-flight upgrade.
    expect(sheet.media).toBeTruthy()
  })

  test('an absent figure leaves empty geometry and no media slot', () => {
    const c = makeContent()

    const item = document.createElement(HTML_TAGS.IMG)

    item.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM
    Object.defineProperty(item, 'naturalWidth', { value: 100, configurable: true })
    Object.defineProperty(item, 'naturalHeight', { value: 50, configurable: true })
    c.appendChild(item)

    const sheet = buildGenieSheet(c, 2)

    expect(sheet.mediaBox.w).toBe(0)
    expect(sheet.clipRadius).toBe(0)
    expect(sheet.media).toBeNull()
  })

  test('a square figure (no radius / no roundRect) takes the rect clip', () => {
    const c = makeContent()
    const { fig } = addFigure(c)

    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = (el) =>
      el === fig ? { backgroundColor: 'rgb(1,2,3)', borderTopLeftRadius: '0px' } : origGCS(el)

    const sheet = buildGenieSheet(c, 2)

    globalThis.getComputedStyle = origGCS

    expect(sheet.clipRadius).toBe(0)
  })

  test('a video item keeps the live slot and primes its poster standby', () => {
    const c = makeContent()
    const { mediaItem } = addFigure(c, { item: 'video', itemDims: false })

    mediaItem.setAttribute(MEDIA_ATTRS.POSTER, TEST_URLS.IMG)

    const sheet = buildGenieSheet(c, 2)

    expect(sheet.media).toBe(mediaItem)
    expect(sheet.back.src).toBe(TEST_URLS.IMG)
  })

  test('a decoded video keeps the live slot with no poster standby', () => {
    const c = makeContent()

    addFigure(c, { item: 'video', itemDims: true })

    const sheet = buildGenieSheet(c, 2)

    expect(sheet.media).toBeTruthy()
    expect(sheet.back).toBeNull()
  })

  test('a video without a poster leaves the standby slot empty', () => {
    const c = makeContent()

    addFigure(c, { item: 'video', itemDims: false })

    const sheet = buildGenieSheet(c, 2)

    expect(sheet.media).toBeTruthy()
    expect(sheet.back).toBeNull()
  })

  test('viewport chrome stays out of the card sheet', () => {
    // The title bar, close button and bottom close label are
    // viewport-anchored chrome — the veil fades them while the funnel
    // flies; only the bounded figure card is the warp's texture.
    const c = makeContent()

    addFigure(c)

    const title = document.createElement(HTML_TAGS.SPAN)

    title.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BAR_TITLE
    title.textContent = 'Cover Title'
    title.getBoundingClientRect = () => rectOf({ x: 8, y: 8, w: 200, h: 20 })
    c.appendChild(title)

    const btn = document.createElement(HTML_TAGS.BUTTON)

    btn.className = PREF_CLASSES.PREF_CLOSE_BTN
    btn.getBoundingClientRect = () => rectOf({ x: 760, y: 8, w: 34, h: 34 })
    c.appendChild(btn)

    const bottom = document.createElement(HTML_TAGS.BUTTON)

    bottom.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BOTTOM
    bottom.textContent = 'close'
    bottom.getBoundingClientRect = () => rectOf({ x: 350, y: 560, w: 100, h: 24 })
    c.appendChild(bottom)

    const sheet = buildGenieSheet(c, 2)

    // Texture = the 400×300 figure at dpr 2 — no text, no disc fills.
    expect(sheet.tex.width).toBe(800)
    expect(sheet.tex.height).toBe(600)
    expect(sheet.ctx.calls.fillText).toBe(0)
    expect(sheet.ctx.calls.fill).toBe(0)
    // The media item alone stamped into the card.
    expect(sheet.ctx.calls.drawImage).toBe(1)
  })

  test('a figure with no media item still stamps its frame', () => {
    const c = makeContent()

    const fig = document.createElement(HTML_TAGS.FIGURE)

    fig.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE
    fig.getBoundingClientRect = () => rectOf({ x: 200, y: 40, w: 400, h: 300 })
    c.appendChild(fig)

    const sheet = buildGenieSheet(c, 2)

    // The figure frame baked; no item means empty media geometry.
    expect(sheet.clipBox.w).toBe(400)
    expect(sheet.mediaBox.w).toBe(0)
    expect(sheet.media).toBeNull()
  })

  test('a zero-size figure falls back to the media item extent', () => {
    // Figure collapsed (0×0) but the item still holds a real box —
    // the extent chain lands on the item rect, so the sheet covers it.
    const c = makeContent()
    const { fig } = addFigure(c, { itemDims: false })

    fig.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    const sheet = buildGenieSheet(c, 2)

    // Item rect 400×300 at dpr 2 → 800×600 texture.
    expect(sheet.tex.width).toBe(800)
    expect(sheet.tex.height).toBe(600)
    // Empty clip geometry — the live slot restamps once the figure
    // settles.
    expect(sheet.clipBox.w).toBe(0)
  })

  test('fitContain leaves a zero box for dimensionless sources', () => {
    const out = { x: 0, y: 0, w: 0, h: 0 }

    fitContain(0, 0, { x: 5, y: 5, w: 100, h: 50 }, out)

    expect(out.w).toBe(0)
    expect(out.x).toBe(55)
  })

  test('a rounded figure takes the roundRect clip path', () => {
    const c = makeContent()

    addFigure(c)

    // The figure resolves a real radius in-browser; happy-dom reports
    // '0px', so override it for this arm.
    const fig = c.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`)

    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = (el) =>
      el === fig
        ? { ...origGCS(el), borderTopLeftRadius: '8px', backgroundColor: 'rgb(4,5,6)' }
        : origGCS(el)

    const sheet = buildGenieSheet(c, 2)

    globalThis.getComputedStyle = origGCS

    // The figure's clipped bg fill.
    expect(sheet.ctx.calls.clip).toBe(1)
    expect(sheet.ctx.calls.fillRect).toBe(1)
  })
})
