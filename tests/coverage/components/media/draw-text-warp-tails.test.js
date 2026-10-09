/**
 * @file draw-text-warp-tails.test.js
 * @description Coverage tails for draw-text/warp.ts — the cursor-following
 * liquid warp: session arm on pointerenter, gaussian displacement on
 * pointermove (rAF-batched), transform reset on pointerleave, listener
 * detach on disconnect, and every early-return arm (no session, chars
 * mid-reveal, reduced motion, empty char set).
 */
import '@website/components/media/DrawText.js'
import store from '@core/store.js'
import { waitFor, TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { DRAW_TEXT_SELECTORS } from '@core/tokens/selectors/draw-text.js'

describe('draw-text warp tails', () => {
  let el

  const mount = (text, attrs = {}) => {
    el = document.createElement(COMPONENT_TAGS.DRAW_TEXT)

    if (text) el.setAttribute(FORM_ATTRS.TEXT, text)

    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]))

    document.body.appendChild(el)

    return el
  }

  const chars = () =>
    Array.from(el.shadowRoot.querySelectorAll(DRAW_TEXT_SELECTORS.DRAW_TEXT_CHAR))

  const move = (x, y) => {
    el.dispatchEvent(
      new MouseEvent(POINTER_EVENTS.POINTERMOVE, { clientX: x, clientY: y })
    )
  }

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
  })

  test('warp attr keeps char spans mounted before/after the reveal', () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    expect(chars().length).toBeGreaterThan(0)
  })

  test('pointerenter arms a session; pointermove warps chars inside rAF', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

    expect(el._warpSession).not.toBeNull()
    expect(el._warpActive).toBe(true)

    move(0, 0)

    await waitFor(() => chars().some((c) => c.style.transform.includes('translateY')))
  })

  test('far pointer clears transforms (infl < 0.01 arm, both transform arms)', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

    // Far before any transform was written — the empty-transform arm.
    move(1e6, 1e6)

    await waitFor(() => !el._warpSession.raf)

    move(0, 0)

    await waitFor(() => chars().some((c) => c.style.transform))

    move(1e6, 1e6)

    await waitFor(() => chars().every((c) => !c.style.transform))
  })

  test('skew sign follows pointer side (dx >= 0 vs dx < 0)', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)

    await waitFor(() => chars().some((c) => c.style.transform.includes('skewX(-')))

    // Slightly negative px: dx < 0 with influence still near 1 → positive skew.
    move(-0.01, 0)

    await waitFor(() =>
      chars().some(
        (c) => c.style.transform.includes('skewX(') && !c.style.transform.includes('skewX(-')
      )
    )
  })

  test('a second move in the same frame reuses the pending rAF', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)
    move(0, 0)

    await waitFor(() => chars().some((c) => c.style.transform.includes('translateY')))
  })

  test('applyWarp bails when the session vanished before the rAF tick', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)

    el._warpSession = null

    await new Promise((r) => setTimeout(r, 30))

    expect(chars().every((c) => !c.style.transform)).toBe(true)
  })

  test('pointerleave resets transforms and clears the session', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)

    await waitFor(() => chars().some((c) => c.style.transform))

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))

    expect(el._warpSession).toBeNull()
    expect(el._warpActive).toBe(false)
    expect(chars().every((c) => !c.style.transform)).toBe(true)
  })

  test('move without session / mid-reveal / reduced-motion are no-ops', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    move(0, 0)

    expect(el._warpSession).toBeNull()

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)

    await new Promise((r) => setTimeout(r, 30))

    expect(chars().every((c) => !c.style.transform)).toBe(true)

    el._hasAnimated = true
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)
    move(0, 0)

    await new Promise((r) => setTimeout(r, 30))

    expect(chars().every((c) => !c.style.transform)).toBe(true)
  })

  test('leave with no session returns early', () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))

    expect(el._warpSession).toBeNull()
  })

  test('enter with an empty char set leaves no session', () => {
    mount('', { [COMMON_ATTRS.WARP]: '' })

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

    expect(el._warpSession).toBeNull()
  })

  test('leave before the rAF tick makes applyWarp bail on null session', async () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)
    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))

    await new Promise((r) => setTimeout(r, 30))

    expect(el._warpSession).toBeNull()
  })

  test('disconnect cancels a pending rAF and detaches listeners', () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._hasAnimated = true

    el.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    move(0, 0)

    expect(el._warpSession.raf).toBeTruthy()

    el.remove()

    expect(el._warpSession).toBeNull()
    expect(el._warpListeners).toBeNull()
  })

  test('removing the warp attr re-renders without char spans', () => {
    mount(TEST_TEXT.HELLO_WORLD, { [COMMON_ATTRS.WARP]: '' })

    el._isVisible = true
    el._hasAnimated = true

    el.removeAttribute(COMMON_ATTRS.WARP)

    expect(chars().length).toBe(0)

    el.setAttribute(COMMON_ATTRS.WARP, '')

    expect(chars().length).toBeGreaterThan(0)
  })

  test('non-warp elements never install warp listeners', () => {
    mount(TEST_TEXT.HELLO_WORLD)

    expect(el._warpListeners).toBeNull()
  })
})
