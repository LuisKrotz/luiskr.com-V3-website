/**
 * @file statshud-engine-feed-tails.test.js
 * @description Coverage tails for StatsHud's conditional statsEngine feed —
 * the engine subscription exists only while the HUD preference is enabled,
 * so toggling the store flag while mounted must subscribe/unsubscribe the
 * direct stats channel.
 */
import { jest } from '@jest/globals'
import store from '@core/store.js'
import { statsEngine } from '@core/utils/perf/stats-engine.js'
import '@website/components/feedback/StatsHud.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

describe('StatsHud engine feed tails', () => {
  const mountHud = () => {
    const el = document.createElement(COMPONENT_TAGS.STATS_HUD)

    document.body.appendChild(el)

    return el
  }

  afterEach(() => {
    if (store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)
  })

  test('mounts unsubscribed while disabled, then subscribes on enable', () => {
    const subSpy = jest.spyOn(statsEngine, 'subscribe')

    const el = mountHud()

    el.onMounted?.()

    expect(el.showStats).toBe(false)

    expect(subSpy).not.toHaveBeenCalled()

    store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    expect(subSpy).toHaveBeenCalledWith(el._statsCb)

    el.remove()

    subSpy.mockRestore()
  })

  test('unsubscribes the engine feed when the flag flips off while mounted', () => {
    if (!store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    const unsubSpy = jest.spyOn(statsEngine, 'unsubscribe')

    const el = mountHud()

    el.onMounted?.()

    store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    expect(unsubSpy).toHaveBeenCalledWith(el._statsCb)

    el.remove()

    unsubSpy.mockRestore()
  })

  test('a store commit that leaves the flag unchanged keeps the feed state', () => {
    if (!store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    const subSpy = jest.spyOn(statsEngine, 'subscribe')

    const unsubSpy = jest.spyOn(statsEngine, 'unsubscribe')

    const el = mountHud()

    el.onMounted?.()

    el.onStoreUpdate?.()

    // The single call is the mount-time subscribe; the unchanged-flag
    // update must not re-subscribe or drop the feed.
    expect(subSpy).toHaveBeenCalledTimes(1)

    expect(unsubSpy).not.toHaveBeenCalled()

    subSpy.mockRestore()

    unsubSpy.mockRestore()

    el.remove()
  })
})
