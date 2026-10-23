/**
 * @file media-video.ts
 * @description Video playback plumbing for <media-figure>: lazy <source>
 * injection when a video first becomes playable, pref-aware play/pause,
 * GPU post-process handoff, and the store-update sync that starts/stops
 * playback on autoplay/reduced-motion changes.
 */

import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import store from '@core/store.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import { prefersScaledVideo, videoAutoplayAllowed } from '@core/utils/media/policy.js'
import type { MediaFigure } from '../MediaFigure.js'
import { VIDEO_DIMENSIONS } from '@core/tokens/media/dimensions.js'

/** Sets the <source> src on a video element when it becomes playable. */
export function ensureVideoSource(fig: MediaFigure, vid: HTMLVideoElement | null): void {
  if (!vid || vid.querySelector(MEDIA_ATTRS.SOURCE)) return

  const append = (src: string, type: string) => {
    if (!src) return

    const el = document.createElement(MEDIA_ATTRS.SOURCE) as HTMLSourceElement

    el.src = src

    el.type = type

    vid.appendChild(el)
  }

  // webm first — the browser walks the list until a source resolves, so
  // a missing webm simply falls through to the mp4 originals. When the
  // rendered box can't resolve the full stream, the scaled (-2x) pair
  // leads instead so a phone never commits to the 4K/1080p download.
  const scaledFirst = prefersScaledVideo(fig.mediaWidth, fig.clientWidth)

  const ordered: Array<[string, string]> = scaledFirst
    ? [
        [fig.videoSrcWebmFallback, MEDIA_ATTRS.VIDEO_WEBM],
        [fig.videoSrcFallback, MEDIA_ATTRS.VIDEO_MP4],
        [fig.videoSrcWebmMain, MEDIA_ATTRS.VIDEO_WEBM],
        [fig.videoSrcMain, MEDIA_ATTRS.VIDEO_MP4],
      ]
    : [
        [fig.videoSrcWebmMain, MEDIA_ATTRS.VIDEO_WEBM],
        [fig.videoSrcWebmFallback, MEDIA_ATTRS.VIDEO_WEBM],
        [fig.videoSrcMain, MEDIA_ATTRS.VIDEO_MP4],
        [fig.videoSrcFallback, MEDIA_ATTRS.VIDEO_MP4],
      ]

  for (const [src, type] of ordered) append(src, type)

  vid.load()
}

/** Starts muted playback honoring reduced-motion/autoplay prefs. */
export function playVideo(fig: MediaFigure, target: HTMLVideoElement | null): void {
  if (
    !store.getters.getReducedMotion() &&
    videoAutoplayAllowed() &&
    store.getters.getVideoAutoplay() &&
    target?.play
  ) {
    fig._ensureVideoSource(target)

    target
      .play()
      .then(() => {
        gpuAccel.processVideoGPU(
          target,
          fig.displayWidth || VIDEO_DIMENSIONS.VIDEO_DEFAULT_WIDTH,
          fig.displayHeight || VIDEO_DIMENSIONS.VIDEO_DEFAULT_HEIGHT
        )
      })
      .catch(() => {})
  }
}

/** Pauses playback (offscreen or pref change). */
export function pauseVideo(fig: MediaFigure, target: HTMLVideoElement | null): void {
  if (!store.getters.getReducedMotion() && target?.pause) {
    target.pause()
  }
}

/**
 * Store change → start/stop playback to match autoplay + visibility.
 * An open expand modal puts the page behind the top layer — background
 * videos must pause (decoding + compositing them under the dialog is
 * pure waste and their frames shimmer through the glass). The modal's
 * own <video> is not a media-figure, so only page figures gate here;
 * on close this sync re-runs and autoplay+visible videos resume.
 */
export function syncVideoPlayback(fig: MediaFigure): void {
  if (!fig.isVideo) return

  const vid = fig.$<HTMLVideoElement>(HTML_TAGS.VIDEO)

  if (!vid) return

  if (!store.getters.getVideoAutoplay() || store.getters.getModal()?.open) {
    if (!vid.paused) {
      vid.pause()
    }
  } else if (
    fig.isIntersecting &&
    vid.paused &&
    !store.getters.getReducedMotion() &&
    videoAutoplayAllowed()
  ) {
    fig._ensureVideoSource(vid)

    vid.play().catch(() => {})
  }
}
