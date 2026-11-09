/**
 * @file anim-demo-defined-tails.test.js
 * @description Coverage tail for components/media/AnimDemo.tsx — the
 * `customElements.get` registration guard's defined arm: the module body
 * must evaluate while the tag already resolves, so the element is
 * predefined here before the module is dynamically imported.
 */

import { describe, test, expect } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

describe('anim-demo registration guard', () => {
  test('an already-defined tag skips re-registration', async () => {
    if (!customElements.get(COMPONENT_TAGS.ANIM_DEMO)) {
      customElements.define(COMPONENT_TAGS.ANIM_DEMO, class extends HTMLElement {})
    }

    const mod = await import('@website/components/media/AnimDemo.js')

    expect(mod.AnimDemo).toBeDefined()
    expect(customElements.get(COMPONENT_TAGS.ANIM_DEMO)).not.toBe(mod.AnimDemo)
  })
})
