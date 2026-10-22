/**
 * @file mosaic-keys-tails.test.js
 * @description Coverage tails for components/home/mosaic/interactions.ts +
 * mosaic/events.ts — keyboard activation (Enter's detail===0 click must
 * bypass the two-tap touch path and navigate outright) and the arrow-key
 * spatial navigation arms (non-arrow passthrough, no card, degenerate
 * geometry, wall-edge misses, missing target node, focus moves).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HomeMosaic } from '@website/components/home/HomeMosaic.js'
import { onCardKeyDown, onClick } from '@website/components/home/mosaic/interactions.js'
import router from '@core/router/router.js'
import store from '@core/store.js'
import { mount, TEST_PROJECTS } from '@tests/fixtures/test-constants.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { KEYS } from '@core/tokens/primitives.js'
import { UI_MUTATIONS } from '@core/tokens/events/mutations.js'
import { INPUT_STRINGS } from '@core/tokens/strings/input.js'
import { KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

const ITEMS = [
  { label: 'Card A', link: TEST_PROJECTS.SLUG_MINIMELISSA, image: 'a' },
  { label: 'Card B', link: TEST_PROJECTS.SLUG_MINIMELISSA, image: 'b' },
  { label: 'Card C', link: TEST_PROJECTS.SLUG_MINIMELISSA, image: 'c' },
]

/** Three cards in an L: 0 top-left, 1 top-right, 2 bottom-left. */
const GRID_CARDS = [
  { card: { top: '0px', left: '0px', width: '100px', height: '100px' } },
  { card: { top: '0px', left: '120px', width: '100px', height: '100px' } },
  { card: { top: '120px', left: '0px', width: '100px', height: '100px' } },
]

const keyEvent = (key, target) => ({
  key,
  target,
  preventDefault: jest.fn(),
})

const cardTarget = (idx) => {
  const itemEl = { getAttribute: () => String(idx) }

  return { closest: () => itemEl }
}

