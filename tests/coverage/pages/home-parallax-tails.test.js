/**
 * @file home-parallax-tails.test.js
 * @description Coverage tails for views/home/parallax.ts — the desktop
 * scroll-parallax session on <view-home>. Exercises the ≥1280 mql gate,
 * the reduced-motion precedence contract (localStorage > store > live
 * OS flag), layer resolve/reuse/rebuild, the measure/paint arms
 * (deadband, progress clamps, empty range),
 * scroll-event coalescing, RO/resize remeasure, callbacks surviving
 * detach, and every typeof-guard else arm.
 */

import { jest } from '@jest/globals'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { SECTIONS } from '@core/tokens/base.js'
import { PARALLAX_CSS_PROPS } from '@core/tokens/css/parallax.js'
import { PREF_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { FORM_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { SECTION_IDS } from '@core/tokens/ids/sections.js'
import { WIDTH_CLASS_GATES } from '@core/tokens/layout/css-classes.js'
import { PARALLAX } from '@core/tokens/motion/parallax.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import store from '@core/store.js'
import { resetViewportCache } from '@core/utils/dom.js'
import '@website/views/home/Home.js'
import { attachParallax, detachParallax, syncParallax } from '@website/views/home/parallax.js'
import { mount } from '@tests/fixtures/test-constants.js'

/** Generous flush — the view's render + data queues need real timers. */
const flush = (ms = 120) => new Promise((r) => setTimeout(r, ms))

/** Pending-rAF queue — frame delivery stays deterministic per test. */
const stubFrames = () => {
  const pending = new Map()
  let id = 0

  globalThis.requestAnimationFrame = jest.fn((cb) => {
    pending.set(++id, cb)

    return id
  })
  globalThis.cancelAnimationFrame = jest.fn((h) => pending.delete(h))

  return {
    pending,
    /** Deliver every queued frame once. */
    run: () => {
      const cbs = [...pending.values()]

      pending.clear()
      cbs.forEach((cb) => cb(0))
    },
  }
}

/** Minimal MediaQueryList — captured change listeners fire gate re-evals. */
const makeMql = (matches) => {
  const listeners = new Set()

  return {
    matches,
    addEventListener: jest.fn((e, fn) => listeners.add(fn)),
    removeEventListener: jest.fn((e, fn) => listeners.delete(fn)),
    /** Trip the change listeners as a media-query crossing would. */
    fire: () => listeners.forEach((fn) => fn()),
  }
}

/** Route matchMedia calls to the supplied per-query mqls. */
const stubMatchMedia = (map) => {
  window.matchMedia = jest.fn((q) => map[q])
}

/** ResizeObserver record — captured callbacks + observed targets. */
const stubRO = () => {
  const rec = { cbs: [], observed: [], disconnected: 0 }

  globalThis.ResizeObserver = class {
    constructor(cb) {
      rec.cbs.push(cb)
    }
    observe(t) {
      rec.observed.push(t)
    }
    disconnect() {
      rec.disconnected += 1
    }
  }

  return rec
}

/** View double — element resolution + scoped-listener capture for the
 *  arms a real view can't reach (post-detach fires, missing els). */
const makeView = (resolve) => {
  const listeners = []

  return {
    _parallax: null,
    listeners,
    $: jest.fn((sel) => resolve(sel)),
    addScopedListener: jest.fn((target, event, fn) => {
      listeners.push({ target, event, fn })
    }),
    /** Invoke every captured listener bound for `event`. */
    fire: (event) => listeners.filter((l) => l.event === event).forEach((l) => l.fn()),
  }
}

/** Element double — inline-var writes land in `vars`; rect is mutable. */
const makeEl = (rect = { top: 0, height: 0 }) => {
  const el = {
    rect,
    vars: {},
    style: {
      setProperty: jest.fn((p, v) => {
        el.vars[p] = v
      }),
      removeProperty: jest.fn((p) => {
        delete el.vars[p]
      }),
    },
    getBoundingClientRect: jest.fn(() => el.rect),
  }

  return el
}

/** Expected inline var value for an amplitude at a given progress. */
const expectVar = (amp, p) => `${Math.round(p * amp * 100) / 100}${COMMON_ATTRS.PX}`

describe('home parallax tails', () => {
  let origs

  beforeEach(() => {
    origs = {
      matchMedia: window.matchMedia,
      gbcr: Element.prototype.getBoundingClientRect,
      raf: globalThis.requestAnimationFrame,
      caf: globalThis.cancelAnimationFrame,
      ro: globalThis.ResizeObserver,
      scrollY: window.scrollY,
      innerH: window.innerHeight,
      reducedMotion: store.state.reducedMotion,
    }
  })

  afterEach(() => {
    window.matchMedia = origs.matchMedia
    Element.prototype.getBoundingClientRect = origs.gbcr
    globalThis.requestAnimationFrame = origs.raf
    globalThis.cancelAnimationFrame = origs.caf

    if (origs.ro === undefined) delete globalThis.ResizeObserver
    else globalThis.ResizeObserver = origs.ro

    Object.defineProperty(window, 'scrollY', {
      value: origs.scrollY,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, 'innerHeight', { value: origs.innerH, configurable: true })
    store.state.reducedMotion = origs.reducedMotion
    localStorage.removeItem(PREF_STORAGE_KEYS.REDUCED_MOTION)
    resetViewportCache()
  })

  test('arms on the desktop gate — coalesced scroll paints, disarm clears, re-render rebinds', async () => {
    const frames = stubFrames()
    const desk = makeMql(true)
    const motion = makeMql(false)
    const ro = stubRO()

    stubMatchMedia({
      [WIDTH_CLASS_GATES.desktop]: desk,
      [MEDIA_QUERIES.PREFERS_REDUCED_MOTION]: motion,
    })

    Element.prototype.getBoundingClientRect = () => ({ top: 0, height: 600 })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })

    const el = document.createElement(VIEW_TAGS.VIEW_HOME)
    const unmount = mount(el)
    await flush()

    const s = el._parallax
    const stack = el.$(`#${SECTIONS.HOME} > ${COMPONENT_TAGS.CARD_STACK}`)
    const about = el.$(`#${SECTION_IDS.ABOUT} > ${COMPONENT_TAGS.ABOUT_SECTION}`)
    const awards = el.$(COMPONENT_TAGS.AWARDS_MENTIONS)

    expect(s.armed).toBe(true)
    expect(ro.observed).toContain(el.$(`#${SECTIONS.HOME}`))
    expect(stack.style.getPropertyValue(PARALLAX_CSS_PROPS.DECK_Y)).not.toBe('')
    expect(about.style.getPropertyValue(PARALLAX_CSS_PROPS.ABOUT_MAIN_Y)).not.toBe('')
    expect(about.style.getPropertyValue(PARALLAX_CSS_PROPS.ABOUT_TEXT_Y)).not.toBe('')
    expect(awards.style.getPropertyValue(PARALLAX_CSS_PROPS.AWARDS_Y)).not.toBe('')

    // A scroll burst schedules ONE frame; the second event sees raf set.
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true })
    const before = frames.pending.size

    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
    expect(frames.pending.size).toBe(before + 1)

    frames.run()
    const painted = stack.style.getPropertyValue(PARALLAX_CSS_PROPS.DECK_Y)

    expect(painted).not.toBe('')

    // Same scrollY again — the deadband skips the rewrite.
    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
    frames.run()
    expect(stack.style.getPropertyValue(PARALLAX_CSS_PROPS.DECK_Y)).toBe(painted)

    // Gate drops while a frame is pending — cancel + var cleanup.
    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
    desk.matches = false
    desk.fire()

    expect(s.armed).toBe(false)
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled()
    expect(stack.style.getPropertyValue(PARALLAX_CSS_PROPS.DECK_Y)).toBe('')
    expect(about.style.getPropertyValue(PARALLAX_CSS_PROPS.ABOUT_MAIN_Y)).toBe('')

    // Re-arm — the RO rebinds to the live measure anchors and repaints.
    desk.matches = true
    desk.fire()
    expect(s.armed).toBe(true)
    expect(stack.style.getPropertyValue(PARALLAX_CSS_PROPS.DECK_Y)).not.toBe('')

    // RO remeasure — armed: measure + one scheduled repaint; a second
    // delivery sees raf already set.
    const roBefore = frames.pending.size

    ro.cbs.forEach((cb) => cb())
    ro.cbs.forEach((cb) => cb())
    expect(frames.pending.size).toBe(roBefore + 1)

    frames.run()

    // Window resize rides the same remeasure path.
    const rsBefore = frames.pending.size

    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))
    expect(frames.pending.size).toBe(rsBefore + 1)

    frames.run()

    // Store-push sync on an unchanged DOM — the armed && !changed out.
    const hero0 = s.hero

    syncParallax(el)
    el.onStoreUpdate()
    expect(s.hero).toBe(hero0)

    // A re-render swaps the layer nodes — the slot rebuilds.
    el.setState({})
    await flush()
    expect(s.hero).not.toBe(hero0)
    expect(s.hero.el).toBe(el.$(`#${SECTIONS.HOME} > ${COMPONENT_TAGS.CARD_STACK}`))
    expect(stack.style).not.toBe(s.hero.el.style)

    unmount()
    expect(el._parallax).toBeNull()
  })

  test('reduced-motion precedence — stored pref > store > live OS flag', async () => {
    stubFrames()
    const desk = makeMql(true)
    const motion = makeMql(false)
    stubRO()
    stubMatchMedia({
      [WIDTH_CLASS_GATES.desktop]: desk,
      [MEDIA_QUERIES.PREFERS_REDUCED_MOTION]: motion,
    })

    const el = document.createElement(VIEW_TAGS.VIEW_HOME)
    const unmount = mount(el)
    await flush()

    const s = el._parallax
    const stack = el.$(`#${SECTIONS.HOME} > ${COMPONENT_TAGS.CARD_STACK}`)

    expect(s.armed).toBe(true)

    // Stored 'true' wins over a permissive OS flag — disarms + clears.
    localStorage.setItem(PREF_STORAGE_KEYS.REDUCED_MOTION, ATTR_VALUES.TRUE)
    syncParallax(el)
    expect(s.armed).toBe(false)
    expect(stack.style.getPropertyValue(PARALLAX_CSS_PROPS.DECK_Y)).toBe('')

    // A stored non-'true' value means motion is allowed — re-arms.
    localStorage.setItem(PREF_STORAGE_KEYS.REDUCED_MOTION, ATTR_VALUES.FALSE)
    syncParallax(el)
    expect(s.armed).toBe(true)

    // No stored pref — the store flag rules next.
    localStorage.removeItem(PREF_STORAGE_KEYS.REDUCED_MOTION)
    store.state.reducedMotion = true
    syncParallax(el)
    expect(s.armed).toBe(false)

    // Disarmed scroll + resize bursts are cheap no-ops.
    window.dispatchEvent(new Event(WINDOW_EVENTS.SCROLL))
    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))

    // Store clear — the live OS mql decides.
    store.state.reducedMotion = false
    motion.matches = true
    syncParallax(el)
    expect(s.armed).toBe(false)

    motion.matches = false
    syncParallax(el)
    expect(s.armed).toBe(true)

    unmount()
  })

  test('mock view arms — partial resolve, disarm with pending frame, callbacks past detach', () => {
    const frames = stubFrames()

    // No-op cancel — the queued tick stays deliverable after teardown.
    globalThis.cancelAnimationFrame = jest.fn()

    const desk = makeMql(true)
    const ro = stubRO()

    stubMatchMedia({
      [WIDTH_CLASS_GATES.desktop]: desk,
      [MEDIA_QUERIES.PREFERS_REDUCED_MOTION]: makeMql(false),
    })

    const el = makeEl({ top: 0, height: 600 })

    // el selectors resolve; the '#anchor' measure selectors miss, so the
    // wrapped specs bail on !measureEl and only the self-measuring band
    // resolves — the !layer continues hit on every loop.
    const view = makeView((sel) =>
      sel === COMPONENT_TAGS.AWARDS_MENTIONS ? el : sel.indexOf('>') === -1 ? null : el
    )

    attachParallax(view)

    const s = view._parallax

    expect(s.armed).toBe(true)
    expect(s.hero).toBeNull()
    expect(s.awards.el).toBe(el)
    expect(el.vars[PARALLAX_CSS_PROPS.AWARDS_Y]).not.toBeUndefined()

    // Scroll coalescing on the resolved layer.
    view.fire(WINDOW_EVENTS.SCROLL)
    view.fire(WINDOW_EVENTS.SCROLL)
    expect(frames.pending.size).toBe(1)

    const [queued] = [...frames.pending.values()]

    // Gate drops mid-frame — cancel runs (no-op) and the vars clear.
    desk.matches = false
    view.fire(FORM_EVENTS.CHANGE)
    expect(s.armed).toBe(false)
    expect(el.vars[PARALLAX_CSS_PROPS.AWARDS_Y]).toBeUndefined()

    // The stale tick still delivers — session exists but disarmed.
    queued()
    expect(el.vars[PARALLAX_CSS_PROPS.AWARDS_Y]).toBeUndefined()

    // Re-arm — the RO rebinding loop sees live + null slots.
    desk.matches = true
    view.fire(FORM_EVENTS.CHANGE)
    expect(s.armed).toBe(true)
    expect(ro.observed).toContain(el)
    expect(el.vars[PARALLAX_CSS_PROPS.AWARDS_Y]).not.toBeUndefined()

    view.fire(WINDOW_EVENTS.SCROLL)
    const [detachedTick] = [...frames.pending.values()]

    detachParallax(view)
    expect(view._parallax).toBeNull()
    expect(ro.disconnected).toBeGreaterThan(0)

    // Post-detach deliveries — every callback guards on a dead session.
    detachedTick()
    view.fire(WINDOW_EVENTS.SCROLL)
    view.fire(WINDOW_EVENTS.RESIZE)
    view.fire(FORM_EVENTS.CHANGE)
    ro.cbs.forEach((cb) => cb())
    syncParallax(view)
    detachParallax(view)
  })

  test('missing APIs degrade — no els, no RO, no matchMedia, no window', () => {
    stubFrames()
    stubMatchMedia({
      [WIDTH_CLASS_GATES.desktop]: makeMql(true),
      [MEDIA_QUERIES.PREFERS_REDUCED_MOTION]: makeMql(false),
    })

    const savedRO = globalThis.ResizeObserver

    globalThis.ResizeObserver = undefined

    const view = makeView(() => null)

    attachParallax(view)

    const s = view._parallax

    expect(s.ro).toBeNull()
    expect(s.hero).toBeNull()
    expect(s.armed).toBe(true) // gates open even with zero resolved layers

    // Second attach — the existing-session early return.
    attachParallax(view)
    expect(view._parallax).toBe(s)

    detachParallax(view)
    expect(view._parallax).toBeNull()

    globalThis.ResizeObserver = savedRO

    // No matchMedia — listeners still bind; the mql slots stay null and
    // the gate never opens.
    window.matchMedia = undefined

    const view2 = makeView(() => null)

    attachParallax(view2)
    expect(view2._parallax.mql).toBeNull()
    expect(view2._parallax.motionMql).toBeNull()
    expect(view2._parallax.armed).toBe(false)

    view2.fire(WINDOW_EVENTS.SCROLL)
    view2.fire(WINDOW_EVENTS.RESIZE)
    detachParallax(view2)

    // No window at all — the whole listener block skips.
    const savedWin = globalThis.window

    delete globalThis.window

    try {
      const view3 = makeView(() => null)

      attachParallax(view3)
      expect(view3._parallax).not.toBeNull()
      expect(view3._parallax.armed).toBe(false)

      detachParallax(view3)
    } finally {
      globalThis.window = savedWin
    }
  })

  test('motion check falls back to store + OS flag without localStorage', () => {
    stubFrames()
    const desk = makeMql(true)

    // The motion query resolves undefined — the motionMql?.matches arm.
    stubMatchMedia({ [WIDTH_CLASS_GATES.desktop]: desk })
    stubRO()

    const el = makeEl()
    const view = makeView(() => el)

    const savedLS = globalThis.localStorage

    delete globalThis.localStorage

    try {
      attachParallax(view)

      const s = view._parallax

      expect(s.armed).toBe(true)
      expect(el.vars[PARALLAX_CSS_PROPS.AWARDS_Y]).not.toBeUndefined()

      // Store flag closes it through the desk mql listener.
      store.state.reducedMotion = true
      view.fire(FORM_EVENTS.CHANGE)
      expect(s.armed).toBe(false)

      store.state.reducedMotion = false
      view.fire(FORM_EVENTS.CHANGE)
      expect(s.armed).toBe(true)

      detachParallax(view)
    } finally {
      globalThis.localStorage = savedLS
    }
  })

  test('deadband, ±1 clamps and empty range hold', () => {
    const frames = stubFrames()
    const desk = makeMql(true)
    const ro = stubRO()

    stubMatchMedia({
      [WIDTH_CLASS_GATES.desktop]: desk,
      [MEDIA_QUERIES.PREFERS_REDUCED_MOTION]: makeMql(false),
    })

    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    resetViewportCache()
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true, writable: true })

    // el === measureEl everywhere — every spec self-measures the same
    // shared node (the awards path, quadrupled).
    const el = makeEl({ top: 0, height: 600 })
    const view = makeView(() => el)

    attachParallax(view)

    // docTop = rect.top + scrollY = 0 + 100 → layer centre 400 vs
    // viewport centre 500 over range 700 → p = −100/700. Asserted on the
    // about-main var; each layer writes its own prop, so the shared
    // element also holds the awards layer's AWARDS_Y write.
    const p0 = (100 + 600 * 0.5 - 100 - 800 * 0.5) / ((800 + 600) * 0.5)

    expect(el.vars[PARALLAX_CSS_PROPS.ABOUT_MAIN_Y]).toBe(expectVar(PARALLAX.ABOUT_MAIN_Y, p0))
    expect(el.vars[PARALLAX_CSS_PROPS.AWARDS_Y]).toBe(expectVar(PARALLAX.AWARDS_Y, p0))

    // Both clamps.
    Object.defineProperty(window, 'scrollY', { value: -1e6, configurable: true, writable: true })
    view.fire(WINDOW_EVENTS.SCROLL)
    frames.run()
    expect(el.vars[PARALLAX_CSS_PROPS.ABOUT_MAIN_Y]).toBe(expectVar(PARALLAX.ABOUT_MAIN_Y, 1))

    Object.defineProperty(window, 'scrollY', { value: 1e6, configurable: true, writable: true })
    view.fire(WINDOW_EVENTS.SCROLL)
    frames.run()
    expect(el.vars[PARALLAX_CSS_PROPS.ABOUT_MAIN_Y]).toBe(expectVar(PARALLAX.ABOUT_MAIN_Y, -1))

    // RO remeasure — re-caches geometry and repaints through the
    // coalesced frame.
    ro.cbs.forEach((cb) => cb())
    frames.run()

    // Deadband — an identical scrollY repaints nothing.
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    view.fire(WINDOW_EVENTS.SCROLL)
    frames.run()

    const settled = el.vars[PARALLAX_CSS_PROPS.ABOUT_MAIN_Y]

    view.fire(WINDOW_EVENTS.SCROLL)
    frames.run()
    expect(el.vars[PARALLAX_CSS_PROPS.ABOUT_MAIN_Y]).toBe(settled)

    // Empty transit range — zero viewport + zero height pins p to 0.
    Object.defineProperty(window, 'innerHeight', { value: 0, configurable: true })
    resetViewportCache()
    el.rect = { top: 0, height: 0 }

    ro.cbs.forEach((cb) => cb())
    frames.run()
    expect(el.vars[PARALLAX_CSS_PROPS.ABOUT_MAIN_Y]).toBe(`0${COMMON_ATTRS.PX}`)

    detachParallax(view)
  })
})
