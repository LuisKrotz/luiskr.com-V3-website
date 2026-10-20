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
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'

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
  _menuCloseCanvas: () => null,
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
      _menuCloseCanvasEl: null,
      _menuBg: null,
      _menuCloseBtn: null,
      _menuSettled: true,
      _menuSettleTimer: null,
    }

    mountNavMenuWebGL(host)

    expect(host._menuBg).toBeNull()
    expect(host._menuCloseBtn).toBeNull()
  })

  test('playground and star-field menu anchors keep native semantics on modified clicks', () => {
    const nav = navStub()
    const tree = renderAppNav(nav)
    const pushSpy = jest.spyOn(router, 'push')

    for (const key of [CMS_KEYS.EARTH_PLAYGROUND, CMS_KEYS.STAR_FIELD]) {
      const href = localePath(key, LOCALES.EN)
      const anchor = tree.querySelector(`a[href="${href}"]`)

      expect(anchor).toBeTruthy()

      const ev = ctrlClick()

      anchor.dispatchEvent(ev)

      expect(ev.defaultPrevented).toBe(false)
    }

    expect(pushSpy).not.toHaveBeenCalled()
    expect(nav._closeMenu).not.toHaveBeenCalled()

    pushSpy.mockRestore()
  })
})
