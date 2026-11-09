/**
 * @file legal-view-defined-tails.test.js
 * @description Coverage tail for views/legal/Legal.tsx — the
 * `customElements.get` registration guard's defined arm: the module body
 * must evaluate while the tag already resolves, so the element is
 * predefined here before the module is dynamically imported.
 */

import { describe, test, expect } from '@jest/globals'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'

describe('legal view registration guard', () => {
  test('an already-defined tag skips re-registration', async () => {
    if (!customElements.get(VIEW_TAGS.VIEW_LEGAL)) {
      customElements.define(VIEW_TAGS.VIEW_LEGAL, class extends HTMLElement {})
    }

    const mod = await import('@website/views/legal/Legal.js')

    expect(mod.ViewLegal).toBeDefined()
    expect(customElements.get(VIEW_TAGS.VIEW_LEGAL)).not.toBe(mod.ViewLegal)
  })
})
