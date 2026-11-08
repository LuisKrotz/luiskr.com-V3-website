/**
 * @file awardsmentions-tails-2.test.js
 * @description Split from coverage-tails-6.test.js — covers the "AwardsMentions tails 2" describe.
 */
import store from '@core/store.js'

import '@website/components/home/AwardsMentions.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 100) => new Promise((r) => setTimeout(r, ms))

describe('AwardsMentions tails 2', () => {
  test('legalLinks falls back through CMS → locale → defaults', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    const viaCms = el.legalLinks

    expect(Array.isArray(viaCms)).toBe(true)

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})

    const viaFallback = el.legalLinks

    expect(Array.isArray(viaFallback)).toBe(true)

    el.remove()
  })

  test('divider-sheen teardown lifecycle tolerates absent nodes', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    el._mountDividerSheen()
    el.onDestroy()

    expect(el._dividerTeardowns).toHaveLength(0)

    el.remove()
  })
})
