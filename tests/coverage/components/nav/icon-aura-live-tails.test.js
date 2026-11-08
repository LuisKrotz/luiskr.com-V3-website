/**
 * @file icon-aura-live-tails.test.js
 * @description Coverage tails for components/nav/icon-aura.ts — the
 * live-session arms that only wire when mountRingFill succeeds: per-tile
 * pointerenter/leave progress calls and the transitionend refresh.
 * The ring mount is stubbed because happy-dom can't mount WebGPU.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'

/** Fake aura session — jest fns record the lifecycle calls under test. */
const session = {
  setProgress: jest.fn(),
  refresh: jest.fn(),
  destroy: jest.fn(),
}

jest.unstable_mockModule('@core/utils/gpu/ring-fill.js', () => ({
  mountRingFill: () => session,
}))

const { mountNavIconAura, destroyNavIconAura } =
  await import('@website/components/nav/icon-aura.js')

/** Host with a strip containing the search + gear chip buttons. */
const auraHost = () => {
  const host = document.createElement('div')

  host.attachShadow({ mode: 'open' })
  host._navIconAura = null

  const strip = document.createElement('div')

  strip.className = NAV_CLASSES.NAV_MOBILE_STRIP

  const search = document.createElement('button')
  const gear = document.createElement('button')

  search.className = NAV_CLASSES.NAV_SEARCH_BTN
  gear.className = NAV_CLASSES.NAV_GEAR_BTN
  strip.appendChild(search)
  strip.appendChild(gear)
  host.shadowRoot.appendChild(strip)

  return { host, strip }
}

describe('nav icon aura live arms', () => {
  test('tiles drive setProgress on hover and refresh on transitionend', () => {
    const { host, strip } = auraHost()

    const mounted = mountNavIconAura(host)

    expect(mounted).toBe(session)
    expect(host._navIconAura).toBe(session)

    const [search, gear] = strip.children

    search.dispatchEvent(new Event('pointerenter'))
    gear.dispatchEvent(new Event('pointerleave'))
    gear.dispatchEvent(new Event('transitionend'))

    expect(session.setProgress).toHaveBeenCalledWith(0, 1)
    expect(session.setProgress).toHaveBeenCalledWith(1, 0)
    expect(session.refresh).toHaveBeenCalled()

    destroyNavIconAura(host)
    expect(session.destroy).toHaveBeenCalled()
    expect(host._navIconAura).toBeNull()
  })
})
