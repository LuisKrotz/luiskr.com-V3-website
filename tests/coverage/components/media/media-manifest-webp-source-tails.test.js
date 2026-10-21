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
import { renderMosaic } from '@website/components/home/mosaic/render.js'
import { PortfolioRelated } from '@website/components/portfolio/Related.js'
import { renderRelated } from '@website/components/portfolio/related/render.js'
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
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import store from '@core/store.js'

describe('media-manifest webp sources', () => {
  const COVER_KEY = 'covers/ia'
  const LADDER_KEY = 'covers/lad'
  const JPG_ONLY_KEY = 'covers/lad2'
  const THUMB_KEY = `folder/b${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}`

  test('manifest-seeded renders emit webp <source>s', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        `${COVER_KEY}${MEDIA.WEBP_EXT}`,
        `${THUMB_KEY}${MEDIA.WEBP_EXT}`,
        // fig/pic — figure ladder: q50 (jpg-only), q75 (+webp), q100; the
        // raw stem.jpg deliberately absent so the '' rung gates out.
        `fig/pic${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        `fig/pic${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
        `fig/pic${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.WEBP_EXT}`,
        `fig/pic${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
        // covers/lad — cover ladder: kodak LQIP, q50 (+webp), q75 (jpg
        // only); the trusted passthrough original rides the '' rung.
        `${LADDER_KEY}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`,
        `${LADDER_KEY}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
        `${LADDER_KEY}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`,
        `${LADDER_KEY}${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
        // covers/lad2 — same ladder minus the q50 webp sibling so the
        // rung-0 <source> gate takes its webp-absent arm.
        `${JPG_ONLY_KEY}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`,
        `${JPG_ONLY_KEY}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
      ],
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

  test('proven ladder climbs every rung into the same high layer', async () => {
    // Manifest is loaded (first test) — fig/pic proves q50, q75 (+webp)
    // and q100, so loadHighRes climbs all three probes into the one high
    // <img> and stops at the highest available quality.
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'fig/pic')
    fig.setAttribute(MEDIA_ATTRS.WIDTH, '100')
    fig.setAttribute(MEDIA_ATTRS.HEIGHT, '100')
    document.body.appendChild(fig)

    const origImage = window.Image
    const probes = []

    window.Image = class {
      constructor() {
        probes.push(this)
      }
    }

    try {
      fig.isLoaded = false
      await fig.loadHighRes()

      // Rung 0 — a jpg-only rung starts the probe straight on the jpg.
      expect(probes[0].src.endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)).toBe(true)

      probes[0].onload()

      expect(fig.highResSrc.endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)).toBe(true)

      // Each confirmed tier mounts as a NEW stacked layer — the swap
      // retires the layers underneath on the successor's own load, so
      // the painted frame never blanks mid-climb.
      const settleTop = () => {
        const tops = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

        tops[tops.length - 1].dispatchEvent(new Event(WINDOW_EVENTS.LOAD))
      }

      settleTop()

      // Rung 1 — the proven webp sibling rides its own rung.
      expect(probes[1].src.endsWith(`${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.WEBP_EXT}`)).toBe(true)

      probes[1].onload()

      settleTop()

      // Rung 2 — the uncompressed top tier ends the climb.
      expect(probes[2].src.endsWith(`${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)).toBe(true)

      probes[2].onload()

      settleTop()

      const highs = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)
      const high = highs[highs.length - 1]

      expect(fig.isLoaded).toBe(true)
      expect(fig.highResSrc.endsWith(`${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)).toBe(true)
      expect(highs.length).toBe(1)
      expect(high.src).toBe(fig.highResSrc)
      expect(high.classList.contains(MEDIA_CLASSES.RENDER_MEDIA_LOADED)).toBe(true)
      expect(probes.length).toBe(3)
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

  test('proven cover rungs paint the high layer, climb on load, and resume from the registry', () => {
    // Manifest latched by the first test — covers/lad proves thumb +
    // q50 (+webp) + q75, covers/lad2 proves thumb + q50 jpg only.
    const mosaic = new HomeMosaic()
    const mosaicCleanup = mount(mosaic)

    mosaic.processedItems = [
      { label: 'Ladder Card', link: 'lad', image: 'lad', featured: false },
      { label: 'Ladder Jpg', link: 'lad2', image: 'lad2', featured: false },
    ]
    mosaic._updateDom()

    const highs = mosaic.shadowRoot.querySelectorAll(
      `img.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_HIGH}`
    )

    expect(highs.length).toBe(2)
    expect(highs[0].getAttribute('src').endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)).toBe(true)

    // rung-0 webp rides <source> only where the sibling is proven.
    const ladPic = highs[0].parentElement
    const lad2Pic = highs[1].parentElement

    expect(
      ladPic
        .querySelector('source')
        .getAttribute('srcset')
        .endsWith(`${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`)
    ).toBe(true)
    expect(lad2Pic.querySelector('source')).toBeNull()

    const origImage = window.Image
    const probes = []

    window.Image = class {
      constructor() {
        probes.push(this)
      }
    }

    const allHighs = () =>
      Array.from(
        mosaic.shadowRoot.querySelectorAll(`img.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_HIGH}`)
      )

    try {
      // First load — rung-0 confirmed, registry records, q75 is probed.
      highs[0].dispatchEvent(new Event(WINDOW_EVENTS.LOAD))

      const coverKey = `${CDN_URLS.CDN_BASE}${LADDER_KEY}${MEDIA.EXT}`

      expect(mosaic._loadedCovers.get(coverKey)).toBe(highs[0].src)
      expect(highs[0].classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_LOADED)).toBe(true)
      expect(probes.at(-1).src.endsWith(`${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`)).toBe(true)

      // Probe confirms → q75 mounts as a NEW stacked layer; the painted
      // rung stays connected (and unpainted-src untouched) until the
      // successor's own load retires it — no blank frame mid-climb.
      probes.at(-1).onload()

      const step1 = allHighs().find((el) =>
        el.getAttribute('src').endsWith(`${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`)
      )

      expect(step1).toBeTruthy()
      expect(highs[0].isConnected).toBe(true)

      step1.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))

      expect(highs[0].isConnected).toBe(false)
      expect(probes.at(-1).src).toBe(coverKey)

      probes.at(-1).onload()

      const step2 = allHighs().find((el) => el.getAttribute('src') === coverKey)

      expect(step2).toBeTruthy()

      step2.dispatchEvent(new Event(WINDOW_EVENTS.LOAD))

      expect(mosaic._loadedCovers.get(coverKey)).toBe(coverKey)

      // Re-render — the registry's reached tier re-emits directly with
      // the loaded class and no rung-0 <source> (resume path).
      mosaic._updateDom()

      const resumed = mosaic.shadowRoot.querySelector(
        `img.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_HIGH}`
      )

      expect(resumed.getAttribute('src')).toBe(coverKey)
      expect(resumed.classList.contains(HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_LOADED)).toBe(true)
      expect(resumed.parentElement.querySelector('source')).toBeNull()
    } finally {
      window.Image = origImage
      mosaicCleanup()
    }

    // Bare host — no _loadedCovers registry: the optional-chain else arm
    // still renders the ladder, it just cannot persist across re-renders.
    // Empty cards/image-less fields take the `||`/`?.` fallback arms.
    const bare = renderMosaic({
      translations: null,
      processedItems: [{ link: '', image: 'lad2', featured: false }],
      hoveredIdx: null,
      touchIdx: null,
      cards: [],
      containerH: '0px',
      storage: CDN_URLS.CDN_BASE,
      ext: MEDIA.EXT,
      _packSkeleton: () => ({ height: 0, boxes: [] }),
    })

    expect(bare.querySelector(`img.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_HIGH}`)).not.toBeNull()
  })

  test('related cards paint the same ladder and resume from their registry', () => {
    store.state.portfoliolist = [
      { link: 'rel', image: 'lad', label: 'Rel Lad' },
      { link: 'rel2', image: 'lad2', label: 'Rel Lad2' },
    ]

    const related = new PortfolioRelated()
    const relatedCleanup = mount(related)

    related.translations = {
      title: 'More',
      path: ROUTE_PATHS.PORTFOLIO,
      projects: [
        { link: '/portfolio/rel', page: 'Rel' },
        { link: '/portfolio/rel2', page: 'Rel2' },
      ],
    }
    related._updateDom()

    const highs = related.shadowRoot.querySelectorAll(
      `img.${RELATED_CLASSES.RELATED_MOSAIC_IMG_HIGH}`
    )

    expect(highs.length).toBe(2)
    expect(highs[0].parentElement.querySelector('source')).not.toBeNull()
    expect(highs[1].parentElement.querySelector('source')).toBeNull()

    const origImage = window.Image
    const probes = []

    window.Image = class {
      constructor() {
        probes.push(this)
      }
    }

    try {
      highs[0].dispatchEvent(new Event(WINDOW_EVENTS.LOAD))

      const imageSrc = related.projectsList[0].imageSrc

      expect(related._loadedCovers.get(imageSrc)).toBe(highs[0].src)

      // Re-render — reached tier re-emits with the loaded class.
      related._updateDom()

      const resumed = related.shadowRoot.querySelector(
        `img.${RELATED_CLASSES.RELATED_MOSAIC_IMG_HIGH}`
      )

      expect(resumed.getAttribute('src')).toBe(related._loadedCovers.get(imageSrc))
      expect(resumed.classList.contains(RELATED_CLASSES.RELATED_MOSAIC_IMG_LOADED)).toBe(true)
      expect(resumed.parentElement.querySelector('source')).toBeNull()
    } finally {
      window.Image = origImage
      relatedCleanup()
    }

    // Bare host — undefined registry arm of the optional chain, a
    // described card's draw-text arm, and an image-less card's skeleton
    // media + `imageSrc ? … : undefined` else arm.
    const bare = renderRelated({
      projectsList: [
        {
          link: 'rel',
          page: 'Rel',
          fullPath: '/portfolio/rel',
          imageSrc: `${CDN_URLS.CDN_BASE}${LADDER_KEY}${MEDIA.EXT}`,
          description: 'A described card',
          featured: false,
        },
        {
          link: 'noimg',
          page: 'NoImg',
          fullPath: '/portfolio/noimg',
          imageSrc: '',
          description: '',
          featured: true,
        },
      ],
      translations: { title: 'T', note: '', socials: [] },
      _noteOpen: false,
      _noteTruncated: false,
      _toggleNote() {},
    })

    expect(bare.querySelector(`img.${RELATED_CLASSES.RELATED_MOSAIC_IMG_HIGH}`)).not.toBeNull()
  })
})
