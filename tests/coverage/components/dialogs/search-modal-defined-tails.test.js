/**
 * @file search-modal-defined-tails.test.js
 * @description Coverage tail for components/dialogs/SearchModal.tsx — the
 * `customElements.get` registration guard's defined arm: the module body
 * must evaluate while the tag already resolves, so the element is
 * predefined here before the module is dynamically imported.
 */

import { describe, test, expect } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

describe('search-modal registration guard', () => {
  test('an already-defined tag skips re-registration', async () => {
    if (!customElements.get(COMPONENT_TAGS.SEARCH_MODAL)) {
      customElements.define(COMPONENT_TAGS.SEARCH_MODAL, class extends HTMLElement {})
    }

    const mod = await import('@website/components/dialogs/SearchModal.js')

    expect(mod.SearchModal).toBeDefined()
    expect(customElements.get(COMPONENT_TAGS.SEARCH_MODAL)).not.toBe(mod.SearchModal)
  })
})
