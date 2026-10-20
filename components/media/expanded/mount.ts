/**
 * @file media/expanded-mount.ts
 * @description Mount wiring for <media-expanded>: scroll reset, Escape /
 * native-cancel / close-button affordances, the WebGL close widget, perf
 * telemetry dispatch, and the full-res pipeline (disk cache → WASM
 * decode → detached preload → blob swap → optional GPU upload).
 */

import { KEYS } from '@core/tokens/primitives.js'
import { EXPAND_MODAL_CLASSES, MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { APP_EVENTS } from '@core/tokens/events/app.js'
import {
  KEYBOARD_EVENTS,
  MEDIA_EVENTS,
  MOUSE_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { WASM_ACTIONS } from '@core/tokens/data/wasm.js'
import store from '@core/store.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import { wasmPool } from '@core/utils/wasm/wasm-pool.js'
import { localMediaCache } from '@core/utils/media/local-media-cache.js'
import { wasmMediaThreads } from '@core/utils/wasm/wasm-media-threads.js'
import { CloseButtonWebGL } from '@core/utils/canvas/widgets/close-button.js'
import { ANIMATION_DURATIONS, EASING } from '@core/tokens/motion/animation.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { mountCornerBracketsAll } from '@core/utils/gpu/corner-brackets.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { calcMediaBox } from '@core/utils/wasm/wasm-layout.js'
import { startGenieOpen } from './genie.js'
import type { MediaExpanded } from '../MediaExpanded.js'
import { GENERIC_DIMENSIONS, VIDEO_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

/**
 * Full-res pipeline: thumb paints instantly → the disk-cached blob is
 * fetched → WASM threads attempt a decode (pre-warms the frame) → a
 * detached Image confirms load → the visible <img> swaps to the blob
 * URL (no second network trip, instant paint). GPU upload only runs when
 * the WASM decode produced no bitmap. Error path still swaps the src —
 * the browser shows the broken-image state rather than pinning the thumb.
 */
function loadFullRes(el: MediaExpanded): void {
  // The modal is the full-fidelity surface: always fetch the original
  // asset, never the webp sibling — compression artifacts have no place
  // in a deliberately perf-isolated view.
  const candidates = [el.source].filter((u) => u && u.length > 0)

  const attempt = (index: number): void => {
    if (index >= candidates.length) return

    localMediaCache.fetchOrGetLocalMedia(candidates[index]).then(async (localUrl) => {
      if (!localUrl) {
        // webp sibling missing/not-cached — fall through to the original.
        attempt(index + 1)

        return
      }

      const bitmap = await wasmMediaThreads.decodeMediaInSeparateThread(
        localUrl,
        el.mediaWidth || VIDEO_DIMENSIONS.VIDEO_DEFAULT_WIDTH,
        el.mediaHeight || VIDEO_DIMENSIONS.VIDEO_DEFAULT_HEIGHT
      )

      const img = new Image()

      const swap = () => {
        el.currentSrc = localUrl

        const imgEl = el.$<HTMLImageElement>(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

        if (imgEl) imgEl.src = localUrl

        // Terminal state — the figure's skeleton shimmer releases even on
        // the error path (a broken swap must not pin the shimmer forever).
        el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`)?.classList.add(
          EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE_LOADED
        )
      }

      img.src = localUrl

      img.onload = () => {
        if (!bitmap) {
          gpuAccel.processImageGPU(
            img,
            el.mediaWidth || VIDEO_DIMENSIONS.VIDEO_DEFAULT_WIDTH,
            el.mediaHeight || VIDEO_DIMENSIONS.VIDEO_DEFAULT_HEIGHT
          )
        }

        swap()
      }

      img.onerror = swap
    })
  }

  attempt(0)
}

/** Mount lifecycle: listeners, close button, telemetry, media pipeline. */
export function mountMediaExpanded(el: MediaExpanded): void {
  // The document scroll is untouched — the native dialog's inert top
  // layer is the lock; the old fixed-pin era scrolled the page to top
  // here, which read as a jump under the modal. Only the dialog's own
  // scroll resets.
  const modalAbove = document.querySelector(`.${MODAL_CLASSES.MODAL_ABOVE}`)

  if (modalAbove) modalAbove.scrollTop = 0

  // ESC key closes modal
  el.addScopedListener(window, KEYBOARD_EVENTS.KEYDOWN, (e) => {
    if ((e as KeyboardEvent).key === KEYS.ESCAPE) el.startClose()
  })

  // Scroll snapback — the native dialog's inert top layer already blocks
  // user-driven document scroll (wheel/touch land on the dialog, whose
  // overscroll-behavior:contain stops the chain), but inertness can't
  // block programmatic window.scrollTo. Any drift while the modal is
  // open is snapped back to the parked offset on the next frame —
  // rAF-coalesced so a burst of scroll events costs one scrollTo. The
  // close.ts restore lands on the same value, so it can't fight itself.
  let snapQueued = false

  el.addScopedListener(
    window,
    WINDOW_EVENTS.SCROLL,
    () => {
      const modal = store.getters.getModal()

      if (!modal?.open || snapQueued) return

      snapQueued = true

      requestAnimationFrame(() => {
        snapQueued = false

        const parked = Number(store.getters.getModal().transform) || 0

        if (store.getters.getModal().open && Math.abs(window.scrollY - parked) > 1) {
          window.scrollTo(0, parked)
        }
      })
    },
    { passive: true }
  )

  // Native dialog cancel event
  const dialog =
    (el.closest(HTML_TAGS.DIALOG) as HTMLDialogElement | null) ||
    (document.querySelector(
      `${HTML_TAGS.DIALOG}.${MODAL_CLASSES.MODAL_ABOVE}`
    ) as HTMLDialogElement | null)

  if (dialog) {
    el.addScopedListener(dialog, APP_EVENTS.CANCEL, (e) => {
      e.preventDefault()

      el.startClose()
    })
  }

  // Click events
  const closeBtns = el.$$(
    `.${PREF_CLASSES.PREF_CLOSE_BTN}, .${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BAR_BUTTON}, .${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BOTTOM}, .${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_AREA}`
  )

  closeBtns.forEach((btn) => {
    el.addScopedListener(btn, MOUSE_EVENTS.CLICK, () => el.startClose())
  })

  // The media item is the element the genie warp animates — it carries
  // the translated description (the transient overlay canvas stays
  // aria-hidden, decorative-only).
  const mediaItem = el.$<HTMLElement>(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

  if (mediaItem) applyAnimationDesc(mediaItem, ANIMATION_IDS.GENIE_MODAL)

  // Genie entrance — the media warps from the clicked figure's rect
  // into the modal. When the transition cannot run (reduced motion,
  // missing surfaces) the legacy CSS zoom covers the entrance instead.
  const content = el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT}`)

  // Media-box allocation — the displayed box is computed through the
  // WASM layout path (calcMediaBox; JS-identical fallback when the
  // engine is unavailable) and stamped as explicit px on the item, so
  // the box is decided in one layout pass instead of CSS negotiating
  // max-width/scale-down against the intrinsic attrs. Images get an
  // unbounded height on purpose: a "huge length" capture keeps its
  // full fitted width and overflows into the dialog's own scroll —
  // constraining by height would squash it (the reported regression).
  // Videos keep the flex contract since their chrome must fit the
  // viewport. The genie measure below reads the same layout pass.
  const fitMediaItem = () => {
    if (!mediaItem || !content || el.isVideo) return

    const style = getComputedStyle(content)
    const boundW =
      content.clientWidth -
      (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0)

    // A non-laid-out content (or a NaN padding parse) would produce a
    // zero/negative box — leave the intrinsic attrs in place instead.
    if (!(boundW > 0)) return

    const box = calcMediaBox(
      el.mediaWidth || GENERIC_DIMENSIONS.DEFAULT_WIDTH,
      el.mediaHeight || GENERIC_DIMENSIONS.DEFAULT_HEIGHT,
      boundW,
      Number.POSITIVE_INFINITY
    )

    mediaItem.style.width = `${box.width}${CHAR_STRINGS.PX}`

    mediaItem.style.height = `${box.height}${CHAR_STRINGS.PX}`
  }

  fitMediaItem()

  // Refit on viewport changes while the modal is open — rAF-coalesced
  // so a resize burst costs one layout pass.
  let fitQueued = false

  el.addScopedListener(
    window,
    WINDOW_EVENTS.RESIZE,
    () => {
      if (fitQueued) return

      fitQueued = true

      requestAnimationFrame(() => {
        fitQueued = false

        fitMediaItem()
      })
    },
    { passive: true }
  )

  if (content) {
    if (!startGenieOpen(el, () => undefined)) {
      if (!store.getters.getReducedMotion()) {
        content.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_CSS_ZOOM)
      }
    }
  }

  // Deferred mounts — everything past the entrance runs after the
  // first painted frame so the click task (INP) only pays for the
  // listeners, the a11y hooks, and the genie arm. The close-button GL
  // init, the bracket widgets, the telemetry dispatch and the media
  // pipeline all land post-paint; the veil covers them during the warp
  // anyway.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!el.isConnected) return

      // Staged glass — the translucent tint has already painted (the
      // ::before's cheap layer); now that the first frames are up, arm
      // the backdrop blur. Deferring it keeps the fullscreen
      // backdrop-root snapshot off the click→first-paint path — the
      // reported "transparent background takes too long to render".
      content?.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT_GLASS)

      const closeCanvas = el.$<HTMLCanvasElement>(`.${PREF_CLASSES.PREF_CLOSE_CANVAS}`)

      if (closeCanvas) {
        applyAnimationDesc(closeCanvas, ANIMATION_IDS.CLOSE_BUTTON)

        el._closeBtn = new CloseButtonWebGL(closeCanvas, () => el.startClose())
      }

      // Corner-bracket widgets on the close-bar + bottom close buttons
      // (0.2s ease, --space-xs inset — matching _expand-modal.scss).
      if (el.shadowRoot) {
        el._brackets = mountCornerBracketsAll(
          el.shadowRoot,
          `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BAR_BUTTON}, .${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CLOSE_BOTTOM}`,
          {
            canvasClass: EXPAND_MODAL_CLASSES.EXPAND_MODAL_BRACKET_CANVAS,
            insetVar: '--space-xs',
            ease: EASING.CSS_EASE_POINTS,
            ms: ANIMATION_DURATIONS.BRACKET_FAST_MS,
          }
        )
      }

      // Telemetry: record the displayed media shape for the perf worker.
      wasmPool.dispatch(WASM_ACTIONS.PROCESS_MEDIA_ANALYTICS, {
        width: el.mediaWidth || 0,
        height: el.mediaHeight || 0,
        isVideo: el.isVideo,
      })

      if (el.isVideo) {
        const vid = el.$<HTMLVideoElement>(HTML_TAGS.VIDEO)

        if (vid) {
          // First frame decoded (or a hard failure) — terminal state for
          // the figure's skeleton shimmer, same contract as media-figure.
          const markLoaded = () => {
            el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`)?.classList.add(
              EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE_LOADED
            )
          }

          el.addScopedListener(vid, MEDIA_EVENTS.LOADEDDATA, markLoaded)

          el.addScopedListener(vid, WINDOW_EVENTS.ERROR, markLoaded)

          if (!store.getters.getReducedMotion()) {
            vid.play().catch(() => {})
          }
        }
      } else if (el.source) {
        loadFullRes(el)
      }
    })
  )
}
