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

  test('false when a strict majority shares one aspect — the odd item rides the strip', () => {
    // 3 landscape + 1 portrait: spread alone is ≈3.6× past the gate, but
    // a wall of near-identical tiles with one misfit reads as a broken
    // grid — the majority keeps the carousel.
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1600, 900] },
        { src: 'c', size: [1366, 768] },
        { src: 'd', size: [828, 1792] },
      ])
    ).toBe(false)
    // 2 same + 1 odd of 3 → same verdict.
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1280, 720] },
        { src: 'c', size: [900, 1800] },
      ])
    ).toBe(false)
  })

  test('true when no majority cluster exists — the split stays a wall', () => {
    // 2 landscape + 2 portrait: 2 of 4 is not a strict majority, the
    // ≈3.16× spread still flags the mosaic.
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1600, 900] },
        { src: 'c', size: [1080, 1920] },
        { src: 'd', size: [900, 1800] },
      ])
    ).toBe(true)
  })

  test('true on the area-spread arm — tight ratios but a ≥3× area gulf', () => {
    // Ratios rise 0.5→0.8 (spread 1.6× — under RATIO_SPREAD_MIN and too
    // far apart to cluster), so the verdict falls through to the area
    // term: 38720/5000 ≈ 7.7× — a resolution gulf the wall would still
    // magnify into mismatched tile weight.
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [100, 50] },
        { src: 'b', size: [140, 84] },
        { src: 'c', size: [180, 126] },
        { src: 'd', size: [220, 176] },
      ])
    ).toBe(true)
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
    // Zero-dimension sizes are skipped by the positive-dimension guard.
    expect(
      hasIrregularMediaHeights([
        { src: 'a', size: [0, 1800] },
        { src: 'b', size: [900, 0] },
        { src: 'c', size: [1920, 1080] },
      ])
    ).toBe(false)
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

  test('a wall narrower than the floor keeps the clamped size — ÷1 is no wider', () => {
    // bound=50 clamps every rung to the same 50px width, so the ÷1 probe
    // can't beat the ÷4 clamp — the ternary's keep-s arm applies.
    const s = mosaicTileSize(1800, 1200, 50)
    expect(s).toEqual({ w: 50, h: 33 })
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
    // c (800x400) can't fit the 616 pocket under a at full width, and a
    // normal placement would bridge b's peak at y=616 — leaving the
    // pocket a stranded void. The pocket shrink-fit downscales c to the
    // segment width (616px, aspect kept → 308h) and rests it on the
    // pocket floor at y=316 instead.
    const c = packed.tiles[2].tile
    expect(parseInt(c.top)).toBe(300 + LAYOUT.GAP)
    expect(c.left).toBe(`${OFF}px`)
    expect(c.width).toBe(`${600 + LAYOUT.GAP}px`)
    expect(c.height).toBe(`${Math.round((400 * (600 + LAYOUT.GAP)) / 800)}px`)
    // Wall height = b's bottom (600) vs c's shrunk bottom (316 + 308).
    expect(packed.height).toBe(300 + LAYOUT.GAP + Math.round((400 * (600 + LAYOUT.GAP)) / 800))
  })

  test('footprints ending mid-segment split the skyline; edge pockets shrink-fit', () => {
    // Five-item wall exercising raiseSkyline's right-remainder arm:
    // b's 216px footprint ends mid-segment, leaving the uncovered
    // [1032, 1200] tail at y=0 — a pocket the shrink-fit later fills
    // with e (300px packed can't fit the 168px segment at the wall's
    // right edge, so it downscales, aspect kept).
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [2400, 1200] },
        { src: 'b', size: [600, 1200] },
        { src: 'c', size: [900, 300] },
        { src: 'd', size: [1200, 600] },
        { src: 'e', size: [900, 900] },
      ],
      W
    )
    const [a, b, c, d, e] = packed.tiles.map((t) => t.tile)
    expect([a.left, a.top, a.width, a.height]).toEqual(['0px', '0px', '800px', '400px'])
    expect([b.left, b.top, b.width, b.height]).toEqual(['816px', '0px', '200px', '400px'])
    expect([c.left, c.top, c.width, c.height]).toEqual(['0px', '416px', '300px', '100px'])
    expect([d.left, d.top, d.width, d.height]).toEqual(['316px', '416px', '400px', '200px'])
    // e's 300px packed width can't fit the 168px pocket at the wall's right
    // edge — the shrink-fit downsizes it to the segment (aspect kept).
    expect([e.left, e.top, e.width, e.height]).toEqual(['1032px', '0px', '168px', '168px'])
    expect(packed.height).toBe(416 + 200)

    // The second fixture shrink-fits the right-edge pocket directly: b's
    // 300px packed width can't fit the 284px segment, so it downscales
    // (aspect kept) and its footprint clamps flush to the wall edge.
    const packed2 = packMediaMosaic(
      [
        { src: 'a', size: [2700, 300] },
        { src: 'b', size: [900, 1800] },
        { src: 'c', size: [1500, 1500] },
      ],
      W
    )
    const [a2, b2, c2] = packed2.tiles.map((t) => t.tile)
    expect([a2.left, a2.top, a2.width, a2.height]).toEqual(['0px', '0px', '900px', '100px'])
    expect([b2.left, b2.top, b2.width, b2.height]).toEqual(['916px', '0px', '284px', '568px'])
    expect([c2.left, c2.top, c2.width, c2.height]).toEqual(['0px', '116px', '500px', '500px'])
    expect(packed2.height).toBe(116 + 500)
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

  test('a rising skyline and a shallower pocket skip non-improving candidates', () => {
    // b's footprint leaves a mid-wall step ABOVE a's floor ([316,532]
    // tops at 216 while a's span rests at 116) — so c's full-size pass
    // evaluates a candidate that doesn't improve the running min, and
    // the pocket pass evaluates a shallower pocket ([316,216] at y=216)
    // after the deeper one ([0,316] at y=116). c still lands full-size
    // on the deep floor at the right edge.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [900, 300] },
        { src: 'b', size: [600, 600] },
        { src: 'c', size: [1200, 600] },
      ],
      W
    )
    const [a, b, c] = packed.tiles.map((t) => t.tile)
    // The wall never reaches the right edge (c ends at 932) — the sparse
    // offset shifts every tile by (1200−932)/2 = 134.
    const off = Math.floor((W - (532 + 400)) / 2)
    expect([a.left, a.top, a.width, a.height]).toEqual([`${off}px`, '0px', '300px', '100px'])
    expect([b.left, b.top, b.width, b.height]).toEqual([`${316 + off}px`, '0px', '200px', '200px'])
    expect([c.left, c.top, c.width, c.height]).toEqual([`${532 + off}px`, '0px', '400px', '200px'])
    expect(packed.height).toBe(200)
  })

  test('an item without size metadata packs at the generic box', () => {
    // size?.[n] is undefined → the || 0 fallbacks route the item through
    // mosaicTileSize's generic-dimension path.
    const packed = packMediaMosaic([{ src: 'a' }, { src: 'b', size: [1800, 900] }], W)
    const a = packed.tiles[0].tile
    expect(a.width).toBe(
      `${Math.floor(GENERIC_DIMENSIONS.DEFAULT_WIDTH / INTERNAL_MOSAIC.DIVISOR_DEFAULT)}px`
    )
    expect(a.height).toBe(
      `${Math.round(GENERIC_DIMENSIONS.DEFAULT_HEIGHT / INTERNAL_MOSAIC.DIVISOR_DEFAULT)}px`
    )
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
