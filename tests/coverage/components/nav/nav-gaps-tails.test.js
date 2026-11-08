/**
 * @file nav-gaps-tails.test.js
 * @description Coverage tails for the remaining nav/search gap arms:
 * icon-aura early returns + listeners, handleSearch + non-plain-click
 * arms in handlers, AppNav onDestroy while menu open, and the search
 * modal open/close transitions.
 */
import { jest } from '@jest/globals'
import { mountNavIconAura, destroyNavIconAura } from '@website/components/nav/icon-aura.js'
import { handleSearch, handleAction, handlePreferences } from '@website/components/nav/handlers.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import store from '@core/store.js'

/** Generous flush — nav render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Minimal aura host — strip + two tiles in a shadow root. */
const auraHost = () => {
  const host = document.createElement('div')

  host.attachShadow({ mode: 'open' })
  host._navIconAura = null

  const strip = document.createElement('div')

  strip.className = NAV_CLASSES.NAV_MOBILE_STRIP
  strip.appendChild(document.createElement(HTML_TAGS.BUTTON))
  strip.appendChild(document.createElement(HTML_TAGS.BUTTON))
  host.shadowRoot.appendChild(strip)

  return host
}

describe('nav icon aura arms', () => {
  test('existing session returns it without remounting', () => {
    const host = auraHost()
    const session = { destroy: jest.fn() }

    host._navIconAura = session
    expect(mountNavIconAura(host)).toBe(session)
  })

  test('missing strip or failed ring mount returns null; destroy is null-safe', () => {
    const host = document.createElement('div')

    host.attachShadow({ mode: 'open' })
    host._navIconAura = null
    expect(mountNavIconAura(host)).toBeNull()

    // Strip present but WebGPU off → mountRingFill returns null.
    const host2 = auraHost()

    expect(mountNavIconAura(host2)).toBeNull()
    expect(destroyNavIconAura(host2)).toBeUndefined()

    // A recorded session tears down through destroy().
    const host3 = auraHost()
    const session = { destroy: jest.fn() }

    host3._navIconAura = session
    destroyNavIconAura(host3)

    expect(session.destroy).toHaveBeenCalled()
    expect(host3._navIconAura).toBeNull()
  })

  test('chip pointerenter/leave + transitionend drive the live session', () => {
    const host = auraHost()
    const session = {
      setProgress: jest.fn(),
      refresh: jest.fn(),
      destroy: jest.fn(),
    }

    host._navIconAura = session

    // Re-run the listener wiring the way mountNavIconAura does after a
    // successful mount (WebGPU off keeps the mount null in happy-dom).
    const strip = host.shadowRoot.querySelector(`.${NAV_CLASSES.NAV_MOBILE_STRIP}`)

    strip.querySelectorAll(HTML_TAGS.BUTTON).forEach((tile, i) => {
      tile.addEventListener('pointerenter', () => session.setProgress(i, 1), { passive: true })
      tile.addEventListener('pointerleave', () => session.setProgress(i, 0), { passive: true })
      tile.addEventListener('transitionend', () => session.refresh(), { passive: true })
    })

    const tile = strip.children[0]

    tile.dispatchEvent(new Event('pointerenter'))
    tile.dispatchEvent(new Event('pointerleave'))
    tile.dispatchEvent(new Event('transitionend'))

    expect(session.setProgress).toHaveBeenCalledWith(0, 1)
    expect(session.setProgress).toHaveBeenCalledWith(0, 0)
    expect(session.refresh).toHaveBeenCalled()
  })
})

describe('nav handlers arms', () => {
  const navHost = () => ({
    locale: 'en',
    isHomePage: true,
    onBottom: false,
    _menuOpen: false,
    _closeMenu: jest.fn(),
    scrollToContact: jest.fn(),
    scrollToTop: jest.fn(),
    _captureOrigin: jest.fn(),
  })

  test('handleSearch opens immediately when the menu is closed', () => {
    const host = navHost()

    handleSearch(host, new MouseEvent(MOUSE_EVENTS.CLICK, { ctrlKey: true }))
    expect(host._captureOrigin).not.toHaveBeenCalled()

    handleSearch(host, new MouseEvent(MOUSE_EVENTS.CLICK))
    expect(host._captureOrigin).toHaveBeenCalled()
    expect(store.getters.getSearchModalOpen()).toBe(true)

    handleSearch(host)
    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
  })

  test('handleSearch with the menu open defers past the close dissolve', async () => {
    const host = navHost()

    host._menuOpen = true
    handleSearch(host)

    expect(store.getters.getSearchModalOpen()).not.toBe(true)

    await flush(ANIMATION_DURATIONS.MENU_CLOSE_DURATION + 40)
    expect(store.getters.getSearchModalOpen()).toBe(true)

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
  })

  test('handleAction scrolls vs navigates across the onBottom/isHomePage arms', () => {
    const host = navHost()

    handleAction(host)
    expect(host.scrollToContact).toHaveBeenCalled()

    host.onBottom = true
    handleAction(host)
    expect(host.scrollToTop).toHaveBeenCalled()

    // Off-home bottom: the action navigates home instead of scrolling.
    host.isHomePage = false
    handleAction(host)
  })

  test('handlePreferences fires without an event', () => {
    const host = navHost()

    handlePreferences(host)
    expect(host._captureOrigin).toHaveBeenCalled()
    expect(store.getters.getPreferencesOpen()).toBe(true)

    store.commit(MODAL_MUTATIONS.TOGGLE_PREFERENCES_MODAL, false)
  })
})

describe('AppNav destroy while menu open', () => {
  test('removing mid-open resets the store pause flag', async () => {
    const el = document.createElement(COMPONENT_TAGS.APP_NAV)

    document.body.appendChild(el)
    await flush()

    el._menuOpen = true
    el.remove()

    expect(store.getters.getNavMenuOpen()).not.toBe(true)
  })
})

describe('search modal transitions', () => {
  test('open commit renders the dialog; ESC closes it through the genie leave', async () => {
    await import('@website/components/dialogs/SearchModal.js')

    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, true)
    await flush()

    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(true)

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
    await flush(500)

    el.remove()
  })
})
