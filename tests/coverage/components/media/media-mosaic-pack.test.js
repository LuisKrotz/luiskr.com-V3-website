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
  stripHeroSlotClasses,
} from '@core/utils/media/group.js'
import { INTERNAL_MOSAIC, LAYOUT } from '@core/tokens/layout/masonry.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'

/** Container width (px) the pack-layout assertions compute against. */
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

  // The 3-tile wall leaves a right-edge strip (rightmost = b at
  // 600+GAP+308) — the void fill widens b into it until its bottom meets
  // the wall floor (600→616 height → w 300→308), so every left shifts by
  // half of the remaining strip.
  const OFF = Math.floor((W - (600 + LAYOUT.GAP + 308)) / 2)

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
    // c (800x400) can't fit the 616 pocket under a at full width, and the
    // full segment width would end its box flush on b's edge (a 0px
    // seam) — the shrink-fit backs the box off one GAP to 600px wide
    // (aspect kept → 300h) and rests it on the pocket floor at y=316.
    const c = packed.tiles[2].tile
    expect(parseInt(c.top)).toBe(300 + LAYOUT.GAP)
    expect(c.left).toBe(`${OFF}px`)
    expect(c.width).toBe('600px')
    expect(c.height).toBe('300px')
    // Wall height = c's shrunk bottom vs b's grown bottom — both 616.
    expect(packed.height).toBe(300 + LAYOUT.GAP + 300)
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

  test('the void fill widens a canyon wall tile into the dead pocket', () => {
    // a's tail leaves a canyon under it ([616,900] × [100,616]); e lands
    // at the canyon's left edge with its top inside the void band, so the
    // fill pass widens it — aspect kept — instead of stranding the dead
    // strip. FILL_GROW_MAX (1.5) wins over the width/floor factors.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [2700, 300] },
        { src: 'b', size: [600, 1800] },
        { src: 'd', size: [900, 300] },
        { src: 'e', size: [900, 900] },
      ],
      W
    )
    const e = packed.tiles[3].tile
    const grown = Math.round(300 * INTERNAL_MOSAIC.FILL_GROW_MAX)
    expect(e.width).toBe(`${grown}px`)
    expect(e.height).toBe(`${grown}px`)
  })

  test('a bounded canyon keeps one GAP before the opposite wall', () => {
    // b is the tall right column; g drifts to the canyon mouth at 864 and
    // rests on b's fp at 716. The void between a's tail and g's top is
    // walled on BOTH sides — f's right edge at 848, b's box overlapping
    // the band at 916 — so f widens only to x1−GAP: the 16px rhythm
    // survives the fill.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [2700, 300] },
        { src: 'b', size: [600, 2100] },
        { src: 'c', size: [600, 1500] },
        { src: 'd', size: [600, 1500] },
        { src: 'e', size: [600, 1500] },
        { src: 'f', size: [600, 1500] },
        { src: 'g', size: [600, 1200] },
      ],
      W
    )
    const f = packed.tiles[5].tile
    // f lands at (648,116) 200×500; the grown edge stops one GAP before
    // b's left edge at 916: w = 900−648 = 252, aspect kept → h = 630.
    expect(f.width).toBe(`${Math.round(200 * 1.26)}px`)
    expect(f.height).toBe(`${Math.round(500 * 1.26)}px`)
  })

  test('a candidate overflowing the wall edge is skipped before it can land', () => {
    // a's footprint leaves a 184px trailing strip at the right edge; b is
    // 467 wide — evaluating it at that segment start overflows the wall,
    // so bestSpot skips the candidate and b rests on a's shelf instead.
    // The fill can't widen a into the strip: the floor under the grown
    // span is b's top, and the grown bottom would land flush on it — the
    // one-GAP discount leaves fh at exactly 1, so a keeps its packed box.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [3000, 300] },
        { src: 'b', size: [1400, 600] },
      ],
      W
    )
    const [a, b] = packed.tiles.map((t) => t.tile)
    expect([a.left, a.top, a.width, a.height]).toEqual(['100px', '0px', '1000px', '100px'])
    expect([b.left, b.top, b.width, b.height]).toEqual(['100px', '116px', '466px', '200px'])
  })

  test('a rising skyline mid-scan rejects a deeper candidate', () => {
    // a is shallow at the left; b stacks deep beside it, so the skyline
    // rises mid-scan — when c evaluates segments, b's peak is a candidate
    // that fails to improve the running minimum and takes the else arm.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [600, 300] },
        { src: 'b', size: [600, 1500] },
        { src: 'c', size: [600, 300] },
      ],
      W
    )
    const [a, b, c] = packed.tiles.map((t) => t.tile)
    // a(0,0) and b(216,0) raise [0,216]→116 and [216,432]→516; c scans
    // seg0 top 116, seg216 top 516 (rejected — not below y), seg432 top 0
    // and lands on the open floor at the right — then the fill widens it
    // into the trailing strip at the 1.5 cap.
    const off = Math.floor((W - (432 + 300)) / 2)
    expect([a.left, a.top]).toEqual([`${off}px`, '0px'])
    expect([b.left, b.top, b.height]).toEqual([`${216 + off}px`, '0px', '500px'])
    expect([c.left, c.top, c.width, c.height]).toEqual([`${432 + off}px`, '0px', '300px', '150px'])
  })

  test('a pocket too narrow for a legal shrink-fit stays a void', () => {
    // c-f raise the left columns to 632 while the [864,1016] pocket stays
    // at 116: g (200 wide) can't land there full-size, and the pocket's
    // honest shrink width — seg.w−GAP = 136 so the box keeps one GAP off
    // b's edge — falls under the MIN_TILE_W floor. The seam-free fit is
    // rejected, the pocket strands, and g rests on the left shelf at 332.
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [3000, 300] },
        { src: 'b', size: [600, 1500] },
        { src: 'c', size: [600, 600] },
        { src: 'd', size: [600, 1500] },
        { src: 'e', size: [600, 1500] },
        { src: 'f', size: [600, 1500] },
        { src: 'g', size: [600, 600] },
      ],
      1252
    )
    const g = packed.tiles[6].tile
    expect([g.left, g.top, g.width, g.height]).toEqual(['0px', '332px', '200px', '200px'])
  })

  test('a wall tile above the void band never grows over covered columns', () => {
    // The pocket below b sits under b's own box — b's top is above the
    // void band, so growing it would paint over the tile resting there.
    // It stays at its packed size; only inside-band walls may grow.
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
    expect(packed.tiles[1].tile.width).toBe('200px')
    expect(packed.tiles[1].tile.height).toBe('400px')
  })

  test('grown tiles never overlap — every pair of boxes stays disjoint', () => {
    const packed = packMediaMosaic(
      [
        { src: 'a', size: [2700, 300] },
        { src: 'b', size: [600, 1800] },
        { src: 'd', size: [900, 300] },
        { src: 'e', size: [900, 900] },
        { src: 'f', size: [1800, 900] },
        { src: 'g', size: [900, 1800] },
      ],
      W
    )
    const boxes = packed.tiles.map((t) => ({
      x: parseInt(t.tile.left),
      y: parseInt(t.tile.top),
      r: parseInt(t.tile.left) + parseInt(t.tile.width),
      b: parseInt(t.tile.top) + parseInt(t.tile.height),
    }))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const p = boxes[i]
        const q = boxes[j]
        expect(p.x < q.r && p.r > q.x && p.y < q.b && p.b > q.y).toBe(false)
      }
    }
  })

  test('every pair keeps a full GAP of separation — packed and grown', () => {
    // Fuzz-reproduced walls that used to violate the margin rule:
    // a pocket's trailing GAP strip overwrote a taller neighbour's
    // skyline level so a later shrink-fit parked inside its box (a real
    // overlap); the void fill grew a tile's bottom across an
    // edge-adjacent neighbour's top; and grown edges swept under
    // covering tiles whose bottoms sat just above the grown top.
    const fixtures = [
      {
        W: 1920,
        items: [
          { src: 'a', size: [1585, 539] },
          { src: 'b', size: [3222, 4122] },
          { src: 'c', size: [4869, 94] },
          { src: 'd', size: [3753, 3088] },
          { src: 'e', size: [2552, 789] },
          { src: 'f', size: [1733, 1212] },
          { src: 'g', size: [4669, 5919] },
        ],
      },
      {
        W: 1440,
        items: [
          { src: 'a', size: [5116, 5479] },
          { src: 'b', size: [734, 2894] },
          { src: 'c', size: [1680, 4176] },
          { src: 'd', size: [3752, 602] },
          { src: 'e', size: [357, 2638] },
          { src: 'f', size: [1398, 2845] },
          { src: 'g', size: [3626, 5984] },
          { src: 'h', size: [3008, 621] },
          { src: 'i', size: [4420, 597] },
          { src: 'j', size: [2724, 1304] },
          { src: 'k', size: [5669, 4929] },
          { src: 'l', size: [689, 3263] },
        ],
      },
      {
        W: 1600,
        items: [
          { src: 'a', size: [4836, 4165] },
          { src: 'b', size: [4886, 1777] },
          { src: 'c', size: [5717, 1394] },
          { src: 'd', size: [730, 5294] },
          { src: 'e', size: [3310, 255] },
          { src: 'f', size: [1510, 2795] },
          { src: 'g', size: [991, 484] },
          { src: 'h', size: [1790, 3994] },
          { src: 'i', size: [2380, 2647] },
        ],
      },
      {
        W: 1920,
        items: [
          { src: 'a', size: [2870, 3576] },
          { src: 'b', size: [312, 4124] },
          { src: 'c', size: [3390, 2138] },
          { src: 'd', size: [5173, 406] },
          { src: 'e', size: [5868, 3044] },
          { src: 'f', size: [474, 3423] },
          { src: 'g', size: [1441, 289] },
          { src: 'h', size: [4201, 1385] },
          { src: 'i', size: [133, 4949] },
        ],
      },
      {
        W: 1920,
        items: [
          { src: 'a', size: [3906, 2984] },
          { src: 'b', size: [1490, 3029] },
          { src: 'c', size: [2495, 5671] },
          { src: 'd', size: [5199, 4069] },
          { src: 'e', size: [1151, 4353] },
        ],
      },
    ]

    for (const { W: wall, items } of fixtures) {
      const boxes = packMediaMosaic(items, wall).tiles.map((t) => ({
        x: parseInt(t.tile.left),
        y: parseInt(t.tile.top),
        r: parseInt(t.tile.left) + parseInt(t.tile.width),
        b: parseInt(t.tile.top) + parseInt(t.tile.height),
      }))

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const p = boxes[i]

          const q = boxes[j]

          // Legal pairs separate by ≥GAP on at least one axis; anything
          // less on both is either an overlap or a broken-margin seam.
          const xSep = Math.max(q.x - p.r, p.x - q.r)

          const ySep = Math.max(q.y - p.b, p.y - q.b)

          expect(Math.max(xSep, ySep) >= LAYOUT.GAP).toBe(true)
        }
      }
    }
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

