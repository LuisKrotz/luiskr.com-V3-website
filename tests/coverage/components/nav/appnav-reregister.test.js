/**
 * @file appnav-reregister.test.js
 * @description Covers the custom-elements registration guard's else arm —
 * <app-nav> is already defined by the import chain above, so a module
 * re-evaluation (post jest.resetModules) must not throw or re-register.
 * The merge keeps this file's else-arm hit alongside the if-arm hits
 * recorded by every other suite.
 */

import { describe, test, expect, jest } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import '@website/components/nav/AppNav.js'

describe('app-nav registration guard', () => {
  test('re-importing after reset skips the already-registered define', async () => {
    expect(customElements.get(COMPONENT_TAGS.APP_NAV)).toBeTruthy()

    jest.resetModules()

    await import('@website/components/nav/AppNav.js')

    expect(customElements.get(COMPONENT_TAGS.APP_NAV)).toBeTruthy()
  })
})
