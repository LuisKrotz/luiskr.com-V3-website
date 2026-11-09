/**
 * @file statshud-defined-tails.test.js
 * @description Coverage tail for components/feedback/StatsHud.tsx — the
 * `customElements.get` registration guard's defined arm: the module body
 * must evaluate while the tag already resolves, so the element is
 * predefined here before the module is dynamically imported.
 */

import { describe, test, expect } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

describe('stats-hud registration guard', () => {
  test('an already-defined tag skips re-registration', async () => {
    const stub = class extends HTMLElement {}

    if (!customElements.get(COMPONENT_TAGS.STATS_HUD)) {
      customElements.define(COMPONENT_TAGS.STATS_HUD, stub)
    }

    const mod = await import('@website/components/feedback/StatsHud.js')

    expect(mod).toBeDefined()
    expect(customElements.get(COMPONENT_TAGS.STATS_HUD)).toBe(stub)
  })
})