describe('stripHeroSlotClasses', () => {
  test('removes internal-main-item and ztf-video, keeps layout classes', () => {
    const input = [
      STATE_STRINGS.LANDSCAPE,
      INTERNAL_CLASSES.ZTF_VIDEO,
      INTERNAL_CLASSES.INTERNAL_MAIN_ITEM,
    ].join(CHAR_STRINGS.SPACE_CHAR)

    expect(stripHeroSlotClasses(input)).toBe(STATE_STRINGS.LANDSCAPE)
  })

  test('preserves order and non-hero tokens on mixed class lists', () => {
    const input = [
      INTERNAL_CLASSES.INTERNAL_MAIN_ITEM,
      STATE_STRINGS.LANDSCAPE,
      INTERNAL_CLASSES.ZTF_VIDEO,
      STATE_STRINGS.MOBILE,
    ].join(CHAR_STRINGS.SPACE_CHAR)

    expect(stripHeroSlotClasses(input)).toBe(
      [STATE_STRINGS.LANDSCAPE, STATE_STRINGS.MOBILE].join(CHAR_STRINGS.SPACE_CHAR)
    )
  })

  test('returns the string untouched when no hero token is present', () => {
    expect(stripHeroSlotClasses(STATE_STRINGS.LANDSCAPE)).toBe(STATE_STRINGS.LANDSCAPE)
    expect(stripHeroSlotClasses(CHAR_STRINGS.EMPTY)).toBe(CHAR_STRINGS.EMPTY)
  })

  test('drops empty fragments from double-space joins', () => {
    const input = [STATE_STRINGS.LANDSCAPE, CHAR_STRINGS.EMPTY, INTERNAL_CLASSES.ZTF_VIDEO].join(
      CHAR_STRINGS.SPACE_CHAR
    )

    expect(stripHeroSlotClasses(input)).toBe(STATE_STRINGS.LANDSCAPE)
  })
})
