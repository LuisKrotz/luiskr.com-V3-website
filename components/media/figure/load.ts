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
import { ANIMATION_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
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
import { ladderCeiling, smallMediaBox } from '@core/utils/media/policy.js'
import { svgPlaceholder } from '@core/utils/dom.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import { wasmImageDecoder } from '@core/utils/wasm/wasm-image-decoder.js'
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
 * CDN warm ordering — fires a detached fetch of the FIRST ladder rung
 * while the figure is still ~600px outside the viewport. The request
 * itself warms the CDN edge and the browser HTTP cache (decodeImageWASM
 * replays it via `force-cache`), so the 100px-margin climb starts on a
 * hot rung instead of a cold one. Warms only the entry rung — the climb
 * ascends serially, so warming the top rung early would fight the low
 * rung's fetch for bandwidth and warm a resource that may never publish.
 * Never publishes, never marks loaded — pure network warm.
 */
export function warmFirstRung(fig: MediaFigure): void {
  if (fig.isVideo || fig.isLoaded || fig.warmed) return

  fig.warmed = true

  const storage = store.getters.getStorage()
  const stem = encodeMediaUrl(storage + fig.mediaSrc)

  const ladder = figureLadder(stem, fig.clientWidth)
  const first = ladder[0]

  const url = first
    ? first.webp || first.jpg
    : encodeMediaUrl(`${stem}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)

  // Same constructor resolution as the climb — window.Image first so
  // test/DOM-realms that stub it stay authoritative.
  const ImageCtor = typeof window !== TYPE_STRINGS.UNDEFINED && window.Image ? window.Image : Image

  const probe = new ImageCtor()

  probe.src = url
}

/**
 * The ascending rung ladder a figure climbs — the 768px-wide
 * `{stem}-mobile` derivative stem when the rendered box is ≤768 CSS px
 * and the manifest proves mobile tiers exist, else the full-width stem.
 * Every mobile rung is a fraction of its full-width twin's bytes and a
 * box that small cannot resolve the difference — Lighthouse counts the
 * full-width climb as pure waste.
 * @param stem Emission-encoded extensionless media stem.
 * @param boxWidthCssPx Rendered figure width (0 = pre-layout → full stem).
 * @returns Proven ascending rungs — may be empty (manifest absent).
 */
function figureLadder(stem: string, boxWidthCssPx: number): CoverRung[] {
  if (smallMediaBox(boxWidthCssPx)) {
    const mobile = mediaRungs(`${stem}${MEDIA.MOBILE_SUFFIX}`)

    if (mobile.length) return mobile
  }

  return mediaRungs(stem)
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
  const ladder: CoverRung[] = figureLadder(stem, fig.clientWidth)

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
          /**
           * Retires every layer UNDER the successor once it is fully
           * painted AND fully opaque — never at load. Removing mid-fade
           * (or before first paint) leaves a translucent rung over an
           * empty figure box for the transition's remainder: the visible
           * quality-swap blink. transitionend fires at fade completion;
           * the timeout covers reduced-motion/no-transition environments
           * where the event never lands. Index order is recomputed at
           * retire time so a newer layer mounted above is never pruned.
           */
          let retired = false

          const retire = () => {
            // Detached by a mid-flight _updateDom → the rebuilt DOM already
            // emits fig.highResSrc; a stray layer must never prune it.
            if (retired || !successor.isConnected) return

            retired = true

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
          }

          const onFadeEnd = () => {
            successor.removeEventListener(ANIMATION_EVENTS.TRANSITIONEND, onFadeEnd)

            retire()
          }

          successor.addEventListener(ANIMATION_EVENTS.TRANSITIONEND, onFadeEnd)

          setTimeout(retire, ANIMATION_DURATIONS.MEDIA_LAYER_RETIRE)
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

  // Budget ceiling — connection tier + the rendered box width bound how
  // high the climb may go; rungs past it (original/uncompressed) can
  // never be resolved by this card and are pure transfer waste.
  const ceiling = ladderCeiling(ladder.length, fig.clientWidth)

  if (!ImageClass) {
    publish(ladder[Math.min(ladder.length - 1, ceiling)].jpg)

    return
  }

  /**
   * Probes rung `i` through a detached Image; on confirm the tier paints
   * and the climb continues, stopping when the highest proven quality is
   * reached. A proven-but-dead webp retries once as jpg; a dead jpg just
   * skips to the next rung — the best confirmed tier stays painted.
   */
  const climb = (i: number): void => {
    if (i >= ladder.length || i > ceiling) {
      fig.isLoaded = true
      fig.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)

      if (best && !overBudget) {
        // WASM decode first — the worker-side createImageBitmap reuses
        // the HTTP cache (no re-download), resizes on the GPU during
        // decompression, and uploads zero-copy via processBitmapGPU
        // inside decodeImageWASM itself. A null result falls back to
        // the classic img-element texture upload.
        const bestUrl = best.currentSrc || best.src

        void wasmImageDecoder
          .decodeImageWASM(bestUrl, fig.displayWidth, fig.displayHeight)
          .then((bitmap) => {
            const src: ImageBitmap | HTMLImageElement = bitmap ?? (best as HTMLImageElement)

            if (!bitmap) {
              gpuAccel.processTextureGPU(
                src as HTMLImageElement,
                fig.displayWidth,
                fig.displayHeight
              )
            }

            // ML super-resolution — when the best confirmed rung still
            // under-resolves the display box, a 2× ORT pass (WebNN →
            // WebGPU → wasm) re-uploads a sharper bitmap into the same
            // texture layer. Enhancement never blocks the climb: it
            // lands whenever the EP answers, and a null result changes
            // nothing. The decoded bitmap is preferred as the source —
            // its dimensions are the real pixel count, and drawImage
            // accepts it directly.
            const srcW = bitmap ? bitmap.width : (src as HTMLImageElement).naturalWidth

            if (srcW && srcW < fig.displayWidth) {
              void upscaleImage2x(src).then((bmp) => {
                if (bmp) gpuAccel.processBitmapGPU(bmp, fig.displayWidth, fig.displayHeight)
              })
            }
          })
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
