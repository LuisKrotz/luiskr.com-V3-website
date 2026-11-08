/**
 * @file anim-demo/canvas2d.ts — 2D-canvas demo approximations for the
 * two animations whose real surfaces can't mount inside a demo (the
 * glitch portrait needs the about-section decoded-image session, the
 * space scene needs the experiments three.js stack — both gated by the
 * component-portability rule). Each draws a faithful miniature of the
 * real effect on the stage's canvas: channel-split slices for the
 * glitch, a depth-projected starfield for the space scene.
 *
 * Frame-contract: loops are rAF-time-based, allocation-free per frame
 * (stars + scratch surfaces allocated once at mount), cancel on
 * teardown, and paint one settled frame under reduced motion. Inks are
 * palette snapshots — getComputedStyle reads the theme vars once at
 * mount, off the frame loop entirely (the nav-glyph pattern).
 */

import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { reducedMotion } from './cycle.js'
import type { DemoContext } from './types.js'

/** Glitch slice cadence — a burst every ~90 frames at 60fps. */
const _GLITCH_PERIOD = 90

/** Glitch slice count per burst (horizontal bands offset). */
const _GLITCH_SLICES = 5

/** Max slice displacement in device pixels. */
const _GLITCH_SHIFT = 10

/** Star count in the scene demo — small enough for a 2D loop. */
const _STAR_COUNT = 120

/** Star depth range (world z) the field recycles through. */
const _STAR_DEPTH = 1000

/** Star forward drift speed (units/frame at 60fps) — reads as flight. */
const _STAR_SPEED = 6

/**
 * Palette snapshot — reads the theme custom properties the two 2D
 * demos paint with, once, off the frame loop (the nav-glyph pattern:
 * re-reads only happen at mount, not per frame).
 * @param el Element the computed style resolves on (the host canvas).
 * @returns Ink strings for ground/silhouette/star and the two tints.
 */
