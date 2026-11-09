/**
 * @file statshud-tiers-tails.test.js
 * @description Coverage tails for StatsHud's render-side tier bands and the
 * imperative DOM patch — render() only ever evaluated against the zeroed
 * stats seed, so every good/mid/bad class ternary plus the latency/memory
 * dashes and the NPU-active acceleration label are driven here. Also covers
 * the `_updateStatsDom` preference guard, the missing stat-element arm, and
 * both `npu` capabilities.
 */
import { jest } from '@jest/globals'
import store from '@core/store.js'
import { npuPredict } from '@core/utils/gpu/npu-predict.js'
import '@website/components/feedback/StatsHud.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

describe('StatsHud tier tails', () => {
  const mountHud = () => {
    const el = document.createElement(COMPONENT_TAGS.STATS_HUD)

    document.body.appendChild(el)

    return el
  }

  afterEach(() => {
    if (store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)
  })

  test('renders every stat color band from a populated snapshot', () => {
    if (!store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    const npuSpy = jest
      .spyOn(npuPredict, 'getNpuAnalytics')
      .mockReturnValue({ hasNPU: true, hasGPU: false })

    const el = mountHud()

    const bands = [
      { fps: 60, cpuPercent: 10, latencyMs: 50, memoryMB: 128 },
      { fps: 40, cpuPercent: 50, latencyMs: 200, memoryMB: 0 },
      { fps: 10, cpuPercent: 90, latencyMs: 800, memoryMB: 0 },
    ]

    for (const band of bands) {
      el._stats = {
        networkBytesPerSec: 1024,
        pendingRequests: 0,
        ...band,
      }

      el._updateDom()
      el._updateStatsDom()
      el._statsCb?.(el._stats)
    }

    expect(el.showStats).toBe(true)

    el.remove()

    npuSpy.mockRestore()
  })

  test('acceleration label falls back to GPU-only capability', () => {
    if (!store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    const npuSpy = jest
      .spyOn(npuPredict, 'getNpuAnalytics')
      .mockReturnValue({ hasNPU: false, hasGPU: true })

    const el = mountHud()

    const display = el._accelerationDisplay()

    expect(display.className).toContain('-fps-good')

    el.remove()

    npuSpy.mockRestore()
  })

  test('_updateStatsDom returns early while the preference is off', () => {
    const el = mountHud()

    el._updateStatsDom()

    el.remove()
  })

  test('_updateStatsDom skips stat rows missing from the DOM', () => {
    if (!store.state.showStatsForNerds) store.commit(PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS)

    const el = mountHud()

    el.shadowRoot?.querySelector('[data-stat="mem"]')?.remove()

    el._updateStatsDom()

    el.remove()
  })
})
