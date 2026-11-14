/**
 * @file nav-menu-keys-tails.test.js
 * @description Coverage tails for components/nav/menu.tsx keyboard roving
 * + focus lifecycle — navMenuKeyDown's key/guard arms, focusNavMenuItem's
 * wrap indexing, openNavMenu's focus-first-item handoff, the closeNavMenu
 * focus-restore tail (a disconnected capture hands focus back to the
 * burger button), and the mounted AppNav window listener routing.
 */
import { describe, test, expect, jest } from '@jest/globals'
import {
  focusNavMenuItem,
  navMenuKeyDown,
  openNavMenu,
  closeNavMenu,
} from '@website/components/nav/menu.js'
import '@website/components/nav/AppNav.js'
import store from '@core/store.js'
import { KEYS } from '@core/tokens/primitives.js'
import { KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { NAV_BURGER_CLASSES, NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

/** Generous flush — nav render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Fake menu item — records focus() calls without needing a live DOM. */
const item = () => ({ focus: jest.fn() })

/** Host stub with a scripted item list + a settable shadow activeElement. */
const menuHost = (items, active = null, over = {}) => ({
  _menuOpen: true,
  _menuClosing: false,
  _menuSettled: false,
  _menuSettleTimer: null,
  _menuBg: null,
  _menuCanvasEl: null,
  _burgerBtn: null,
  shadowRoot: { activeElement: active },
  $: () => null,
  $$: () => items,
  _updateDom: jest.fn(),
  ...over,
})

describe('nav menu keyboard tails', () => {
  test('focusNavMenuItem no-ops without items and wraps both directions', () => {
    // navMenuItems' ?? [] arm — a host that cannot query has no items.
    focusNavMenuItem({ _menuOpen: true }, 0)

    const items = [item(), item(), item()]
    const host = menuHost(items)

    focusNavMenuItem(host, 1)
    expect(items[1].focus).toHaveBeenCalledTimes(1)

    // Over-length and negative indexes wrap through the modulo.
    focusNavMenuItem(host, 3)
    expect(items[0].focus).toHaveBeenCalledTimes(1)

    focusNavMenuItem(host, -1)
    expect(items[2].focus).toHaveBeenCalledTimes(1)
  })

  test('navMenuKeyDown rejects non-nav keys, closed/closing menus, and item-less hosts', () => {
    const items = [item()]
    const host = menuHost(items)

    expect(navMenuKeyDown(host, { key: KEYS.SLASH })).toBe(false)

    expect(navMenuKeyDown({ ...host, _menuOpen: false }, { key: KEYS.ARROW_DOWN })).toBe(false)
    expect(navMenuKeyDown({ ...host, _menuClosing: true }, { key: KEYS.ARROW_DOWN })).toBe(false)

    // Items empty (queried) + $$ absent (?? [] arm) → both unconsumed.
    expect(navMenuKeyDown(menuHost([], items[0]), { key: KEYS.ARROW_DOWN })).toBe(false)
    expect(navMenuKeyDown({ _menuOpen: true, _menuClosing: false }, { key: KEYS.ARROW_DOWN })).toBe(
      false
    )
  })

  test('navMenuKeyDown roves the focused item in every direction and wraps', () => {
    const items = [item(), item(), item()]

    const first = menuHost(items, items[0])
    expect(navMenuKeyDown(first, { key: KEYS.ARROW_DOWN })).toBe(true)
    expect(navMenuKeyDown(first, { key: KEYS.ARROW_RIGHT })).toBe(true)
    expect(items[1].focus).toHaveBeenCalledTimes(2)

    const last = menuHost(items, items[2])
    // Down/Right past the end wraps to the first item.
    expect(navMenuKeyDown(last, { key: KEYS.ARROW_DOWN })).toBe(true)
    expect(items[0].focus).toHaveBeenCalledTimes(1)

    // Up/Left from the end steps back to the middle.
    expect(navMenuKeyDown(last, { key: KEYS.ARROW_LEFT })).toBe(true)
    expect(navMenuKeyDown(last, { key: KEYS.ARROW_UP })).toBe(true)
    expect(items[1].focus).toHaveBeenCalledTimes(4)

    expect(navMenuKeyDown(first, { key: KEYS.END })).toBe(true)
    expect(items[2].focus).toHaveBeenCalledTimes(1)

    expect(navMenuKeyDown(last, { key: KEYS.HOME })).toBe(true)
    expect(items[0].focus).toHaveBeenCalledTimes(2)
  })

  test('navMenuKeyDown starts from the edges when focus is outside the items', () => {
    const items = [item(), item(), item()]

    // activeElement null → indexOf -1 — Down lands on the first item,
    // Up wraps around the top edge to the second-to-last slot.
    const outside = menuHost(items, null)

    expect(navMenuKeyDown(outside, { key: KEYS.ARROW_DOWN })).toBe(true)
    expect(items[0].focus).toHaveBeenCalledTimes(1)

    expect(navMenuKeyDown(outside, { key: KEYS.ARROW_UP })).toBe(true)
    expect(items[1].focus).toHaveBeenCalledTimes(1)

    // No shadowRoot at all → the ?. arm resolves the same "not found".
    const rootless = { ...outside, shadowRoot: undefined }

    expect(navMenuKeyDown(rootless, { key: KEYS.ARROW_RIGHT })).toBe(true)
    expect(items[0].focus).toHaveBeenCalledTimes(2)
  })

  test('openNavMenu hands focus to the first menu item after the re-render', () => {
    const items = [item(), item()]
    const host = menuHost(items, null, { _menuOpen: false })

    openNavMenu(host)

    expect(host._menuOpen).toBe(true)
    expect(items[0].focus).toHaveBeenCalledTimes(1)

    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)
  })

  test('closeNavMenu restores focus to the burger when the capture detached', () => {
    jest.useFakeTimers()

    // host.$ returns this for every selector — the modal-classList add
    // and the burger-focus lookup share it.
    const burger = { focus: jest.fn(), classList: { add: jest.fn() } }

    // The captured element left the DOM in the close-tail re-render →
    // the fresh fallback button takes keyboard focus back.
    const detached = { isConnected: false }
    const host = menuHost([], detached, { $: () => burger })

    closeNavMenu(host)
    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(burger.focus).toHaveBeenCalledTimes(1)

    // Still-connected capture (focus sat outside the overlay — e.g. the
    // burger itself or a dialog control) → no handoff at all.
    const present = { isConnected: true }
    const host2 = menuHost([], present, { $: () => burger })

    closeNavMenu(host2)
    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(burger.focus).toHaveBeenCalledTimes(1)

    // No shadowRoot → nothing to capture → the restore guard skips.
    const host3 = menuHost([], null, { shadowRoot: undefined, $: () => burger })

    closeNavMenu(host3)
    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(burger.focus).toHaveBeenCalledTimes(1)

    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)
    jest.useRealTimers()
  })

  test('mounted AppNav roves items on arrows and restores the burger on close', async () => {
    const el = document.createElement(COMPONENT_TAGS.APP_NAV)

    document.body.appendChild(el)
    await flush()

    // Menu closed — arrows bail at the !_menuOpen guard unconsumed.
    const closedKey = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_DOWN,
      cancelable: true,
    })

    window.dispatchEvent(closedKey)
    expect(closedKey.defaultPrevented).toBe(false)

    el._openMenu()

    const items = el.shadowRoot.querySelectorAll(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}`)

    expect(items.length).toBeGreaterThan(1)

    // The open handoff already focused the first item.
    expect(el.shadowRoot.activeElement).toBe(items[0])

    const down = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_DOWN,
      cancelable: true,
    })

    window.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(el.shadowRoot.activeElement).toBe(items[1])

    const up = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_UP,
      cancelable: true,
    })

    window.dispatchEvent(up)
    expect(up.defaultPrevented).toBe(true)
    expect(el.shadowRoot.activeElement).toBe(items[0])

    // Unhandled key — nothing is prevented.
    const misc = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.SLASH,
      cancelable: true,
    })

    window.dispatchEvent(misc)
    expect(misc.defaultPrevented).toBe(false)

    // A dialog above the overlay owns the keyboard — the arrow row and
    // Escape pass through untouched.
    store.commit(MODAL_MUTATIONS.TOGGLE_PREFERENCES_MODAL, true)

    const behindDialog = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_DOWN,
      cancelable: true,
    })

    window.dispatchEvent(behindDialog)
    expect(behindDialog.defaultPrevented).toBe(false)
    expect(el.shadowRoot.activeElement).toBe(items[0])

    store.commit(MODAL_MUTATIONS.TOGGLE_LANG_DIALOG, true)
    store.commit(MODAL_MUTATIONS.TOGGLE_PREFERENCES_MODAL, false)

    const behindLang = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_DOWN,
      cancelable: true,
    })

    window.dispatchEvent(behindLang)
    expect(behindLang.defaultPrevented).toBe(false)

    store.commit(MODAL_MUTATIONS.TOGGLE_LANG_DIALOG, false)

    el._closeMenu()

    await flush(ANIMATION_DURATIONS.MENU_CLOSE_DURATION + 40)

    // The focused item died in the re-render — focus came home to the
    // burger fallback button.
    expect(el.shadowRoot.activeElement).toBe(
      el.shadowRoot.querySelector(`.${NAV_BURGER_CLASSES.NAV_BURGER_FALLBACK}`)
    )

    el.remove()
  })
})
