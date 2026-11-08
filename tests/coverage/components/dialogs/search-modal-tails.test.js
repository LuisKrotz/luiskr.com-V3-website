/**
 * @file search-modal-tails.test.js
 * @description <search-modal> coverage tails — open/close state machine
 * (store flag ⇄ open attr), backdrop/Esc/✕ dismissal, focus handoff into
 * the hosted <route-search>, and the isOpen getter fallback.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { SEARCH_MODAL_CLASSES } from '@core/tokens/classes/search-modal.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { KEYS } from '@core/tokens/primitives.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { mount } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'
import { SearchModal } from '@website/components/dialogs/SearchModal.js'
import { RouteSearch } from '@website/components/search/RouteSearch.js'

const S = {
  BACKDROP: `.${SEARCH_MODAL_CLASSES.SEARCH_MODAL_BACKDROP}`,
  PANEL: `.${SEARCH_MODAL_CLASSES.SEARCH_MODAL_PANEL}`,
  CLOSE: `.${SEARCH_MODAL_CLASSES.SEARCH_MODAL_CLOSE_BTN}`,
}

describe('SearchModal element', () => {
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

  test('defines the custom element', () => {
    expect(customElements.get(COMPONENT_TAGS.SEARCH_MODAL)).toBe(SearchModal)
  })

  test('closed state renders nothing; open mounts the dialog surface', () => {
    expect(el.shadowRoot.querySelector(S.PANEL)).toBeNull()

    el.open = true

    expect(el.isOpen).toBe(true)
    expect(el.open).toBe(true)
    expect(store.state.searchModalOpen).toBe(true)
    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(true)

    const panel = el.shadowRoot.querySelector(S.PANEL)
    expect(panel).not.toBeNull()
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(el.shadowRoot.querySelector(COMPONENT_TAGS.ROUTE_SEARCH)).not.toBeNull()
  })

  test('open focuses the hosted route-search input', () => {
    const spy = jest.spyOn(RouteSearch.prototype, 'focusInput').mockImplementation(() => {})

    el.open = true

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('✕ button + backdrop + Escape all dismiss via the store flag', async () => {
    // The genie-leave collapse runs before the store flag commits — the
    // dialog stays "open" until DIALOG_LEAVE_DURATION has elapsed.
    const flushLeave = () =>
      new Promise((r) => setTimeout(r, ANIMATION_DURATIONS.DIALOG_LEAVE_DURATION + 20))

    el.open = true
    expect(el.isOpen).toBe(true)

    el.shadowRoot
      .querySelector(S.CLOSE)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    expect(el._closing).toBe(true)

    await flushLeave()

    expect(store.state.searchModalOpen).toBe(false)
    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(false)

    el.open = true
    el.shadowRoot
      .querySelector(S.BACKDROP)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    await flushLeave()

    expect(store.state.searchModalOpen).toBe(false)

    el.open = true
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: KEYS.ESCAPE }))

    await flushLeave()

    expect(store.state.searchModalOpen).toBe(false)
  })

  test('re-entry during genie-leave is a no-op — the _closing guard', async () => {
    el.open = true

    el.close() // starts the collapse — store flag still true
    expect(el._closing).toBe(true)

    el.close() // _closing arm — returns early
    el.onStoreUpdate() // _closing guard — no re-render mid-collapse

    await new Promise((r) => setTimeout(r, ANIMATION_DURATIONS.DIALOG_LEAVE_DURATION + 20))

    expect(el._closing).toBe(false)
    expect(store.state.searchModalOpen).toBe(false)
  })

  test('close() is a no-op while already closed; isOpen falls back to _isOpen', () => {
    el.close() // closed arm — returns early
    expect(el._isOpen).toBe(false)

    const getter = store.getters.getSearchModalOpen

    store.getters.getSearchModalOpen = undefined
    el._isOpen = true

    expect(el.isOpen).toBe(true)

    store.getters.getSearchModalOpen = getter
  })

  test('onStoreUpdate is a no-op when the flag did not change', () => {
    el.onStoreUpdate() // closed + no attr → neither branch
    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(false)

    el.open = true
    el.onStoreUpdate() // open + attr already set → neither branch

    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(true)
  })

  test('missing route-search child and missing focusInput arm tolerated', () => {
    // $(…) → null covers `search?.focusInput` null arm.
    el.$ = () => null
    el.open = true
    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(true)

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
    el.$ = () => ({}) // focusInput undefined → `?.()` skips
    el.open = true
    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(true)
  })
})
