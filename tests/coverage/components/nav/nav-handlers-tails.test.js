/**
 * @file nav-handlers-tails.test.js
 * @description Coverage tails for components/nav/handlers.ts — the
 * `!isPlainClick(e)` early returns on handleLogo/handleAbout/handleAction:
 * modified or middle clicks must bail before swallow() so the browser keeps
 * native <a href> semantics (open in new tab).
 */
import { describe, test, expect, jest } from '@jest/globals'
import {
  handleLogo,
  handleAbout,
  handleAction,
  handleSearch,
} from '@website/components/nav/handlers.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import router from '@core/router/router.js'

const { MENU_CLOSE_DURATION } = ANIMATION_DURATIONS

/** Middle-click event stub — isPlainClick rejects button !== 0. */
const middleClick = () => ({
  button: 1,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
})

const hostStub = () => ({
  isHomePage: false,
  onBottom: false,
  locale: 'en',
  scrollToTop: jest.fn(),
  goToAbout: jest.fn(),
  scrollToContact: jest.fn(),
})

describe('nav handlers non-plain click tails', () => {
  test('handleLogo returns early on a modified/middle click', () => {
    const host = hostStub()
    const e = middleClick()
    const pushSpy = jest.spyOn(router, 'push')

    handleLogo(host, e)

    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()

    pushSpy.mockRestore()
  })

  test('handleAbout returns early on a modified/middle click', () => {
    const host = hostStub()
    const e = middleClick()
    const pushSpy = jest.spyOn(router, 'push')

    handleAbout(host, e)

    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()

    pushSpy.mockRestore()
  })

  test('handleAction returns early on a modified/middle click', () => {
    const host = hostStub()
    const e = middleClick()
    const pushSpy = jest.spyOn(router, 'push')

    handleAction(host, e)

    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    expect(host.scrollToContact).not.toHaveBeenCalled()

    pushSpy.mockRestore()
  })

  test('handleSearch deferred open tolerates a missing window (SSR arm)', async () => {
    const host = {
      _menuOpen: true,
      _closeMenu: jest.fn(),
      _captureOrigin: jest.fn(),
      isHomePage: false,
      locale: 'en',
    }

    handleSearch(host)

    const prevWindow = globalThis.window

    delete globalThis.window

    // The menu→search handoff defers `open` past the dissolve — the timer
    // fires with `window` gone so the guard takes its no-window arm.
    await new Promise((r) => setTimeout(r, MENU_CLOSE_DURATION + 50))

    globalThis.window = prevWindow

    expect(host._closeMenu).toHaveBeenCalled()
  })
})
