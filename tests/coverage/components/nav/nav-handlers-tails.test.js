/**
 * @file nav-handlers-tails.test.js
 * @description Coverage tails for components/nav/handlers.ts — the
 * `!isPlainClick(e)` early returns on handleLogo/handleAbout/handleAction:
 * modified or middle clicks must bail before swallow() so the browser keeps
 * native <a href> semantics (open in new tab).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { handleLogo, handleAbout, handleAction } from '@website/components/nav/handlers.js'
import router from '@core/router/router.js'

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
})
