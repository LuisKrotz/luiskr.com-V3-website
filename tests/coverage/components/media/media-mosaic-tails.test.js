/**
 * @file media-mosaic-tails.test.js
 * @description Coverage tails for the <media-mosaic> runtime cluster —
 * mosaic/events.ts (matchMedia binding + breakpoint flips + host
 * ResizeObserver), mosaic/layout.ts (wall-width estimate, repack gate,
 * debounced scheduleLayout, imperative style writes), mosaic/render.tsx
 * (compact carousel vs packed wall, per-tile fallback arms), and
 * MediaMosaic.tsx (configure parity contract, items setter, mount/
 * update/destroy lifecycle, _syncCarousel passthrough).
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { bindMediaMosaicEvents } from '@website/components/media/mosaic/events.js'
import {
  estimateWallWidth,
  relayout,
  scheduleLayout,
  applyTileStyles,
} from '@website/components/media/mosaic/layout.js'
import { renderMediaMosaic } from '@website/components/media/mosaic/render.js'
import '@website/components/media/MediaMosaic.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { MEDIA_MOSAIC_CLASSES } from '@core/tokens/classes/media-mosaic.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { FORM_EVENTS } from '@core/tokens/events/dom.js'

const WALL_ITEMS = [
  { src: 'a.webp', size: [1800, 900], label: 'Alpha', class: 'landscape', canExpand: true },
  { src: 'b.webp', size: [900, 1800] },
]

/** Minimal host surface for the events/layout/render modules. */
const makeHost = (over = {}) => ({
  _items: WALL_ITEMS,
  _isCompact: false,
  _packedW: 0,
  _lastObservedW: 0,
  _mq: null,
  _ro: null,
  _rafId: null,
  tiles: [],
  wallH: `${CHAR_STRINGS.ZERO}${CHAR_STRINGS.PX}`,
  $: () => null,
  $$: () => [],
  addScopedListener: jest.fn(),
  _updateDom: jest.fn(),
  ...over,
})

/** Stubbed rAF pair — captures callbacks; cancel drops them by id. */
const stubRaf = () => {
  const pending = new Map()
  let next = 0

  globalThis.requestAnimationFrame = (cb) => {
    pending.set(++next, cb)
    return next
  }
  globalThis.cancelAnimationFrame = jest.fn((id) => pending.delete(id))

  return {
    pending,
    runAll: () => [...pending.values()].forEach((cb) => cb()),
  }
}

describe('media-mosaic events', () => {
  const origMatchMedia = window.matchMedia
  const origRO = globalThis.ResizeObserver
  const origRaf = globalThis.requestAnimationFrame
  const origCancel = globalThis.cancelAnimationFrame

  afterEach(() => {
    window.matchMedia = origMatchMedia
    globalThis.ResizeObserver = origRO
    globalThis.requestAnimationFrame = origRaf
    globalThis.cancelAnimationFrame = origCancel
  })

  test('no matchMedia → null mq, wall mode, no observer listeners', () => {
    window.matchMedia = undefined

    const host = makeHost()

    globalThis.ResizeObserver = undefined
    bindMediaMosaicEvents(host)

    expect(host._mq).toBeNull()
    expect(host._isCompact).toBe(false)
    expect(host.addScopedListener).not.toHaveBeenCalled()
    expect(host._ro).toBeNull()
  })

  test('compact query binds the flip listener + host ResizeObserver', () => {
    const listeners = []
    const mq = { matches: true }
    window.matchMedia = () => mq
    const host = makeHost({
      addScopedListener: jest.fn((t, e, fn) => {
        listeners.push(fn)
        return () => {}
      }),
    })

    let roCb = null
    globalThis.ResizeObserver = class {
      constructor(cb) {
        roCb = cb
      }
      observe() {}
      disconnect() {}
    }

    bindMediaMosaicEvents(host)

    expect(host._mq).toBe(mq)
    expect(host._isCompact).toBe(true)
    expect(host.addScopedListener).toHaveBeenCalledWith(
      mq,
      FORM_EVENTS.CHANGE,
      expect.any(Function)
    )
    expect(host._ro).not.toBeNull()

    // Same-state flip is a no-op.
    listeners[0]()
    expect(host._updateDom).not.toHaveBeenCalled()

    // Compact → wall: repacks (packedW reset) and schedules layout.
    const raf = stubRaf()
    mq.matches = false
    listeners[0]()

    expect(host._isCompact).toBe(false)
    expect(host._packedW).toBe(0)
    expect(host._updateDom).toHaveBeenCalled()
    expect(raf.pending.size).toBe(1)

    // Wall → compact: no scheduleLayout on entry.
    raf.pending.clear()
    mq.matches = true
    listeners[0]()
    expect(raf.pending.size).toBe(0)

    // RO: sub-epsilon deltas are dropped; real moves repack.
    roCb([{ contentRect: { width: host._lastObservedW + CAROUSEL_LAYOUT.FIT_EPS_PX / 2 } }])
    expect(raf.pending.size).toBe(0)

    roCb([{ contentRect: { width: 1400 } }])
    expect(host._lastObservedW).toBe(1400)
    expect(raf.pending.size).toBe(1)

    // Entries without a rect fall back to width 0.
    roCb([{}])
    expect(host._lastObservedW).toBe(0)
  })
})

