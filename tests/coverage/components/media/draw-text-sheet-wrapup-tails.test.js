/**
 * @file draw-text-sheet-wrapup-tails.test.js
 * @description Coverage tail for media/draw-text/sheet.ts — the
 * printprepare listener arm the idle-scheduled tails never reach:
 * a print arriving before the lazy fetch kicks the tier loader NOW
 * and hands the promise to the adapter's pending bag, so the gated
 * snapshot always composes with the @media print block in place.
 */
import { describe, test, expect } from '@jest/globals'

import { createDrawTextSheet } from '@website/components/media/draw-text/sheet.js'
import { PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Base css — a marker rule the composed text must lead with. */
const BASE = '.draw-text { display: block; }'

/** Print-tier css — composed after the base on resolution. */
const PRINT = '@media print { .draw-text { opacity: 1; } }'

/** Two-macrotask flush — drains the listener's fetchPrint promise. */
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('draw-text sheet — printprepare kick', () => {
  test('a printprepare before the idle slice fetches the tier immediately', async () => {
    let calls = 0

    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => {
        calls++

        return Promise.resolve({ default: PRINT })
      },
    })
    const seen = []

    sheet.onPrintText((t) => seen.push(t))

    // The arm is live — the window listener now owns the fetch kick.
    window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))

    await flush()
    await flush()

    expect(calls).toBe(1)
    expect(seen).toEqual([`${BASE}\n${PRINT}`])
  })

  test('the prepare kick folds through the memoized in-flight promise', async () => {
    let calls = 0
    let resolveTier = null

    const sheet = createDrawTextSheet({
      base: BASE,
      tiers: {},
      print: () => {
        calls++

        return new Promise((res) => {
          resolveTier = res
        })
      },
    })
    const seen = []

    sheet.onPrintText((t) => seen.push(t))

    // The idle fetch is already in flight (requestIdleCallback fires the
    // same fetchPrint) — printprepare must reuse printPromise, not start
    // a second request.
    await flush()

    window.dispatchEvent(new window.Event(PRINT_EVENTS.PREPARE))

    resolveTier({ default: TEST_TEXT.HELLO })
    await flush()

    expect(calls).toBe(1)
    expect(seen).toEqual([`${BASE}\n${TEST_TEXT.HELLO}`])
  })
})
