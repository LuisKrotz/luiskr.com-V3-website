/**
 * @file nav-menu-render-tails.test.js
 * @description Coverage tails for components/nav/menu.tsx +
 * components/nav/render.tsx — mountNavMenuWebGL's absent-modal else arm
 * (`host.$` finds no modal node so applyAnimationDesc is skipped), and the
 * `!isPlainClick` early returns on the playground / star-field menu
 * anchors so modified clicks keep native <a href> semantics.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { mountNavMenuWebGL } from '@website/components/nav/menu.js'
import { renderAppNav } from '@website/components/nav/render.js'
import { localePath } from '@core/i18n.js'
import router from '@core/router/router.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { NAV_CLASSES, NAV_BURGER_CLASSES, NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'

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

  test('modal items skip their sr-only heading when a label resolves empty', () => {
    // An empty locale label (currentLangLabel '') must not produce an
    // empty h3 — heading maps only get rows that carry copy.
    const tree = renderAppNav(navStub({ currentLangLabel: '' }))
    const modalItems = tree.querySelectorAll(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}`)
    const headings = tree.querySelectorAll(`h3.${A11Y_CLASSES.SR_ONLY}`)

    expect(headings.length).toBe(modalItems.length - 1)
  })

  test('action item delegates to handleAction and burger fallback toggles the menu', () => {
    const nav = navStub({ handleAction: jest.fn(), _toggleMenu: jest.fn() })
    const tree = renderAppNav(nav)

    // Heading structure: one sr-only h2 for the menu landmark + one h3
    // per item — the AT heading-jump contract.
    const items = tree.querySelectorAll(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}`)

    expect(tree.querySelectorAll(`h2.${A11Y_CLASSES.SR_ONLY}`)).toHaveLength(1)
    expect(tree.querySelectorAll(`h3.${A11Y_CLASSES.SR_ONLY}`)).toHaveLength(items.length)

    const actionAnchor = tree.querySelector(`a.${NAV_CLASSES.NAV_ACTION_BTN}`)

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

    // Index items delegate to the same handlers as the modal items —
    // the first button item is the preferences trigger.
    const prefNav = navStub({ _menuOpen: false, handlePreferences: jest.fn() })
    const prefTree = renderAppNav(prefNav)
    const prefIndexBtn = [...prefTree.querySelectorAll(`nav.${A11Y_CLASSES.SR_ONLY} h3 button`)][0]

    expect(prefIndexBtn).toBeTruthy()

    prefIndexBtn.dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
    )

    expect(prefNav.handlePreferences).toHaveBeenCalled()
  })
})
