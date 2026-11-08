/**
 * @file media-mosaic-pack.test.js
 * @description Unit coverage for the media-mosaic skyline packer
 * (mosaic/pack.js) and the shared media-group predicates
 * (core/utils/media/group.js) — sizing ladder, packing geometry, and the
 * irregular-heights gate.
 */
import { describe, test, expect } from '@jest/globals'
import {
  mosaicTileSize,
  packMediaMosaic,
  estimateMosaicHeight,
} from '@website/components/media/mosaic/pack.js'
import {
  mediaItemHeightRatio,
  isAllLandscapeGroup,
  hasIrregularMediaHeights,
} from '@core/utils/media/group.js'
import { INTERNAL_MOSAIC, LAYOUT } from '@core/tokens/layout/masonry.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'

const W = 1200

describe('mediaItemHeightRatio', () => {
  test('returns h/w for sized items, null otherwise', () => {
    expect(mediaItemHeightRatio({ size: [1600, 900] })).toBeCloseTo(0.5625)
    expect(mediaItemHeightRatio({ size: [0, 900] })).toBeNull()
    expect(mediaItemHeightRatio({ size: [1600, 0] })).toBeNull()
    expect(mediaItemHeightRatio({})).toBeNull()
    expect(mediaItemHeightRatio(null)).toBeNull()
  })
})

describe('isAllLandscapeGroup', () => {
  test('true only for non-empty all-landscape groups', () => {
    expect(isAllLandscapeGroup([{ class: 'landscape' }, { class: 'landscape' }])).toBe(true)
    expect(isAllLandscapeGroup([{ class: 'landscape' }, {}])).toBe(false)
    expect(isAllLandscapeGroup([])).toBe(false)
    expect(isAllLandscapeGroup(null)).toBe(false)
  })
})

describe('hasIrregularMediaHeights', () => {
  test('true for mixed-orientation spreads past the gate', () => {
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1080, 1920] },
      ])
    ).toBe(true)
  })

  test('true for very-wide plus square irregular sets', () => {
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [2100, 900] },
        { src: 'b', size: [1000, 1000] },
        { src: 'c', size: [1600, 900] },
      ])
    ).toBe(true)
  })

  test('false for uniform ratio groups', () => {
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1600, 900] },
        { src: 'c', size: [1280, 720] },
      ])
    ).toBe(false)
  })

  test('false when any media stands taller than the 2560px cap — the wall never applies', () => {
    // Uniform-ratio tall screenshots: a >2560px source vetoes the mosaic
    // for the whole group — it stays on the capped carousel strip.
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [832, 1728] },
        { src: 'b', size: [1920, 5996] },
        { src: 'c', size: [1920, 4318] },
      ])
    ).toBe(false)
    // A lone tall capture vetoes too — never a one-item wall.
    expect(hasIrregularMediaHeights([{ src: 'a', size: [1920, 3000] }])).toBe(false)
    // Exactly at the bound is not over it — same-ratio pair isolates the
    // height term (spread alone would stay ≈1.0).
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [1920, 2560] },
        { src: 'b', size: [1800, 2400] },
      ])
    ).toBe(false)
  })

  test('false for single, empty, non-array and unsized groups', () => {
    expect(hasIrregularMediaHeights([{ src: 'a', size: [1920, 1080] }])).toBe(false)
    expect(hasIrregularMediaHeights([])).toBe(false)
    expect(hasIrregularMediaHeights(null)).toBe(false)
    expect(hasIrregularMediaHeights([{ src: 'a' }, { src: 'b' }])).toBe(false)
    expect(hasIrregularMediaHeights([{ src: 'a', size: [900, 1800] }, { src: 'b' }])).toBe(false)
    // An unsized item beside a tall one — the tall source still vetoes.
    expect(hasIrregularMediaHeights([{ src: 'a', size: [900, 4000] }, { src: 'b' }])).toBe(false)
  })
})