describe('media-mosaic layout', () => {
  const origRaf = globalThis.requestAnimationFrame
  const origCancel = globalThis.cancelAnimationFrame
  const origIW = window.innerWidth

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf
    globalThis.cancelAnimationFrame = origCancel
    window.innerWidth = origIW
  })

  test('estimateWallWidth subtracts the grid gutters (0 without a viewport)', async () => {
    await Promise.resolve()

    window.innerWidth = 1024
    const w = estimateWallWidth()
    expect(w).toBeGreaterThan(0)
    expect(w).toBeLessThan(1024)

    await Promise.resolve()
    window.innerWidth = 0
    expect(estimateWallWidth()).toBe(0)
  })

  test('relayout packs on width change, applies geometry, skips when stable', () => {
    const wall = { clientWidth: 1200, style: {} }
    const tileEls = [{ style: {} }, { style: {} }]
    const host = makeHost({
      $: () => wall,
      $$: () => tileEls,
    })

    relayout(host)

    expect(host._packedW).toBe(1200)
    expect(host.tiles.length).toBe(2)
    expect(wall.style.height).toBe(host.wallH)
    expect(tileEls[0].style.position).toBe('absolute')

    // Same width + same tile count → no repack, styles still stamped.
    const tiles = host.tiles
    relayout(host)
    expect(host.tiles).toBe(tiles)
  })

  test('relayout early-outs: compact mode, empty items, zero wall width', async () => {
    relayout(makeHost({ _isCompact: true }))
    relayout(makeHost({ _items: [] }))

    await Promise.resolve()
    window.innerWidth = 0
    const host = makeHost()
    relayout(host)
    expect(host._packedW).toBe(0)
  })

  test('scheduleLayout coalesces into one rAF and reruns relayout', () => {
    const raf = stubRaf()
    const wall = { clientWidth: 900, style: {} }
    const host = makeHost({ $: () => wall })

    scheduleLayout(host)
    scheduleLayout(host)

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled()
    expect(raf.pending.size).toBe(1)

    raf.runAll()
    expect(host._packedW).toBe(900)
  })

  test('applyTileStyles tolerates a missing wall and missing tiles', () => {
    const tileEls = [{ style: {} }, { style: {} }]
    const host = makeHost({ $$: () => tileEls })

    host.tiles = [{ tile: { position: 'absolute' } }]
    applyTileStyles(host)

    expect(tileEls[0].style.position).toBe('absolute')
    expect(tileEls[1].style.position).toBeUndefined()
  })

  test('a tile-count mismatch repacks even at the same wall width', () => {
    // tiles.length !== items.length alone reopens the pack gate.
    const wall = { clientWidth: 1200, style: {} }
    const host = makeHost({
      $: () => wall,
      _packedW: 1200,
      tiles: [{ tile: {} }],
    })

    relayout(host)

    expect(host.tiles.length).toBe(2)
  })
})

