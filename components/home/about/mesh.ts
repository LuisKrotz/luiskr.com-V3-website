/**
 * @file about/mesh.ts — the portrait's light-field mesh: a polar dot lattice
 * displaced by a traveling radial wave, painted on a 2D canvas behind the
 * portrait. Five radius rows around the photo edge carry ~200 dots each;
 * every dot's radius oscillates with a rotating sinusoid, so the lattice
 * reads as an undulating mesh ribbon rather than a stroked circle. Three
 * dotted guide lines radiate outward at fixed angles, slowly precessing.
 *
 * Per-frame math stays synchronous on the main thread per the repo's
 * compute-placement rule — no awaits in the loop. Reduced-motion paints
 * one static frame and stops.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { CANVAS_PAINT_CSS } from '@core/tokens/canvas/paint.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { framePool } from '@core/utils/motion/frame.js'
import store from '@core/store.js'
import type { AboutSection } from '../AboutSection.js'

/** Live mesh session parked on the host. */
export interface MeshSession {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  raf: number
  ro: ResizeObserver | null
  io: IntersectionObserver | null
  /** True only while the canvas intersects the viewport — the loop parks
   *  offscreen instead of burning a ~3k-dot raster nobody can see. */
  visible: boolean
  /** rAF timestamp of the last painted frame — the 60 Hz paint cap. */
  lastPaint: number
  w: number
  h: number
  t0: number
  /** Re-measures the canvas box and re-stamps the backing store. */
  size: () => void
}

/** Lattice tunables — picture-wrapper selector, dot rows, radial spoke
 *  count, and the dotted guide-line angles (radians) the mesh draws over. */
