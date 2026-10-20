/**
 * @file related-sync-tails.test.js
 * @description Coverage tail for components/portfolio/Related.tsx —
 * `_syncRingSheen`'s `el instanceof HTMLElement` else arm: when the mosaic
 * query resolves a non-HTMLElement (e.g. an SVG node), the previous ring
 * session is torn down but no new one mounts.
 */
import { describe, test, expect, jest } from '@jest/globals'
import '@website/components/portfolio/Related.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SVG_NS } from '@core/tokens/jsx.js'

describe('Related ring-sheen tails', () => {
  test('_syncRingSheen skips mounting when the resolved node is not an HTMLElement', () => {
    const el = document.createElement(COMPONENT_TAGS.PORTFOLIO_RELATED)
    const svgEl = document.createElementNS(SVG_NS, 'svg')
    const destroy = jest.fn()
    const fake = {
      $: jest.fn(() => svgEl),
      _ringEl: null,
      _ringSession: { destroy },
    }

    el._syncRingSheen.call(fake)

    expect(destroy).toHaveBeenCalled()
    expect(fake._ringSession).toBeNull()
    expect(fake._ringEl).toBe(svgEl)
  })
})
