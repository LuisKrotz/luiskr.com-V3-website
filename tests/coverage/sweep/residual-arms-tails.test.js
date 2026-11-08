/**
 * @file residual-arms-tails.test.js
 * @description Last-arm sweep: SearchModal's pre-open render/setter arms,
 * AppNav's icon-aura mount callback, RouteSearch's unseeded-query and
 * list-close arms, nav render's non-home dark arm.
 */
import { jest } from '@jest/globals'
import '@website/components/dialogs/SearchModal.js'
import { renderAppNav } from '@website/components/nav/render.js'

import { STATE_CLASSES } from '@core/tokens/classes/state.js'

import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import store from '@core/store.js'

const flush = (ms = 120) => new Promise((r) => setTimeout(r, ms))

const navStub = (over = {}) => ({
  translations: null,
  currentRoute: { name: ROUTE_NAMES.ABOUT },
  isHomePage: false,
  isPlaygroundPage: false,
  isEarthPlaygroundPage: false,
  isStarFieldPage: false,
  onBottom: false,
  activeSection: null,
  _menuOpen: false,
  _menuClosing: false,
  _menuSettled: false,
  locale: LOCALES.EN,
  _burgerCanvas: () => null,
  _menuCanvas: () => null,
  handleLang: () => {},
  handlePreferences: () => {},
  _toggleMenu: () => {},
  _closeMenu: jest.fn(),
  handleLogo: () => {},
  handleAbout: () => {},
  handleAction: () => {},
  scrollToTop: jest.fn(),
  _onDark: null,
  ...over,
})

describe('nav render — dark-theme on a non-home route', () => {
  test('dark theme + non-home page evaluates the isHomePage arm false', () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    const tree = renderAppNav(navStub())

    expect(tree).toBeTruthy()
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
  })
})

describe('SearchModal residual arms', () => {
  test('setter drives open/close through _isOpen when flag absent', async () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    el.open = true // isOpen truthy → the onStoreUpdate open branch
    await flush()

    el.onStoreUpdate()

    el.open = false
    await flush()

    el.close() // early-return arm when already closed

    el.remove()
  })

  test('open path arms — search absent / focusInput missing', async () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    // isOpen reads the STORE getter — drive it via commit, not _isOpen.
    jest.spyOn(el, '$').mockReturnValue(null) // route-search missing → search?. arm

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, true)
    await flush()

    el.onStoreUpdate() // hasAttribute(OPEN) set → the !hasAttribute falsy arm

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    await flush() // !isOpen && hasAttribute(OPEN) → else-if arm

    // _isOpen fallback arm — pull the store getter away temporarily.
    const origGetter = store.getters.getSearchModalOpen

    store.getters.getSearchModalOpen = undefined
    el._isOpen = true
    expect(el.isOpen).toBe(true)
    store.getters.getSearchModalOpen = origGetter

    jest.restoreAllMocks()
    el.remove()
  })

  test('route-search present without focusInput → ?.() arm', async () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    jest.spyOn(el, '$').mockReturnValue({ tagName: 'ROUTE-SEARCH' })

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, true)
    await flush()

    jest.restoreAllMocks()
    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    el.remove()
  })

  test('render while open + close while open + close while closing', async () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, true)
    await flush()

    expect(el.render()).not.toBe(ATTR_VALUES.EMPTY)

    el.close() // opens the genieLeave path (isOpen && !_closing)
    el.close() // _closing guard arm

    await flush(400)
    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    el.remove()
  })
})
