/**
 * @file custom-carousel-aspect-ratio-patterns.test.js
 * @description Unit tests for CustomCarousel aspect ratio determination (16:9, 21:9, 32:9)
 * and mixed carousel landscape strip-fill slides.
 */

import '@website/components/carousel/CustomCarousel.js'
import {
  determineLandscapeRatio,
  getRatioMultiplier,
  getSmallestPortraitRatio,
  isLandscapeItem,
  isMixedCarousel,
  isPortraitItem,
  setHeightVar,
} from '@website/components/carousel/custom-carousel/sizing.js'
import {
  renderCarousel,
  renderCarouselSlide,
} from '@website/components/carousel/custom-carousel/render.js'
import { CAROUSEL_CLASSES } from '@core/tokens/classes/carousel.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { CAROUSEL_CSS_PROPS } from '@core/tokens/css/carousel.js'

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('CustomCarousel orientation & ratio helpers', () => {
  test('isLandscapeItem detects landscape class, dimension ratio, and null guards', () => {
    expect(isLandscapeItem(null)).toBe(false)

    expect(isLandscapeItem(undefined)).toBe(false)

    expect(isLandscapeItem({ class: STATE_STRINGS.LANDSCAPE })).toBe(true)

    expect(isLandscapeItem({ size: [1920, 1080] })).toBe(true)

    expect(isLandscapeItem({ size: [1080, 1920] })).toBe(false)

    expect(isLandscapeItem({ src: TEST_URLS.A })).toBe(false)
  })

  test('isPortraitItem detects portrait items and guards missing data', () => {
    expect(isPortraitItem(null)).toBe(false)

    expect(isPortraitItem({ class: STATE_STRINGS.LANDSCAPE })).toBe(false)

    expect(isPortraitItem({ size: [1080, 1920] })).toBe(true)

    expect(isPortraitItem({ size: [1920, 1080] })).toBe(false)
  })

  test('isMixedCarousel verifies mixed groups vs uniform groups', () => {
    expect(isMixedCarousel([])).toBe(false)

    expect(isMixedCarousel([{ class: STATE_STRINGS.LANDSCAPE }])).toBe(false)

    const allLandscape = [{ class: STATE_STRINGS.LANDSCAPE }, { size: [1920, 1080] }]

    expect(isMixedCarousel(allLandscape)).toBe(false)

    const allPortrait = [{ size: [1080, 1920] }, { size: [800, 1200] }]

    expect(isMixedCarousel(allPortrait)).toBe(false)

    const mixed = [{ class: STATE_STRINGS.LANDSCAPE, size: [1920, 1080] }, { size: [1080, 1920] }]

    expect(isMixedCarousel(mixed)).toBe(true)
  })

  test('determineLandscapeRatio calculates majority ratio among 16:9, 21:9, and 32:9', () => {
    expect(determineLandscapeRatio([])).toBeNull()

    expect(determineLandscapeRatio([{ size: [1080, 1920] }])).toBeNull()

    const majority16 = [
      { size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
      { size: [1600, 900], class: STATE_STRINGS.LANDSCAPE },
      { size: [2560, 1080], class: STATE_STRINGS.LANDSCAPE },
    ]

    expect(determineLandscapeRatio(majority16)).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_16_9)

    const majority21 = [
      { size: [2560, 1080], class: STATE_STRINGS.LANDSCAPE },
      { size: [3440, 1440], class: STATE_STRINGS.LANDSCAPE },
      { size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
    ]

    expect(determineLandscapeRatio(majority21)).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_21_9)

    const majority32 = [
      { size: [5120, 1440], class: STATE_STRINGS.LANDSCAPE },
      { size: [3840, 1080], class: STATE_STRINGS.LANDSCAPE },
      { size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
    ]

    expect(determineLandscapeRatio(majority32)).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_32_9)

    const noSizes = [{ class: STATE_STRINGS.LANDSCAPE }]

    expect(determineLandscapeRatio(noSizes)).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_16_9)
  })

  test('getRatioMultiplier maps ratio keys to numeric values', () => {
    expect(getRatioMultiplier(CAROUSEL_LAYOUT.ASPECT_RATIO_16_9)).toBe(CAROUSEL_LAYOUT.RATIO_16_9)

    expect(getRatioMultiplier(CAROUSEL_LAYOUT.ASPECT_RATIO_21_9)).toBe(CAROUSEL_LAYOUT.RATIO_21_9)

    expect(getRatioMultiplier(CAROUSEL_LAYOUT.ASPECT_RATIO_32_9)).toBe(CAROUSEL_LAYOUT.RATIO_32_9)

    expect(getRatioMultiplier(null)).toBe(CAROUSEL_LAYOUT.RATIO_16_9)
  })

  test('getSmallestPortraitRatio finds minimum portrait ratio and handles edge cases', () => {
    expect(getSmallestPortraitRatio([])).toBeNull()

    expect(getSmallestPortraitRatio(null)).toBeNull()

    expect(getSmallestPortraitRatio([{ class: STATE_STRINGS.LANDSCAPE }])).toBeNull()

    expect(getSmallestPortraitRatio([{ src: TEST_URLS.A }])).toBeNull()

    const portraits = [{ size: [1080, 1920] }, { size: [800, 1200] }, { size: [1000, 1100] }]

    expect(getSmallestPortraitRatio(portraits)).toBe(1100 / 1000)
  })
})

