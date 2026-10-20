/**
 * @file draw-text/traversal.ts — bakes the pen-traversal field that makes
 * the WebGPU reveal read as handwriting rather than a masked wipe.
 *
 * A linear sweep (the old `m` mask) reveals pixels in x/y order, which no
 * pen ever does — real ink visits pixels in stroke order. This module
 * computes, once per atlas at trigger time, the order a nib would
 * plausibly visit each pixel: a geodesic flood over the glyph's ink mask
 * seeded at the letter's natural pen-entry point (the topmost-leftmost
 * ink — where a hand starts most Latin letters). Non-ink is impassable,
 * so the flood hugs the strokes and its iso-contours ARE the pen
 * frontier — the reveal edge becomes organic, forks at junctions, and
 * splits around rings ('o' writes both ways from the top, like a real
 * circular stroke).
 *
 * Distance is Dijkstra over the 8-neighbourhood with integer costs
 * (straight 2 / diagonal 3 ≈ 1 : √2) solved with a Dial bucket queue —
 * O(pixels), a few ms for a whole title atlas, paid once at trigger.
 *
 * The field is normalized by a canonical path length (~2.5× the cell
 * height) rather than each glyph's own max: a period's flood saturates
 * almost immediately so it lands in one fast dab, while an 'm' uses the
 * full stroke budget — matching how a pen's per-letter time is
 * proportional to ink length, not constant.
 *
 * Disconnected ink (the tittle of 'i', diacritics, '%' islands) is
 * unreachable from the entry and keeps R=255 (T=1): it is written last,
 * exactly when a hand lifts and dots the letter.
 *
 * Encoding: the atlas is painted white-on-transparent, so R is a free
 * channel — ink pixels get R = T·255, everything else stays 255 (T=1),
 * which also makes bilinear sampling at stroke edges blend toward
 * "written last" → the stroke visibly swells as the nib passes.
 */

/** Horizontal span of one glyph cell inside the single-row atlas. */
export interface TraversalCell {
  /** First atlas column of the cell (inclusive). */
  x0: number
  /** First atlas column AFTER the cell (exclusive). */
  x1: number
}

/** Alpha floor for "this pixel is ink" — antialiased fringes below this are paper. */
const INK_ALPHA_MIN = 48

/** Straight neighbour cost — the unit step of the geodesic flood. */
const COST_STRAIGHT = 2

/** Diagonal neighbour cost — 3/2 ≈ √2, keeps the flood isotropic. */
const COST_DIAG = 3

/** Dial ring size — buckets are indexed `dist % (maxCost + 1)`. */
const RING_SIZE = COST_DIAG + 1

/** Canonical stroke path length as a multiple of cell height (see file doc). */
const PATH_LEN_SCALE = 2.5

/** Field byte resolution — T is stored in one RGBA channel. */
const FIELD_BYTE_MAX = 255

/** Bytes per RGBA pixel in the ImageData buffer. */
const RGBA_STRIDE = 4

/** Byte offset of the alpha channel inside one RGBA pixel. */
const ALPHA_BYTE = 3

/** 8-neighbourhood: [dx, dy, cost] — straight steps then diagonals. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = Object.freeze([
  [1, 0, COST_STRAIGHT],
  [-1, 0, COST_STRAIGHT],
  [0, 1, COST_STRAIGHT],
  [0, -1, COST_STRAIGHT],
  [1, 1, COST_DIAG],
  [-1, 1, COST_DIAG],
  [1, -1, COST_DIAG],
  [-1, -1, COST_DIAG],
])

/**
 * `bakeTraversalField` — floods each cell's ink from its pen-entry point
 * and writes the normalized visit order into the atlas' R channel, in
 * place. Pixels the flood cannot reach keep their painted R=255 so they
 * write last (pen lift) or never (paper — alpha masks them out anyway).
 *
 * The bucket queue is a bounded drain loop, not stack emulation: each
 * pixel is enqueued at most once per relaxation and dist strictly
 * decreases per re-push, so the ring always empties.
 * @param data RGBA bytes of the painted atlas (`ctx.getImageData().data`).
 * @param width Atlas width in px.
 * @param height Atlas height in px (the atlas is a single row of cells).
 * @param cells Per-glyph x-ranges, in atlas order.
 */
