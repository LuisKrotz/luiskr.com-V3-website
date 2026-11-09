/**
 * @file anim-demo/canvas2d.ts — the 2D-canvas fallback for the 3D-scene
 * demo: mountScene3d is WebGPU-gated, so where the wasm surface can't
 * mount this driver paints a faithful miniature of the real scene on
 * the stage's 2D context — a depth-projected starfield recycling
 * through z the way the three.js scene reads.
 *
 * Frame-contract: the loop is rAF-time-based, allocation-free per
 * frame (stars preallocated at mount), cancels on teardown, and paints
 * one settled frame under reduced motion. Inks are palette snapshots —
 * getComputedStyle reads the theme vars once at mount, off the frame
 * loop entirely (the nav-glyph pattern).
 */

import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { reducedMotion } from './cycle.js'
import type { DemoContext } from './types.js'

/** Star count in the scene demo — small enough for a 2D loop. */
const _STAR_COUNT = 120

/** Star depth range (world z) the field recycles through. */
const _STAR_DEPTH = 1000

/** Star forward drift speed (units/frame at 60fps) — reads as flight. */
const _STAR_SPEED = 6

/**
 * Palette snapshot — reads the theme custom properties the demo paints
 * with, once, off the frame loop (the nav-glyph pattern: re-reads only
 * happen at mount, not per frame).
 * @param el Element the computed style resolves on (the host canvas).
 * @returns Ink strings for ground and star.
 */
const readInks = (el: HTMLElement): [string, string] => {
  const cs = getComputedStyle(el)

  return [
    cs.getPropertyValue(THEME_CSS_PROPS.BG_DARK).trim(),
    cs.getPropertyValue(THEME_CSS_PROPS.TEXT_MUTED_ON_DARK).trim(),
  ]
}

/**
 * The stage's full-size 2D context with backing pixels matched to the
 * box — allocated once; resize handling lives with the widget instead
 * of per-frame work.
 * @param canvas The stage canvas.
 * @returns [ctx, dpr-scaled width, height] or null when 2D is absent.
 */
const ctx2d = (canvas: HTMLCanvasElement): [CanvasRenderingContext2D, number, number] | null => {
  const box = canvas.getBoundingClientRect()

  const dpr = window.devicePixelRatio || 1

  const w = Math.max(1, Math.round(box.width * dpr))

  const h = Math.max(1, Math.round(box.height * dpr))

  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')

  return ctx ? [ctx, w, h] : null
}

/**
 * Space-scene demo — a depth-projected starfield: preallocated stars
 * recycle through a z range while the projection (perspective divide,
 * size/alpha falloff) maps them to screen — the same depth cue the
 * experiments three.js scene renders on the GPU, in miniature.
 * @param ctx The demo context (stage owns the canvas).
 * @returns Teardown — cancels the loop.
 */
export const mountSceneDemo = ({ stage }: DemoContext): (() => void) => {
  const canvas = stage.querySelector<HTMLCanvasElement>(`.${ANIM_DEMO_CLASSES.CANVAS}`)

  const setup = canvas && ctx2d(canvas)

  if (!setup) return () => undefined

  const [ctx, w, h] = setup

  const [ground, star] = readInks(canvas)

  const stars = new Float32Array(_STAR_COUNT * 3)

  for (let i = 0; i < _STAR_COUNT; i++) {
    stars[i * 3] = (Math.random() - 0.5) * 2
    stars[i * 3 + 1] = (Math.random() - 0.5) * 2
    stars[i * 3 + 2] = Math.random() * _STAR_DEPTH
  }

  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(w, h)

  /** One settled frame — a static spread with no drift. */
  const still = () => {
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = star

    for (let i = 0; i < _STAR_COUNT; i++) {
      const p = stars[i * 3 + 2] / _STAR_DEPTH

      ctx.globalAlpha = 1 - p * 0.8

      ctx.fillRect(cx + stars[i * 3] * scale * p, cy + stars[i * 3 + 1] * scale * p, 2, 2)
    }

    ctx.globalAlpha = 1
  }

  if (reducedMotion()) {
    still()

    return () => undefined
  }

  let raf = 0

  const frame = () => {
    ctx.globalAlpha = 1
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = star

    for (let i = 0; i < _STAR_COUNT; i++) {
      let z = stars[i * 3 + 2] - _STAR_SPEED

      if (z < 1) {
        z = _STAR_DEPTH
        stars[i * 3] = (Math.random() - 0.5) * 2
        stars[i * 3 + 1] = (Math.random() - 0.5) * 2
      }

      stars[i * 3 + 2] = z

      const p = 1 - z / _STAR_DEPTH

      ctx.globalAlpha = p

      const size = 1 + p * 3

      ctx.fillRect(
        cx + (stars[i * 3] * scale * 0.5) / Math.max(z / _STAR_DEPTH, 0.08),
        cy + (stars[i * 3 + 1] * scale * 0.5) / Math.max(z / _STAR_DEPTH, 0.08),
        size,
        size
      )
    }

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  return () => cancelAnimationFrame(raf)
}
