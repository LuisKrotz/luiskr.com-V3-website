/**
 * @file route-search-defined-tails.test.js
 * @description Coverage tail for components/search/RouteSearch.tsx — the
 * `customElements.get` registration guard's defined arm: the module body
 * must evaluate while the tag already resolves, so the element is
 * predefined here before the module is dynamically imported.
 */

import { describe, test, expect } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

describe('route-search registration guard', () => {
  test('an already-defined tag skips re-registration', async () => {
    if (!customElements.get(COMPONENT_TAGS.ROUTE_SEARCH)) {
      customElements.define(COMPONENT_TAGS.ROUTE_SEARCH, class extends HTMLElement {})
    }

    const mod = await import('@website/components/search/RouteSearch.js')

    expect(mod.RouteSearch).toBeDefined()
    expect(customElements.get(COMPONENT_TAGS.ROUTE_SEARCH)).not.toBe(mod.RouteSearch)
  })
})
