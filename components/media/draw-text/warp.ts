/**
 * @file draw-text/warp.ts — cursor-following liquid warp for <draw-text
 * warp>: after the reveal completes, chars within a gaussian radius of the
 * pointer lift, scale and skew; per-char transition-delay (derived from
 * the existing --i index) makes the wave trail the cursor like liquid
 * instead of snapping. Transform-only writes inside a rAF batch — no
 * layout work per frame.
 */

import { DRAW_TEXT_SELECTORS } from '@core/tokens/selectors/draw-text.js'
import { POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import store from '@core/store.js'
import type { DrawText } from '../DrawText.js'

/**
 * Warp tunables — fractions of the title's own geometry, so the same
 * numbers work from 13px menu labels to 90px display titles.
 */
/** Radius of influence as a fraction of the host's height. */
const _SIGMA_RATIO = 0.6
/** Peak upward lift, fraction of char height. */
const _LIFT_RATIO = 0.14
/** Peak scale gain at the cursor point. */
const _SCALE_GAIN = 0.22
/** Peak skew away from the pointer, degrees. */
const _SKEW_DEG = 5

/** Cached geometry for one warp session (pointerenter → pointerleave). */
export interface WarpSession {
  /** Char spans currently mounted in the shadow root. */
  chars: HTMLElement[]
  /** Viewport-space center of each char, measured once on entry. */
  centers: { x: number; y: number }[]
  /** Influence radius in px — derived from the host's height. */
  sigma2: number
  /** Representative char height in px — scales the lift amount. */
  charH: number
  /** Pending rAF handle so only one frame of writes is queued. */
  raf: number
  /** Last pointer position — consumed by the rAF callback. */
  px: number
  py: number
}

/**
 * Applies the warp displacement for the pointer position stored on the
 * session. For each char the influence is a gaussian of the 2D distance
 * to the pointer; transform is translateY + scale + a skew that pushes
 * the char slightly away from the cursor horizontally.
 */
function applyWarp(host: DrawText): void {
  const s = host._warpSession
  if (!s) return

  for (let i = 0; i < s.chars.length; i++) {
    const c = s.centers[i]
    const dx = s.px - c.x
    const dy = s.py - c.y
    const infl = Math.exp(-(dx * dx + dy * dy) / s.sigma2)

    if (infl < 0.01) {
      if (s.chars[i].style.transform) s.chars[i].style.transform = ''
      continue
    }

    const lift = -infl * _LIFT_RATIO * s.charH
    const scale = 1 + infl * _SCALE_GAIN
    const skew = (dx >= 0 ? -1 : 1) * infl * _SKEW_DEG

    s.chars[i].style.transform =
      `translateY(${lift.toFixed(2)}px) scale(${scale.toFixed(3)}) skewX(${skew.toFixed(2)}deg)`
  }
}

/** Tears down listeners/session state — called on disconnect & warp-off. */
export function teardownWarp(host: DrawText): void {
  const s = host._warpSession

  if (s?.raf) cancelAnimationFrame(s.raf)

  host._warpSession = null
  host._warpActive = false
}

/**
 * Arms the liquid warp: chars are re-measured on every pointerenter so
 * scroll/reflow never desyncs the centers, then pointermove just writes
 * transforms inside one rAF per frame. The warp only runs after the
 * reveal finished (`.draw-text--done`) — while chars are animating the
 * CSS keyframes own their transforms.
 */
export function setupWarp(host: DrawText): void {
  teardownWarp(host)

  if (!host.hasAttribute(COMMON_ATTRS.WARP)) return

  const enter = () => {
    const chars = Array.from(
      host.shadowRoot!.querySelectorAll<HTMLElement>(DRAW_TEXT_SELECTORS.DRAW_TEXT_CHAR)
    )

    if (!chars.length) return

    const hostRect = host.getBoundingClientRect()
    const sigma = Math.max(1, hostRect.height * _SIGMA_RATIO)

    host._warpSession = {
      chars,
      centers: chars.map((el) => {
        const r = el.getBoundingClientRect()

        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }),
      sigma2: 2 * sigma * sigma,
      charH: chars[0].getBoundingClientRect().height || hostRect.height,
      raf: 0,
      px: 0,
      py: 0,
    }
    host._warpActive = true
  }

  const move = (e: Event) => {
    const s = host._warpSession
    if (!s || !host._hasAnimated) return
    if (store.getters.getReducedMotion?.()) return

    const pe = e as PointerEvent

    s.px = pe.clientX
    s.py = pe.clientY

    if (!s.raf) {
      s.raf = requestAnimationFrame(() => {
        s.raf = 0

        applyWarp(host)
      })
    }
  }

  const leave = () => {
    const s = host._warpSession
    if (!s) return

    for (const ch of s.chars) ch.style.transform = ''

    teardownWarp(host)
  }

  host.addEventListener(POINTER_EVENTS.POINTERENTER, enter)
  host.addEventListener(POINTER_EVENTS.POINTERMOVE, move)
  host.addEventListener(POINTER_EVENTS.POINTERLEAVE, leave)
  host._warpListeners = { enter, move, leave }
}

/** Detaches the three pointer listeners — disconnect path. */
export function detachWarp(host: DrawText): void {
  const l = host._warpListeners

  if (l) {
    host.removeEventListener(POINTER_EVENTS.POINTERENTER, l.enter)
    host.removeEventListener(POINTER_EVENTS.POINTERMOVE, l.move)
    host.removeEventListener(POINTER_EVENTS.POINTERLEAVE, l.leave)
    host._warpListeners = null
  }

  teardownWarp(host)
}
