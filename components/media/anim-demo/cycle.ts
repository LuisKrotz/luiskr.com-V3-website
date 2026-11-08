/**
 * @file anim-demo/cycle.ts — the demo choreography clock. Every staged
 * animation on the /animations route replays on a setInterval loop (never
 * rAF — cycle cadence is multi-second, not per-frame); the loop's steps
 * toggle the same public state hooks a pointer would (setOpen, setHover,
 * setActive, setTheme, arm/disarm, class swaps) so the demo shows the
 * real interaction without needing one.
 *
 * `cycle` returns the teardown the caller stores on the demo context —
 * clearing the interval is every driver's destroy path.
 */

import store from '@core/store.js'

/** One choreography beat (ms) — the dwell between demo state flips. */
export const DEMO_BEAT_MS = 1600

/** Long beat (ms) — multi-phase demos that need settle time between steps. */
export const DEMO_BEAT_LONG_MS = 3400

/**
 * Whether the visitor prefers reduced motion — demo loops honor it the
 * same way the widgets do (they render one settled frame instead of a
 * moving cycle).
 * @returns true when motion is reduced.
 */
export const reducedMotion = (): boolean => Boolean(store.getters.getReducedMotion?.())

/**
 * Repeating step sequencer — runs `steps[i % steps.length]` every `ms`,
 * advancing i so a demo walks an open→hold→close→hold choreography.
 * Skips scheduling entirely under reduced motion (the staged widget's
 * own reduced path paints its settled frame; the steps would only snap
 * states nobody should watch move).
 * @param ms Interval between steps.
 * @param steps Ordered step callbacks — each performs one state change.
 * @param immediate Run step 0 at mount instead of waiting a beat —
 *   demos whose idle state is hidden (menu closed, toast absent,
 *   dialog left) must land their visible state synchronously or the
 *   stage reads as an empty box for the first dwell.
 * @returns Teardown clearing the interval.
 */
export const cycle = (ms: number, steps: Array<() => void>, immediate = false): (() => void) => {
  if (reducedMotion() || !steps.length) return () => undefined

  let i = 0

  if (immediate) {
    steps[0]()

    i = 1
  }

  const timer = setInterval(() => {
    steps[i % steps.length]()

    i++
  }, ms)

  return () => clearInterval(timer)
}

/**
 * Fires `fn` once after `ms` — used to start a demo's first beat on the
 * next breath instead of synchronously inside mount (the stage must
 * paint once before the first state flip lands).
 * @param ms Delay.
 * @param fn The deferred callback.
 * @returns Teardown clearing the timeout.
 */
export const after = (ms: number, fn: () => void): (() => void) => {
  const timer = setTimeout(fn, ms)

  return () => clearTimeout(timer)
}