export function bakeTraversalField(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cells: TraversalCell[]
): void {
  const n = width * height
  const dist = new Int32Array(n)

  dist.fill(-1)

  for (const cell of cells) {
    // Clamp to the atlas — a degenerate cell range must degrade to a
    // no-op, never read or write a neighbouring row's bytes.
    const x0 = Math.max(0, cell.x0)
    const x1 = Math.min(width, cell.x1)

    if (x1 <= x0) continue

    let entry = -1
    let entryY = height
    let entryX = width
    let inkCount = 0

    for (let y = 0; y < height; y++) {
      const row = y * width

      for (let x = x0; x < x1; x++) {
        const i = row + x

        if (data[i * RGBA_STRIDE + ALPHA_BYTE] <= INK_ALPHA_MIN) continue

        inkCount++

        if (y < entryY || (y === entryY && x < entryX)) {
          entry = i
          entryY = y
          entryX = x
        }
      }
    }

    if (!inkCount) continue

    // Canonical path budget for this cell — T = dist / refLen, so short
    // marks saturate early inside their keyframe (one dab) while long
    // strokes keep tracing; clamped to T=1 at the far end.
    const refLen = Math.max(1, Math.round(height * PATH_LEN_SCALE))
    const touched: number[] = []
    const buckets: number[][] = []

    for (let b = 0; b < RING_SIZE; b++) buckets.push([])

    /**
     * Relaxes the 8-neighbourhood of one popped pixel — a straight step
     * costs 2, a diagonal 3, and a neighbour is (re)queued only when this
     * path is strictly cheaper than whatever distance it already holds.
     * @param px Flat index of the pixel whose frontier expands.
     * @param cur Distance of the popped pixel (its bucket slot).
     */
    const relax = (px: number, cur: number): void => {
      const x = px % width
      const y = (px / width) | 0

      for (const [dx, dy, cost] of NEIGHBOURS) {
        const nx = x + dx
        const ny = y + dy

        if (nx < x0 || nx >= x1 || ny < 0 || ny >= height) continue

        const ni = ny * width + nx

        if (data[ni * RGBA_STRIDE + ALPHA_BYTE] <= INK_ALPHA_MIN) continue

        const nd = cur + cost

        if (dist[ni] !== -1 && dist[ni] <= nd) continue

        dist[ni] = nd
        buckets[nd % RING_SIZE].push(ni)
      }
    }

    dist[entry] = 0
    buckets[0][0] = entry

    let cur = 0

    // Bounded drain: ends when the ring holds no pending entry — not at
    // `inkCount` pops, because ink unreachable from the entry (tittles,
    // islands) never arrives and must NOT keep the loop alive.
    while (true) {
      const bucket = buckets[cur % RING_SIZE]

      if (!bucket.length) {
        if (
          !buckets[(cur + 1) % RING_SIZE].length &&
          !buckets[(cur + 2) % RING_SIZE].length &&
          !buckets[(cur + 3) % RING_SIZE].length
        )
          break

        cur++

        continue
      }

      const px = bucket.pop()!

      // No stale-entry check needed: slot `cur % RING` only ever holds
      // entries at exactly `cur` — pushes land at cur+{2,3}, and on a
      // uniform-cost grid a queued node can never be improved before it
      // pops (a later pop has dist ≥ the current one, so d'+w' < d+w
      // would need d' < d, impossible in nondecreasing pop order).
      touched[touched.length] = px
      relax(px, cur)
    }

    for (const i of touched) {
      const t = Math.min(dist[i] / refLen, 1)

      data[i * RGBA_STRIDE] = Math.round(t * FIELD_BYTE_MAX)
    }

    for (const i of touched) dist[i] = -1
  }
}
