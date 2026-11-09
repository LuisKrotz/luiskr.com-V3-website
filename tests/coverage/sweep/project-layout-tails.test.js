/**
 * @file project-layout-tails.test.js
 * @description Covers the `height > 0 ? px : ''` arm in
 * views/project/layout.ts's sectionMosaicHeight — irregular media plus
 * a degenerate wall width make estimateMosaicHeight return 0 and keep
 * the empty arm; a normal viewport publishes the px estimate.
 */
import { sectionMosaicHeight } from '@website/views/project/layout.js'
import { resetViewportCache } from '@core/utils/dom.js'

describe('project layout — sectionMosaicHeight arms', () => {
  // Three all-different aspect ratios so the majority gate stays off.
  const media = [{ size: [800, 600] }, { size: [500, 800] }, { size: [300, 800] }]

  const section = [media, [{ data: 'x' }]]

  const withViewport = (w, fn) => {
    const iw = Object.getOwnPropertyDescriptor(window, 'innerWidth')

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: w,
    })
    resetViewportCache()

    try {
      fn()
    } finally {
      if (iw) Object.defineProperty(window, 'innerWidth', iw)
      resetViewportCache()
    }
  }

  test('irregular media + positive wall publishes the px estimate', () => {
    withViewport(1400, () => {
      expect(sectionMosaicHeight(null, section)).toMatch(/px$/)
    })
  })

  test('a degenerate wall width keeps the empty arm', () => {
    withViewport(0, () => {
      expect(sectionMosaicHeight(null, section)).toHaveLength(0)
    })
  })
})
