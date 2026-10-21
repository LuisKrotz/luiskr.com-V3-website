/**
 * @file media-load.ts
 * @description Media URL matrix + progressive loading for <media-figure>:
 * CDN variant resolution (poster/mp4 tiers, LQIP thumb vs the ascending
 * quality ladder), the zero-CLS SVG placeholder data-URI, and the
 * detached-preload climb that fades each confirmed quality rung in over
 * the last until the highest available tier is reached.
 */

import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { IMAGE_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import {
  mediaKeyExists,
  mediaManifestReady,
  mediaRungs,
  type CoverRung,
} from '@core/utils/media/manifest.js'
import { encodeMediaUrl, webpSibling } from '@core/utils/media.js'
import { svgPlaceholder } from '@core/utils/dom.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import { upscaleImage2x } from '@core/utils/ml/super-res.js'
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
 * Thumb → high-res quality ladder. Detached Image probes climb the
 * manifest-proven rungs (q50 → q75 → raw original → uncompressed) — webp
 * first, jpg on 404 (the "if webp exists" check is the request itself, no
 * manifest round-trip); every confirmed tier republishes the same high
 * layer's src, so the painted box upgrades in place and can never tear.
 * The 4096²-pixel budget gates the GPU texture upload only — oversized
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
  const stem = encodeMediaUrl(storage + fig.mediaSrc)

  // Manifest-proven ascending rungs; when the manifest can't prove a
  // single tier (absent, or the media was never converted) fall back to
  // the historic blind Q50 probe — the request itself is the check.
  const ladder: CoverRung[] = mediaRungs(stem)

  if (!ladder.length) {
    const q50 = encodeMediaUrl(`${stem}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)

    ladder.push({
      jpg: q50,
      webp: mediaManifestReady() ? ATTR_VALUES.EMPTY : webpSibling(q50),
    })
  }

  /** Highest confirmed probe — the bitmap handed to the GPU at chain end. */
  let best: HTMLImageElement | null = null

  /**
   * Publishes a confirmed tier into the visible high layer — the probe
   * already holds the bytes. The tier mounts as a NEW img stacked over
   * the painted one (reassigning the live img.src would blank the box
   * while the upgrade re-decodes — the rung blink); the clone mounts
   * empty, paints once its own `load` fires, and retires every layer
   * underneath in the same task, so the swap is atomic per frame.
   * Re-queries the topmost layer each rung because _updateDom rebuilds
   * the shadow DOM wholesale between steps.
   */
  const publish = (url: string): void => {
    fig.isLoaded = true
    // Publish only the confirmed URL — assigning highResSrc earlier would
    // let a mid-flight _updateDom bind a 404 webp into the visible img.
    fig.highResSrc = url
    fig.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)

    const highs = fig.$$<HTMLImageElement>(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

    const highEl = highs[highs.length - 1]

    if (highEl) {
      const successor = highEl.cloneNode(false) as HTMLImageElement

      successor.addEventListener(
        WINDOW_EVENTS.LOAD,
        () => {
          // Detached by a mid-flight _updateDom → the rebuilt DOM already
          // emits fig.highResSrc; a stray layer must never prune it.
          if (!successor.isConnected) return

          // Retire the layers UNDER the successor only — the ladder climbs
          // serially but a slower clone can still be painting below while
          // the next probe already resolved; index order in the live DOM
          // is the stacking order, so removing anything at a lower index
          // is safe, removing a NEWER layer would strand the climb.
          const layers = fig.$$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)
          const topIdx = layers.indexOf(successor)

          layers.forEach((el, i) => {
            if (i < topIdx) el.remove()
          })

          // Now that a real bitmap occupies the box the LQIP can leave —
          // hiding it any earlier blanks the frame while the clone
          // finishes its first paint.
          const thumbEl = fig.$<HTMLElement>(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)

          if (thumbEl) {
            thumbEl.style.display = ATTR_VALUES.NONE
          }
        },
        { once: true }
      )

      successor.addEventListener(
        WINDOW_EVENTS.ERROR,
        () => {
          successor.remove()
        },
        { once: true }
      )

      highEl.after(successor)

      successor.src = url

      successor.classList.add(MEDIA_CLASSES.RENDER_MEDIA_LOADED)
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
    publish(ladder[ladder.length - 1].jpg)

    return
  }

  /**
   * Probes rung `i` through a detached Image; on confirm the tier paints
   * and the climb continues, stopping when the highest proven quality is
   * reached. A proven-but-dead webp retries once as jpg; a dead jpg just
   * skips to the next rung — the best confirmed tier stays painted.
   */
  const climb = (i: number): void => {
    if (i >= ladder.length) {
      fig.isLoaded = true
      fig.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)

      if (best && !overBudget) {
        gpuAccel.processTextureGPU(best, fig.displayWidth, fig.displayHeight)

        // ML super-resolution — when the best confirmed rung still
        // under-resolves the display box, a 2× ORT pass (WebNN → WebGPU
        // → wasm) re-uploads a sharper bitmap into the same texture
        // layer. Enhancement never blocks the climb: it lands whenever
        // the EP answers, and a null result changes nothing.
        if (best.naturalWidth && best.naturalWidth < fig.displayWidth) {
          void upscaleImage2x(best).then((bmp) => {
            if (bmp) gpuAccel.processBitmapGPU(bmp, fig.displayWidth, fig.displayHeight)
          })
        }
      }

      return
    }

    const rung = ladder[i]
    const probe = new ImageClass()

    let target = rung.webp || rung.jpg

    probe.onload = () => {
      best = probe

      publish(target)
      climb(i + 1)
    }

    probe.onerror = () => {
      // A manifest-proven webp can still fail to decode — retry the jpg
      // once; a dead jpg leaves the painted rung standing and climbs on.
      if (target !== rung.jpg) {
        target = rung.jpg
        probe.src = target

        return
      }

      climb(i + 1)
    }

    probe.src = target
  }

  climb(0)
}
