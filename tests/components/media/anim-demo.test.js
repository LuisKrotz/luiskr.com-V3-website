/**
 * @file anim-demo.test.js
 * @description Covers website/components/media/AnimDemo.js + its
 * anim-demo/* driver modules — the /animations live-preview stage:
 * per-id stage DOM, driver mounting + auto-cycle state flips, attr-swap
 * remount, teardown on disconnect, and the cycle clock's reduced-motion
 * contract. Widget/GPU mounts degrade in happy-dom the same way they do
 * without a GL context — the assertions key on the staged DOM + class
 * choreography, not the paint.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { AnimDemo } from '@website/components/media/AnimDemo.js'
import '@website/components/media/DrawText.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { SCSS, mount } from '@tests/fixtures/test-constants.js'
import * as ANIM_DEMO_MOUNTS from '@website/components/media/anim-demo/mounts.js'
import store from '@core/store.js'

/** Class-name alias — the demo-surface selectors below stay readable. */
const C = ANIM_DEMO_CLASSES

/**
 * A no-throw 2D-context stub — happy-dom canvases have no real 2D backend;
 * this stub stands in so the 2D approximation drivers exercise their draw
 * paths exactly as they would on a real canvas.
 */
const _fake2d = () =>
  new Proxy(
    { globalAlpha: 1, globalCompositeOperation: '', fillStyle: '' },
    {
      get: (t, k) => (k in t ? t[k] : () => undefined),
      set: (t, k, v) => {
        t[k] = v
        return true
      },
    }
  )

