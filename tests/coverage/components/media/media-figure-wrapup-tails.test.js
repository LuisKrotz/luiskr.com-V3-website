/**
 * @file media-figure-wrapup-tails.test.js
 * @description Coverage tails for media/figure — two arms the mount-flow
 * tails can't reach: load.ts's refreshManifestMedia longdesc stamps
 * (render binds longdesc eagerly, so the live-patch only stamps when
 * the attribute is absent — an unstamp img exercises the write), and
 * video.ts's play()-rejection catch arm (happy-dom's <video>.play is a
 * plain stub, so a rejecting thenable must be injected).
 */
import { describe, test, expect, jest } from '@jest/globals'

import '@website/components/media/MediaFigure.js'
import { refreshManifestMedia } from '@website/components/media/figure/load.js'
import { playVideo, syncVideoPlayback } from '@website/components/media/figure/video.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'

/** Seeded bucket key — the manifest proves the derived thumb + longdesc. */
const STEM = 'wrapup'

/** Proven localized longdesc URL the refresh re-resolves. */
const LONGDESC_URL = `${CDN_URLS.CDN_BASE}${STEM}${MEDIA.LONGDESC_SUFFIX}${MEDIA.LONGDESC_EXT}`

/** Shadow query for the painted thumb layer. */
const thumbEl = (fig) => fig.shadowRoot.querySelector(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)

/** Shadow query for the deferred high layer. */
const highEl = (fig) => fig.shadowRoot.querySelector(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

describe('media-figure wrapup tails', () => {
  test('the refresh stamps longdesc onto layers that lost the attribute', async () => {
    // Manifest lands BEFORE the mount so the render emits the proven
    // matrix — the layers carry longdesc eagerly, which is why the live
    // patch's stamps stay cold in every mount-flow tail.
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        `${STEM}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`,
        `${STEM}${MEDIA.LONGDESC_SUFFIX}${MEDIA.LONGDESC_EXT}`,
        `${STEM}${MEDIA.VIDEO_THUMB_EXT}`,
      ],
    }))

    try {
      await initMediaManifest()
    } finally {
      globalThis.fetch = realFetch
    }

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, STEM)
    document.body.appendChild(fig)

    const thumb = thumbEl(fig)
    const high = highEl(fig)

    expect(thumb.getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)
    expect(high.getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)

    // Attribute-less layers — the refresh's getAttribute guard now takes
    // its absent arm and stamps the resolved URL in place.
    thumb.removeAttribute(MEDIA_ATTRS.LONGDESC)
    high.removeAttribute(MEDIA_ATTRS.LONGDESC)

    refreshManifestMedia(fig)

    expect(thumb.getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)
    expect(high.getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)

    fig.remove()
  })

  test('a rejected play() is swallowed by the catch arm', () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, STEM)
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    document.body.appendChild(fig)

    const vid = fig.shadowRoot.querySelector(HTML_TAGS.VIDEO)

    // happy-dom's play() returns undefined; a real rejection (autoplay
    // policy denial) is the arm the chain exists for.
    vid.play = jest.fn(() => Promise.reject(new Error('denied')))

    expect(() => playVideo(fig, vid)).not.toThrow()
    expect(vid.play).toHaveBeenCalled()

    fig.remove()
  })

  test('a hero video renders its poster eagerly and mounts cleanly', async () => {
    // isHeroItem stamps initialPoster into the markup — the mount-time
    // needsPoster check then reads vid.poster as already-truthy (the
    // lazy-arm arm). The file's shared manifest already proves the
    // video-thumb key from the first test's seed. happy-dom's poster
    // IDL is a getter-only stub, so the truthy state rides a prototype
    // getter (the stubPaused pattern the playback tails use).
    const proto = Object.getPrototypeOf(document.createElement(HTML_TAGS.VIDEO))
    const descriptor = Object.getOwnPropertyDescriptor(proto, MEDIA_ATTRS.POSTER)

    Object.defineProperty(proto, MEDIA_ATTRS.POSTER, {
      get: () => 'armed',
      configurable: true,
    })

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, STEM)
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    fig.setAttribute(COMMON_ATTRS.CLASSES, INTERNAL_CLASSES.INTERNAL_MAIN_ITEM)
    document.body.appendChild(fig)

    const vid = fig.shadowRoot.querySelector(HTML_TAGS.VIDEO)

    expect(vid.getAttribute(MEDIA_ATTRS.POSTER)).toBe(
      `${CDN_URLS.CDN_BASE}${STEM}${MEDIA.VIDEO_THUMB_EXT}`
    )

    fig.remove()

    if (descriptor) {
      Object.defineProperty(proto, MEDIA_ATTRS.POSTER, descriptor)
    } else {
      delete proto[MEDIA_ATTRS.POSTER]
    }
  })

  test('a video with no proven poster mounts with needsPoster falsy', () => {
    // The latched manifest proves only this file's seeded keys — a stem
    // absent from it resolves poster='' on every tier, covering the
    // mount's posterless arm.
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'unproven-stem')
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    document.body.appendChild(fig)

    const vid = fig.shadowRoot.querySelector(HTML_TAGS.VIDEO)

    expect(vid.getAttribute(MEDIA_ATTRS.POSTER) || ATTR_VALUES.EMPTY).toBe(ATTR_VALUES.EMPTY)

    fig.remove()
  })

  test('a wide-media video resolves the scaled poster tier on intersect', async () => {
    // mediaWidth ≥ 2× the render box flips _scaledVideo true, so the
    // observer's poster attach reads the [1] scaled rung — the arm only
    // fires inside the IntersectionObserver callback, which the shared
    // mock dispatches ~10ms after observe().
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, STEM)
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    fig.setAttribute(MEDIA_ATTRS.WIDTH, '4096')
    document.body.appendChild(fig)

    expect(fig._scaledVideo).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 30))

    const vid = fig.shadowRoot.querySelector(HTML_TAGS.VIDEO)

    expect(vid.getAttribute(MEDIA_ATTRS.POSTER)).toBe(
      `${CDN_URLS.CDN_BASE}${STEM}${MEDIA.VIDEO_THUMB_EXT}`
    )

    fig.remove()
  })

  test('syncVideoPlayback swallows a rejected autoplay resume', () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, STEM)
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    document.body.appendChild(fig)

    const vid = fig.shadowRoot.querySelector(HTML_TAGS.VIDEO)

    // Autoplay on, overlay closed, intersecting, unpaused-capable — the
    // else-if arm resumes playback; the rejection hits the bare catch.
    fig.isIntersecting = true
    vid.play = jest.fn(() => Promise.reject(new Error('denied')))

    expect(() => syncVideoPlayback(fig)).not.toThrow()
    expect(vid.play).toHaveBeenCalled()

    fig.isIntersecting = false
    fig.remove()
  })
})
