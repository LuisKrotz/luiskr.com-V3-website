/**
 * @file cardstack/autoplay.ts — the deck's autoplay: a 10-second
 * countdown per card drawn as a light filling the active card's
 * border band (a conic-gradient ring masked to the card edge). The
 * play/pause transport is the only manual control: any navigation —
 * prev/next/dots, side-card click, a committed drag/swipe, the
 * view-all index — kills autoplay entirely (the light hides) until
 * the user re-arms it. The section's IntersectionObserver holds the
 * countdown off-screen (and tab-hidden holds it the same way) so a
 * scrolled-away deck never advances unseen; the banked clock and the
 * JS-written progress var freeze/resume together so they never drift
 * apart.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_CSS_PROPS } from '@core/tokens/css/card-stack.js'
import { CARD_STACK_LAYOUT } from '@core/tokens/motion/card-stack.js'
import { goTo } from './interactions.js'
import { autoElapsed } from './timer.js'
import type { CardStack } from '../CardStack.js'

/**
 * Publishes the countdown state to the DOM: the section's --auto /
 * --auto-paused modifiers drive the border light's visibility and
 * freeze, and the transport button's --armed class + aria-label swap
 * the pause-bars/play-triangle glyph so it always shows the action it
 * performs. Imperative (no re-render) — same contract as
 * applyIndexState.
 * @param host The CardStack element.
 */
export function applyAutoChrome(host: CardStack): void {
  const section = host.$(CARD_STACK_SELECTORS.CARD_STACK) as HTMLElement | null

  section?.classList.toggle(CARD_STACK_CLASSES.CARD_STACK_AUTO, host._autoOn)

  section?.classList.toggle(
    CARD_STACK_CLASSES.CARD_STACK_AUTO_PAUSED,
    host._autoOn && (host._autoPaused || host._autoHeld)
  )

  const btn = host.$(CARD_STACK_SELECTORS.CARD_STACK_AUTOPLAY)

  const running = host._autoOn && !host._autoPaused

  btn?.classList.toggle(CARD_STACK_CLASSES.CARD_STACK_AUTOPLAY_ARMED, running)

  btn?.setAttribute(ARIA_ATTRS.ARIA_LABEL, running ? host._t.autoplayPause : host._t.autoplayPlay)

  paintAutoProgress(host)
}

/**
 * The DOM rings' progress writer — --card-stack-timer-p on the HOST's
 * inline style inherits through the shadow boundary into the active
 * card's conic-gradient border band and the transport's rim ring, so
 * one write drives both lights off the same banked clock. A rAF loop
 * repaints while the countdown runs (@property + keyframe animation is
 * unusable — registered custom properties don't interpolate inside a
 * shadow-adopted sheet, so the gradient stop must be written, not
 * animated). Paused/held writes once and freezes; stopped removes the
 * property entirely.
 * @param host The CardStack element.
 */
function paintAutoProgress(host: CardStack): void {
  if (host._autoRaf) {
    cancelAnimationFrame(host._autoRaf)

    host._autoRaf = 0
  }

  const write = () => {
    const p = Math.min(autoElapsed(host) / CARD_STACK_LAYOUT.AUTOPLAY_MS, 1) * 100

    host.style.setProperty(CARD_STACK_CSS_PROPS.CARD_STACK_TIMER_P, `${p}${CHAR_STRINGS.PERCENT}`)
  }

  if (host._autoOn) {
    // The current state paints synchronously — a fresh arm shows 0%
    // this frame rather than one rAF late; paused/held freezes the
    // banked position.
    write()
  } else {
    host.style.removeProperty(CARD_STACK_CSS_PROPS.CARD_STACK_TIMER_P)
  }

  if (host._autoOn && !host._autoPaused && !host._autoHeld) {
    const frame = () => {
      write()

      host._autoRaf = requestAnimationFrame(frame)
    }

    host._autoRaf = requestAnimationFrame(frame)
  }
}

/**
 * The autoplay eligibility gate — the countdown is a fan-tier surface
 * only: the stacked mobile/tablet layouts get no countdown, no border
 * light, and no transport button (the stylesheet hides it under the
 * same 1280 boundary). Arms and the transport both check this so a
 * stacked tier can never start the clock.
 * @param host The CardStack element.
 * @returns True on a desktop fan tier with a populated deck.
 */
