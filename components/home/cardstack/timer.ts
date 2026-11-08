/**
 * @file cardstack/timer.ts — the autoplay border light's shared clock.
 * autoElapsed() reports the banked+in-flight countdown the progress
 * writer reads per frame; a frozen clock (paused or off-screen held)
 * reports the banked figure so the light hangs mid-fill exactly where
 * the pause left it.
 */

import { CARD_STACK_LAYOUT } from '@core/tokens/motion/card-stack.js'
import type { CardStack } from '../CardStack.js'

/**
 * Milliseconds into the current countdown — the banked elapsed from
 * before the last (re)start plus the in-flight span while the clock
 * runs. The progress writer reads it per frame; a frozen clock (paused
 * or off-screen held) reports the banked figure so the border light
 * hangs mid-fill exactly where the pause left it.
 * @param host The CardStack element.
 * @returns Elapsed ms in [0, AUTOPLAY_MS]; 0 when autoplay is off.
 */
export function autoElapsed(host: CardStack): number {
  if (!host._autoOn) return 0

  const ticking = !host._autoPaused && !host._autoHeld

  return Math.min(
    CARD_STACK_LAYOUT.AUTOPLAY_MS,
    host._autoBank + (ticking ? performance.now() - host._autoT0 : 0)
  )
}
