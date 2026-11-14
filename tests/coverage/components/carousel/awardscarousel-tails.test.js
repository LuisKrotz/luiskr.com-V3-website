/**
 * @file awardscarousel-tails.test.js
 * @description Split from coverage-tails-3.test.js — covers the "AwardsCarousel tails" describe.
 */
import _router from '@core/router/router.js'
import { TEST_PROJECTS } from '@tests/fixtures/test-constants.js'

import '@website/components/feedback/StatsHud.js'
import '@website/components/home/AwardsMentions.js'
import '@website/components/legal/Footer.js'

import '@website/components/home/HomeMosaic.js'
import '@website/components/dialogs/LangDialog.js'
import '@website/components/dialogs/PreferencesModal.js'
import '@website/components/carousel/AwardsCarousel.js'
import '@website/views/home/Home.js'
import '@website/views/legal/Legal.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { goTo } from '@website/components/carousel/awards-carousel/nav.js'
import { AWC_CLASSES } from '@core/tokens/classes/awards-carousel.js'
import { CAROUSEL_TIMING } from '@core/tokens/motion/carousel.js'
import { jest } from '@jest/globals'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

/** Minimal goTo host — track + slide mocks satisfy the centering math. */
const goToHost = ({ clones = true } = {}) => {
  const slide = () => ({ getBoundingClientRect: () => ({ left: 100, width: 200 }) })
  const track = {
    children: [slide(), slide(), slide(), slide()],
    scrollLeft: 0,
    scrollTo: jest.fn(),
    classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ left: 0, width: 600 }),
  }
  const cloneFirst = clones ? { getBoundingClientRect: () => ({ left: -200, width: 200 }) } : null
  const cloneLast = clones ? { getBoundingClientRect: () => ({ left: 800, width: 200 }) } : null

  return {
    items: [{}, {}, {}],
    currentIndex: 0,
    isNavigating: false,
    pendingTeleport: null,
    teleportTimer: null,
    _jumpToSlide: jest.fn(),
    dispatchEvent: jest.fn(),
    $$: () => [],
    $: (sel) =>
      sel.includes(AWC_CLASSES.AWC_SLIDE_CLONE_FIRST)
        ? cloneFirst
        : sel.includes(AWC_CLASSES.AWC_SLIDE_CLONE_LAST)
          ? cloneLast
          : sel.includes(AWC_CLASSES.AWC_TRACK)
            ? track
            : null,
  }
}

describe('AwardsCarousel tails', () => {
  test('renders empty state and item list variants', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_CAROUSEL)

    document.body.appendChild(el)
    await flush()

    el.items = []
    el.items = [{ slug: TEST_PROJECTS.CICB }]
    el.translations = null

    await flush()
    el.remove()
  })

  test('goTo in-range arms the settle timer; out-of-range arms clone teleports', async () => {
    // In-range idx → direct scrollToSlide + NAVIGATION_SETTLE_DELAY latch.
    const host = goToHost()

    goTo(host, 1)

    expect(host.currentIndex).toBe(1)
    expect(host.isNavigating).toBe(true)
    expect(host.pendingTeleport).toBe(null)
    expect(host.teleportTimer).not.toBe(null)
    expect(host.dispatchEvent).toHaveBeenCalled()

    clearTimeout(host.teleportTimer)

    // idx ≥ len → cloneFirst scroll + teleport(0) watchdog.
    const wrapFwd = goToHost()

    goTo(wrapFwd, 3)

    expect(wrapFwd.currentIndex).toBe(0)
    expect(wrapFwd.pendingTeleport).toBe(0)
    expect(wrapFwd.teleportTimer).not.toBe(null)

    clearTimeout(wrapFwd.teleportTimer)

    // idx < 0 → cloneLast scroll + teleport(len−1) watchdog.
    const wrapBack = goToHost()

    goTo(wrapBack, -1)

    expect(wrapBack.currentIndex).toBe(2)
    expect(wrapBack.pendingTeleport).toBe(2)
    expect(wrapBack.teleportTimer).not.toBe(null)

    clearTimeout(wrapBack.teleportTimer)

    // An armed pendingTeleport is landed before the new nav proceeds.
    const pending = goToHost()

    pending.pendingTeleport = 2
    pending.teleportTimer = setTimeout(() => {}, CAROUSEL_TIMING.TELEPORT_DELAY)

    goTo(pending, 1)

    expect(pending._jumpToSlide).toHaveBeenCalledWith(2, false)
    expect(pending.pendingTeleport).toBe(null)

    clearTimeout(pending.teleportTimer)

    // pendingTeleport armed but its timer already drained → the guard's
    // falsy arm skips clearTimeout and still lands the twin jump.
    const drained = goToHost()

    drained.pendingTeleport = 0
    drained.teleportTimer = null

    goTo(drained, 1)

    expect(drained._jumpToSlide).toHaveBeenCalledWith(0, false)
    expect(drained.pendingTeleport).toBe(null)

    clearTimeout(drained.teleportTimer)
  })
})
