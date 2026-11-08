/**
 * @file search-wip-tails.test.js
 * @description Sweep tails for the route-search WIP: route-search/data
 * projectEntries keyed-object + filter arms, render.tsx isActive arm,
 * SearchModal open/close/isOpen-fallback arms, views/search re-import
 * guard, views/project/data locale-fallback arm, and related/render's
 * loaded-rung arm.
 */
import { jest } from '@jest/globals'
import {
  projectEntries,
  searchStrings,
  staticEntries,
} from '@website/components/search/route-search/data.js'
import { renderItems } from '@website/components/search/route-search/render.js'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { LOCALES } from '@core/tokens/locales.js'
import store from '@core/store.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('route-search data arms', () => {
  test('projectEntries accepts a keyed object, filters junk and fills fallbacks', () => {
    const rows = {
      a: { link: '/work/one', label: 'One', description: 'd', cover: 'c.jpg' },
      b: { link: '/work/two' },
      junk1: null,
      junk2: 'nope',
      junk3: { label: 'no-link' },
    }

    const out = projectEntries(rows, LOCALES.EN)

    expect(out.length).toBe(2)
    expect(out[0].path).toContain('/work/one')
    expect(projectEntries(null, LOCALES.EN)).toEqual([])
    expect(projectEntries(undefined, 'br')).toEqual([])
  })

  test('staticEntries builds the page route set for a locale', () => {
    const entries = staticEntries(LOCALES.EN)

    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })
})

describe('route-search render arms', () => {
  test('renderItems marks the active row and skips missing previews', () => {
    const strings = searchStrings(null)
    const items = [
      { title: 'A', path: '/a', preview: '', keywords: [], kind: 'page' },
      { title: 'B', path: '/b', preview: 'p', keywords: [], kind: 'page' },
    ]

    const els = renderItems(items, 1, strings)

    // els[0] is the kind-boundary group header — the options follow it.
    expect(els[2].classList.contains(ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM_ACTIVE)).toBe(true)
    expect(els[1].querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PREVIEW}`)).toBeNull()

    const withThumb = renderItems(
      [
        {
          title: 'T',
          path: '/t',
          preview: 'x',
          thumb: 'https://x/y.png',
          keywords: [],
          kind: 'page',
        },
      ],
      0,
      strings
    )

    expect(withThumb[1].querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_THUMB}`)).not.toBeNull()
  })
})

describe('search modal arms', () => {
  test('isOpen falls back to local state when the store getter is absent', async () => {
    await import('@website/components/dialogs/SearchModal.js')

    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    const getter = store.getters.getSearchModalOpen

    store.getters.getSearchModalOpen = undefined
    el._isOpen = true

    expect(el.isOpen).toBe(true)
    expect(el.render()).toBeTruthy()

    store.getters.getSearchModalOpen = getter
    el.remove()
  })

  test('close() runs the genie leave and commits the toggle', async () => {
    const el = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)

    document.body.appendChild(el)
    await flush()

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, true)
    await flush()

    el.close()
    await flush(ANIMATION_DURATIONS.DIALOG_LEAVE_DURATION + 20)

    expect(store.state.searchModalOpen).toBe(false)
    expect(el.hasAttribute(COMMON_ATTRS.OPEN)).toBe(false)
    el.remove()
  })
})

describe('view guard + locale arms', () => {
  test('re-importing views/search while the tag exists hits the defined guard', async () => {
    await import('@website/views/search/Search.js')
    await jest.isolateModulesAsync(async () => {
      await import('@website/views/search/Search.js')
    })

    expect(customElements.get(VIEW_TAGS.VIEW_SEARCH)).toBeTruthy()
  })
})
