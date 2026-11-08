/**
 * @file nav-joust-tails.test.js
 * @description Coverage tails for the joust gate wiring in
 * components/nav — handlers.ts's `if (!joustClick(e)) return` guards on
 * the language/search/preferences chips (first hover-less tap pours the
 * label, second commits), and menu.tsx's toggleNavMenu gate for both the
 * DOM-event path (label span / fallback button) and the event-less
 * WebGL-canvas callback path, plus the menu-open bypass that keeps
 * closing single-tap.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { handleLang, handleSearch, handlePreferences } from '@website/components/nav/handlers.js'
import { toggleNavMenu, openNavMenu } from '@website/components/nav/menu.js'
import store from '@core/store.js'
import { JOUST_CLASSES } from '@core/tokens/classes/joust.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { joustCollapseAll } from '@core/utils/dom/joust.js'

/** Mirrors the setup.js matchMedia mock shape with a switchable `matches`. */
const stubMatchMedia = (matches) => {
  window.matchMedia = (query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

/** A joust-rooted button chip hosting a `joust-label` span. */
const makeChip = () => {
  const chip = document.createElement(HTML_TAGS.BUTTON)

  chip.classList.add(JOUST_CLASSES.JOUST)

  const label = document.createElement(HTML_TAGS.SPAN)

  label.classList.add(JOUST_CLASSES.JOUST_LABEL)

  chip.appendChild(label)
  document.body.appendChild(chip)

  return { chip, label }
}

/** Dispatches a real pointer click so `e.currentTarget` + `detail` are live. */
const pointerClick = (el) => {
  el.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 1 }))
}

/** Minimal NavMenuHost surface for toggleNavMenu/openNavMenu. */
const menuHost = (over = {}) => ({
  _menuOpen: false,
  _menuClosing: false,
  _menuSettled: false,
  _menuSettleTimer: null,
  _menuBg: null,
  _menuCanvasEl: null,
  _burgerBtn: null,
  _burgerCanvasEl: null,
  _onDark: false,
  $: () => null,
  _updateDom: jest.fn(),
  ...over,
})

/** Fake `this` for the nav handlers — jest fns record every internal call. */
const handlerHost = () => ({
  _captureOrigin: jest.fn(),
  _menuOpen: false,
  _closeMenu: jest.fn(),
})

describe('nav joust wiring tails', () => {
  let origMatchMedia

  beforeEach(() => {
    origMatchMedia = window.matchMedia
  })

  afterEach(() => {
    joustCollapseAll()

    window.matchMedia = origMatchMedia

    document.body.innerHTML = CHAR_STRINGS.EMPTY

    store.commit(MODAL_MUTATIONS.TOGGLE_LANG_DIALOG, false)
    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    store.commit(MODAL_MUTATIONS.TOGGLE_PREFERENCES_MODAL, false)
  })

  test('handleLang jousts the first hover-less tap and commits on the second', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()
    const host = handlerHost()

    chip.addEventListener(MOUSE_EVENTS.CLICK, (e) => handleLang(host, e))

    pointerClick(chip)

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)
    expect(store.getters.getLangDialogOpen()).toBe(false)
    expect(host._captureOrigin).not.toHaveBeenCalled()

    pointerClick(chip)

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
    expect(store.getters.getLangDialogOpen()).toBe(true)
    expect(host._captureOrigin).toHaveBeenCalled()
  })

  test('handleSearch + handlePreferences share the same first-tap gate', () => {
    stubMatchMedia(true)

    const host = handlerHost()
    const search = makeChip()
    const prefs = makeChip()

    search.chip.addEventListener(MOUSE_EVENTS.CLICK, (e) => handleSearch(host, e))
    prefs.chip.addEventListener(MOUSE_EVENTS.CLICK, (e) => handlePreferences(host, e))

    pointerClick(search.chip)

    expect(search.chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)
    expect(store.getters.getSearchModalOpen()).toBe(false)

    pointerClick(search.chip)

    expect(store.getters.getSearchModalOpen()).toBe(true)

    pointerClick(prefs.chip)

    expect(prefs.chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)
    expect(store.getters.getPreferencesOpen()).toBe(false)

    pointerClick(prefs.chip)

    expect(store.getters.getPreferencesOpen()).toBe(true)
  })

  test('hover-capable clicks keep firing single-shot through the gate', () => {
    stubMatchMedia(false)

    const { chip } = makeChip()
    const host = handlerHost()

    chip.addEventListener(MOUSE_EVENTS.CLICK, (e) => handleLang(host, e))

    pointerClick(chip)

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
    expect(store.getters.getLangDialogOpen()).toBe(true)
  })

  test('toggleNavMenu jousts the DOM-event path, opens on the second tap', () => {
    stubMatchMedia(true)

    const { label } = makeChip()
    const host = menuHost()

    label.addEventListener(MOUSE_EVENTS.CLICK, (e) => toggleNavMenu(host, e))

    pointerClick(label)

    expect(host._menuOpen).toBe(false)
    expect(host._updateDom).not.toHaveBeenCalled()

    pointerClick(label)

    expect(host._menuOpen).toBe(true)
    expect(host._updateDom).toHaveBeenCalled()
  })

  test('toggleNavMenu gates the burger canvas callback (event-less chip arm)', () => {
    stubMatchMedia(true)

    const wrap = document.createElement(HTML_TAGS.DIV)

    wrap.classList.add(JOUST_CLASSES.JOUST)

    const canvas = document.createElement(HTML_TAGS.CANVAS)

    wrap.appendChild(canvas)
    document.body.appendChild(wrap)

    const host = menuHost()

    // The BurgerButtonWebGL click route — a real tap with no DOM event.
    toggleNavMenu(host, undefined, canvas)

    expect(host._menuOpen).toBe(false)
    expect(wrap.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    toggleNavMenu(host, undefined, canvas)

    expect(host._menuOpen).toBe(true)
    expect(wrap.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('toggleNavMenu bypasses the gate while the menu is open', () => {
    stubMatchMedia(true)
    jest.useFakeTimers()

    const { chip } = makeChip()
    const host = menuHost({ _menuOpen: true, _menuSettled: true })

    chip.addEventListener(MOUSE_EVENTS.CLICK, (e) => toggleNavMenu(host, e))

    pointerClick(chip)

    // Single tap closes — no joust pin, straight into the closing state.
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
    expect(host._menuClosing).toBe(true)

    jest.advanceTimersByTime(ANIMATION_DURATIONS.MENU_CLOSE_DURATION)

    expect(host._menuOpen).toBe(false)

    jest.useRealTimers()
  })

  test('openNavMenu collapses a pinned joust on another chip', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()
    const host = menuHost()

    chip.addEventListener(MOUSE_EVENTS.CLICK, (e) => handleLang(handlerHost(), e))

    pointerClick(chip)

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    openNavMenu(host)

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
    expect(host._menuOpen).toBe(true)
  })
})
