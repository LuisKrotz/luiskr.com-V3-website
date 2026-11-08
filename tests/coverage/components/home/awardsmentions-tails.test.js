/**
 * @file awardsmentions-tails.test.js
 * @description Split from coverage-tails-3.test.js — covers the "AwardsMentions tails" describe.
 */
import { jest } from '@jest/globals'
import store from '@core/store.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'

import '@website/components/home/AwardsMentions.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('AwardsMentions tails', () => {
  test('_ensureData tolerates a null lang object and missing snapshots', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    const prevLang = store.state.lang

    try {
      store.state.lang = null
      el._ensureData()
    } finally {
      store.state.lang = prevLang
    }

    const prevComponents = store.getters.getlang()?.components

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, null)

    expect(el.legalLinks.length).toBeGreaterThan(0)

    store.commit(LANG_MUTATIONS.SET_LANG, 'zz-missing')
    el._ensureData()
    await flush(40)

    const origFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => null })
    try {
      store.state.lang = { locale: 'zz-null', database: 'dbz-awards/' }
      el._ensureData()
      await flush(40)
    } finally {
      globalThis.fetch = origFetch
      store.state.lang = prevLang
    }

    store.commit(LANG_MUTATIONS.SET_LANG, prevLang.locale)
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, prevComponents)
    el.remove()
  })

  test('onStoreUpdate skips the re-render while the locale is unchanged', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    const spy = jest.spyOn(el, '_updateDom')

    el.onStoreUpdate()

    expect(spy).not.toHaveBeenCalled()

    el.remove()
  })

  test('onUpdated skips the sep watcher when the legal nav is absent', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    el.shadowRoot.querySelector(`nav.${AWARDS_CLASSES.AWARDS_FOOTER_LINKS}`)?.remove()

    expect(() => el.onUpdated()).not.toThrow()
    expect(el._sepsTeardown).toBeNull()

    el.remove()
  })

  test('delegated click handler covers non-element and non-item targets', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    el.shadowRoot.dispatchEvent(
      new window.Event(MOUSE_EVENTS.CLICK, { bubbles: true, composed: true })
    )

    const inner = document.createElement(HTML_TAGS.SPAN)

    el.shadowRoot.appendChild(inner)
    inner.dispatchEvent(new window.Event(MOUSE_EVENTS.CLICK, { bubbles: true, composed: true }))

    inner.remove()
    el.remove()
  })
})