const readInks = (el: HTMLElement): [string, string, string, string] => {
  const cs = getComputedStyle(el)

  return [
    cs.getPropertyValue(THEME_CSS_PROPS.BG_DARK).trim(),
    cs.getPropertyValue(THEME_CSS_PROPS.TEXT_MUTED_ON_DARK).trim(),
    cs.getPropertyValue(NAV_SEARCH_CSS_PROPS.NEON_TEAL).trim(),
    cs.getPropertyValue(NAV_SEARCH_CSS_PROPS.NEON_MAGENTA).trim(),
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
 * Glitch-portrait demo — paints a portrait silhouette to an offscreen
 * canvas once, then per frame redraws it whole plus an intermittent
 * burst of horizontal slices displaced left/right in alternating
 * neon tints — the channel split the real session produces around the
 * portrait's edges.
 * @param ctx The demo context (stage owns the canvas).
 * @returns Teardown — cancels the loop.
 */
export const mountGlitchDemo = ({ stage }: DemoContext): (() => void) => {
  const canvas = stage.querySelector<HTMLCanvasElement>(`.${ANIM_DEMO_CLASSES.CANVAS}`)

  const setup = canvas && ctx2d(canvas)

  if (!setup) return () => undefined

  const [ctx, w, h] = setup

  const [ground, silhouette, teal, magenta] = readInks(canvas)

  // Portrait plate — a centered photo frame holding a painted bust
  // (head, neck, shoulders clipped to the plate), painted once. The
  // real surface glitches an actual decoded image; the plate reads as
  // a photograph so the corruption bursts read as channel splits.
  const off = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  off.width = w
  off.height = h

  const octx = off.getContext('2d')

  // The offscreen 2D context resolves wherever the stage canvas's did
  // (the caller already passed ctx2d()) — a null here only happens on
  // drivers where 2D vanished between setup and paint, so skip the plate.
  if (octx) {
    octx.fillStyle = ground
    octx.fillRect(0, 0, w, h)

    // The photo plate — portrait aspect, centered, slightly lifted
    // from the stage so the photo reads.
    const pw = Math.min(w * 0.34, h * 0.82)
    const ph = pw * 1.28
    const px = (w - pw) / 2
    const py = (h - ph) / 2

    octx.save()
    octx.beginPath()
    octx.rect(px, py, pw, ph)
    octx.clip()

    const grad = octx.createLinearGradient(px, py, px, py + ph)
    grad.addColorStop(0, silhouette)
    grad.addColorStop(1, ground)

    octx.fillStyle = grad
    octx.fillRect(px, py, pw, ph)

    // The bust — head oval, neck, tapered shoulders, ground ink.
    const cx = w / 2
    const headW = pw * 0.34
    const headH = headW * 1.22
    const hy = py + ph * 0.34

    octx.fillStyle = ground
    octx.beginPath()
    octx.ellipse(cx, hy, headW, headH, 0, 0, Math.PI * 2)
    octx.fill()

    octx.fillRect(cx - headW * 0.32, hy + headH * 0.8, headW * 0.64, headH * 0.5)

    octx.beginPath()
    octx.moveTo(cx - pw * 0.46, py + ph)
    octx.quadraticCurveTo(cx - pw * 0.4, hy + headH * 1.3, cx - headW * 0.3, hy + headH * 1.15)
    octx.lineTo(cx + headW * 0.3, hy + headH * 1.15)
    octx.quadraticCurveTo(cx + pw * 0.4, hy + headH * 1.3, cx + pw * 0.46, py + ph)
    octx.closePath()
    octx.fill()

    // Faint scanlines inside the plate — the analog texture the real
    // session corrupts.
    octx.globalAlpha = 0.08
    octx.fillStyle = ground

    for (let y = py + 2; y < py + ph; y += 4) {
      octx.fillRect(px, y, pw, 1)
    }

    octx.globalAlpha = 1
    octx.restore()
  }

  /** One settled frame under reduced motion. */
  const still = () => {
    ctx.drawImage(off, 0, 0)
  }

  if (reducedMotion()) {
    still()

    return () => undefined
  }

  let raf = 0
  let t = 0

  const slice = () => {
    for (let i = 0; i < _GLITCH_SLICES; i++) {
      const sy = Math.random() * h
      const sh = 4 + Math.random() * (h * 0.08)
      const dx = (Math.random() - 0.5) * 2 * _GLITCH_SHIFT

      ctx.drawImage(off, 0, sy, w, sh, dx, sy, w, sh)

      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.35
      ctx.fillStyle = i % 2 ? teal : magenta
      ctx.fillRect(0, sy, w, sh)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  const frame = () => {
    ctx.drawImage(off, 0, 0)

    t = (t + 1) % _GLITCH_PERIOD

    if (t < _GLITCH_SLICES * 2) slice()

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  return () => cancelAnimationFrame(raf)
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

/** Mesh dot rows — the portrait halo's concentric lattice depth. */
const _MESH_ROWS = 5

/** Dots per lattice row — dense enough to read as a ring ribbon. */
const _MESH_DOTS = 40

/** Precessing guide-line count — the radiating dotted spokes. */
const _MESH_GUIDES = 3

/**
 * About-mesh demo — a miniature of the portrait's light-field halo:
 * concentric dot rows whose radius oscillates with a traveling radial
 * sinusoid, plus slowly precessing dotted guide spokes — the undulating
 * lattice ring the real mesh.ts paints behind the About photo.
 * @param ctx The demo context (stage owns the canvas).
 * @returns Teardown — cancels the loop.
 */
export const mountMeshDemo = ({ stage }: DemoContext): (() => void) => {
  const canvas = stage.querySelector<HTMLCanvasElement>(`.${ANIM_DEMO_CLASSES.CANVAS}`)

  const setup = canvas && ctx2d(canvas)

  if (!setup) return () => undefined

  const [ctx, w, h] = setup

  const [ground, faint, teal] = readInks(canvas)

  const cx = w / 2
  const cy = h / 2
  const r0 = Math.min(w, h) * 0.16
  const rStep = Math.min(w, h) * 0.055

  /** One lattice paint at phase t — the row radius breathes with the
   *  traveling sinusoid, dots shrink toward the rim. */
  const paint = (t: number) => {
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = teal

    for (let row = 0; row < _MESH_ROWS; row++) {
      const base = r0 + row * rStep

      for (let i = 0; i < _MESH_DOTS; i++) {
        const a = (i / _MESH_DOTS) * Math.PI * 2 + t * 0.003 * (row % 2 ? 1 : -1)
        const wave = Math.sin(a * 3 - t * 0.02 + row) * rStep * 0.35
        const r = base + wave

        ctx.globalAlpha = 0.9 - row * 0.15
        ctx.fillRect(
          cx + Math.cos(a) * r - 1,
          cy + Math.sin(a) * r - 1,
          2.2 - row * 0.25,
          2.2 - row * 0.25
        )
      }
    }

    // Guide spokes — dotted radial lines precessing slowly.
    ctx.globalAlpha = 0.35
    ctx.fillStyle = faint

    for (let g = 0; g < _MESH_GUIDES; g++) {
      const a = (g / _MESH_GUIDES) * Math.PI * 2 + t * 0.001

      for (let r = r0; r < r0 + _MESH_ROWS * rStep + rStep; r += 6) {
        ctx.fillRect(cx + Math.cos(a) * r - 0.5, cy + Math.sin(a) * r - 0.5, 1.2, 1.2)
      }
    }

    ctx.globalAlpha = 1
  }

  if (reducedMotion()) {
    paint(0)

    return () => undefined
  }

  let raf = 0
  let t = 0

  const frame = () => {
    t++

    paint(t)

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  return () => cancelAnimationFrame(raf)
}
