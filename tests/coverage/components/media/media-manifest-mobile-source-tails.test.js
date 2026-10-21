/**
 * @file media-manifest-mobile-source-tails.test.js
 * @description Coverage tails for the mobile-tier <source> emission — the
 * `(mobileWebp || mobileJpg) && <source media=…>` block shared by the home
 * mosaic card and the related-projects card (components/home/mosaic/render.tsx,
 * components/portfolio/related/render.tsx). A manifest proving only the
 * mobile jpg emits a type-less <source>; one that also proves the mobile
 * webp emits the typed variant. Same file binds related/match.ts rule 3 —
 * image-name containment joining a related pointer when exact matching fails.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { HomeMosaic } from '@website/components/home/HomeMosaic.js'
import { PortfolioRelated } from '@website/components/portfolio/Related.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { mount, TEST_PROJECTS, TEST_TEXT } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

describe('media-manifest mobile <source> variants', () => {
  // metcha proves only the ≤768px jpg (type-less <source>); sage also
  // proves the mobile webp (typed <source> preferred in srcset).
  const MOBILE_JPG = (stem) =>
    `covers/${stem}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`

  const MOBILE_WEBP = (stem) =>
    `covers/${stem}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.MOBILE_SUFFIX}${MEDIA.WEBP_EXT}`

  test('mobile-tier <source> emits typed and untyped arms in mosaic + related', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        MOBILE_JPG(TEST_PROJECTS.METCHA),
        MOBILE_JPG(TEST_PROJECTS.SAGE),
        MOBILE_WEBP(TEST_PROJECTS.SAGE),
      ],
    }))

    await initMediaManifest()

    try {
      // Home mosaic — one card per mobile-tier arm.
      const mosaic = new HomeMosaic()
      const mosaicCleanup = mount(mosaic)

      mosaic.processedItems = [
        {
          label: TEST_TEXT.HEADING,
          link: TEST_PROJECTS.METCHA,
          image: TEST_PROJECTS.METCHA,
          featured: false,
        },
        {
          label: TEST_TEXT.SECOND,
          link: TEST_PROJECTS.SAGE,
          image: TEST_PROJECTS.SAGE,
          featured: false,
        },
      ]
      mosaic._updateDom()

      const mosaicSources = [...mosaic.shadowRoot.querySelectorAll('source[media]')]

      expect(mosaicSources.length).toBe(2)
      expect(mosaicSources.filter((s) => s.getAttribute('type')).length).toBe(1)
      expect(
        mosaicSources.find((s) => s.getAttribute('type'))?.getAttribute('type')
      ).toBe(MEDIA_ATTRS.IMAGE_WEBP)

      mosaicCleanup()

      // Related cards — same cover matrix through buildProjectsList; the
      // melissa home row joins 'minimelissa' by image-name containment
      // (rule 3) since neither link nor image matches exactly.
      store.state.portfoliolist = [
        { link: TEST_PROJECTS.CICB, image: TEST_PROJECTS.MELISSA, label: TEST_TEXT.HEADING },
        { link: TEST_PROJECTS.METCHA, image: TEST_PROJECTS.METCHA, label: TEST_TEXT.HEADING },
        { link: TEST_PROJECTS.SAGE, image: TEST_PROJECTS.SAGE, label: TEST_TEXT.SECOND },
      ]

      const related = new PortfolioRelated()
      const relatedCleanup = mount(related)

      related.translations = {
        title: TEST_TEXT.HEADING,
        path: ROUTE_PATHS.PORTFOLIO,
        projects: [
          { link: `/portfolio/${TEST_PROJECTS.SLUG_MINIMELISSA}`, page: TEST_TEXT.HEADING },
          { link: `/portfolio/${TEST_PROJECTS.METCHA}`, page: TEST_TEXT.HEADING },
          { link: `/portfolio/${TEST_PROJECTS.SAGE}`, page: TEST_TEXT.SECOND },
        ],
      }
      related._updateDom()

      const relatedSources = [...related.shadowRoot.querySelectorAll('source[media]')]

      expect(relatedSources.length).toBe(2)
      expect(relatedSources.filter((s) => s.getAttribute('type')).length).toBe(1)

      // Rule-3 join check — the minimelissa pointer bound melissa's row.
      expect(related.projectsList[0].imageSrc).toContain(
        `covers/${TEST_PROJECTS.MELISSA}`
      )

      relatedCleanup()
    } finally {
      globalThis.fetch = realFetch
      store.state.portfoliolist = []
    }
  })
})
