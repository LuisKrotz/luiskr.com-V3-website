/**
 * @file animations-tails-3.test.js
 * @description Coverage tail for the <view-animations> define guard — the
 * tag is pre-registered with a stub so the module's
 * `if (!customElements.get(...))` else arm runs (the real registration is
 * exercised by every other suite that imports the module first).
 */
import { describe, test, expect } from '@jest/globals'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'

// Pre-register the tag — the module import below must skip its define().
if (!customElements.get(VIEW_TAGS.VIEW_ANIMATIONS)) {
  customElements.define(VIEW_TAGS.VIEW_ANIMATIONS, class extends HTMLElement {})
}

describe('Animations tails 3', () => {
  test('module import skips define when the tag is already registered', async () => {
    const tag = customElements.get(VIEW_TAGS.VIEW_ANIMATIONS)

    await import('@website/views/animations/Animations.js')

    expect(customElements.get(VIEW_TAGS.VIEW_ANIMATIONS)).toBe(tag)
  })
})
