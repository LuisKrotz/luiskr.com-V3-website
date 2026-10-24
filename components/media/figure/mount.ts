/**
 * @file media/media-mount.ts
 * @description Mount lifecycle for MediaFigure — GPU-layer promotion, store subscription, expand-click binding, hover-to-play video wiring with IntersectionObserver gating, and the img-observer that triggers lazy loadHighRes.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_EVENTS, MOUSE_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { ANIMATION_DURATIONS, EASING } from '@core/tokens/motion/animation.js'
import store from '@core/store.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import { mountCornerBrackets } from '@core/utils/gpu/corner-brackets.js'
import { videoAutoplayAllowed } from '@core/utils/media/policy.js'
import type { MediaFigure } from '../MediaFigure.js'
import { warmFirstRung } from './load.js'
import { VIDEO_DIMENSIONS } from '@core/tokens/media/dimensions.js'

/**
 * Mounts media figure.
 * @param c — the component
 */
export function mountMediaFigure(c: MediaFigure): void {
  // No blanket will-change: the figure element itself never transforms —
  // the expand modal's genie warp animates a canvas sheet elsewhere.
  // Forcing a composited layer per figure on a 100+-figure page is pure
  // layer bloat (the Safari patch disables this call for that reason).
  c.subscribe(store)

  if (c.classes) {
    c.classes.split(/\s+/).forEach((cls) => {
      if (cls) c.classList.add(cls)
    })
  }

  const fig = c.$<HTMLElement>(HTML_TAGS.FIGURE)

  if (fig && c.canExpand) {
    c.addScopedListener(fig, MOUSE_EVENTS.CLICK, () => c.openModal())

    const openBtn = c.$<HTMLElement>(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_1}`)

    if (openBtn) {
      // The CSS brackets animate on .internal-expand:hover (the figure
      // ancestor), not the button itself — hoverParentSelector mirrors that.
      c._expandBrackets = mountCornerBrackets(openBtn, {
        canvasClass: EXPAND_MODAL_CLASSES.EXPAND_MODAL_BRACKET_CANVAS,
        insetVar: '--space-xs',
        ease: EASING.CSS_EASE_POINTS,
        ms: ANIMATION_DURATIONS.BRACKET_MS,
        hoverParentSelector: `.${INTERNAL_CLASSES.INTERNAL_EXPAND}`,
      })
    }
  }

  if (c.isVideo) {
    const isReduced = store.getters.getReducedMotion()

    const vid = c.$<HTMLVideoElement>(HTML_TAGS.VIDEO)

    if (vid) {
      const videoPlayEvents = [
        MOUSE_EVENTS.MOUSEENTER,
        MOUSE_EVENTS.MOUSEOVER,
        MOUSE_EVENTS.MOUSEDOWN,
      ]
      const videoPauseEvents = [MOUSE_EVENTS.MOUSELEAVE, MOUSE_EVENTS.MOUSEOUT]

      for (const evt of videoPlayEvents) {
        c.addScopedListener(vid, evt, (e) =>
          c.playVideo((e as Event).target as HTMLVideoElement | null)
        )
      }

      for (const evt of videoPauseEvents) {
        c.addScopedListener(vid, evt, (e) =>
          c.pauseVideo((e as Event).target as HTMLVideoElement | null)
        )
      }

      c.addScopedListener(vid, MEDIA_EVENTS.LOADEDDATA, (e) => {
        // First frame decoded — terminal state, the loading shimmer releases.
        c.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)

        gpuAccel.processVideoGPU(
          (e as Event).target as HTMLVideoElement | null,
          c.displayWidth || VIDEO_DIMENSIONS.VIDEO_DEFAULT_WIDTH,
          c.displayHeight || VIDEO_DIMENSIONS.VIDEO_DEFAULT_HEIGHT
        )
      })

      c.addScopedListener(vid, WINDOW_EVENTS.ERROR, (e) => {
        // Video failed — terminal state, the loading shimmer releases.
        c.classList.add(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)

        const el = (e as Event).target as HTMLElement | null

        if (el?.hasAttribute(MEDIA_ATTRS.POSTER)) {
          el.removeAttribute(MEDIA_ATTRS.POSTER)
        }
      })

      if (!isReduced && videoAutoplayAllowed()) {
        // Viewport-gated playback: sources are only attached once the
        // video is ≥15% visible (saves bandwidth on below-fold media),
        // and leaving the viewport pauses it — no offscreen decode. A
        // 'low' connection budget (saveData/≤2g) skips this branch like
        // reduced-motion: the poster stays painted and no stream bytes
        // are ever fetched.
        c.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              c.isIntersecting = entry.isIntersecting

              if (entry.isIntersecting) {
                c._ensureVideoSource(vid)

                if (store.getters.getVideoAutoplay() && vid.paused) {
                  vid.play().catch(() => {})
                }
              } else {
                if (!vid.paused) {
                  vid.pause()
                }
              }
            })
          },
          { threshold: 0.15 }
        )

        c.observer.observe(vid)
      }
    }
  } else {
    const highImg = c.$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`) || c.$(HTML_TAGS.FIGURE)

    if (highImg) {
      // Progressive enhancement: 100px rootMargin starts the high-res
      // fetch just before the card scrolls into view — by the time the
      // user sees it, the thumb→high-res swap has usually completed.
      // One-shot: disconnects after the first load.
      c.imgObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !c.isLoaded) {
              c.loadHighRes()

              if (c.imgObserver) {
                c.imgObserver.disconnect()

                c.imgObserver = null
              }
            }
          })
        },
        { rootMargin: QUERY_STRINGS.ROOT_MARGIN_100, threshold: 0.01 }
      )

      c.imgObserver.observe(highImg)

      // Warm band — a much wider margin (~600px) fires a single detached
      // fetch of the FIRST ladder rung, warming the CDN edge + HTTP cache
      // before the 100px load margin starts the real climb. One-shot.
      c.warmObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !c.warmed) {
              warmFirstRung(c)

              if (c.warmObserver) {
                c.warmObserver.disconnect()

                c.warmObserver = null
              }
            }
          })
        },
        { rootMargin: QUERY_STRINGS.ROOT_MARGIN_600, threshold: 0.01 }
      )

      c.warmObserver.observe(highImg)
    }
  }
}