describe('mosaic keyboard tails', () => {
  let el
  let cleanup

  beforeEach(() => {
    store.commit(UI_MUTATIONS.SET_INPUT_METHOD, INPUT_STRINGS.MOUSE)
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  test('a keyboard-synthesized activation navigates even when the session is touch', () => {
    const host = {
      hasTouch: true,
      touchIdx: null,
      bottomHMap: {},
      $: jest.fn(() => null),
      _updateDom: jest.fn(),
      layout: jest.fn(),
    }

    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

    onClick(host, { link: TEST_PROJECTS.SLUG_MINIMELISSA }, 0, { detail: 0 })

    expect(pushSpy).toHaveBeenCalled()
    expect(host.touchIdx).toBeNull()

    pushSpy.mockRestore()
  })

  test('a real pointer click on a touch session still expands first', () => {
    const host = {
      hasTouch: true,
      touchIdx: null,
      bottomHMap: {},
      $: jest.fn(() => null),
      _updateDom: jest.fn(),
      layout: jest.fn(),
    }

    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

    onClick(host, { link: TEST_PROJECTS.SLUG_MINIMELISSA }, 0, { detail: 1 })

    expect(pushSpy).not.toHaveBeenCalled()
    expect(host.touchIdx).toBe(0)

    pushSpy.mockRestore()
  })

  test('onCardKeyDown ignores non-arrow keys and events outside a card', () => {
    const host = { processedItems: ITEMS, cards: GRID_CARDS, $: jest.fn(() => null) }

    const misc = keyEvent('a', cardTarget(0))

    onCardKeyDown(host, misc)
    expect(misc.preventDefault).not.toHaveBeenCalled()

    const outside = keyEvent(KEYS.ARROW_RIGHT, { closest: () => null })

    onCardKeyDown(host, outside)
    expect(outside.preventDefault).not.toHaveBeenCalled()
  })

  test('onCardKeyDown bails on degenerate geometry and missing focus targets', () => {
    const noCards = { processedItems: ITEMS, cards: [], $: jest.fn(() => null) }
    const ev1 = keyEvent(KEYS.ARROW_RIGHT, cardTarget(0))

    onCardKeyDown(noCards, ev1)
    expect(ev1.preventDefault).not.toHaveBeenCalled()

    const nanCards = {
      processedItems: ITEMS,
      cards: [{ card: { top: 'x', left: '0px', width: '1px', height: '1px' } }],
      $: jest.fn(() => null),
    }
    const ev2 = keyEvent(KEYS.ARROW_RIGHT, cardTarget(0))

    onCardKeyDown(nanCards, ev2)
    expect(ev2.preventDefault).not.toHaveBeenCalled()

    // Wall edge — nothing sits right of card 1 → no move, no preventDefault.
    const ev3 = keyEvent(KEYS.ARROW_RIGHT, cardTarget(1))
    const host = { processedItems: ITEMS, cards: GRID_CARDS, $: jest.fn(() => null) }

    onCardKeyDown(host, ev3)
    expect(ev3.preventDefault).not.toHaveBeenCalled()

    // A forward neighbor exists but the DOM lookup misses → still no move.
    const ev4 = keyEvent(KEYS.ARROW_RIGHT, cardTarget(0))
    const missing = { processedItems: ITEMS, cards: GRID_CARDS, $: jest.fn(() => null) }

    onCardKeyDown(missing, ev4)
    expect(ev4.preventDefault).not.toHaveBeenCalled()
  })

  test('each arrow direction resolves the nearest neighbor and focuses it', () => {
    const focusSpies = ITEMS.map(() => jest.fn())

    const host = {
      processedItems: ITEMS,
      cards: GRID_CARDS,
      $: jest.fn((sel) => {
        const idx = parseInt(sel.slice(-3, -2), 10)

        return { focus: focusSpies[idx] }
      }),
    }

    onCardKeyDown(host, keyEvent(KEYS.ARROW_RIGHT, cardTarget(0)))
    expect(focusSpies[1]).toHaveBeenCalledTimes(1)

    onCardKeyDown(host, keyEvent(KEYS.ARROW_DOWN, cardTarget(0)))
    expect(focusSpies[2]).toHaveBeenCalledTimes(1)

    onCardKeyDown(host, keyEvent(KEYS.ARROW_LEFT, cardTarget(1)))
    expect(focusSpies[0]).toHaveBeenCalledTimes(1)

    onCardKeyDown(host, keyEvent(KEYS.ARROW_UP, cardTarget(2)))
    expect(focusSpies[0]).toHaveBeenCalledTimes(2)
  })

  test('spatial nav skips a neighbor whose packed geometry is unparseable', () => {
    const focusSpies = ITEMS.map(() => jest.fn())

    const host = {
      processedItems: ITEMS,
      // Card 1 has a NaN left — cardCenter returns null → continue; the
      // arrow still reaches card 2 further along the scan direction.
      cards: [
        { card: { top: '0px', left: '0px', width: '100px', height: '100px' } },
        { card: { top: '0px', left: 'x', width: '100px', height: '100px' } },
        { card: { top: '0px', left: '240px', width: '100px', height: '100px' } },
      ],
      $: jest.fn((sel) => {
        const idx = parseInt(sel.slice(-3, -2), 10)

        return { focus: focusSpies[idx] }
      }),
    }

    onCardKeyDown(host, keyEvent(KEYS.ARROW_RIGHT, cardTarget(0)))

    expect(focusSpies[1]).not.toHaveBeenCalled()
    expect(focusSpies[2]).toHaveBeenCalledTimes(1)
  })

  test('the mounted keydown listener moves focus to the right neighbor', async () => {
    el = new HomeMosaic()
    cleanup = mount(el)
    el.processedItems = ITEMS
    el._updateDom()

    const cards = [...el.shadowRoot.querySelectorAll(`a[${DATA_ATTRS.DATA_INDEX}]`)]

    expect(cards.length).toBe(3)

    // Deterministic geometry — the wall is packed by viewport-driven
    // layout, so the neighbor map is stamped explicitly (focus() re-runs
    // layout via the focusin → onHover chain, but only AFTER the handler
    // has already resolved and focused the target).
    el.cards = GRID_CARDS

    // Assert the observable outcome — focus() on the target anchor moves
    // the shadow root's active element. document.activeElement reports
    // the <home-mosaic> host itself (correct shadow retargeting), so the
    // inner anchor is read off shadowRoot.activeElement. The event is
    // cancelable — synthesized KeyboardEvents default to
    // cancelable:false, which silently no-ops preventDefault().
    const right = new window.KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_RIGHT,
      bubbles: true,
      composed: true,
      cancelable: true,
    })

    cards[0].dispatchEvent(right)

    expect(right.defaultPrevented).toBe(true)
    expect(el.shadowRoot.activeElement).toBe(cards[1])

    await flush()
  })
})
