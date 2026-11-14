/**
 * @file cookie-banner-define-guard-tails.test.js
 * @description Coverage tail for feedback/CookieBanner.tsx — the
 * customElements.define guard's already-registered arm: when the tag
 * is defined before the module evaluates (a barrel or an earlier boot
 * chunk owns it), the guard skips re-definition instead of throwing a
 * duplicate-name DOMException.
 */
import { describe, test, expect } from '@jest/globals'

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

describe('cookie-banner define guard', () => {
  test('an already-registered tag skips the module-level define', async () => {
    // Register a stub under the real tag BEFORE the module evaluates —
    // the `if (!customElements.get(...))` guard takes its occupied arm.
    class StubBanner extends HTMLElement {}

    customElements.define(COMPONENT_TAGS.COOKIE_BANNER, StubBanner)

    const mod = await import('@website/components/feedback/CookieBanner.js')

    // Module evaluated fine and kept the pre-registered implementation.
    expect(mod).toBeTruthy()
    expect(customElements.get(COMPONENT_TAGS.COOKIE_BANNER)).toBe(StubBanner)

    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    expect(el).toBeInstanceOf(StubBanner)
    expect(el.tagName).toBe(COMPONENT_TAGS.COOKIE_BANNER.toUpperCase())
  })
})
