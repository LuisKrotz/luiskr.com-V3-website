/**
 * @file coverage/components/media/draw-text-traversal-tails.test.js
 * @description Coverage tail for components/media/draw-text/traversal.ts —
 * the pen-traversal field baked into the draw-text atlas' R channel.
 * Pins the flood's contract: entry at topmost-leftmost ink, stroke-
 * hugging order, per-cell isolation, unreachable ink written last,
 * short marks saturating early, and no runtime errors on degenerate
 * input (empty cells, zero ink, out-of-range cells).
 */
import { describe, test, expect } from '@jest/globals'
import { bakeTraversalField } from '@website/components/media/draw-text/traversal.js'

const A = 3 // alpha byte offset
const INK = 255
const PAPER = 0

/** Paints `data` white-on-transparent at (x,y) — ink pixel. */
const ink = (data, w, x, y) => {
  const i = (y * w + x) * 4

  data[i] = INK
  data[i + 1] = INK
  data[i + 2] = INK
  data[i + A] = INK
}

/** Reads the baked traversal byte at (x,y). */
const tAt = (data, w, x, y) => data[(y * w + x) * 4]

describe('draw-text traversal field', () => {
  test('an empty cell list and zero-ink cells never throw', () => {
    const w = 8
    const h = 8
    const data = new Uint8ClampedArray(w * h * 4)

    expect(() => bakeTraversalField(data, w, h, [])).not.toThrow()
    expect(() => bakeTraversalField(data, w, h, [{ x0: 0, x1: 8 }])).not.toThrow()
    expect(() =>
      bakeTraversalField(data, w, h, [
        { x0: 0, x1: 4 },
        { x0: 4, x1: 8 },
      ])
    ).not.toThrow()

    // Every byte still zero — nothing was touched.
    expect(data.every((b) => b === 0)).toBe(true)
  })

  test('a vertical stroke gets increasing T top→bottom, entry T=0', () => {
    const w = 4
    const h = 10
    const data = new Uint8ClampedArray(w * h * 4)

    for (let y = 0; y < 10; y++) ink(data, w, 2, y)

    bakeTraversalField(data, w, h, [{ x0: 0, x1: 4 }])

    // Pen enters at the topmost ink → T=0 there.
    expect(tAt(data, w, 2, 0)).toBe(0)

    // Monotonic down the stem — the nib travels the stroke in order.
    for (let y = 1; y < 10; y++) {
      expect(tAt(data, w, 2, y)).toBeGreaterThan(tAt(data, w, 2, y - 1))
    }

    // refLen = 10·2.5 = 25; bottom dist = 9 steps · 2 = 18 →
    // T = 18/25 ≈ 0.72 — the stroke finishes well inside the keyframe.
    expect(tAt(data, w, 2, 9)).toBe(Math.round((18 / 25) * 255))
  })

  test('disconnected ink (a tittle) stays R=255 — written last', () => {
    const w = 4
    const h = 10
    const data = new Uint8ClampedArray(w * h * 4)

    // Stem y=0..4 at x=2, isolated dot at (2,9).
    for (let y = 0; y < 5; y++) ink(data, w, 2, y)
    ink(data, w, 2, 9)

    bakeTraversalField(data, w, h, [{ x0: 0, x1: 4 }])

    expect(tAt(data, w, 2, 0)).toBe(0)
    expect(tAt(data, w, 2, 4)).toBeGreaterThan(0)
    expect(tAt(data, w, 2, 4)).toBeLessThan(255)

    // The dot never joins the flood — R stays 255 = T=1, the pen lift.
    expect(tAt(data, w, 2, 9)).toBe(255)
  })

  test('a ring floods around the curve — all ink reachable, T bounded', () => {
    const w = 8
    const h = 12
    const data = new Uint8ClampedArray(w * h * 4)
    const ring = [
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [1, 1],
      [6, 1],
      [1, 2],
      [6, 2],
      [1, 3],
      [6, 3],
      [1, 4],
      [6, 4],
      [1, 5],
      [6, 5],
      [1, 6],
      [6, 6],
      [1, 7],
      [6, 7],
      [1, 8],
      [6, 8],
      [1, 9],
      [6, 9],
      [2, 10],
      [3, 10],
      [4, 10],
      [5, 10],
    ]

    ring.forEach(([x, y]) => ink(data, w, x, y))

    bakeTraversalField(data, w, h, [{ x0: 0, x1: 8 }])

    // Every ink pixel got written (< 255 unreachable marker) and T is
    // a real visit order — refLen=30 covers the whole half-perimeter.
    ring.forEach(([x, y]) => expect(tAt(data, w, x, y)).toBeLessThan(255))

    // Top of the ring is the entry.
    expect(tAt(data, w, 2, 0)).toBe(0)

    // Bottom of the ring is the geodesic-farthest ink.
    const bottomMax = Math.max(tAt(data, w, 2, 10), tAt(data, w, 5, 10))
    const topMax = Math.max(tAt(data, w, 1, 1), tAt(data, w, 6, 1))

    expect(bottomMax).toBeGreaterThan(topMax)
  })

  test("cells are isolated — one cell's flood never crosses x1", () => {
    const w = 10
    const h = 4
    const data = new Uint8ClampedArray(w * h * 4)

    // Cell 1 ink at x=1 y=0..3; cell 2 ink at x=8 y=0..3 (adjacent gap
    // at x=5..7 is paper, but even glued the bound must hold).
    for (let y = 0; y < 4; y++) {
      ink(data, w, 1, y)
      ink(data, w, 8, y)
    }

    bakeTraversalField(data, w, h, [
      { x0: 0, x1: 5 },
      { x0: 5, x1: 10 },
    ])

    // Each stem wrote its own entry at T=0 — independent fields.
    expect(tAt(data, w, 1, 0)).toBe(0)
    expect(tAt(data, w, 8, 0)).toBe(0)
    expect(tAt(data, w, 1, 3)).toBeGreaterThan(0)
    expect(tAt(data, w, 8, 3)).toBeGreaterThan(0)
  })

  test('non-ink pixels inside the cell keep R=255', () => {
    const w = 6
    const h = 6
    const data = new Uint8ClampedArray(w * h * 4)

    ink(data, w, 3, 0)
    ink(data, w, 3, 1)
    ink(data, w, 3, 2)

    // Paper neighbours of the stroke stay at the painted 255 so the
    // bilinear edge blends toward "drawn last" (stroke swells).
    bakeTraversalField(data, w, h, [{ x0: 0, x1: 6 }])

    expect(tAt(data, w, 0, 0)).toBe(PAPER === 0 ? 0 : INK) // untouched paper byte
    expect(tAt(data, w, 3, 0)).toBe(0)
    expect(tAt(data, w, 3, 2)).toBeGreaterThan(0)
  })

  test('a tiny mark (one pixel) is a single dab — T≈0, written early', () => {
    const w = 4
    const h = 20
    const data = new Uint8ClampedArray(w * h * 4)

    ink(data, w, 1, 15)

    bakeTraversalField(data, w, h, [{ x0: 0, x1: 4 }])

    // dist=0 → T=0 — the dot lands at the very start of its keyframe,
    // not spread over the full duration like a normalized field would.
    expect(tAt(data, w, 1, 15)).toBe(0)
  })

  test('entry picks topmost-leftmost when the top row has several inks', () => {
    const w = 8
    const h = 4
    const data = new Uint8ClampedArray(w * h * 4)

    // A horizontal cap across the top row + a stem — the entry must be
    // the LEFTMOST ink of the top row (how a pen starts a 'T').
    for (let x = 1; x <= 6; x++) ink(data, w, x, 0)
    ink(data, w, 3, 1)
    ink(data, w, 3, 2)

    bakeTraversalField(data, w, h, [{ x0: 0, x1: 8 }])

    expect(tAt(data, w, 1, 0)).toBe(0)
    expect(tAt(data, w, 6, 0)).toBeGreaterThan(0)
    expect(tAt(data, w, 3, 2)).toBeGreaterThan(0)
  })

  test('diagonal strokes are reached via diagonal steps', () => {
    const w = 8
    const h = 8
    const data = new Uint8ClampedArray(w * h * 4)

    for (let i = 0; i < 8; i++) ink(data, w, i, i)

    bakeTraversalField(data, w, h, [{ x0: 0, x1: 8 }])

    expect(tAt(data, w, 0, 0)).toBe(0)

    // Monotonic along the diagonal; the far end clamps at T=1
    // (dist 7·3=21 > refLen 8·2.5=20) — still written, just last.
    for (let i = 1; i < 8; i++) {
      expect(tAt(data, w, i, i)).toBeGreaterThan(tAt(data, w, i - 1, i - 1))
    }
    expect(tAt(data, w, 7, 7)).toBe(255)
  })

  test('degenerate cells (empty range, huge bounds) never throw', () => {
    const w = 8
    const h = 8
    const data = new Uint8ClampedArray(w * h * 4)

    ink(data, w, 2, 2)

    expect(() =>
      bakeTraversalField(data, w, h, [
        { x0: 4, x1: 4 }, // empty range
        { x0: 7, x1: 9 }, // overhang
      ])
    ).not.toThrow()

    // The ink at (2,2) lives outside both cells → untouched.
    expect(tAt(data, w, 2, 2)).toBe(255)
  })
})
