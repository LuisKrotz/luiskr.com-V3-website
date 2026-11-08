/**
 * @file contactsection-reregister.test.js
 * @description Covers the custom-elements registration guard's else arm —
 * <contact-section> is already defined by the import chain above, so a module
 * re-evaluation (post jest.resetModules) must not throw or re-register.
 * The merge keeps this file's else-arm hit alongside the if-arm hits
 * recorded by every other suite.
 */

import { describe, test, expect, jest } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import '@website/components/home/ContactSection.js'
import '@website/components/home/AwardsMentions.js'

describe('contact-section registration guard', () => {
  test('re-importing after reset skips the already-registered define', async () => {
    expect(customElements.get(COMPONENT_TAGS.CONTACT_SECTION)).toBeTruthy()
    expect(customElements.get(COMPONENT_TAGS.AWARDS_MENTIONS)).toBeTruthy()

    jest.resetModules()

    await import('@website/components/home/ContactSection.js')
    await import('@website/components/home/AwardsMentions.js')

    expect(customElements.get(COMPONENT_TAGS.CONTACT_SECTION)).toBeTruthy()
    expect(customElements.get(COMPONENT_TAGS.AWARDS_MENTIONS)).toBeTruthy()
  })
})
