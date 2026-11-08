/**
 * @file views-viewproject.test.js
 * @description Split from views.test.js — covers the "ViewProject" describe.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ViewProject } from '@website/views/project/Project.js'
import { SCSS, mount } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { LABEL_TEXT } from '@core/tokens/strings/text.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { COVER_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TITLE_MARQUEE } from '@core/tokens/motion/marquee.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'

// ─── Local selector helpers (derived from TAGS/CLASSES) ───────────────────────
const S = {
  DRAW_TEXT: COMPONENT_TAGS.DRAW_TEXT,
  MEDIA_FIGURE: COMPONENT_TAGS.MEDIA_FIGURE,
  PORTFOLIO_RELATED: COMPONENT_TAGS.PORTFOLIO_RELATED,
  HOME_MOSAIC_ITEM: `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM}`,
  HOME_MOSAIC_TITLE: `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE}`,
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewProject
// ─────────────────────────────────────────────────────────────────────────────
describe('ViewProject', () => {
  let projectEl
  let cleanup

  beforeEach(() => {
    projectEl = new ViewProject()
    cleanup = mount(projectEl)
  })

  afterEach(() => cleanup())

  test('creates shadow root on construction', () => {
    expect(projectEl.shadowRoot).not.toBeNull()
  })

  test('renders skeleton state when translations are null', () => {
    const skeletonTitle = projectEl.shadowRoot.querySelector(
      `.${SKELETON_CLASSES.SKELETON_TITLE_MD}`
    )
    const skeletonCover = projectEl.shadowRoot.querySelector(
      `.${INTERNAL_CLASSES.INTERNAL_MAIN_ITEM}`
    )
    expect(skeletonTitle).not.toBeNull()
    expect(skeletonCover).not.toBeNull()
    expect(projectEl.shadowRoot.textContent).not.toContain(LABEL_TEXT.LOADING)
  })

  test('renders title marquee and cover media when translations are provided', () => {
    projectEl.translations = {
      title: 'Stellar Branding Project',
      folder: 'portfolio/stellar/',
      cover: { src: 'cover', size: [1920, 1080], isVideo: false, label: 'Cover Art' },
      sections: [],
    }
    projectEl._updateDom()

    const title = projectEl.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_TITLE}`)
    const strip = projectEl.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_TITLE_STRIP}`)
    const copies = projectEl.shadowRoot.querySelectorAll(`.${INTERNAL_CLASSES.INTERNAL_TITLE_COPY}`)
    const mediaFigure = projectEl.shadowRoot.querySelector(S.MEDIA_FIGURE)
    expect(title.classList.contains(INTERNAL_CLASSES.INTERNAL_TITLE_MARQUEE_MOD)).toBe(true)
    expect(title.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('Stellar Branding Project')
    expect(strip).not.toBeNull()
    expect(copies.length).toBe(TITLE_MARQUEE.COPIES)
    expect(copies[0].children.length).toBe(TITLE_MARQUEE.MIN_REPEAT)
    expect(copies[0].firstElementChild.textContent).toBe(
      `Stellar Branding Project${CHAR_STRINGS.PIPE_SEP}`
    )
    expect(mediaFigure).not.toBeNull()
    expect(mediaFigure.getAttribute(MEDIA_ATTRS.SRC)).toBe('portfolio/stellar/cover')
    expect(mediaFigure.getAttribute(MEDIA_ATTRS.WIDTH)).toBe(COVER_DIMENSIONS.FHD_WIDTH_STR)
    expect(mediaFigure.getAttribute(MEDIA_ATTRS.HEIGHT)).toBe('1080')
  })

  describe('title marquee fit', () => {
    const setUnitWidth = (width) => {
      const unit = projectEl.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_TITLE_UNIT}`)

      Object.defineProperty(unit, 'offsetWidth', { configurable: true, value: width })
    }

    const halves = () =>
      projectEl.shadowRoot.querySelectorAll(`.${INTERNAL_CLASSES.INTERNAL_TITLE_COPY}`)

    const strip = () =>
      projectEl.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_TITLE_STRIP}`)

    beforeEach(() => {
      projectEl.translations = { title: 'Metcha', sections: [] }

      projectEl._updateDom()
    })

    test('repeats the title until each half spans the viewport', () => {
      const unitW = 100

      const expected = Math.ceil(window.innerWidth / unitW) + TITLE_MARQUEE.SAFETY_REPEAT

      setUnitWidth(unitW)

      projectEl._syncTitleMarquee()

      halves().forEach((half) => expect(half.children.length).toBe(expected))
      expect(projectEl._titleRepeat).toBe(expected)
      expect(strip().style.animationDuration).toBe(
        `${((expected * unitW) / TITLE_MARQUEE.SPEED_PX_S).toFixed(2)}s`
      )
    })

    test('trims surplus repetitions down to the minimum for wide titles', () => {
      setUnitWidth(1)

      projectEl._syncTitleMarquee()

      setUnitWidth(window.innerWidth * 10)

      projectEl._syncTitleMarquee()

      halves().forEach((half) => expect(half.children.length).toBe(TITLE_MARQUEE.MIN_REPEAT))
    })

    test('leaves the strip untouched while the unit has no width', () => {
      projectEl._syncTitleMarquee()

      halves().forEach((half) => expect(half.children.length).toBe(TITLE_MARQUEE.MIN_REPEAT))
      expect(strip().style.animationDuration).toBe(CHAR_STRINGS.EMPTY)
    })

    test('re-fits on window resize', async () => {
      const spy = jest.spyOn(projectEl, '_syncTitleMarquee')

      window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))

      await new Promise((resolve) => requestAnimationFrame(resolve))

      expect(spy).toHaveBeenCalled()
    })
  })

  test('renders cover without folder as a root-relative src', () => {
    projectEl.translations = {
      title: 'Loose Cover',
      cover: { src: 'cover', size: [1920, 1080], isVideo: false, label: 'Cover Art' },
      sections: [],
    }
    projectEl._updateDom()

    const mediaFigure = projectEl.shadowRoot.querySelector(S.MEDIA_FIGURE)

    expect(mediaFigure).not.toBeNull()
    expect(mediaFigure.getAttribute(MEDIA_ATTRS.SRC)).toBe('cover')
  })

  test('renders video cover with autoPlay and isVideo attributes', () => {
    projectEl.translations = {
      title: 'Video Showcase',
      folder: 'portfolio/video/',
      cover: { src: 'hero-reel', size: [1920, 1080], isVideo: true, label: 'Reel' },
      sections: [],
    }
    projectEl._updateDom()
    const mediaFigure = projectEl.shadowRoot.querySelector(S.MEDIA_FIGURE)
    expect(mediaFigure.getAttribute(MEDIA_ATTRS.IS_VIDEO)).toBe(STATE_STRINGS.TRUE)
    expect(mediaFigure.getAttribute(MEDIA_ATTRS.AUTO_PLAY)).toBe(STATE_STRINGS.TRUE)
  })

  test('isLandscapeGroup returns true when all items have landscape class', () => {
    const landscapeGroup = [
      { src: 'img1', class: STATE_STRINGS.LANDSCAPE },
      { src: 'img2', class: STATE_STRINGS.LANDSCAPE },
    ]
    expect(projectEl.isLandscapeGroup(landscapeGroup)).toBe(true)
  })

  test('isLandscapeGroup returns false when any item is portrait or standard', () => {
    const mixedGroup = [
      { src: 'img1', class: STATE_STRINGS.LANDSCAPE },
      { src: 'img2', class: 'portrait' },
    ]
    expect(projectEl.isLandscapeGroup(mixedGroup)).toBe(false)
  })

  test('isLandscapeGroup returns false for empty or non-array groups', () => {
    expect(projectEl.isLandscapeGroup([])).toBe(false)
    expect(projectEl.isLandscapeGroup(null)).toBe(false)
  })

  test('textDelay dynamically calculates per-character animation delay', () => {
    const textItems = [
      'Short heading',
      'A slightly longer paragraph describing the design process.',
    ]
    const delay = projectEl.textDelay(textItems)
    expect(delay).toBeGreaterThanOrEqual(1)
    expect(delay).toBeLessThanOrEqual(22)
  })

  test('textOffset returns cumulative character offset for staggered entry', () => {
    const textItems = ['First block', 'Second block follows after first block finishes.']
    const offset0 = projectEl.textOffset(textItems, 0)
    const offset1 = projectEl.textOffset(textItems, 1)
    expect(offset0).toBe(0)
    expect(offset1).toBeGreaterThan(0)
  })

  test('renders custom-carousel elements for image sections', () => {
    projectEl.translations = {
      title: 'Gallery Project',
      folder: 'gallery/',
      cover: { src: 'cover', size: [1920, 1080] },
      sections: [
        [
          ['Description paragraph 1'],
          [
            { src: 'slide1', size: [1920, 1080], label: 'Slide 1' },
            { src: 'slide2', size: [1920, 1080], label: 'Slide 2' },
          ],
        ],
      ],
    }
    projectEl._updateDom()
    projectEl._bindCarousels()

    const carousel = projectEl.shadowRoot.querySelector(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    expect(carousel).not.toBeNull()
    expect(carousel.items.length).toBe(2)
  })

  test('renders media-mosaic elements for irregular-height sections', () => {
    projectEl.translations = {
      title: 'Mixed Gallery',
      folder: 'gallery/',
      cover: { src: 'cover', size: [1920, 1080] },
      sections: [
        [
          [
            { src: 'wide', size: [1920, 1080], label: 'Wide shot' },
            { src: 'tall', size: [900, 1800], label: 'Tall shot' },
          ],
        ],
      ],
    }
    projectEl._updateDom()
    projectEl._bindCarousels()

    const mosaic = projectEl.shadowRoot.querySelector(COMPONENT_TAGS.MEDIA_MOSAIC)
    const carousel = projectEl.shadowRoot.querySelector(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    expect(mosaic).not.toBeNull()
    expect(carousel).toBeNull()
    expect(mosaic.items.length).toBe(2)
  })

  test('keeps custom-carousel for uniform-height sections', () => {
    projectEl.translations = {
      title: 'Uniform Gallery',
      folder: 'gallery/',
      cover: { src: 'cover', size: [1920, 1080] },
      sections: [
        [
          [
            { src: 'a', size: [1920, 1080], label: 'A' },
            { src: 'b', size: [1600, 900], label: 'B' },
            { src: 'c', size: [1280, 720], label: 'C' },
          ],
        ],
      ],
    }
    projectEl._updateDom()

    expect(projectEl.shadowRoot.querySelector(COMPONENT_TAGS.MEDIA_MOSAIC)).toBeNull()
    expect(projectEl.shadowRoot.querySelector(COMPONENT_TAGS.CUSTOM_CAROUSEL)).not.toBeNull()
  })

  test('isMosaicGroup reports the irregular-heights decision', () => {
    expect(
      projectEl.isMosaicGroup([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [900, 1800] },
      ])
    ).toBe(true)
    expect(
      projectEl.isMosaicGroup([
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1600, 900] },
      ])
    ).toBe(false)
    expect(projectEl.isMosaicGroup([{ src: 'a', size: [1920, 1080] }])).toBe(false)
    expect(projectEl.isMosaicGroup(null)).toBe(false)
    expect(projectEl.isMosaicGroup([{ src: 'a' }, { src: 'b' }])).toBe(false)
    // A media taller than 2560px vetoes the mosaic wall so tall scrolls stay in carousel mode.
    expect(
      projectEl.isMosaicGroup([
        { src: 'a', size: [1920, 5996] },
        { src: 'b', size: [1920, 4318] },
      ])
    ).toBe(false)
  })

  test('sectionMosaicHeight reserves a packed estimate for mosaic sections', () => {
    const mosaicSection = [
      [
        { src: 'wide', size: [2400, 1200] },
        { src: 'tall', size: [900, 1800] },
      ],
    ]
    const carouselSection = [
      [
        { src: 'a', size: [1920, 1080] },
        { src: 'b', size: [1600, 900] },
      ],
    ]
    expect(projectEl.sectionMosaicHeight(mosaicSection)).toMatch(/^\d+px$/)
    expect(projectEl.sectionMosaicHeight(carouselSection)).toBe('')
    expect(projectEl.sectionMosaicHeight([['text only']])).toBe('')
  })

  test('a11y headings derive from section text; carousels pair ordinal + lead label', () => {
    projectEl.translations = {
      title: 'Labeled Gallery',
      folder: 'gallery/',
      sections: [
        [
          ['Joining the studio marked the first chapter of this build.'],
          [{ src: 'slide1', size: [1, 1], label: 'Brand overview carousel' }],
        ],
        [[{ src: 'slide2', size: [1, 1], label: 'Second gallery carousel' }]],
      ],
    }
    projectEl._updateDom()

    const heads = [...projectEl.shadowRoot.querySelectorAll('h2, h3')].map((h) =>
      h.textContent.trim()
    )

    expect(heads.some((h) => h.startsWith('Joining the studio'))).toBe(true)
    expect(heads).toContain('Carousel 1 — Brand overview carousel')
    expect(heads).toContain('Carousel 2 — Second gallery carousel')
  })

  test('a11y headings fall back to localized ordinals when content yields no lead', () => {
    projectEl.translations = {
      title: 'Unlabeled Gallery',
      folder: 'gallery/',
      sections: [
        [[''], [{ src: 'slide1', size: [1, 1] }]],
        [[{ src: 'media-only', size: [1, 1] }]],
      ],
    }
    projectEl._updateDom()

    const heads = [...projectEl.shadowRoot.querySelectorAll('h2, h3')].map((h) =>
      h.textContent.trim()
    )

    expect(heads.length).toBeGreaterThanOrEqual(3)
    expect(heads.every((h) => h.length > 0)).toBe(true)
  })

  test('renders portfolio-related component at bottom of article', () => {
    const related = projectEl.shadowRoot.querySelector(S.PORTFOLIO_RELATED)
    expect(related).not.toBeNull()
  })

  test('includes dialog.modal-above for fullscreen lightbox preview', () => {
    const modalDialog = projectEl.shadowRoot.querySelector(`dialog.${MODAL_CLASSES.MODAL_ABOVE}`)
    expect(modalDialog).not.toBeNull()
    expect(modalDialog.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('Media preview')
  })

  // ─── SCSS structural assertions ───────────────────────────────────────────
  test('internals.scss defines .internal-main with flex centering and themed background', () => {
    expect(SCSS.internals).toMatch(/&-main\s*\{[\s\S]*?display:\s*flex/)
    expect(SCSS.internals).toMatch(/&-main\s*\{[\s\S]*?align-items:\s*center/)
    expect(SCSS.internals).toMatch(/&-main\s*\{[\s\S]*?justify-content:\s*center/)
    expect(SCSS.internals).toMatch(/&-main\s*\{[\s\S]*?background-color:\s*var\(--bg-secondary\)/)
  })

  test('internals.scss does not pin description blocks to the carousel strip height', () => {
    // The --carousel-item-height min-height on &-description used to stretch
    // paragraph blocks to ~70dvh — text now sizes to its own copy.
    const desc = SCSS.internals.match(/&-description\s*\{[\s\S]*?\n\s*\}/)

    expect(desc).not.toBeNull()
    expect(desc[0]).not.toMatch(/min-height/)
  })

  test('internals.scss progressive image styles define blur on thumb and opacity transition on high-res', () => {
    // The thumb blur compiles to 12px via to-rem($space-lg - $space-3xs) —
    // assert the token mechanism, never the literal px (zero-hardcoding).
    expect(SCSS.internals).toMatch(/--thumb[\s\S]*?filter:\s*blur\(to-rem\(/)
    expect(SCSS.internals).toMatch(/--high[\s\S]*?opacity:\s*0/)
    expect(SCSS.internals).toMatch(/render-media--loaded[\s\S]*?opacity:\s*1/)
  })
})
