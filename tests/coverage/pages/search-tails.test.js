/**
 * @file search-tails.test.js
 * @description <view-search> coverage tails — element registration and the
 * centered route-search surface. The page has no heading of its own.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { mount } from '@tests/fixtures/test-constants.js'
import { ViewSearch } from '@website/views/search/Search.js'

describe('ViewSearch element', () => {
  let el
  let cleanup

  beforeEach(() => {
    el = new ViewSearch()
    cleanup = mount(el)
  })

  afterEach(() => cleanup())

  test('defines the custom element', () => {
    expect(customElements.get(VIEW_TAGS.VIEW_SEARCH)).toBe(ViewSearch)
  })

  test('renders only the route-search surface inside the view column', () => {
    const column = el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.SEARCH_VIEW}`)

    expect(column).not.toBeNull()
    expect(el.shadowRoot.querySelector(HTML_TAGS.H1)).toBeNull()
    expect(column.querySelector(COMPONENT_TAGS.ROUTE_SEARCH)).not.toBeNull()
  })

  test('mounts the shared legal footer after the column', () => {
    const footer = el.shadowRoot.querySelector(COMPONENT_TAGS.LEGAL_FOOTER)

    expect(footer).not.toBeNull()
    // The footer is the column's next sibling — it sits below the
    // full-viewport search screen, reachable on scroll.
    expect(footer.previousElementSibling).toBe(
      el.shadowRoot.querySelector(`.${ROUTE_SEARCH_CLASSES.SEARCH_VIEW}`)
    )
  })

  test('module re-eval sees the tag already registered', async () => {
    expect(customElements.get(VIEW_TAGS.VIEW_SEARCH)).toBeTruthy()
    jest.resetModules()
    await import('@website/views/search/Search.js')
  })
})