// ─────────────────────────────────────────────────────────────────────────────
// AnimDemo
// ─────────────────────────────────────────────────────────────────────────────
describe('AnimDemo', () => {
  let el

  const mountDemo = (id) => {
    const demo = new AnimDemo()
    demo.setAttribute(COMMON_ATTRS.ANIMATION, id)
    const unmount = mount(demo)
    return { demo, unmount }
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    if (el && el.parentNode) el.parentNode.removeChild(el)
    jest.useRealTimers()
  })

  test('registers the <anim-demo> custom element tag', () => {
    expect(customElements.get(COMPONENT_TAGS.ANIM_DEMO)).toBe(AnimDemo)
  })

  test('creates shadow root and stage on construction', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo

    expect(demo.shadowRoot).not.toBeNull()
    expect(demo.shadowRoot.querySelector(`.${C.ANIM_DEMO}`)).not.toBeNull()
    unmount()
  })

  test('observes the animation attribute', () => {
    expect(AnimDemo.observedAttributes).toContain(COMMON_ATTRS.ANIMATION)
  })

  // ── Stage DOM per id ────────────────────────────────────────────────────

  test.each([
    [ANIMATION_IDS.BURGER_BUTTON, `${HTML_TAGS.CANVAS}.${C.ICON}`],
    [ANIMATION_IDS.CLOSE_BUTTON, `${HTML_TAGS.CANVAS}.${C.ICON}`],
    [ANIMATION_IDS.NAV_MENU_BACKGROUND, `${HTML_TAGS.CANVAS}.${C.CANVAS}`],
    [ANIMATION_IDS.SCENE_3D, `${HTML_TAGS.CANVAS}.${C.CANVAS}`],
    [ANIMATION_IDS.GLITCH_PORTRAIT, COMPONENT_TAGS.ABOUT_SECTION],
    [ANIMATION_IDS.NAV_FLAG, `${HTML_TAGS.CANVAS}.${C.FLAG}`],
    [ANIMATION_IDS.SWITCH_SLIDER, `${HTML_TAGS.CANVAS}.${C.SWITCH}`],
    [ANIMATION_IDS.THEME_SLIDER, `${HTML_TAGS.CANVAS}.${C.THEME}`],
    [ANIMATION_IDS.NAV_MENU, `.${C.MENU}`],
    [ANIMATION_IDS.INTRO_LOADER, `.${C.LOADER}`],
    [ANIMATION_IDS.SITE_TOAST, `.${C.TOAST_ITEM}`],
    [ANIMATION_IDS.SKELETON, `.${C.SKEL}`],
    [ANIMATION_IDS.MOSAIC_BURN, `.${C.CARD}`],
    [ANIMATION_IDS.DIVIDER_SHEEN, `.${C.DIVIDER}`],
    [ANIMATION_IDS.RING_SHEEN, `.${C.TILES}`],
    [ANIMATION_IDS.RELATED_TILE, `.${C.TILES}`],
    [ANIMATION_IDS.CORNER_BRACKETS, `.${C.BUTTON}`],
    [ANIMATION_IDS.GENIE_MODAL, `.${C.DIALOG}`],
    [ANIMATION_IDS.CAROUSEL, COMPONENT_TAGS.AWARDS_CAROUSEL],
    [ANIMATION_IDS.BODY_GLOW, `.${C.GLOW}`],
    [ANIMATION_IDS.PROGRESS_BAR, `.${C.BAR}`],
    [ANIMATION_IDS.TEXT_DRAW, `.${C.DRAW}`],
    [ANIMATION_IDS.ABOUT_TEXT, `.${C.DRAW}`],
    [ANIMATION_IDS.MEDIA_PROGRESSIVE, `.${C.FIGURE}`],
    [ANIMATION_IDS.CARD_STACK, COMPONENT_TAGS.CARD_STACK],
    [ANIMATION_IDS.ABOUT_MESH, COMPONENT_TAGS.ABOUT_SECTION],
    [ANIMATION_IDS.NAV_ICON_AURA, `.${C.CHIP}`],
    [ANIMATION_IDS.VIEW_TRANSITION, `.${C.PANE}`],
    [ANIMATION_IDS.ROUTE_SEARCH, `.${C.SEARCH}`],
    [ANIMATION_IDS.CUSTOM_CAROUSEL, COMPONENT_TAGS.CUSTOM_CAROUSEL],
    [ANIMATION_IDS.MENTIONS_DECK, COMPONENT_TAGS.MENTIONS_DECK],
    [ANIMATION_IDS.EXPAND_MODAL_LOADING, `.${C.MODAL}`],
    [ANIMATION_IDS.FOOTER_FEED_WAVE, `.${C.FEED}`],
  ])('stages the right DOM for %s', (id, selector) => {
    const { demo, unmount } = mountDemo(id)
    el = demo

    expect(demo.shadowRoot.querySelector(selector)).not.toBeNull()
    unmount()
  })

  test('renders an inert stage for an unknown id', () => {
    const demo = new AnimDemo()
    demo.setAttribute(COMMON_ATTRS.ANIMATION, 'lk-not-a-real-id')
    const unmount = mount(demo)
    el = demo

    expect(demo.shadowRoot.querySelector(`.${C.ANIM_DEMO}`)).not.toBeNull()
    expect(demo._teardown).toBeNull()
    unmount()
  })

  // ── Auto-cycle choreography ─────────────────────────────────────────────

  test('menu demo toggles the open modifier on each beat', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo
    const menu = demo.shadowRoot.querySelector(`.${C.MENU}`)

    jest.advanceTimersByTime(3400)
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(true)

    jest.advanceTimersByTime(3400)
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(false)
    unmount()
  })

  test('toast demo alternates the in/out modifiers', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.SITE_TOAST)
    el = demo
    const item = demo.shadowRoot.querySelector(`.${C.TOAST_ITEM}`)

    jest.advanceTimersByTime(3400)
    expect(item.classList.contains(C.TOAST_IN)).toBe(true)

    jest.advanceTimersByTime(3400)
    expect(item.classList.contains(C.TOAST_OUT)).toBe(true)
    unmount()
  })

  test('progress bar walks active → done → reset', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.PROGRESS_BAR)
    el = demo
    const bar = demo.shadowRoot.querySelector(`.${C.BAR}`)

    jest.advanceTimersByTime(1700)
    expect(bar.classList.contains(C.BAR_ACTIVE)).toBe(true)

    jest.advanceTimersByTime(1700)
    expect(bar.classList.contains(C.BAR_DONE)).toBe(true)
    expect(bar.classList.contains(C.BAR_ACTIVE)).toBe(false)

    jest.advanceTimersByTime(1700)
    expect(bar.classList.contains(C.BAR_DONE)).toBe(false)
    unmount()
  })

  test('related-tile demo staggers the hover modifier tile-by-tile', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.RELATED_TILE)
    el = demo
    const tiles = demo.shadowRoot.querySelectorAll(`.${C.TILE}`)

    jest.advanceTimersByTime(1600)
    expect(tiles[0].classList.contains(C.TILE_HOVER)).toBe(true)
    expect(tiles[1].classList.contains(C.TILE_HOVER)).toBe(false)

    jest.advanceTimersByTime(1600)
    expect(tiles[1].classList.contains(C.TILE_HOVER)).toBe(true)
    unmount()
  })

  test('loader demo counts the percent readout', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.INTRO_LOADER)
    el = demo
    const counter = demo.shadowRoot.querySelector(`.${C.LOADER_COUNTER}`)

    // Flush the deferred IO mount (the shared mock's setTimeout), then
    // advance the beat the counter increments on.
    jest.advanceTimersByTime(10)
    jest.advanceTimersByTime(800)
    expect(counter.textContent).not.toBe('0%')
    unmount()
  })

  // ── Later-added surfaces ────────────────────────────────────────────────

  test('card-stack demo mounts the real deck element and feeds it data', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.CARD_STACK)
    el = demo

    jest.advanceTimersByTime(10)
    const deck = demo.shadowRoot.querySelector(COMPONENT_TAGS.CARD_STACK)

    expect(deck).not.toBeNull()
    expect(demo._mounted).toBe(true)

    unmount()
  })

  test('icon-aura demo arms each chip in turn then rests', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_ICON_AURA)
    el = demo

    jest.advanceTimersByTime(10)
    const chips = demo.shadowRoot.querySelectorAll(`.${C.CHIP}`)

    // Immediate arm — chip 0 sweeps first.
    expect(chips[0].classList.contains(C.CHIP_ARMED)).toBe(true)

    jest.advanceTimersByTime(1600)
    expect(chips[1].classList.contains(C.CHIP_ARMED)).toBe(true)
    expect(chips[0].classList.contains(C.CHIP_ARMED)).toBe(false)

    jest.advanceTimersByTime(1600)
    expect(chips[1].classList.contains(C.CHIP_ARMED)).toBe(false)

    unmount()
    expect(chips[0].classList.contains(C.CHIP_ARMED)).toBe(false)
  })

  test('view-transition demo cross-fades the two panes', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.VIEW_TRANSITION)
    el = demo

    jest.advanceTimersByTime(10)
    const panes = demo.shadowRoot.querySelectorAll(`.${C.PANE}`)

    // The immediate swap hid pane 0 (it starts visible).
    expect(panes[0].classList.contains(C.PANE_GONE)).toBe(true)
    expect(panes[1].classList.contains(C.PANE_GONE)).toBe(false)

    jest.advanceTimersByTime(3400)
    expect(panes[0].classList.contains(C.PANE_GONE)).toBe(false)
    expect(panes[1].classList.contains(C.PANE_GONE)).toBe(true)

    unmount()
    expect(panes[0].classList.contains(C.PANE_GONE)).toBe(false)
    expect(panes[1].classList.contains(C.PANE_GONE)).toBe(true)
  })

  test('route-search demo toggles the loading modifier', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.ROUTE_SEARCH)
    el = demo
    const field = demo.shadowRoot.querySelector(`.${C.SEARCH}`)

    jest.advanceTimersByTime(10)
    expect(field.classList.contains(C.SEARCH_LOADING)).toBe(true)

    jest.advanceTimersByTime(1600)
    expect(field.classList.contains(C.SEARCH_LOADING)).toBe(false)

    unmount()
  })

  test('mentions-deck demo mounts the real fan element and feeds it data', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.MENTIONS_DECK)
    el = demo

    jest.advanceTimersByTime(10)
    const deck = demo.shadowRoot.querySelector(COMPONENT_TAGS.MENTIONS_DECK)

    expect(deck).not.toBeNull()
    expect(demo._mounted).toBe(true)

    unmount()
  })

  test('expand-modal-loading demo toggles the ready modifier', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.EXPAND_MODAL_LOADING)
    el = demo
    const modal = demo.shadowRoot.querySelector(`.${C.MODAL}`)

    jest.advanceTimersByTime(10)
    expect(modal.classList.contains(C.MODAL_READY)).toBe(true)

    jest.advanceTimersByTime(3400)
    expect(modal.classList.contains(C.MODAL_READY)).toBe(false)

    unmount()
  })

  test('footer-feed-wave demo mounts the real feed link + glyph', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.FOOTER_FEED_WAVE)
    el = demo

    jest.advanceTimersByTime(10)
    expect(demo._mounted).toBe(true)

    const link = demo.shadowRoot.querySelector(`.${C.FEED}`)
    const icon = link?.querySelector(`.${AWARDS_CLASSES.AWARDS_FOOTER_FEED_ICON}`)

    expect(icon).not.toBeNull()
    expect(link.querySelectorAll(`.${AWARDS_CLASSES.AWARDS_FOOTER_FEED_WAVE}`)).toHaveLength(2)
    expect(link.getAttribute('href')).toBeTruthy()

    unmount()
  })

  test('about-mesh demo mounts the real about-section element', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.ABOUT_MESH)
    el = demo

    jest.advanceTimersByTime(10)
    expect(demo.shadowRoot.querySelector(COMPONENT_TAGS.ABOUT_SECTION)).not.toBeNull()
    expect(demo._mounted).toBe(true)

    unmount()
  })

  test('glitch demo mounts the real about-section element', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.GLITCH_PORTRAIT)
    el = demo

    jest.advanceTimersByTime(10)
    expect(demo.shadowRoot.querySelector(COMPONENT_TAGS.ABOUT_SECTION)).not.toBeNull()
    expect(demo._mounted).toBe(true)

    unmount()
  })

  // ── Lifecycle ───────────────────────────────────────────────────────────

  test('attribute swap re-renders the stage and remounts the driver', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo

    demo.setAttribute(COMMON_ATTRS.ANIMATION, ANIMATION_IDS.PROGRESS_BAR)
    expect(demo.shadowRoot.querySelector(`.${C.BAR}`)).not.toBeNull()
    expect(demo.shadowRoot.querySelector(`.${C.MENU}`)).toBeNull()

    // Flush the re-mounted observer (the shared mock's setTimeout) — the
    // progress driver lands BAR_ACTIVE immediately on mount.
    jest.advanceTimersByTime(10)
    const bar = demo.shadowRoot.querySelector(`.${C.BAR}`)
    expect(bar.classList.contains(C.BAR_ACTIVE)).toBe(true)
    unmount()
  })

  test('disconnect runs the driver teardown and resets the state', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo
    const menu = demo.shadowRoot.querySelector(`.${C.MENU}`)

    jest.advanceTimersByTime(3400)
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(true)

    unmount()
    expect(demo._teardown).toBeNull()
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(false)
  })

  test('leaving the viewport tears the driver down but keeps the observer', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo
    const menu = demo.shadowRoot.querySelector(`.${C.MENU}`)

    jest.advanceTimersByTime(3400)
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(true)

    // A non-intersecting entry runs only the driver teardown — the same
    // observer stays connected so re-entry remounts.
    demo._io.callback([{ isIntersecting: false, intersectionRatio: 0, target: demo }], demo._io)
    expect(demo._teardown).toBeNull()
    expect(demo._mounted).toBe(false)
    expect(demo._io).not.toBeNull()
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(false)

    unmount()
  })

  test('a repeated intersecting entry does not remount a live driver', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo

    jest.advanceTimersByTime(10)
    const teardown = demo._teardown

    demo._io.callback([{ isIntersecting: true, intersectionRatio: 1, target: demo }], demo._io)
    expect(demo._teardown).toBe(teardown)

    unmount()
  })

  test('leaving the viewport is a no-op teardown for drivers without one', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.SKELETON)
    el = demo

    jest.advanceTimersByTime(10)
    expect(demo._mounted).toBe(true)
    expect(demo._teardown).toBeNull()

    demo._io.callback([{ isIntersecting: false, intersectionRatio: 0, target: demo }], demo._io)
    expect(demo._mounted).toBe(false)

    unmount()
  })

  test('mounts eagerly when IntersectionObserver is unavailable', () => {
    const io = globalThis.IntersectionObserver
    globalThis.IntersectionObserver = undefined
    window.IntersectionObserver = undefined

    try {
      const { demo, unmount } = mountDemo(ANIMATION_IDS.PROGRESS_BAR)
      el = demo

      // No deferred observe — the driver lands immediately on mount.
      expect(demo._mounted).toBe(true)
      const bar = demo.shadowRoot.querySelector(`.${C.BAR}`)
      expect(bar.classList.contains(C.BAR_ACTIVE)).toBe(true)

      unmount()
    } finally {
      globalThis.IntersectionObserver = io
      window.IntersectionObserver = io
    }
  })

  // ── Reduced motion ──────────────────────────────────────────────────────

  test('the cycle clock skips scheduling under reduced motion', () => {
    const getter = jest.spyOn(store.getters, 'getReducedMotion').mockReturnValue(true)

    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo
    const menu = demo.shadowRoot.querySelector(`.${C.MENU}`)

    jest.advanceTimersByTime(10000)
    expect(menu.classList.contains(C.MENU_OPEN)).toBe(false)

    unmount()
    getter.mockRestore()
  })

  // ── Guard arms — previously istanbul-ignored ────────────────────────────

  test('_mountDemo early-returns on an unregistered id and a missing stage', () => {
    const { demo, unmount } = mountDemo('no-such-animation')
    el = demo

    jest.advanceTimersByTime(10)
    expect(demo._mounted).toBeFalsy()

    // Stage removed between renders — the guard reads null and bails.
    demo.shadowRoot.querySelector(`.${C.ANIM_DEMO}`)?.remove()
    demo._mountDemo()
    expect(demo._mounted).toBeFalsy()

    unmount()
  })

  test('_runMount re-checks the registry — a swapped id without a driver no-ops', () => {
    const { demo, unmount } = mountDemo(ANIMATION_IDS.NAV_MENU)
    el = demo

    const stage = demo.shadowRoot.querySelector(`.${C.ANIM_DEMO}`)

    demo._runMount('no-such-animation', stage)
    expect(demo._mounted).toBeFalsy()

    unmount()
  })

  test('ring-sheen teardown is a no-op when the stage has no tiles row', () => {
    // mountRingSheen short-circuits on a missing container — the demo's
    // teardown must skip destroy() instead of throwing.
    const { mountRingSheenDemo } = ANIM_DEMO_MOUNTS
    const stage = document.createElement(HTML_TAGS.DIV)
    const teardown = mountRingSheenDemo({ stage })

    expect(() => teardown()).not.toThrow()
  })

  test('ring-sheen teardown destroys the session when WebGPU is present', () => {
    // 'gpu' in navigator is the whole capability probe — stubbing it
    // flips mountRingSheen into the session path.
    const hadGpu = 'gpu' in navigator

    if (!hadGpu) {
      Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true })
    }

    try {
      const { mountRingSheenDemo } = ANIM_DEMO_MOUNTS
      const stage = document.createElement(HTML_TAGS.DIV)
      const tiles = document.createElement(HTML_TAGS.DIV)

      tiles.className = C.TILES
      stage.appendChild(tiles)

      const teardown = mountRingSheenDemo({ stage })

      expect(() => teardown()).not.toThrow()
    } finally {
      if (!hadGpu) delete navigator.gpu
    }
  })

  test('scene demo survives a failed getContext probe', () => {
    const getContext = window.HTMLCanvasElement.prototype.getContext
    let calls = 0

    window.HTMLCanvasElement.prototype.getContext = () => (++calls === 1 ? _fake2d() : null)

    try {
      const { demo, unmount } = mountDemo(ANIMATION_IDS.SCENE_3D)
      el = demo

      jest.advanceTimersByTime(10)
      expect(demo._mounted).toBe(true)

      jest.advanceTimersByTime(100)
      unmount()
    } finally {
      window.HTMLCanvasElement.prototype.getContext = getContext
    }
  })

  // ── Sheet contract ──────────────────────────────────────────────────────

  test('anim-demo.scss declares the stage + every staged surface', () => {
    expect(SCSS.animDemo).toMatch(/\$_B: 'anim-demo'/)
    expect(SCSS.animDemo).toMatch(/-menu-item/)
    expect(SCSS.animDemo).toMatch(/-loader-ring/)
    expect(SCSS.animDemo).toMatch(/-toast-item/)
    expect(SCSS.animDemo).toMatch(/-dialog/)
    expect(SCSS.animDemo).toMatch(/prefers-reduced-motion/)
  })
})
