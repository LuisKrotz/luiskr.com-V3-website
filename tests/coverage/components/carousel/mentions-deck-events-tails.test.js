/**
 * @file mentions-deck-events-tails.test.js
 * @description Coverage tail for carousel/mentions-deck/events.ts — the
 * DRAGSTART guard: a native drag mid-gesture would freeze the deck's swipe
 * state, so the handler cancels it outright.
 */

import { describe, test, expect, afterEach } from '@jest/globals'
import { MentionsDeck } from '@website/components/carousel/MentionsDeck.js'
import { DRAG_EVENTS } from '@core/tokens/events/dom.js'
import { mount, TEST_AWARDS } from '@tests/fixtures/test-constants.js'

const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

describe('mentions-deck dragstart guard', () => {
  let cleanup

  afterEach(() => cleanup?.())

  test('a native drag on the deck is prevented', async () => {
    const el = new MentionsDeck()

    cleanup = mount(el)
    el.items = [{ description: TEST_AWARDS.AWWARDS_SOTD, link: 'https://a.test' }]

    await flush()

    const e = new Event(DRAG_EVENTS.DRAGSTART, { cancelable: true })

    el.shadowRoot.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(true)
  })
})