const _SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`
const _ROW_COUNT = 11
const _SPOKES = 260
const _TWO_PI = Math.PI * 2
const _LINES = [0.5, 2.4, 4.1] // radian angles of the dotted guide lines

/**
 * Paint-rate ceiling (Hz). The lattice's fastest component is the traveling
 * wave at 1.4 rad/s (~0.22 cycles/s) — far below 60 Hz, so capping paints
 * here is visually identical to a full-rate loop while spending a quarter
 * of the raster on a 240 Hz timeline. Uncapped, ~2,860 `fillRect`s per
 * frame pushed the desktop scroll-fps p95 over its 8.33 ms ceiling.
 */
const _PAINT_HZ = 60

/** Cached dot ink (`r,g,b` string) + the theme flag it resolved under. */
let _ink: string | null = null

let _inkDark = false

/**
 * Dot ink — the lattice paints in `--text-muted` so the mesh reads on
 * whatever theme field sits behind the portrait (the old fixed mid-grey
 * vanished on the light paper wash: "animation is not visible"). The
 * palette re-samples on a theme flip only — per-frame paints read the
 * cached channel string, so the loop never pays a getComputedStyle.
 * @returns `r,g,b` channel string for rgba() composition.
 */
function meshInk(): string {
  const dark = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

  if (_ink && _inkDark === dark) return _ink

  const cs = getComputedStyle(document.documentElement)

  const resolved = cs.getPropertyValue(THEME_CSS_PROPS.TEXT_MUTED).trim()

  // MESH_GREY is a literal hex token — always parses, so the `||` chain can
  // never produce null; the cast just narrows the type for the map below.
  const tri = (parseCssColor(resolved) || parseCssColor(CANVAS_PAINT_CSS.MESH_GREY)) as number[]

  _ink = tri.map((n) => Math.round(n * 255)).join(',')

  _inkDark = dark

  return _ink
}

/**
 * Deterministic hash → pseudo-random 0..1 per lattice site — the static
 * per-dot jitter that breaks the rings' regularity into an organic field.
 * @param row lattice row index
 * @param i dot index within the row
 */
function hash(row: number, i: number): number {
  const x = Math.sin(i * 12.9898 + row * 78.233) * 43758.5453

  return x - Math.floor(x)
}

/**
 * Paints one frame of the lattice: 9 dense dot rows around the photo edge,
 * each dot displaced by a two-harmonic traveling wave plus a fixed hash
 * jitter — the warped-fabric look of the reference band; guide lines are
 * dotted spokes drifting at a slow angular rate.
 * @param s the live session
 * @param now rAF timestamp (ms)
 */
function paint(s: MeshSession, now: number): void {
  if (!s.w || !s.h) s.size()

  if (s.w < 2 || s.h < 2) return

  const t = (now - s.t0) / 1000
  const cx = s.w / 2
  const cy = s.h / 2
  const half = Math.min(s.w, s.h) / 2

  s.ctx.clearRect(0, 0, s.w, s.h)
  s.ctx.fillStyle = `rgba(${meshInk()}, 1)`

  const amp = half * 0.06 * (0.8 + 0.2 * Math.sin(t * 0.9))
  const sigma = half * 0.028 // lens waist — gaussian falloff across the band
  const bandC = half * 0.055 // band center offset above the photo edge

  // Radial ray lattice: for each spoke θ a column of dots marches outward
  // from the photo edge; every column gets displaced by the SAME wave —
  // gaussian-tapered so the lens bulge is strongest at band center and
  // fades to nothing at both edges (light bending around the disc).
  for (let i = 0; i < _SPOKES; i++) {
    const th = (i / _SPOKES) * _TWO_PI
    const w1 = Math.sin(5 * th - t * 1.4)
    const w2 = 0.45 * Math.sin(3 * th + t * 0.7)
    const w = w1 + w2
    const c = Math.cos(th)
    const sn = Math.sin(th)

    for (let row = 0; row < _ROW_COUNT; row++) {
      const d = (row - (_ROW_COUNT - 1) / 2) * half * 0.02 + bandC
      const g = Math.exp(-((d - bandC) * (d - bandC)) / (sigma * sigma))
      const j = hash(row, i)
      const r = half * 0.55 + d + amp * w * g + (j - 0.5) * half * 0.008
      const x = cx + r * c
      const y = cy + r * sn

      s.ctx.globalAlpha = (0.15 + 0.55 * Math.abs(w1) + 0.12 * j) * (0.35 + 0.65 * g)
      s.ctx.fillRect(x, y, 1.3, 1.3)
    }
  }

  s.ctx.globalAlpha = 0.4

  for (const a of _LINES) {
    const ang = a + t * 0.03

    for (let d = half * 0.64; d < half * 0.95; d += half * 0.018) {
      s.ctx.fillRect(cx + d * Math.cos(ang), cy + d * Math.sin(ang), 1.4, 1.4)
    }
  }

  s.ctx.globalAlpha = 1
}

/**
 * Arms the mesh on the portrait wrapper: creates the canvas, sizes it to
 * the wrapper box (×1.9 bleed for the outer ring + lines), and starts the
 * rAF loop unless motion is reduced. Self-healing — a re-render detaches
 * the canvas, so callers re-arm from onUpdated. Idempotent.
 * @param host The <about-section> component the session parks on.
 * @returns true when a session is running.
 */
export function attachMesh(host: AboutSection): boolean {
  if (host._mesh) {
    // Self-heal after a shadow-root re-render — the session survives but
    // its canvas was detached with the dead wrapper; re-mount it live.
    const s = host._mesh
    const wrap = host.shadowRoot?.querySelector<HTMLElement>(_SEL)

    if (!wrap) return false
    if (!s.canvas.isConnected) {
      wrap.appendChild(s.canvas)
      s.w = 0
      s.h = 0
    }

    return true
  }

  const wrap = host.shadowRoot?.querySelector<HTMLElement>(_SEL)

  if (!wrap) return false

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  let ctx: CanvasRenderingContext2D | null = null

  try {
    ctx = canvas.getContext(WEBGL_STRINGS.CONTEXT_2D) as CanvasRenderingContext2D | null
  } catch {
    ctx = null
  }

  if (!ctx) return false

  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  canvas.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_MESH
  wrap.appendChild(canvas)

  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const size = () => {
    const r = canvas.getBoundingClientRect()

    s.w = r.width
    s.h = r.height
    canvas.width = Math.max(2, Math.round(r.width * dpr))
    canvas.height = Math.max(2, Math.round(r.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const s: MeshSession = {
    canvas,
    ctx,
    raf: 0,
    ro: null,
    io: null,
    visible: false,
    lastPaint: 0,
    w: 0,
    h: 0,
    t0: performance.now(),
    size,
  }

  if (typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
    s.ro = new ResizeObserver(size)
    s.ro.observe(canvas)
  }

  if (store.getters.getReducedMotion?.()) {
    s.raf = framePool.request((now) => paint(s, now))
  } else {
    const loop = (now: number) => {
      // The queued id is consumed — the IO re-arm check below keys off
      // `s.raf === 0` to mean "no frame pending", same contract the
      // spring loops use.
      s.raf = 0

      // Offscreen — park the chain entirely; the IntersectionObserver
      // re-arms it on the next entry. Without this gate the lattice
      // rastered ~3k dots per frame through the whole page scroll.
      if (!s.visible) return

      // 60 Hz paint cap — skip (don't paint) frames that arrive faster
      // than the lattice can visibly change. framePool additionally
      // starves the whole queue during scroll flings, so the ambient
      // lattice never competes with gesture frames.
      if (now - s.lastPaint >= 1000 / _PAINT_HZ) {
        paint(s, now)
        s.lastPaint = now
      }

      s.raf = framePool.request(loop)
    }

    if (typeof IntersectionObserver !== TYPE_STRINGS.UNDEFINED) {
      s.io = new IntersectionObserver((entries) => {
        s.visible = entries[0]?.isIntersecting === true

        // Re-entry — restart the parked chain.
        if (s.visible && !s.raf) s.raf = framePool.request(loop)
      })

      s.io.observe(canvas)
    } else {
      // No IO — fall back to the always-on loop so the mesh still animates.
      s.visible = true
      s.raf = framePool.request(loop)
    }
  }

  host._mesh = s

  return true
}

/** Stops the loop and detaches the canvas when the element unmounts. */
export function disarmMesh(host: AboutSection): void {
  const s = host._mesh

  if (!s) return

  // s.raf is a framePool virtual id — plain cancelAnimationFrame could
  // collide with an unrelated live rAF holding the same number.
  framePool.cancel(s.raf)
  s.ro?.disconnect()
  s.io?.disconnect()
  s.canvas.remove()
  host._mesh = null
}
