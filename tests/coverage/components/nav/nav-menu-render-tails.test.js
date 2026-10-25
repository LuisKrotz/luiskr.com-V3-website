/**
 * @file nav-menu-render-tails.test.js
 * @description Coverage tails for components/nav/menu.tsx +
 * components/nav/render.tsx — mountNavMenuWebGL's absent-modal else arm
 * (`host.$` finds no modal node so applyAnimationDesc is skipped), and the
 * `!isPlainClick` early returns on the playground / star-field menu
 * anchors so modified clicks keep native <a href> semantics.
 */
import { describe, test, expect, jest } from '@jest/globals'
import {
  mountNavMenuWebGL,
  mountNavBurgerWebGL,
  navBurgerCanvas,
  toggleNavMenu,
  openNavMenu,
  closeNavMenu,
} from '@website/components/nav/menu.js'
import { renderAppNav } from '@website/components/nav/render.js'
import { localePath } from '@core/i18n.js'
import router from '@core/router/router.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { SECTIONS } from '@core/tokens/base.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { NAV_CLASSES, NAV_BURGER_CLASSES, NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

const navStub = (over = {}) => ({
  translations: null,
  currentRoute: { name: ROUTE_NAMES.HOME },
  isHomePage: true,
  isPlaygroundPage: false,
  isEarthPlaygroundPage: false,
  isStarFieldPage: false,
  onBottom: false,
  activeSection: null,
  _menuOpen: true,
  _menuClosing: false,
  _menuSettled: false,
  currentLangLabel: 'EN',
  locale: LOCALES.EN,
  _burgerCanvas: () => null,
  _menuCanvas: () => null,
  renderLocaleFlag: () => null,
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

const ctrlClick = () =>
  new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true, ctrlKey: true })

describe('nav menu + render tails', () => {
  test('mountNavMenuWebGL skips animation descs when the modal node is absent', () => {
    const host = {
      _menuOpen: true,
      $: jest.fn(() => null),
      _menuCanvasEl: null,
      _menuBg: null,
      _menuSettled: true,
      _menuSettleTimer: null,
    }

    mountNavMenuWebGL(host)

    expect(host._menuBg).toBeNull()
  })

  test('mountNavBurgerWebGL swaps a permanently dead canvas binding and rebuilds the widget', () => {
    // A live canvas whose bound context is lost and unrestorable — the
    // real-GPU-eviction signature webglContextDead() reports true for.
    const dead = document.createElement(HTML_TAGS.CANVAS)

    dead.setAttribute(ARIA_ATTRS.ARIA_LABEL, TEST_TEXT.HEADING)

    dead.getContext = (type) =>
      String(type) === WEBGL_STRINGS.WEBGL
        ? { isContextLost: () => true, getExtension: () => null }
        : null

    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(dead)
    document.body.appendChild(parent)

    const destroy = jest.fn()
    const host = {
      _burgerBtn: { useWebGL: false, destroy },
      _burgerCanvasEl: dead,
      _menuOpen: false,
      _onDark: false,
      _updateDom: jest.fn(),
    }

    mountNavBurgerWebGL(host)

    // The dead element left the DOM; the persistent slot points at the
    // fresh connected canvas and a rebuilt widget carries the label over.
    expect(destroy).toHaveBeenCalled()
    expect(dead.isConnected).toBe(false)
    expect(host._burgerCanvasEl).not.toBe(dead)
    expect(host._burgerCanvasEl.isConnected).toBe(true)
    expect(host._burgerCanvasEl.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(TEST_TEXT.HEADING)
    expect(host._burgerBtn).toBeTruthy()

    // The rebuilt widget's click route is the toggle closure — firing it
    // opens the menu on the stub host (covers the widget callback arm).
    host._burgerCanvasEl.dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
    )

    expect(host._menuOpen).toBe(true)
    expect(host._updateDom).toHaveBeenCalled()

    host._burgerBtn.destroy()
    parent.remove()
  })

  test('mountNavBurgerWebGL swap defaults the label when the dead canvas has none', () => {
    // Same unrecoverable-loss signature, minus aria-label — the fresh
    // canvas must come up with the empty-label arm, not a null attr.
    const dead = document.createElement(HTML_TAGS.CANVAS)

    dead.getContext = (type) =>
      String(type) === WEBGL_STRINGS.WEBGL
        ? { isContextLost: () => true, getExtension: () => null }
        : null

    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(dead)
    document.body.appendChild(parent)

    const host = {
      _burgerBtn: { useWebGL: false, destroy: jest.fn() },
      _burgerCanvasEl: dead,
      _menuOpen: false,
      _onDark: false,
    }

    mountNavBurgerWebGL(host)

    expect(host._burgerCanvasEl).not.toBe(dead)
    expect(host._burgerCanvasEl.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(ATTR_VALUES.EMPTY)

    host._burgerBtn.destroy()
    parent.remove()
  })

  test('mountNavBurgerWebGL tears the widget down when the canvas left the DOM', () => {
    // !burgerCanvas arm — nav states that drop the burger (404) must
    // destroy the live widget instead of leaking its GL context.
    const destroy = jest.fn()
    const host = { _burgerBtn: { destroy }, _burgerCanvasEl: null }

    mountNavBurgerWebGL(host)

    expect(destroy).toHaveBeenCalled()
    expect(host._burgerBtn).toBeNull()

    // !isConnected arm — canvas exists but is detached; nothing to
    // destroy on the widget-null path either.
    const detached = document.createElement(HTML_TAGS.CANVAS)
    const host2 = { _burgerBtn: null, _burgerCanvasEl: detached }

    mountNavBurgerWebGL(host2)

    expect(host2._burgerBtn).toBeNull()
  })

  test('mountNavMenuWebGL mounts the background widget on a connected canvas', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)

    const host = {
      _menuOpen: true,
      $: () => null,
      _menuCanvasEl: canvas,
      _menuBg: null,
      _menuSettled: true,
      _menuSettleTimer: null,
    }

    mountNavMenuWebGL(host)

    expect(host._menuBg).toBeTruthy()

    host._menuBg.destroy()
    canvas.remove()
  })

  test('navBurgerCanvas builds the element once and reuses it after', () => {
    const host = { _burgerCanvasEl: null, _onDark: false, _menuOpen: false }

    const created = navBurgerCanvas(host, TEST_TEXT.HEADING)

    expect(created).toBe(host._burgerCanvasEl)
    expect(created.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(TEST_TEXT.HEADING)

    const again = navBurgerCanvas(host, TEST_TEXT.HEADING)

    expect(again).toBe(created)
  })

  test('toggleNavMenu opens a closed menu and openNavMenu no-ops while open', () => {
    const host = {
      _menuOpen: false,
      _menuClosing: false,
      _menuSettled: false,
      _burgerBtn: null,
      _updateDom: jest.fn(),
    }

    toggleNavMenu(host)

    // Else arm — no burger widget, so the optional setOpen hop no-ops.
    expect(host._menuOpen).toBe(true)
    expect(host._updateDom).toHaveBeenCalledTimes(1)

    // Early return arm — a second open on an open menu is a no-op.
    openNavMenu(host)

    expect(host._updateDom).toHaveBeenCalledTimes(1)

    // Burger-present arm — the open morph is pushed to the live widget.
    const withBurger = { ...host, _menuOpen: false, _burgerBtn: { setOpen: jest.fn() } }

    openNavMenu(withBurger)

    expect(withBurger._burgerBtn.setOpen).toHaveBeenCalledWith(true)
  })

  test('toggleNavMenu on an open menu walks the close path', () => {
    jest.useFakeTimers()

    const host = {
      _menuOpen: true,
      _menuClosing: false,
      _menuSettled: true,
      _menuSettleTimer: null,
      _menuBg: null,
      _menuCanvasEl: null,
      _burgerBtn: null,
      _navFlags: [],
      _menuFlagCanvasEl: null,
      _menuFlagLang: null,
      $: () => null,
      _updateDom: jest.fn(),
    }

    // if arm — the overlay is open, so the toggle routes to closeNavMenu.
    toggleNavMenu(host)

    expect(host._menuClosing).toBe(true)

    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(host._menuOpen).toBe(false)

    jest.useRealTimers()
  })

  test('mountNavBurgerWebGL no-ops without a window (SSR)', () => {
    const winDesc = Object.getOwnPropertyDescriptor(globalThis, 'window')

    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })

    try {
      const host = { _burgerBtn: null, _burgerCanvasEl: null }

      mountNavBurgerWebGL(host)

      expect(host._burgerBtn).toBeNull()
    } finally {
      if (winDesc) Object.defineProperty(globalThis, 'window', winDesc)
    }
  })

  test('mountNavMenuWebGL describes the overlay when the modal node exists', () => {
    // if(modal) arm — the absent-modal tail above covers the skip path.
    const modal = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(modal)

    const host = {
      _menuOpen: true,
      $: jest.fn(() => modal),
      _menuCanvasEl: null,
      _menuBg: null,
      _menuSettled: true,
      _menuSettleTimer: null,
    }

    mountNavMenuWebGL(host)

    expect(host.$).toHaveBeenCalled()

    modal.remove()
  })

  test('settle timer leaves _menuSettled false when the menu closed first', () => {
    jest.useFakeTimers()

    const host = {
      _menuOpen: true,
      $: () => null,
      _menuCanvasEl: null,
      _menuBg: null,
      _menuSettled: false,
      _menuSettleTimer: null,
    }

    mountNavMenuWebGL(host)

    expect(host._menuSettleTimer).not.toBeNull()

    // Menu closed while the settle delay was still pending — the timer
    // callback must not stamp _menuSettled on a closed overlay.
    host._menuOpen = false

    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_SETTLE_DURATION)

    expect(host._menuSettleTimer).toBeNull()
    expect(host._menuSettled).toBe(false)

    jest.useRealTimers()
  })

  test('closeNavMenu timer clears state with no settle timer or background', () => {
    jest.useFakeTimers()

    const host = {
      _menuOpen: true,
      _menuClosing: false,
      _menuSettled: true,
      _menuSettleTimer: null,
      _menuBg: null,
      _menuCanvasEl: null,
      _burgerBtn: null,
      _navFlags: [],
      _menuFlagCanvasEl: null,
      _menuFlagLang: null,
      $: () => null,
      _updateDom: jest.fn(),
    }

    closeNavMenu(host)

    expect(host._menuClosing).toBe(true)

    // No _menuSettleTimer / _menuBg — the close timer's null arms run.
    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(host._menuOpen).toBe(false)
    expect(host._menuClosing).toBe(false)
    expect(host._menuSettled).toBe(false)

    jest.useRealTimers()
  })

  test('closeNavMenu timer bails when the close was cancelled mid-flight', () => {
    jest.useFakeTimers()

    const host = {
      _menuOpen: true,
      _menuClosing: false,
      _menuSettled: true,
      _menuSettleTimer: null,
      _menuBg: null,
      _menuCanvasEl: null,
      _burgerBtn: null,
      _navFlags: [],
      _menuFlagCanvasEl: null,
      _menuFlagLang: null,
      $: () => null,
      _updateDom: jest.fn(),
    }

    closeNavMenu(host)

    // A second path reset the flag before the dissolve timer fired —
    // the callback must return early instead of tearing the menu down.
    host._menuClosing = false

    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(host._menuOpen).toBe(true)

    jest.useRealTimers()
  })

  test('playground and star-field menu anchors keep native semantics on modified clicks', () => {
    const nav = navStub()
    const tree = renderAppNav(nav)
    const pushSpy = jest.spyOn(router, 'push')

    for (const key of [CMS_KEYS.EARTH_PLAYGROUND, CMS_KEYS.STAR_FIELD]) {
      const href = localePath(key, LOCALES.EN)
      // Modal copy — the persistent index anchors share the href but
      // are classless, so the item class scopes to the overlay row.
      const anchor = tree.querySelector(`a.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}[href="${href}"]`)

      expect(anchor).toBeTruthy()

      const ev = ctrlClick()

      anchor.dispatchEvent(ev)

      expect(ev.defaultPrevented).toBe(false)
    }

    expect(pushSpy).not.toHaveBeenCalled()
    expect(nav._closeMenu).not.toHaveBeenCalled()

    pushSpy.mockRestore()
  })

  test('playground and star-field menu anchors route through the SPA on plain clicks', () => {
    const nav = navStub()
    const tree = renderAppNav(nav)
    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => {})

    for (const key of [CMS_KEYS.EARTH_PLAYGROUND, CMS_KEYS.STAR_FIELD]) {
      const href = localePath(key, LOCALES.EN)
      const anchor = tree.querySelector(`a.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}[href="${href}"]`)

      expect(anchor).toBeTruthy()

      anchor.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

      expect(pushSpy).toHaveBeenCalledWith(href)
    }

    expect(nav._closeMenu).toHaveBeenCalled()

    pushSpy.mockRestore()
  })

  test('modal renders the experiments category heading above the playground pair', () => {
    const tree = renderAppNav(navStub())
    const group = tree.querySelector(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_GROUP}`)

    expect(group).toBeTruthy()
    expect(group.querySelector(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_GROUP_TITLE}`)).toBeTruthy()
  })

  test('action item delegates to handleAction and burger fallback toggles the menu', () => {
    const nav = navStub({ handleAction: jest.fn(), _toggleMenu: jest.fn() })
    const tree = renderAppNav(nav)

    // Heading structure: one sr-only h2 for the menu landmark + one h3
    // per item — the AT heading-jump contract.
    const items = tree.querySelectorAll(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}`)

    expect(tree.querySelectorAll(`h2.${A11Y_CLASSES.SR_ONLY}`)).toHaveLength(1)
    expect(tree.querySelectorAll(`h3.${A11Y_CLASSES.SR_ONLY}`)).toHaveLength(items.length)

    // Two rows carry nav-action-btn now (selected-work + contact) —
    // scope to the contact anchor by its href.
    const actionAnchor = tree.querySelector(
      `a.${NAV_CLASSES.NAV_ACTION_BTN}[href="${localePath(CMS_KEYS.CONTACT, LOCALES.EN)}"]`
    )

    expect(actionAnchor).toBeTruthy()

    actionAnchor.dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
    )

    expect(nav._closeMenu).toHaveBeenCalled()
    expect(nav.handleAction).toHaveBeenCalled()

    const burger = tree.querySelector(`button.${NAV_BURGER_CLASSES.NAV_BURGER_FALLBACK}`)

    expect(burger).toBeTruthy()

    burger.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(nav._toggleMenu).toHaveBeenCalled()
  })

  test('persistent menu index lists every item in closed state and goes inert while open', () => {
    // Open state — the index exists but is inert; the modal carries the
    // navigation landmark + labelledby wiring.
    const openNav = navStub({ _menuOpen: true })
    const openTree = renderAppNav(openNav)
    const openIndex = openTree.querySelector(`nav.${A11Y_CLASSES.SR_ONLY}`)
    const modal = openTree.querySelector(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL}`)

    expect(openIndex).toBeTruthy()
    expect(openIndex.hasAttribute(COMMON_ATTRS.INERT)).toBe(true)
    expect(openIndex.querySelectorAll('h3 a, h3 button').length).toBeGreaterThan(0)
    expect(modal.getAttribute(ARIA_ATTRS.ROLE)).toBe(ARIA_ATTRS.ROLE_NAVIGATION)
    expect(modal.getAttribute(ARIA_ATTRS.ARIA_LABELLEDBY)).toBe(APP_IDS.NAV_MENU_TITLE)
    expect(modal.id).toBe(APP_IDS.NAV_MENU_PANEL)
    expect(openTree.querySelector(`#${APP_IDS.NAV_MENU_TITLE}`)).toBeTruthy()

    // Closed state — the index is the live copy of the menu (the
    // heading-map/crawler surface) and the modal is landmark-free.
    const closedTree = renderAppNav(navStub({ _menuOpen: false }))
    const closedIndex = closedTree.querySelector(`nav.${A11Y_CLASSES.SR_ONLY}`)
    const closedModal = closedTree.querySelector(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL}`)

    expect(closedIndex.hasAttribute(COMMON_ATTRS.INERT)).toBe(false)
    expect(closedIndex.querySelectorAll('h3 a, h3 button').length).toBe(
      openIndex.querySelectorAll('h3 a, h3 button').length
    )
    expect(
      closedIndex.querySelector(`a[href="${localePath(CMS_KEYS.ABOUT, LOCALES.EN)}"]`)
    ).toBeTruthy()
    expect(closedIndex.querySelector(`a[tabindex="-1"]`)).toBeTruthy()
    expect(closedModal.getAttribute(ARIA_ATTRS.ROLE)).toBeNull()
    expect(closedModal.getAttribute(ARIA_ATTRS.ARIA_LABELLEDBY)).toBeNull()

    // Both burger toggles point at the overlay via aria-controls.
    expect(
      closedTree
        .querySelector(`button.${NAV_BURGER_CLASSES.NAV_BURGER_FALLBACK}`)
        .getAttribute(ARIA_ATTRS.ARIA_CONTROLS)
    ).toBe(APP_IDS.NAV_MENU_PANEL)

    // Preferences moved out of the modal into the round gear chip —
    // it delegates to the same handler the old menu row did.
    const prefNav = navStub({ _menuOpen: false, handlePreferences: jest.fn() })
    const prefTree = renderAppNav(prefNav)
    const gearBtn = prefTree.querySelector(`button.${NAV_CLASSES.NAV_GEAR_BTN}`)

    expect(gearBtn).toBeTruthy()

    gearBtn.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(prefNav.handlePreferences).toHaveBeenCalled()
  })

  test('selected-work item scrolls to the mosaic, closes only when already over it', () => {
    // Home, mid-page → scrolls to the top mosaic section.
    const nav = navStub({ isHomePage: true, activeSection: null, onBottom: false })
    const tree = renderAppNav(nav)
    const anchor = tree.querySelector(`a.${NAV_CLASSES.NAV_SELECTED_WORK}`)

    expect(anchor).toBeTruthy()

    anchor.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(nav._closeMenu).toHaveBeenCalled()
    expect(nav.scrollToTop).toHaveBeenCalled()

    // Home, already over the section → the menu just closes.
    const topNav = navStub({
      isHomePage: true,
      activeSection: SECTIONS.HOME,
      onBottom: false,
    })
    const topTree = renderAppNav(topNav)

    topTree
      .querySelector(`a.${NAV_CLASSES.NAV_SELECTED_WORK}`)
      .dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(topNav._closeMenu).toHaveBeenCalled()
    expect(topNav.scrollToTop).not.toHaveBeenCalled()
  })

  test('selected-work item navigates home off-home and keeps native semantics on modified clicks', () => {
    const nav = navStub({ isHomePage: false })
    const tree = renderAppNav(nav)
    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => {})
    const anchor = tree.querySelector(`a.${NAV_CLASSES.NAV_SELECTED_WORK}`)

    anchor.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(pushSpy).toHaveBeenCalledWith(localePath('', LOCALES.EN))
    expect(nav._closeMenu).toHaveBeenCalled()

    const ev = ctrlClick()

    anchor.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(false)

    pushSpy.mockRestore()
  })

  test('contact item flips to the scroll-up label at page bottom', () => {
    const nav = navStub({ onBottom: true })
    const tree = renderAppNav(nav)
    const anchor = tree.querySelector(
      `a.${NAV_CLASSES.NAV_ACTION_BTN}.${NAV_CLASSES.NAV_SCROLL_DOWN}`
    )

    expect(anchor).toBeTruthy()
    expect(anchor.getAttribute('href')).toBe(localePath('', LOCALES.EN))
  })

  test('flag chip opens the language dialog and is suppressed on the docs route', () => {
    const nav = navStub({ handleLang: jest.fn() })
    const tree = renderAppNav(nav)
    const flagBtn = tree.querySelector(`button.${NAV_CLASSES.NAV_FLAG_BTN}`)

    expect(flagBtn).toBeTruthy()

    flagBtn.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(nav.handleLang).toHaveBeenCalled()

    const docsNav = navStub({ currentRoute: { name: ROUTE_NAMES.HOME, meta: { docsRoute: true } } })
    const docsTree = renderAppNav(docsNav)

    expect(docsTree.querySelector(`button.${NAV_CLASSES.NAV_FLAG_BTN}`)).toBeNull()
  })
})
