/**
 * @file media-figure-manifest-refresh-tails.test.js
 * @description Coverage tail for refreshManifestMedia — the onMediaManifest
 * subscriber that re-resolves a mounted figure's URL matrix and patches the
 * LIVE shadow DOM (never an _updateDom, which would orphan the video's
 * scoped listeners, pooled observer, and already-attached <source> nodes).
 * The pre-arrival mounts exercise the patch path (track attach, poster
 * stamp, thumb swap, longdesc stamp); the post-arrival mounts exercise the
 * skip arms (tracks already in markup, src already proven, hero poster
 * pre-stamped, scaled tier pick, unmanifested passthrough).
 */
import { jest } from '@jest/globals'
import '@website/components/media/MediaFigure.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'

describe('media-figure manifest refresh', () => {
  const STEM_V = 'vref'
  const STEM_I = 'iref'
  const STEM_NONE = 'unseeded'
  const POSTER_URL = `${CDN_URLS.CDN_BASE}${STEM_V}${MEDIA.VIDEO_THUMB_EXT}`
  const THUMB_URL = `${CDN_URLS.CDN_BASE}${STEM_I}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`
  const LONGDESC_URL = `${CDN_URLS.CDN_BASE}${STEM_I}${MEDIA.LONGDESC_SUFFIX}${MEDIA.LONGDESC_EXT}`

  const mkFigure = (src, isVideo, extra = {}) => {
    const el = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    el.setAttribute(MEDIA_ATTRS.SRC, src)

    if (isVideo) el.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v)

    return el
  }

  const videoEl = (fig) => fig.shadowRoot.querySelector(HTML_TAGS.VIDEO)
  const thumbEl = (fig) => fig.shadowRoot.querySelector(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)
  const highEl = (fig) => fig.shadowRoot.querySelector(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)
  const descTracks = (vid) =>
    vid.querySelectorAll(`${MEDIA_ATTRS.TRACK}[${MEDIA_ATTRS.KIND}="${MEDIA_ATTRS.DESCRIPTIONS}"]`)
  const captionsTrack = (vid) =>
    vid.querySelector(`${MEDIA_ATTRS.TRACK}[${MEDIA_ATTRS.KIND}="${MEDIA_ATTRS.CAPTIONS}"]`)

  test('manifest arrival patches mounted figures in place', async () => {
    // Mount while the manifest is still in flight — the figures emit
    // originals-only markup (no under-layer, no poster, no description
    // tracks, original thumb) and subscribe for the arrival refresh.
    const vidArrive = mkFigure(STEM_V, true)
    const vidBare = mkFigure(STEM_V, true)
    const imgArrive = mkFigure(STEM_I, false)

    document.body.appendChild(vidArrive)
    document.body.appendChild(vidBare)
    document.body.appendChild(imgArrive)

    // The no-captions placeholder is pulled from this copy pre-arrival so
    // the refresh takes the placeholderTrack-absent arm — the attach must
    // still land without anything to de-default.
    captionsTrack(videoEl(vidBare)).remove()

    expect(thumbEl(vidArrive)).toBeNull()
    expect(videoEl(vidArrive).getAttribute(MEDIA_ATTRS.POSTER)).toBe(ATTR_VALUES.EMPTY)
    expect(descTracks(videoEl(vidArrive)).length).toBe(0)
    expect(thumbEl(imgArrive).src.endsWith(`${STEM_I}${MEDIA.EXT}`)).toBe(true)

    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        `${STEM_V}${MEDIA.VIDEO_THUMB_EXT}`,
        `${STEM_V}${MEDIA.WEBM_EXT}`,
        `${STEM_V}${MEDIA.VIDEO_SCALE}${MEDIA.WEBM_EXT}`,
        `${STEM_V}${MEDIA.VIDEO_SCALE}${MEDIA.VIDEO_EXT}`,
        `${STEM_V}${MEDIA.VTT_EXT}`,
        `${STEM_I}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`,
        `${STEM_I}${MEDIA.LONGDESC_SUFFIX}${MEDIA.LONGDESC_EXT}`,
      ],
    }))

    try {
      await initMediaManifest()
    } finally {
      globalThis.fetch = realFetch
    }

    // Video — the proven poster stamps the live element, the proven
    // descriptions attach as real <track> children, and the placeholder
    // captions yields `default` to the visitor-locale descriptions.
    const v1 = videoEl(vidArrive)

    expect(v1.getAttribute(MEDIA_ATTRS.POSTER)).toBe(POSTER_URL)
    expect(descTracks(v1).length).toBe(vidArrive.descriptionTracks.length)
    expect(descTracks(v1).length).toBeGreaterThan(0)
    expect(captionsTrack(v1).default).toBe(false)

    // No under-layer existed pre-arrival (poster was unproven) — the
    // refresh does not resurrect one; the poster attr carries the frame.
    expect(thumbEl(vidArrive)).toBeNull()

    // Placeholder-absent copy — the attach still lands.
    const v0 = videoEl(vidBare)

    expect(descTracks(v0).length).toBe(vidBare.descriptionTracks.length)

    // Image — the painted thumb swaps to its proven variant and the
    // localized longdesc stamps both image layers.
    expect(thumbEl(imgArrive).src).toBe(THUMB_URL)
    expect(thumbEl(imgArrive).getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)
    expect(highEl(imgArrive).getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)

    vidArrive.remove()
    vidBare.remove()
    imgArrive.remove()
  })

  test('late mounts render proven markup and the refresh stays a no-op', () => {
    // Manifest already latched — first render emits the proven matrix and
    // the subscribe-then-render callback must not double-attach.
    const vidLate = mkFigure(STEM_V, true)

    document.body.appendChild(vidLate)

    const v2 = videoEl(vidLate)

    // Under-layer emitted at render (proven posterSrc arm).
    expect(thumbEl(vidLate).src).toBe(POSTER_URL)

    // Render already emitted the descriptions — the refresh guard keeps
    // the count identical (no duplicate attach).
    expect(descTracks(v2).length).toBe(vidLate.descriptionTracks.length)
    expect(v2.getAttribute(MEDIA_ATTRS.POSTER)).toBe(POSTER_URL)

    vidLate.remove()
  })

  test('hero video keeps its render-stamped poster through the refresh', () => {
    const vidHero = mkFigure(STEM_V, true, {
      [COMMON_ATTRS.CLASSES]: INTERNAL_CLASSES.INTERNAL_MAIN_ITEM,
    })

    document.body.appendChild(vidHero)

    // initialPoster bound the attribute at render — the refresh's
    // `!vid.poster` guard takes its already-set arm.
    expect(videoEl(vidHero).getAttribute(MEDIA_ATTRS.POSTER)).toBe(POSTER_URL)

    vidHero.remove()
  })

  test('scaled-tier video falls back to the base poster pick', () => {
    // 4096 natural width ⇒ prefersScaledVideo picks poster[1]; the scaled
    // poster is deliberately unmanifested so the `|| poster[0]` arm wins.
    const vidScaled = mkFigure(STEM_V, true, { [MEDIA_ATTRS.WIDTH]: '4096' })

    document.body.appendChild(vidScaled)

    expect(vidScaled._scaledVideo).toBe(true)
    expect(thumbEl(vidScaled).src).toBe(POSTER_URL)

    vidScaled.remove()
  })

  test('unmanifested video stays originals-only', () => {
    const vidNone = mkFigure(STEM_NONE, true)

    document.body.appendChild(vidNone)

    // poster '' ⇒ `poster &&` guard arm; no descriptions ⇒ length arm;
    // the base mp4 rides the trusted passthrough.
    expect(vidNone.poster).toEqual([ATTR_VALUES.EMPTY, ATTR_VALUES.EMPTY])
    expect(vidNone.video[0].endsWith(`${STEM_NONE}${MEDIA.VIDEO_EXT}`)).toBe(true)
    expect(vidNone.descriptionTracks.length).toBe(0)
    expect(thumbEl(vidNone)).toBeNull()
    expect(videoEl(vidNone).getAttribute(MEDIA_ATTRS.POSTER)).toBe(ATTR_VALUES.EMPTY)

    vidNone.remove()
  })

  test('late images keep render-stamped attrs; unmanifested omits longdesc', () => {
    const imgLate = mkFigure(STEM_I, false)
    const imgNone = mkFigure(STEM_NONE, false)

    document.body.appendChild(imgLate)
    document.body.appendChild(imgNone)

    // Render already bound the proven thumb + longdesc — the refresh's
    // `!==` and `!getAttribute` guards take their already-set arms.
    expect(thumbEl(imgLate).src).toBe(THUMB_URL)
    expect(thumbEl(imgLate).getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)
    expect(highEl(imgLate).getAttribute(MEDIA_ATTRS.LONGDESC)).toBe(LONGDESC_URL)

    // Unmanifested — thumbSrc fell back to the original and the
    // `fig.longdescUrl` guards stay false on both layers.
    expect(thumbEl(imgNone).src.endsWith(`${STEM_NONE}${MEDIA.EXT}`)).toBe(true)
    expect(thumbEl(imgNone).getAttribute(MEDIA_ATTRS.LONGDESC)).toBeNull()
    expect(highEl(imgNone).getAttribute(MEDIA_ATTRS.LONGDESC)).toBeNull()

    imgLate.remove()
    imgNone.remove()
  })
})
