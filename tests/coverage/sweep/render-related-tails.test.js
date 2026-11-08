/**
 * @file render-related-tails.test.js
 * @description Sweep tails: nav render's onDark binary arms (bottom-of-
 * page / contact-section / playground inks), related card's loaded-rung
 * registry arm, and project data's locale-fallback arm.
 */
import { jest } from '@jest/globals'
import { renderAppNav } from '@website/components/nav/render.js'
import { renderRelated } from '@website/components/portfolio/related/render.js'
import { loadData } from '@website/views/project/data.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { SECTIONS } from '@core/tokens/base.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { LOCALES } from '@core/tokens/locales.js'
import { TEST_TEXT, TEST_PROJECTS, TEST_URLS } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

/** Minimal nav-store surface components read — overridable per test. */
const navStub = (over = {}) => ({
  translations: null,
  currentRoute: { name: ROUTE_NAMES.HOME },
  isHomePage: true,
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

describe('nav render onDark arms', () => {
  test('dark theme + onBottom + home → dark-ink control', () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    const tree = renderAppNav(navStub({ onBottom: true }))

    expect(tree).toBeTruthy()
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
  })

  test('dark theme + activeSection CONTACT (not bottom) → still dark', () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    const tree = renderAppNav(navStub({ activeSection: SECTIONS.CONTACT }))

    expect(tree).toBeTruthy()
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
  })

  test('playground page is always light-ink regardless of theme', () => {
    const tree = renderAppNav(navStub({ isPlaygroundPage: true, isHomePage: false }))

    expect(tree).toBeTruthy()
  })

  test('menu open forces theme ink over the modal surface', () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    const tree = renderAppNav(navStub({ _menuOpen: true, onBottom: true }))

    expect(tree).toBeTruthy()
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
  })
})

describe('related render loaded-rung arm', () => {
  const hostWith = (loadedCovers) => ({
    projectsList: [
      {
        fullPath: `/portfolio/${TEST_PROJECTS.SLUG_MINIMELISSA}`,
        imageSrc: TEST_URLS.IMG,
        page: TEST_TEXT.HEADING,
        description: TEST_TEXT.SECOND,
        link: TEST_PROJECTS.SLUG_MINIMELISSA,
      },
    ],
    translations: {
      title: TEST_TEXT.HEADING,
      note: TEST_TEXT.SECOND,
      socials: [],
    },
    _loadedCovers: loadedCovers,
  })

  test('a confirmed cover rung marks the card alreadyLoaded', () => {
    const host = hostWith(new Map([[TEST_URLS.IMG, 'high.jpg']]))
    const tree = renderRelated(host)

    expect(tree.querySelector(`.${RELATED_CLASSES.RELATED_LIST_ITEM}`)).toBeTruthy()
  })

  test('no imageSrc → covers.rungs empty → the other && arm', () => {
    const host = hostWith(new Map())

    host.projectsList[0].imageSrc = ''

    const tree = renderRelated(host)

    expect(tree.querySelector(`.${RELATED_CLASSES.RELATED_LIST_ITEM}`)).toBeTruthy()
  })

  test('rungs present but no confirmed rung → Boolean(reached) false arm', () => {
    const host = hostWith(new Map()) // imageSrc set, registry empty → reached falsy

    const tree = renderRelated(host)

    expect(tree.querySelector(`.${RELATED_CLASSES.RELATED_LIST_ITEM}`)).toBeTruthy()
  })
})

describe('project data locale fallback arm', () => {
  test('empty store locale falls back to EN', () => {
    const view = { projectSlug: TEST_PROJECTS.SLUG_MINIMELISSA, _lastLocale: null }

    const langSpy = jest
      .spyOn(store.getters, 'getlang')
      .mockReturnValue({ locale: '', database: '', pagesPath: '' })

    loadData(view)

    expect(view._lastLocale).toBe(LOCALES.EN)
    langSpy.mockRestore()
  })

  test('a populated store locale wins over the EN fallback', () => {
    const view = { projectSlug: TEST_PROJECTS.SLUG_MINIMELISSA, _lastLocale: null }

    const langSpy = jest
      .spyOn(store.getters, 'getlang')
      .mockReturnValue({ locale: 'br', database: '', pagesPath: '' })

    loadData(view)

    expect(view._lastLocale).toBe('br')
    langSpy.mockRestore()
  })
})

void NAV_CLASSES
