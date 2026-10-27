/**
 * @file media/media-mount.ts
 * @description Mount lifecycle for MediaFigure — GPU-layer promotion, store subscription, expand-click binding, hover-to-play video wiring with IntersectionObserver gating, and the img-observer that triggers lazy loadHighRes.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import {
  KEYBOARD_EVENTS,
  MEDIA_EVENTS,
  MOUSE_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { KEYS } from '@core/tokens/primitives.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ANIMATION_DURATIONS, EASING } from '@core/tokens/motion/animation.js'
import { onScrollStop } from '@core/utils/motion/scroll-state.js'
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

      // Keyboard contract for ambient loops: muted videos render without
      // native controls (except under reduced-motion), so the element
      // itself is the control — Space/Enter toggles playback. Intentional
      // activation bypasses autoplay policy gates: a reduced-motion user
      // who deliberately presses play still gets playback.
      c.addScopedListener(vid, KEYBOARD_EVENTS.KEYDOWN, (e) => {
        const key = (e as KeyboardEvent).key

        if (key !== KEYS.SPACE && key !== KEYS.ENTER) return

        e.preventDefault()

        if (vid.paused) {
          c._ensureVideoSource(vid)

          vid.play().catch(() => {})
        } else {
          vid.pause()
        }
      })

      // The accessible name tracks real playback — autoplay, viewport
      // gating, reduced-motion sync and the keydown toggle all funnel
      // through the media element's own events, so one pair of listeners
      // keeps the toggle state truthful no matter which path flips it.
      // (aria-pressed is button-role-only and the a11y checker's ARIA
      // table predates aria-description, so the state rides aria-label —
      // the legal widget role on <video> is application.)
      const setLabel = (state: string) => {
        vid.setAttribute(ARIA_ATTRS.ARIA_LABEL, `${c.label} ${CHAR_STRINGS.EM_DASH} ${state}`)
      }

      c.addScopedListener(vid, MEDIA_EVENTS.PLAY, () => setLabel(STATE_STRINGS.PLAYING))

      c.addScopedListener(vid, MEDIA_EVENTS.PAUSE, () => setLabel(STATE_STRINGS.PAUSED))

      if (!isReduced && videoAutoplayAllowed()) {
        // Viewport-gated playback: sources are only attached once the
        // video is ≥15% visible (saves bandwidth on below-fold media),
        // and leaving the viewport pauses it — no offscreen decode. A
        // 'low' connection budget (saveData/≤2g) skips this branch like
        // reduced-motion: the poster stays painted and no stream bytes
        // are ever fetched.
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              c.isIntersecting = entry.isIntersecting

              if (entry.isIntersecting) {
                // Defer the source attach + play to an idle slice — a
                // video that streams the moment it intersects races the
                // page's own LCP/TBT budget on throttled links. The
                // hover/keyboard paths stay immediate: a deliberate play
                // intent always wins over the budget.
                const start = () => {
                  // Stale-observer/stale-position bail: a queued deferred
                  // start must never fire after this observer was
                  // disconnected/replaced (patch re-bind, re-mount,
                  // onDestroy) or after the element left the viewport —
                  // either would replay the entry against newer state.
                  if (c.observer !== observer || !c.isIntersecting) return

                  c._ensureVideoSource(vid)

                  // Overlay gate: the page sits under a covering layer
                  // while any overlay (expand modal, nav menu, dialogs)
                  // is open — a stray entry (resize/orientation) must not
                  // restart playback.
                  if (
                    store.getters.getVideoAutoplay() &&
                    !store.getters.getOverlayOpen() &&
                    vid.paused
                  ) {
                    const p = vid.play()

                    // Non-promise play() (older WebKit, stubs) has no
                    // rejection surface — only chain .catch on a thenable.
                    if (p && typeof p.catch === TYPE_STRINGS.FUNCTION) p.catch(() => {})
                  }
                }

                const queueIdle = () => {
                  if (typeof window.requestIdleCallback === TYPE_STRINGS.FUNCTION) {
                    window.requestIdleCallback(start)
                  } else {
                    setTimeout(start, 0)
                  }
                }

                // Ambient attach also waits out an in-flight scroll
                // gesture — decoding a stream mid-fling spends the frame
                // budget the scroll itself needs (scroll-fps gate). The
                // parked start re-reads isIntersecting, so a figure that
                // exited mid-gesture never attaches at all; onScrollStop
                // fires immediately when the window isn't scrolling.
                const queueStart = () => onScrollStop(queueIdle)

                // Ambient loops are decorative — the poster already owns
                // the paint — so an unrequested stream must not race the
                // page's own load window: a multi-MB fetch + decode while
                // the document is still loading steals critical-path
                // bandwidth and main-thread the boot veil needs. Post-load
                // intersections take the usual idle slice; pre-load ones
                // park on a one-shot 'load' listener.
                if (document.readyState === STATE_STRINGS.COMPLETE) {
                  queueStart()
                } else {
                  c.addScopedListener(window, WINDOW_EVENTS.LOAD, queueStart, { once: true })
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

        c.observer = observer

        observer.observe(vid)
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
