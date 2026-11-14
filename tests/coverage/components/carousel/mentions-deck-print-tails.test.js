/**
 * @file mentions-deck-print-tails.test.js
 * @description Coverage tail for carousel/mentions-deck/print.ts — the
 * deck's printable form: preparePrint arms the _printing poser gate and
 * restorePrint drops it and re-poses the live strip. Guards the flag
 * contract measure/applyPoses consult during the print job.
 */

import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { MentionsDeck } from '@website/components/carousel/MentionsDeck.js'
import { preparePrint, restorePrint } from '@website/components/carousel/mentions-deck/print.js'
import { mount } from '@tests/fixtures/test-constants.js'

describe('mentions-deck print gate', () => {
  let cleanup

  afterEach(() => cleanup?.())

  test('preparePrint arms _printing; restorePrint drops it and re-poses', async () => {
    const el = new MentionsDeck()

    cleanup = mount(el)

    const poseSpy = jest.spyOn(el, 'applyPoses').mockImplementation(() => {})

    expect(el._printing).toBeFalsy()

    preparePrint(el)
    expect(el._printing).toBe(true)

    restorePrint(el)
    expect(el._printing).toBe(false)
    expect(poseSpy).toHaveBeenCalledTimes(1)

    // Idempotent — both restore channels may fire for one job.
    restorePrint(el)
    expect(poseSpy).toHaveBeenCalledTimes(2)
  })
})
