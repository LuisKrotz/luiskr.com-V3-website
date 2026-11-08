/**
 * @file search-modal-fallback-tails.test.js
 * @description <search-modal> fallback-path coverage — `appText`
 * resolving to empty strings so every `|| EMPTY` guard arm in the
 * dialog's render runs.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { LANG_SLUGS as mockLangSlugs } from '@core/locale/lang-slugs.js'

/** `appText` resolves to '' — every `|| EMPTY` arm in render runs; the
 * rest of the export surface keeps its contract for transitive imports. */
jest.unstable_mockModule('@core/locale/ui-text.js', () => ({
  appText: () => '',
  componentText: () => '',
  indexedText: () => '',
  routeSlugs: (lang) => mockLangSlugs[lang] || mockLangSlugs.en,
  rightsText: () => '',
  rightsParts: () => ({ pre: '', copy: '', mid: '', year: '', post: '' }),
}))

const { SearchModal } = await import('@website/components/dialogs/SearchModal.js')

import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { SEARCH_MODAL_CLASSES } from '@core/tokens/classes/search-modal.js'
import { mount } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

describe('SearchModal fallback paths', () => {
  let el
  let cleanup

  beforeEach(() => {
    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    el = new SearchModal()
    cleanup = mount(el)
  })

  afterEach(() => {
    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    cleanup()
  })

  test('renders with empty label fallbacks', () => {
    el.open = true

    const panel = el.shadowRoot.querySelector(`.${SEARCH_MODAL_CLASSES.SEARCH_MODAL_PANEL}`)

    expect(panel).not.toBeNull()
    expect(
      el.shadowRoot
        .querySelector(`.${SEARCH_MODAL_CLASSES.SEARCH_MODAL_CLOSE_BTN}`)
        .getAttribute('aria-label')
    ).toBe('')
  })
})
