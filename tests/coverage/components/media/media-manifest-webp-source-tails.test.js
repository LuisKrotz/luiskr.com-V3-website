/**
 * @file media-manifest-webp-source-tails.test.js
 * @description Coverage tail for the manifest-gated <source> emission —
 * with the bucket manifest loaded, surfaces that offer a webp variant
 * render the <source> (mosaic cover, related card, carousel pattern
 * thumb). The unmanifested/negative arms are covered by every other
 * component suite that renders these templates without a fetch mock.
 */
import { jest } from '@jest/globals'
import '@website/components/media/MediaFigure.js'
import { HomeMosaic } from '@website/components/home/HomeMosaic.js'
import { PortfolioRelated } from '@website/components/portfolio/Related.js'
import { renderCarouselSlide } from '@website/components/carousel/custom-carousel/render.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { MediaExpanded } from '@website/components/media/MediaExpanded.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { mount } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import store from '@core/store.js'

describe('media-manifest webp sources', () => {
  const COVER_KEY = 'covers/ia'
  const THUMB_KEY = `folder/b${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}`

  test('manifest-seeded renders emit webp <source>s', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [`${COVER_KEY}${MEDIA.WEBP_EXT}`, `${THUMB_KEY}${MEDIA.WEBP_EXT}`],
    }))

    await initMediaManifest()

    // Home mosaic card — <source> only because covers/ia.webp is listed.
    const mosaic = new HomeMosaic()
    const mosaicCleanup = mount(mosaic)

    mosaic.processedItems = [
      { label: 'Unit Card', link: 'unit-card', image: 'ia', featured: false },
    ]
    mosaic._updateDom()

    const mosaicSource = mosaic.shadowRoot.querySelector('source')

    expect(mosaicSource).not.toBeNull()
    expect(mosaicSource.getAttribute('srcset')).toBe(
      `${CDN_URLS.CDN_BASE}${COVER_KEY}${MEDIA.WEBP_EXT}`
    )

    mosaicCleanup()

    // Related card — imageSrc derives storage + covers/<image>.jpg; the
    // manifest-listed webp makes the <source> appear.
    store.state.portfoliolist = [{ link: 'rel', image: 'ia', label: 'Rel' }]

    const related = new PortfolioRelated()
    const relatedCleanup = mount(related)

    related.translations = {
      title: 'More',
      path: ROUTE_PATHS.PORTFOLIO,
      projects: [{ link: '/portfolio/rel', page: 'Rel' }],
    }
    related._updateDom()

    const relatedSource = related.shadowRoot.querySelector('source')

    expect(relatedSource).not.toBeNull()
    expect(relatedSource.getAttribute('srcset')).toBe(
      `${CDN_URLS.CDN_BASE}${COVER_KEY}${MEDIA.WEBP_EXT}`
    )

    relatedCleanup()

    // Carousel mixed-landscape pattern — two mirrored <picture>s get a
    // webp <source> each when the thumb sibling exists in the manifest.
    const slide = renderCarouselSlide(
      { src: 'b', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
      'folder/',
      true
    )

    const patternSources = slide.querySelectorAll('source')

    expect(patternSources.length).toBe(2)
    expect(patternSources[0].getAttribute('srcset')).toBe(
      `${CDN_URLS.CDN_BASE}${THUMB_KEY}${MEDIA.WEBP_EXT}`
    )

    globalThis.fetch = realFetch
  })

  test('manifest-known-absent webp starts the high-res probe on the jpg', async () => {
    // Manifest already loaded by the first test — the media-figure's probe
    // consults it and skips the doomed webp request entirely.
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'unconverted/pic')
    fig.setAttribute(MEDIA_ATTRS.WIDTH, '100')
    fig.setAttribute(MEDIA_ATTRS.HEIGHT, '100')
    document.body.appendChild(fig)

    const origImage = window.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()

      // Started on the original — no webp probe was issued.
      expect(inst.src.endsWith(MEDIA.WEBP_EXT)).toBe(false)
      expect(inst.src.endsWith(MEDIA.EXT)).toBe(true)

      inst.onload()

      expect(fig.highResSrc.endsWith(MEDIA.EXT)).toBe(true)
    } finally {
      window.Image = origImage
      fig.remove()
    }
  })

  test('manifest-known-absent webm/poster tiers are omitted from the video matrix', () => {
    // Manifest is loaded (first test) and lists none of this video's
    // derived variants — the emit gate must blank them instead of
    // offering doomed <source>/<poster> URLs that 404 into CORB.
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'folder/vid')
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    fig.onInit()

    expect(fig.poster).toEqual([ATTR_VALUES.EMPTY, ATTR_VALUES.EMPTY])
    expect(fig.videoWebm).toEqual([ATTR_VALUES.EMPTY, ATTR_VALUES.EMPTY])
    expect(fig.video[0].endsWith(MEDIA.VIDEO_EXT)).toBe(true)
    expect(fig.video[1].endsWith(`${MEDIA.VIDEO_SCALE}${MEDIA.VIDEO_EXT}`)).toBe(true)

    // Same gate on the expanded modal's webm sibling getter.
    const expanded = new MediaExpanded()

    expanded.setAttribute(MEDIA_ATTRS.SOURCE, `${CDN_URLS.CDN_BASE}folder/vid${MEDIA.VIDEO_EXT}`)
    expect(expanded.sourceWebm).toBe(ATTR_VALUES.EMPTY)

    fig.remove()
  })
})
