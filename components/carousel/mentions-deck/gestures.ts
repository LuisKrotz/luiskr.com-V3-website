/**
 * @file mentions-deck/gestures.ts — pointer-swipe tracking for
 * <mentions-deck>: a slop-gated horizontal drag that slides the strip
 * continuously (one rAF write per frame), vertical-scroll yielding, flick
 * velocity, and the threshold settle that turns a release into a nav or a
 * snap-back. A committed drag also pauses autoplay for the gesture's span.
 */

import { MENTIONS_DECK_CLASSES } from '@core/tokens/classes/mentions-deck.js'
import { MENTIONS_DECK_SELECTORS } from '@core/tokens/selectors/mentions-deck.js'
import { MENTIONS_DECK_LAYOUT } from '@core/tokens/motion/mentions-deck.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { applyPoses } from './deck.js'
import { goTo } from './interactions.js'
import { pauseAutoplay, resumeAutoplay } from './autoplay.js'
import type { MentionsDeck } from '../MentionsDeck.js'

/** The deck element a pointer event landed in, or null — pointer capture
 *  targets it so the move stream retargets there (listeners stay scoped). */
function deckFromEvent(e: Event): Element | null {
  return (e.target as Element | null)?.closest?.(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DECK) ?? null
}

/** Clears the capture + listener bookkeeping left by a finished gesture. */
function releaseGesture(host: MentionsDeck, deck: Element | null, pointerId: number): void {
  const rel = (deck as HTMLElement | null)?.releasePointerCapture

  if (rel) {
    try {
      rel.call(deck, pointerId)
    } catch {
      // The capture may already be released by the browser (cancel path) —
      // a stale release throws NotFoundError; the gesture is over either way.
    }
  }

  host._pointerId = null
}

/**
 * Pointer-down on the deck — arms gesture bookkeeping only. Pointer
 * capture is deliberately NOT taken here: capturing on down retargets
 * the synthesized click to the capture element, so plain taps on cards
 * would never reach the outbound anchors. Capture arms the moment the
 * drag commits past slop (onPointerMove) — committed drags suppress
 * the trailing click anyway. A fresh gesture also clears a stale
 * `_suppressClick`: when a swipe or pointercancel synthesizes no
 * trailing click (touch), an unconsumed flag would otherwise swallow
 * the next real link click — the browser's own trailing click after a
 * drag is never preceded by a new pointerdown. Non-primary mouse
 * buttons and already-tracked pointers are ignored.
 * @param host The MentionsDeck element.
 * @param e The pointerdown event.
 */
export function onPointerDown(host: MentionsDeck, e: Event): void {
  const pe = e as PointerEvent

  if (host._pointerId !== null) return

  if (pe.button !== undefined && pe.button !== 0) return

  host._pointerId = pe.pointerId ?? 0

  host._dragStartX = pe.clientX

  host._dragStartY = pe.clientY

  host._lastPX = pe.clientX

  host._lastT = pe.timeStamp || 0

  host._velX = 0

  host._dragActive = false

  host._gestureDead = false

  host._suppressClick = false
}

/**
 * Pointer-move — consumes the coalesced sample stream (1000–8000Hz mice
 * deliver several per frame; only the last position matters). Before the
 * slop commits the gesture, a steeper vertical track yields to page
 * scroll; after it, `_dragX` updates and ONE rAF writes the strip. The first
 * committed frame also freezes autoplay so the dwell can't fire mid-drag.
 * @param host The MentionsDeck element.
 * @param e The pointermove event.
 */
export function onPointerMove(host: MentionsDeck, e: Event): void {
  const pe = e as PointerEvent

  if (host._pointerId === null || pe.pointerId !== host._pointerId || host._gestureDead) return

  const samples =
    typeof pe.getCoalescedEvents === TYPE_STRINGS.FUNCTION ? pe.getCoalescedEvents() : []

  const last = samples.length ? samples[samples.length - 1] : pe

  const dx = last.clientX - host._dragStartX

  const dy = last.clientY - host._dragStartY

  if (!host._dragActive) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > MENTIONS_DECK_LAYOUT.DRAG_SLOP) {
      host._gestureDead = true

      releaseGesture(host, deckFromEvent(e), host._pointerId)

      return
    }

    if (Math.abs(dx) <= MENTIONS_DECK_LAYOUT.DRAG_SLOP) return

    host._dragActive = true

    pauseAutoplay(host)

    host
      .$(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DECK)
      ?.classList.add(MENTIONS_DECK_CLASSES.MENTIONS_DECK_DECK_DRAGGING)

    // Capture arms at commit — the move/up stream keeps landing on the
    // deck when the pointer leaves mid-swipe; sub-slop taps stay
    // capture-free so the click still targets the card link.
    const deck = deckFromEvent(e)

    const cap = (deck as HTMLElement | null)?.setPointerCapture

    if (cap && host._pointerId !== null) {
      try {
        cap.call(deck, host._pointerId)
      } catch {
        // Engines without pointer-capture support (or a synthetic event)
        // still deliver the scoped listeners — the gesture just can't
        // track outside the deck bounds.
      }
    }
  }

  const dt = last.timeStamp - host._lastT

  if (dt > 0) {
    host._velX = (last.clientX - host._lastPX) / dt
  }

  host._lastPX = last.clientX

  host._lastT = last.timeStamp

  host._dragX = dx

  if (host._rafId === null) {
    host._rafId = requestAnimationFrame(host._dragTick)
  }
}

/**
 * Pointer-up/cancel — settles the gesture. Drag fraction + flick velocity
 * decide: advance one card in the drag direction or snap the strip back to
 * the current front. A committed drag also suppresses the trailing click
 * so it can't fire navigation, then hands the dwell back to autoplay.
 * @param host The MentionsDeck element.
 * @param e The pointerup/pointercancel event.
 */
export function onPointerEnd(host: MentionsDeck, e: Event): void {
  const pe = e as PointerEvent

  if (host._pointerId === null || (pe.pointerId !== undefined && pe.pointerId !== host._pointerId))
    return

  releaseGesture(host, deckFromEvent(e), host._pointerId)

  if (host._rafId !== null) {
    cancelAnimationFrame(host._rafId)

    host._rafId = null
  }

  const wasActive = host._dragActive

  host._dragActive = false

  host
    .$(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DECK)
    ?.classList.remove(MENTIONS_DECK_CLASSES.MENTIONS_DECK_DECK_DRAGGING)

  if (!wasActive) {
    host._dragX = 0

    return
  }

  const dx = host._dragX

  host._suppressClick = Math.abs(dx) > MENTIONS_DECK_LAYOUT.DRAG_SLOP

  const p = -dx / host._step

  const dir = p >= 0 ? 1 : -1

  const flick =
    dir > 0
      ? host._velX < -MENTIONS_DECK_LAYOUT.FLICK_VEL
      : host._velX > MENTIONS_DECK_LAYOUT.FLICK_VEL

  host._velX = 0

  if (Math.abs(p) > MENTIONS_DECK_LAYOUT.DRAG_THRESHOLD || (dx !== 0 && flick)) {
    goTo(host, host.activeIdx + dir)

    resumeAutoplay(host)

    return
  }

  host._dragX = 0

  applyPoses(host)

  resumeAutoplay(host)
}