describe('mosaicTileSize', () => {
  test('renders at natural/3 for typical sizes', () => {
    const s = mosaicTileSize(1800, 1200, W)
    expect(s).toEqual({ w: 600, h: 400 })
  })

  test('drops to /4 when /3 still overflows the wall', () => {
    const s = mosaicTileSize(4800, 2400, W)
    expect(s).toEqual({ w: 1200, h: 600 })
  })

  test('clamps to the wall when even /4 overflows', () => {
    const s = mosaicTileSize(9600, 4800, W)
    expect(s).toEqual({ w: W, h: 600 })
  })

  test('bumps to /2 when /3 would be too small for the expand trigger', () => {
    const s = mosaicTileSize(400, 300, W)
    expect(s).toEqual({ w: 200, h: 150 })
  })

  test('keeps undivided when even /2 stays under the floor', () => {
    const s = mosaicTileSize(200, 150, W)
    expect(s).toEqual({ w: 200, h: 150 })
  })

  test('a source smaller than the floor keeps its natural box', () => {
    const s = mosaicTileSize(100, 80, W)
    expect(s.w).toBeLessThanOrEqual(INTERNAL_MOSAIC.MIN_TILE_W)
    expect(s.w).toBe(100)
  })

  test('falls back to generic dims for missing/degenerate input', () => {
    const s = mosaicTileSize(0, 0, W)
    expect(s).toEqual({
      w: Math.floor(GENERIC_DIMENSIONS.DEFAULT_WIDTH / INTERNAL_MOSAIC.DIVISOR_DEFAULT),
      h: Math.round(GENERIC_DIMENSIONS.DEFAULT_HEIGHT / INTERNAL_MOSAIC.DIVISOR_DEFAULT),
    })
    expect(mosaicTileSize(1800, 1200, 0)).toEqual({ w: 600, h: 400 })
  })
})

describe('packMediaMosaic', () => {
  const items = [
    { src: 'a', size: [1800, 900] },
    { src: 'b', size: [900, 1800] },
    { src: 'c', size: [2400, 1200] },
  ]

  // The 3-tile wall never reaches the right edge (rightmost = b at
  // 600+GAP+300) → every left shifts by half the unused strip.
  const OFF = Math.floor((W - (600 + LAYOUT.GAP + 300)) / 2)

  test('returns positioned tiles and the wall height', () => {
    const packed = packMediaMosaic(items, W)
    expect(packed).not.toBeNull()
    expect(packed.tiles.length).toBe(3)
    expect(packed.height).toBeGreaterThan(0)
    const first = packed.tiles[0].tile
    expect(first.position).toBe('absolute')
    expect(first.top).toBe('0px')
    expect(first.left).toBe(`${OFF}px`)
    expect(first.width).toBe('600px')
    expect(first.height).toBe('300px')
  })

  test('drops later items into the lowest free span (true masonry)', () => {
    const packed = packMediaMosaic(items, W)
    // b (300x600) packs beside a (600x300): a's footprint incl. gap ends at 616
    const b = packed.tiles[1].tile
    expect(b.top).toBe('0px')
    expect(b.left).toBe(`${600 + LAYOUT.GAP + OFF}px`)
    // c (800x400) is too wide to slip under b's peak → rests on it at y=616
    const c = packed.tiles[2].tile
    expect(parseInt(c.top)).toBe(600 + LAYOUT.GAP)
    expect(c.left).toBe(`${OFF}px`)
    expect(packed.height).toBe(600 + LAYOUT.GAP + 400)
  })

  test('slips a narrow tile into the pocket a wide predecessor would seal', () => {
    // Shelf-hole repro: a leaves a 584px pocket at the right edge; b
    // (900w) can't fit it, so strict document order would drop b over
    // the pocket and seal it — the pocket area strands as a gap. The
    // global-min pick places c (300w) into the pocket first, then b
    // lands on the merged 316 shelf: shorter wall, no hole.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [1800, 900] },
        { src: 'b', size: [2700, 300] },
        { src: 'c', size: [900, 900] },
      ],
      W
    )
    const c = packed.tiles[2].tile
    expect(c.top).toBe('0px')
    const b = packed.tiles[1].tile
    expect(parseInt(b.top)).toBe(300 + LAYOUT.GAP)
    expect(packed.height).toBe(300 + LAYOUT.GAP + 100)
  })

  test('packs a wall of one item', () => {
    const packed = packMediaMosaic([{ src: 'a', size: [1500, 1500] }], W)
    expect(packed.tiles.length).toBe(1)
    expect(packed.height).toBe(500)
  })

  test('returns null for degenerate input', () => {
    expect(packMediaMosaic([], W)).toBeNull()
    expect(packMediaMosaic(null, W)).toBeNull()
    expect(packMediaMosaic(items, 0)).toBeNull()
    expect(packMediaMosaic(items, -5)).toBeNull()
  })

  test('estimateMosaicHeight mirrors the packed height (0 on degenerate)', () => {
    expect(estimateMosaicHeight(items, W)).toBe(packMediaMosaic(items, W).height)
    expect(estimateMosaicHeight([], W)).toBe(0)
  })
})