export function autoplayAllowed(host: CardStack): boolean {
  return host.deckItems.length > 0 && host._tier?.STACKED === false
}

/**
 * (Re)starts the countdown clock — clears any pending tick and arms a
 * fresh timeout for the banked remainder. The DOM light needs no kick:
 * its animation's start/resume follows the section modifiers.
 * @param host The CardStack element.
 */
function restartClock(host: CardStack): void {
  if (host._autoTimer) clearTimeout(host._autoTimer)

  host._autoT0 = performance.now()

  host._autoTimer = setTimeout(() => autoTick(host), CARD_STACK_LAYOUT.AUTOPLAY_MS - host._autoBank)
}

/**
 * Arms the countdown from zero on the current card — the deck's
 * auto-start on mount (gated on reduced-motion by the caller) and the
 * play control's restart after a full stop.
 * @param host The CardStack element.
 */
export function armAutoplay(host: CardStack): void {
  if (!autoplayAllowed(host)) return

  host._autoOn = true

  host._autoPaused = false

  host._autoHeld = false

  host._autoBank = 0

  restartClock(host)

  applyAutoChrome(host)
}

/**
 * The countdown's expiry — advances the fan one card and re-arms.
 * goTo() itself never kills autoplay (the manual-nav wrappers do), so
 * the orbit light hand-off is just the new front card's --active
 * modifier: its DOM timer span starts orbiting the moment the class
 * lands, in lockstep with this re-armed clock.
 * @param host The CardStack element.
 */
function autoTick(host: CardStack): void {
  host._autoTimer = null

  if (!host._autoOn || host._autoPaused || host._autoHeld) return

  host._autoBank = 0

  goTo(host, host.activeIdx + 1)

  /* istanbul ignore else -- goTo can only flip _autoOn through a callee's
     stopAutoplay (resize measure); no current path does, so the else arm
     is unreachable defensive code. */
  if (host._autoOn) restartClock(host)
}

/**
 * The play/pause transport: running → pause (banks the in-flight span,
 * the light freezes mid-orbit); paused → resume (the light continues
 * from its frozen point); off → a fresh 10s arm on the current card.
 * @param host The CardStack element.
 */
export function toggleAutoplay(host: CardStack): void {
  if (!autoplayAllowed(host)) return

  if (host._autoOn && !host._autoPaused) {
    host._autoBank = autoElapsed(host)

    host._autoPaused = true

    if (host._autoTimer) {
      clearTimeout(host._autoTimer)

      host._autoTimer = null
    }
  } else if (host._autoOn && host._autoPaused) {
    host._autoPaused = false

    restartClock(host)
  } else {
    armAutoplay(host)

    return
  }

  applyAutoChrome(host)
}

/**
 * Kills autoplay entirely — the manual-nav response (prev/next/dots,
 * card click, committed drag, view-all). The light hides and the bank
 * resets, so the next play starts a fresh countdown.
 * @param host The CardStack element.
 */
export function stopAutoplay(host: CardStack): void {
  if (!host._autoOn && !host._autoPaused) return

  host._autoOn = false

  host._autoPaused = false

  host._autoHeld = false

  host._autoBank = 0

  if (host._autoTimer) {
    clearTimeout(host._autoTimer)

    host._autoTimer = null
  }

  applyAutoChrome(host)
}

/**
 * The visibility hold — the section IO and the document's
 * visibilitychange freeze a running countdown while the deck can't be
 * seen (banked like a pause, but resuming by itself when the surface
 * returns — a user pause stays paused). The frozen state shares the
 * --auto-paused paint (a held light looks identical to a paused one).
 * @param host The CardStack element.
 * @param held True while the deck is off-screen/tab-hidden.
 */
export function holdAutoplay(host: CardStack, held: boolean): void {
  if (!host._autoOn) return

  if (held === host._autoHeld) return

  host._autoHeld = held

  if (held && !host._autoPaused) {
    host._autoBank = autoElapsed(host)

    if (host._autoTimer) {
      clearTimeout(host._autoTimer)

      host._autoTimer = null
    }
  } else if (!held && !host._autoPaused) {
    restartClock(host)
  }

  applyAutoChrome(host)
}
