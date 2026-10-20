/**
 * @file media-load.ts
 * @description Media URL matrix + progressive loading for <media-figure>:
 * CDN variant resolution (poster/mp4 tiers, thumb vs Q50 high-res), the
 * zero-CLS SVG placeholder data-URI, and the detached-preload swap that
 * fades the high-res image in over the thumb.
 */

import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { IMAGE_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { mediaKeyExists, mediaManifestReady } from '@core/utils/media/manifest.js'
import { encodeMediaUrl } from '@core/utils/media.js'
import { svgPlaceholder } from '@core/utils/dom.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import type { MediaFigure } from '../MediaFigure.js'

/**
 * Builds the media's CDN URL matrix on init: [poster, webm, mp4] per tier
 * for videos (full size + VIDEO_SCALE'd fallback — the browser walks the
 * <source> list until one resolves, so webm-first means "use webm when it
 * exists, mp4 otherwise"), or the thumb URL for images.
 */
export function resolveMediaSources(fig: MediaFigure): void {
  if (fig.classes) {
    fig.classes.split(/\s+/).forEach((cls) => {
      if (cls) fig.classList.add(cls)
    })
  }

  const storage = store.getters.getStorage()

  if (fig.isVideo) {
    // Encoded at the base so every derived poster/webm/mp4 URL lands in
    // attributes already emission-safe (bucket keys may carry spaces).
    const base = encodeMediaUrl(storage + fig.mediaSrc)

    const urls = [
      [base + MEDIA.VIDEO_THUMB_EXT, base + MEDIA.WEBM_EXT, base + MEDIA.VIDEO_EXT],
      [
        base + MEDIA.VIDEO_SCALE + MEDIA.VIDEO_THUMB_EXT,
        base + MEDIA.VIDEO_SCALE + MEDIA.WEBM_EXT,
        base + MEDIA.VIDEO_SCALE + MEDIA.VIDEO_EXT,
      ],
    ]

    // Derived variants (poster frame, webm transcodes) are offered only
    // when the bucket manifest can't prove them missing — a known-absent
    // key is a doomed request whose XML 404 trips CORB and a <source> that
    // can never resolve. Unknown ⇒ emit; the <video> source walk degrades
    // gracefully, the poster just no-paints.
    const keepUrl = (url: string): string =>
      mediaManifestReady() && !mediaKeyExists(url) ? ATTR_VALUES.EMPTY : url

    fig.poster = urls.map((a) => keepUrl(a[0]))

    fig.videoWebm = urls.map((a) => keepUrl(a[1]))

    fig.video = urls.map((a) => a[2])
  } else {
    fig.thumbSrc = encodeMediaUrl(
      storage + fig.mediaSrc + MEDIA.MOZ + MEDIA.THUMB_SUFFIX + MEDIA.EXT
    )
  }
}

/**
 * Inline SVG placeholder — a URL-encoded empty <svg> carrying the media's
 * real width/height (definite intrinsic size) plus the viewBox aspect.
 * The width/height attrs matter: a viewBox-only SVG is intrinsic-ratio-only
 * and the <img> would collapse to the ~300×150 default replaced size under
 * `width:auto`, so carousel placeholders keep their natural box before any
 * bytes arrive (zero-CLS without shipping a real image).
 */
export function mediaPlaceholder(w: number, h: number): string {
  return svgPlaceholder(w, h)
}

/**
 * Thumb → high-res swap. A detached Image preloads the Q50 variant —
 * webp first, jpg on 404 (the "if webp exists" check is the request
 * itself, no manifest round-trip); on load the visible element swaps src
 * + gets the loaded class (the CSS crossfade) and the thumb hides. The
 * 4096²-pixel budget gates the GPU texture upload only — oversized
 * sources still fetch and decode (the browser owns that memory), so a
 * big file can never pin its card on the blurred thumb.
 * Errors mark loaded anyway — a broken image must not pin the skeleton
 * shimmer forever.
 */
export async function loadHighRes(fig: MediaFigure): Promise<void> {
  if (fig.isVideo || fig.isLoaded) return

  const height = fig.mediaHeight || 0

  const width = fig.mediaWidth || 0

  // The 4096² budget guards the GPU texture upload, not the fetch —
  // refusing to load above it used to leave oversized sources pinned on
  // the blurred thumb forever ("low-res never loads"). The browser
  // decodes the image regardless; only the GPU bitmap upload would still
  // be unbounded, so the upload alone stays gated.
  const overBudget = height * width > IMAGE_DIMENSIONS.MAX_DECODE_PIXELS

  const storage = store.getters.getStorage()
  const base = encodeMediaUrl(storage + fig.mediaSrc + MEDIA.MOZ + MEDIA.Q50)
  const jpgUrl = base + MEDIA.EXT
  const webpUrl = base + MEDIA.WEBP_EXT

  // Manifest says "no webp" ⇒ skip the doomed probe and start on the
  // original; unknown ⇒ probe webp first (the request IS the check).
  let targetUrl = mediaManifestReady() && !mediaKeyExists(webpUrl) ? jpgUrl : webpUrl

  const highEl = fig.$<HTMLImageElement>(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

  const finish = () => {
    fig.isLoaded = true
    // Publish only the confirmed URL — assigning highResSrc earlier would
    // let a mid-flight _updateDom bind a 404 webp into the visible img.
    fig.highResSrc = targetUrl
    fig.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)

    if (highEl) {
      highEl.src = targetUrl

      highEl.classList.add(MEDIA_CLASSES.RENDER_MEDIA_LOADED)

      const thumbEl = fig.$<HTMLElement>(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)

      if (thumbEl) {
        thumbEl.style.display = ATTR_VALUES.NONE
      }
    } else if (fig._isMounted) {
      fig._updateDom()
    }
  }

  const ImageClass: typeof Image | null =
    typeof window !== TYPE_STRINGS.UNDEFINED && window.Image
      ? window.Image
      : typeof Image !== TYPE_STRINGS.UNDEFINED
        ? Image
        : null

  if (!ImageClass) {
    targetUrl = jpgUrl
    finish()

    return
  }

  const img = new ImageClass()

  img.src = targetUrl

  img.onload = () => {
    if (!overBudget) {
      gpuAccel.processTextureGPU(img, fig.displayWidth, fig.displayHeight)
    }

    finish()
  }

  img.onerror = () => {
    if (img.src !== jpgUrl) {
      // No webp sibling on the bucket — fall back to the jpg original.
      targetUrl = jpgUrl
      img.src = jpgUrl

      return
    }

    fig.isLoaded = true
    fig.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)
  }
}
