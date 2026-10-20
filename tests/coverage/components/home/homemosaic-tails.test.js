/**
 * @file homemosaic-tails.test.js
 * @description Split from coverage-tails-3.test.js — covers the "HomeMosaic tails" describe.
 */
import _router from '@core/router/router.js'
import { jest } from '@jest/globals'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

import '@website/components/feedback/StatsHud.js'
import '@website/components/home/AwardsMentions.js'
import '@website/components/legal/Footer.js'

import '@website/components/home/HomeMosaic.js'
import '@website/components/dialogs/LangDialog.js'
import '@website/components/dialogs/PreferencesModal.js'
import '@website/components/carousel/AwardsCarousel.js'
import '@website/views/home/Home.js'
import '@website/views/legal/Legal.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SVG_NS } from '@core/tokens/jsx.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('HomeMosaic tails', () => {
  test('setter fallbacks and render without processed items', async () => {
    const el = document.createElement(COMPONENT_TAGS.HOME_MOSAIC)

    document.body.appendChild(el)
    await flush()

    el.processedItems = null
    el.processedItems = []
    el.translations = null
    el.translations = { portfoliolist: { title: TEST_TEXT.HEADING } }

    await flush()
    el.remove()
  })

  test('_syncBrackets returns early when no shadow root exists', () => {
    const el = document.createElement(COMPONENT_TAGS.HOME_MOSAIC)
    const teardown = jest.fn()
    const fake = { _bracketTeardown: teardown, shadowRoot: null }

    el._syncBrackets.call(fake)

    expect(teardown).toHaveBeenCalled()
    expect(fake._bracketTeardown).toBeNull()
  })

  test('_syncRingSheen skips mounting when the resolved node is not an HTMLElement', () => {
    const el = document.createElement(COMPONENT_TAGS.HOME_MOSAIC)
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