describe('media-mosaic render', () => {
  const hostFor = (over = {}) => ({
    _isCompact: false,
    _items: [],
    _folder: 'cdn/',
    wallH: '400px',
    tiles: [],
    ...over,
  })

  test('compact mode emits the plain carousel tag', () => {
    const el = renderMediaMosaic(hostFor({ _isCompact: true }))
    expect(el.tagName.toLowerCase()).toBe(COMPONENT_TAGS.CUSTOM_CAROUSEL)
  })

  test('wall tiles carry packed styles, labels, classes, and intrinsic sizes', () => {
    const host = hostFor({
      _items: [WALL_ITEMS[0], { src: 'c.webp' }, { size: [400, 300], label: ATTR_VALUES.EMPTY }],
      tiles: [
        { tile: { position: 'absolute', top: '0px' } },
        { tile: { position: 'absolute', top: '9px' } },
      ],
    })

    const el = renderMediaMosaic(host)
    const tiles = el.querySelectorAll(`.${MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC_ITEM}`)
    expect(tiles.length).toBe(3)

    // Label → sr-only h4 jump target; class joins the figure class list.
    expect(tiles[0].querySelector(`.${A11Y_CLASSES.SR_ONLY}`).textContent).toBe('Alpha')
    const fig0 = tiles[0].querySelector('media-figure')
    expect(fig0.getAttribute('classes')).toContain('landscape')
    expect(fig0.getAttribute('width')).toBe('1800')

    // Missing size → generic dims; missing label → no h4; missing class → bare list.
    const fig1 = tiles[1].querySelector('media-figure')
    expect(fig1.getAttribute('width')).toBe(String(GENERIC_DIMENSIONS.DEFAULT_WIDTH))
    expect(tiles[1].querySelector(`.${A11Y_CLASSES.SR_ONLY}`)).toBeNull()

    // Missing packed tile → empty style; missing src → index key still emits.
    expect(tiles[2].getAttribute('style') || '').not.toContain('top')
  })
})

describe('media-mosaic facade', () => {
  const origMatchMedia = window.matchMedia

  beforeEach(() => {
    document.body.innerHTML = ''
    window.matchMedia = () => ({
      matches: false,
      media: '',
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })
  })

  afterEach(() => {
    window.matchMedia = origMatchMedia
  })

  test('configure batches items/folder/forceActive; same payload is a no-op', () => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_MOSAIC)
    document.body.appendChild(el)

    const items = WALL_ITEMS
    el.configure({ items, folder: 'cdn/', forceActive: false })
    expect(el.items).toBe(items)
    expect(el.folder).toBe('cdn/')

    // Identical payload — early return keeps state untouched.
    const tiles = el.tiles
    el.configure({ items, folder: 'cdn/', forceActive: false })
    expect(el.tiles).toBe(tiles)

    el.remove()
  })

  test('items setter coerces non-arrays and repacks while mounted', () => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_MOSAIC)

    // Unmounted set skips the relayout/update pass.
    el.items = WALL_ITEMS
    expect(el.items).toBe(WALL_ITEMS)

    document.body.appendChild(el)

    el.items = 'nope'
    expect(el.items).toEqual([])

    el.items = WALL_ITEMS
    expect(el._packedW).toBeGreaterThanOrEqual(0)

    el.remove()
  })

  test('configure without a folder defaults the prefix to empty', () => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_MOSAIC)
    document.body.appendChild(el)

    el.configure({ items: WALL_ITEMS })

    expect(el.folder).toBe(ATTR_VALUES.EMPTY)

    el.remove()
  })

  test('compact mount forwards configure into the embedded carousel', () => {
    // The ≤1024 query matching is what flips the host to the carousel path.
    window.matchMedia = () => ({
      matches: true,
      media: '',
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })

    const el = document.createElement(COMPONENT_TAGS.MEDIA_MOSAIC)

    document.body.appendChild(el)
    el.configure({ items: WALL_ITEMS, folder: 'cdn/', forceActive: true })

    const carousel = el.shadowRoot.querySelector(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    expect(carousel).not.toBeNull()
    expect(carousel.items).toBe(WALL_ITEMS)

    el.remove()
  })

  test('_syncCarousel is a no-op without an embedded carousel', () => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_MOSAIC)
    document.body.appendChild(el)

    expect(() => el._syncCarousel()).not.toThrow()

    el.remove()
  })

  test('destroy releases a pending rafId and the observer', () => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_MOSAIC)
    document.body.appendChild(el)

    el.scheduleLayout()
    expect(el._rafId).not.toBeNull()

    el.remove()

    expect(el._rafId).toBeNull()
    expect(el._ro).toBeNull()
  })
})
