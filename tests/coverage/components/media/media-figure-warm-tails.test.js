/**
 * @file media-figure-warm-tails.test.js
 * @description Coverage tail for the CDN warm-up path — warmFirstRung's
 * manifest-proven first rung (webp present, webp absent) and the
 * unmanifested q50 fallback. The mount-time warmObserver arm fires
 * through happy-dom's auto-intersecting observer on every image mount
 * in the other media suites.
 */
import { jest } from '@jest/globals'
import '@website/components/media/MediaFigure.js'
import { warmFirstRung } from '@website/components/media/figure/load.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'

describe('media-figure warm-up', () => {
  const WARM_KEY = 'warm/webp'
  const WARM_JPG_KEY = 'warm/jpg'

  /**
   * Detached figure carrying only attrs — never appended, so the mount
   * observers can't race the explicit warmFirstRung probe.
   */
  const detachedFigure = (src) => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, src)
    fig.setAttribute(MEDIA_ATTRS.WIDTH, '100')
    fig.setAttribute(MEDIA_ATTRS.HEIGHT, '100')

    return fig
  }

  test('manifest-proven first rung warms its webp sibling', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        // warm/webp — q50 jpg + webp sibling proven
        `${WARM_KEY}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        `${WARM_KEY}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`,
        // warm/jpg — q50 jpg only, so rung 0 falls to the jpg arm
        `${WARM_JPG_KEY}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
      ],
    }))

    await initMediaManifest()

    const loaded = []
    const origImage = window.Image

    window.Image = class {
      set src(v) {
        loaded.push(v)
      }
    }

    try {
      warmFirstRung(detachedFigure(WARM_KEY))

      expect(loaded.at(-1).endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`)).toBe(true)
      expect(loaded.at(-1).startsWith(CDN_URLS.CDN_BASE)).toBe(true)

      warmFirstRung(detachedFigure(WARM_JPG_KEY))

      expect(loaded.at(-1).endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)).toBe(true)
      expect(loaded.at(-1).endsWith(MEDIA.WEBP_EXT)).toBe(false)
    } finally {
      window.Image = origImage
      globalThis.fetch = realFetch
    }
  })

  test('the realm Image resolves the probe when window.Image is absent', () => {
    const loaded = []
    const origWin = window.Image
    const origGlobal = globalThis.Image

    window.Image = undefined
    globalThis.Image = class {
      set src(v) {
        loaded.push(v)
      }
    }

    try {
      // window.Image falsy → ImageCtor falls to the realm-global Image arm.
      warmFirstRung(detachedFigure(WARM_JPG_KEY))

      expect(loaded.length).toBe(1)
      expect(loaded[0].endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)).toBe(true)
    } finally {
      window.Image = origWin
      globalThis.Image = origGlobal
    }
  })

  test('unmanifested src warms the historic q50 blind rung', () => {
    // Manifest is latched from the first test — an unproven stem yields
    // no rungs, so the warm probe walks the blind q50 fallback.
    const loaded = []
    const origImage = window.Image

    window.Image = class {
      set src(v) {
        loaded.push(v)
      }
    }

    try {
      warmFirstRung(detachedFigure('warm/missing'))

      expect(loaded.length).toBe(1)
      expect(loaded[0].endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)).toBe(true)
    } finally {
      window.Image = origImage
    }
  })
})