describe('renderCarouselSlide strip fill', () => {
  test('renders every slide as the same strip-fill item — no mixed-landscape class, no pattern node', () => {
    expect(renderCarouselSlide(null, 'folder/')).toBeNull()

    const normalItem = { src: 'a', size: [800, 600] }

    const normalNode = renderCarouselSlide(normalItem, 'folder/')

    expect(normalNode).toBeDefined()

    const landscapeItem = {
      src: 'b',
      size: [1920, 1080],
      class: STATE_STRINGS.LANDSCAPE,
    }

    const fillNode = renderCarouselSlide(landscapeItem, 'folder/')

    expect(fillNode).toBeDefined()

    // Strip-fill contract — every figure cover-fills the shared strip;
    // no landscape-only class or repetition-pattern backdrop remains.
    expect(fillNode.querySelector('picture')).toBeNull()
  })

  test('scrubs hero-slot classes off the slide figure — the wrapper keeps them', () => {
    const item = {
      src: 'b',
      size: [1920, 1080],
      class: [
        STATE_STRINGS.LANDSCAPE,
        INTERNAL_CLASSES.ZTF_VIDEO,
        INTERNAL_CLASSES.INTERNAL_MAIN_ITEM,
      ].join(CHAR_STRINGS.SPACE_CHAR),
    }

    const node = renderCarouselSlide(item, 'folder/')

    const figure = node.querySelector(COMPONENT_TAGS.MEDIA_FIGURE)

    // The figure can never match the 0,3,0 hero selectors — a slide built
    // from the cover media used to re-inflate to the 70dvh/175dvh caps.
    expect(figure.getAttribute('classes')).toBe(STATE_STRINGS.LANDSCAPE)
    expect(figure.getAttribute('class')).toBe(STATE_STRINGS.LANDSCAPE)

    // The slide wrapper keeps the full CMS list for context selectors.
    expect(node.getAttribute('class')).toContain(INTERNAL_CLASSES.ZTF_VIDEO)
    expect(node.getAttribute('class')).toContain(INTERNAL_CLASSES.INTERNAL_MAIN_ITEM)
  })
})

describe('CustomCarousel aspect ratio classes & height synchronizer', () => {
  test('renderCarousel applies ratio class for majority landscape and mixed class for mixed', () => {
    const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

    document.body.appendChild(el)

    el.configure({
      items: [
        { src: '1', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: '2', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: '3', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
      ],
      folder: 'folder/',
    })

    expect(el.landscapeRatio).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_16_9)

    expect(el.isMixed).toBe(false)

    const dom16 = renderCarousel(el)

    expect(dom16.className).toContain(CAROUSEL_CLASSES.CAROUSEL_RATIO_16_9)

    el.configure({
      items: [
        { src: '1', size: [2560, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: '2', size: [2560, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: '3', size: [2560, 1080], class: STATE_STRINGS.LANDSCAPE },
      ],
      folder: 'folder/',
    })

    expect(el.landscapeRatio).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_21_9)

    const dom21 = renderCarousel(el)

    expect(dom21.className).toContain(CAROUSEL_CLASSES.CAROUSEL_RATIO_21_9)

    el.configure({
      items: [
        { src: '1', size: [5120, 1440], class: STATE_STRINGS.LANDSCAPE },
        { src: '2', size: [5120, 1440], class: STATE_STRINGS.LANDSCAPE },
        { src: '3', size: [5120, 1440], class: STATE_STRINGS.LANDSCAPE },
      ],
      folder: 'folder/',
    })

    expect(el.landscapeRatio).toBe(CAROUSEL_LAYOUT.ASPECT_RATIO_32_9)

    const dom32 = renderCarousel(el)

    expect(dom32.className).toContain(CAROUSEL_CLASSES.CAROUSEL_RATIO_32_9)

    el.configure({
      items: [
        { src: '1', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: '2', size: [1080, 1920] },
        { src: '3', size: [1080, 1920] },
      ],
      folder: 'folder/',
    })

    expect(el.isMixed).toBe(true)

    const domMixed = renderCarousel(el)

    expect(domMixed.className).toContain(CAROUSEL_CLASSES.CAROUSEL_MIXED)

    el.remove()
  })

  test('setHeightVar on mobile applies majority landscape ratio to section height', () => {
    const section = document.createElement(COMMON_ATTRS.SECTION)

    const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

    section.appendChild(el)

    document.body.appendChild(section)

    el.configure({
      items: [
        { src: '1', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: '2', size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
      ],
      folder: 'folder/',
    })

    el.isMobile = true

    el._lastObservedWidth = 360

    Object.defineProperty(el, 'clientWidth', { value: 360, configurable: true })

    setHeightVar(el)

    const expectedHeight = `${Math.round(360 / (16 / 9))}${COMMON_ATTRS.PX}`

    expect(section.style.getPropertyValue(CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT)).toBe(
      expectedHeight
    )

    section.remove()
  })

  test('setHeightVar on mobile with mixed items anchors to smallest portrait height', () => {
    const section = document.createElement(COMMON_ATTRS.SECTION)

    const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

    section.appendChild(el)

    document.body.appendChild(section)

    el.configure({
      items: [
        { src: TEST_URLS.A, size: [1920, 1080], class: STATE_STRINGS.LANDSCAPE },
        { src: TEST_URLS.B, size: [1080, 1920] },
        { src: TEST_URLS.IMG, size: [800, 1000] },
      ],
      folder: TEST_URLS.A,
    })

    el.isMobile = true

    el._lastObservedWidth = 360

    Object.defineProperty(el, 'clientWidth', { value: 360, configurable: true })

    setHeightVar(el)

    const expectedHeight = `${Math.round(360 * (1000 / 800))}${COMMON_ATTRS.PX}`

    expect(section.style.getPropertyValue(CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT)).toBe(
      expectedHeight
    )

    expect(el.style.getPropertyValue(CAROUSEL_CSS_PROPS.CAROUSEL_MEDIA_HEIGHT)).toBe(expectedHeight)

    section.remove()
  })
})
