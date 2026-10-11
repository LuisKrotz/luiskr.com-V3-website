/**
 * @file mosaic/burn.ts — paper-combustion title effect for <home-mosaic>.
 *
 * When a card expands (hover / touch-expand) its overlay title burns away
 * bottom→top like a sheet of paper held to a flame — each letter bucket
 * climbing at its own speed so glyphs ignite and vanish at different
 * moments — while a rewritten copy of the title types itself above the
 * description panel.
 *
 * Mechanism (2D canvas — the text is fully self-drawn, no CORS limits):
 *
 *   raster   — the h2 is re-rendered onto an offscreen "paper" canvas at
 *              the DOM glyph positions (font, letter-spacing, uppercase,
 *              manual word-wrap matching the DOM line box)
 *   erode    — each frame a ragged burn front climbs upward, one speed
 *              per detected glyph (`letters` ink runs); the region
 *              below it is erased via `destination-out`
 *   scorch   — per letter, a `source-atop` gradient band chars only the
 *              ink just above that letter's live front (source-atop
 *              touches ink pixels only — letter gaps stay clean), plus a
 *              soft ink-clipped ember wash where the edge smoulders
 *   particles— embers (bright, rise + flicker + wobble) and char flecks
 *              (dark, curl up then tumble) spawn only where a live front
 *              meets actual glyph ink, and dissolve mid-air; on rebuild
 *              they invert into deposits — motes seeded in the still
 *              empty zone above each letter fall top→bottom and land on
 *              the climbing front, knitting the glyph back into place
 *   rewrite  — a slot is inserted above the description containing an
 *              aria-hidden spacer (holds layout so nothing reflows) and a
 *              <draw-text> clone replaying the title, char by char
 *   rebuild  — on un-hover the raster stitches back bottom→top: the
 *              erase mask sits ABOVE a still-climbing front (stage =
 *              1 − prog), so letters re-ink base-to-cap while deposit
 *              particles rain down onto the moving edge — then the DOM
 *              ink takes the pixels back
 *              with a zero-seam handoff
 *
 * Burn duration is capped to the description's draw time so the last
 * ember dies as the description finishes writing; the rebuild replays
 * at ~55% of that length. Reduced motion skips the canvas entirely:
 * the h2 hides instantly and the slot shows static text. The h2 DOM
 * node stays mounted throughout (a11y + fallback); only its ink is
 * hidden while the canvas owns the pixels.
 */

import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { MOSAIC_SELECTORS } from '@core/tokens/selectors/mosaic.js'
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { syncCanvasFont, canvasTransformText } from '@core/utils/canvas/dom-font.js'
import store from '@core/store.js'
import type { MosaicItem } from './pack.js'
import type { HomeMosaic } from '../HomeMosaic.js'

// ── Tunables ─────────────────────────────────────────────────────────────

/** Device-pixel cap on the burn canvas — glow beyond 2× is invisible. */
const _DPR_CAP = 2
/** Side/vertical bleed (css px) around the title box — embers need room. */
const _PAD_X = 26
const _PAD_TOP = 34
const _PAD_BOTTOM = 8
/** Jagged-edge amplitude as a fraction of the paper height — a small
 *  organic waver on top of the per-letter speed spread. */
const _JAG_RATIO = 0.08
/**
 * Per-letter burn-speed range — each glyph bucket burns between ~55%
 * and ~145% of the base rate, so letters vanish at visibly different
 * moments while all still finish inside the description's draw time.
 */
const _COL_SPEED_MIN = 0.7
const _COL_SPEED_SPAN = 1.3
/** Scorch-band height below the burn front (fraction of letter height). */
const _SCORCH_RATIO = 0.09
/** Scorch-band minimum height in device px (tiny letters still char visibly). */
const _BAND_MIN = 6
/** Opacity of the char band laid over ink just above the front. */
const _BAND_ALPHA = 0.82
/** Opacity of the additive ember wash hugging the live front. */
const _GLOW_ALPHA = 0.55
/** X stride for tracing a letter's jagged front polygon (device px). */
const _FRONT_STEP = 3
/** Seconds the front spends travelling the paper. Falls under desc time. */
const _BURN_MS_MIN = 450
const _BURN_MS_MAX = 2400
/** Per-char desc draw estimate (ms) — mirrors the 8ms char delay + draw. */
const _DESC_CHAR_MS = 8
const _DESC_TAIL_MS = 260
/** Particle budget — hard cap on live embers + flecks. */
const _P_MAX = 110
/** Ember spawn per second along the front while it burns. */
const _SPAWN_PER_S = 90
/** Fraction of spawns that are dark char flecks (rest are embers). */
const _CHAR_FRACTION = 0.3
/** Particle lifetime bounds (seconds). */
const _EMBER_LIFE_MIN = 0.35
const _EMBER_LIFE_MAX = 0.9
const _FLECK_LIFE_MIN = 0.5
const _FLECK_LIFE_MAX = 1.1
/** Ember upward velocity bounds (canvas px/s). */
const _EMBER_VY_MIN = 26
const _EMBER_VY_MAX = 74
const _EMBER_VX = 18
/** Fleck launch velocity + gravity pull (canvas px/s, px/s²). */
const _FLECK_VY = 46
const _FLECK_VX = 22
const _FLECK_G = 60
/**
 * Rebuild deposit launch speed (canvas px/s) — motes leave the empty
 * zone drifting down gently, then _FLECK_G accelerates the fall.
 */
const _DEPOSIT_VY = 18
/** Particle size bounds in device px. */
const _EMBER_SIZE = 2.2
const _FLECK_SIZE = 3.4
/** Byte offset of the alpha channel inside a getImageData pixel quad. */
const _ALPHA_STRIDE = 3
/** Alpha floor for "has ink" — anti-aliased feather below ~12% is ignored. */
const _INK_ALPHA_MIN = 32
/**
 * Max ignition delay, as a fraction of total progress — letters catch
 * fire anywhere in the first ~fifth of the burn.
 */
const _IGNITE_DELAY = 0.15
/**
 * Progress at which the slowest letter finishes — the last glyph ashes
 * out just before the description's final chars land, never after.
 */
const _BURN_END = 0.92
/** Ember glow band height, as a share of letter height. */
const _GLOW_RATIO = 0.55
/**
 * Rebuild speed on un-hover — the un-burn replays the consume front
 * downward at this fraction of the burn duration, so rebuilding the
 * title reads quicker than burning it away while staying visible.
 */
const _REBUILD_RATIO = 0.55

/** A live combustion session, keyed by card element in `_sessions`. */
export interface BurnSession {
  /** Overlay canvas absolutely positioned over the title box. */
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** Pre-rasterized "paper" — the title text as a drawable image. */
  paper: HTMLCanvasElement
  /** Canvas box in device px. */
  w: number
  h: number
  /** Paper (title box) offset inside the canvas — the pad bleeds embers. */
  paperX: number
  paperY: number
  paperW: number
  paperH: number
  /** Seconds elapsed — noise/particle clock (forward progress derives from it). */
  t: number
  dur: number
  /**
   * Burn progress 0..1 while rebuilding — captured from the forward clock
   * at disarm, then counted down; burnPaper re-derives the raster from
   * the pristine paper every frame, so shrinking progress un-erases the
   * glyphs (a true time-reverse of the consume front).
   */
  prog: number
  /** Direction: 1 combusts forward, −1 un-burns back to whole text. */
  dir: number
  lastT: number
  raf: number
  active: boolean
  /** Owning card — teardown restores its classes and removes the slot. */
  cardEl: Element
  /** Live particles (embers + char flecks). */
  particles: BurnParticle[]
  /**
   * Per-glyph burn units — detected as ink column-runs in the rasterized
   * paper (a space's gap splits runs, so each bucket IS a letter, not a
   * fixed grid slice). Each letter owns an ignition delay + burn speed:
   * fast letters fully char and dissolve while slow neighbours still
   * stand untouched — the effect consumes the text letter by letter.
   */
  letters: LetterBurn[]
  /** Paper-x → owning letter index (nearest letter for gap columns). */
  colLetter: Int16Array
  /** Paper-x → ink coverage flag (0/1) — embers only spawn on glyph ink. */
  colInk: Uint8Array
  /**
   * Working raster — every frame rebuilds the burned text here (paper →
   * char-darken → erode), then blits into the display canvas so the
   * compositing never collides with particles.
   */
  work: HTMLCanvasElement
  workCtx: CanvasRenderingContext2D
  /**
   * Live DOM nodes — re-measured every frame. The card's expand ease
   * animates the h2's `cqw` font-size and flex-end position for ~0.42s;
   * rasterizing once at arm time froze a mid-transition font into the
   * paper, which rendered as "the effect changed the font size". The
   * paper re-rasterizes whenever the DOM box moves so the burning copy
   * is always pixel-identical to what the DOM would show.
   */
  titleEl: HTMLElement
  overlayEl: HTMLElement
  /** Theme-resolved inks — read once from the CSS burn palette. */
  ink: BurnInk
  /**
   * The title's resolved ink color captured BEFORE the DOM glyphs hide —
   * the `burning` class sets `color: transparent`, so any re-raster after
   * the handoff would otherwise paint invisible text (the "whole word
   * vanishes" bug).
   */
  inkColor: string
  /** Arm-time title-box signature — set once; a truthy value freezes the raster. */
  lastBox: string
  /** Last tracked canvas-space position — position-only drift detector. */
  lastPos: string
}

/**
 * Combustion ink ramp — resolved from `--burn-*` CSS custom properties
 * (dark theme: cyan-blue plasma fire on the accent ramp; light theme:
 * airy paper-fire). Falls back to the fixed canvas inks where a runtime
 * lacks the custom properties.
 */
interface BurnInk {
  core: string
  mid: string
  edge: string
  scorch: string
}

/**
 * One glyph's burn unit — the ink-run span in the paper raster plus its
 * ignition profile. `v` is the burn-speed multiplier, `delay` the share
 * of total progress before this letter ignites (letters catch fire at
 * different moments), and y0/y1 bound the letter's ink extent so the
 * front only travels through its own glyph.
 */
interface LetterBurn {
  /** Column span inside the paper raster (device px). */
  x0: number
  x1: number
  /** Ink vertical extent inside the paper raster (device px). */
  y0: number
  y1: number
  /** Burn-speed multiplier — 0.55..1.45 of the global front rate. */
  v: number
  /** Ignition delay as a fraction of total progress (0..0.22). */
  delay: number
}

/** One combustion particle — an ember (bright, rises) or fleck (dark, curls). */
interface BurnParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  /** 0 = ember, 1 = char fleck. */
  kind: number
  /** Rotation for flecks (radians) + tumble speed. */
  rot: number
  spin: number
  /** Per-particle noise phase — keeps flicker/wobble desynced. */
  phase: number
  /**
   * Rebuild deposits only — the letter whose front this particle rains
   * onto. Undefined for burn particles, which simply rise and die.
   */
  L?: LetterBurn
}

/** Card element carrying a parked burn session. */
interface BurnCard extends Element {
  _burn?: BurnSession | null
}

/**
 * Deterministic smooth edge noise — three detuned sines read as an
 * organic flame line rather than static noise. `ph` (seconds) animates
 * the jag so the burn boundary itself licks sideways as it descends.
 */
function edgeNoise(x: number, ph: number): number {
  return (
    Math.sin(x * 0.09 + ph * 2.1) * 0.5 +
    Math.sin(x * 0.023 - ph * 1.3) * 0.34 +
    Math.sin(x * 0.17 + ph * 3.7) * 0.16
  )
}

/**
 * Rasterizes the h2 text into the paper canvas. Canvas can't line-wrap,
 * so words are measured and packed into lines matching the DOM box, then
 * drawn bottom-anchored like the overlay's `align-items: flex-end`.
 *
 * `cssW`/`cssH` are the title box in CSS px while the paper's backing
 * store is device px (cssW × dpr): canvas font and measureText units are
 * CSS px, so the context is scaled cssW→paper.width first — without the
 * transform the glyphs land at 1/dpr size on hidpi/fractional displays
 * (the "burn text renders smaller than the title" bug).
 * @param title The h2 element whose glyphs are re-rendered.
 * @param paper Offscreen canvas sized in device px.
 * @param cssW Title box width in CSS px.
 * @param cssH Title box height in CSS px.
 * @param ink Pre-capture resolved ink color.
 */
function rasterizeTitle(
  title: HTMLElement,
  paper: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  ink: string
): void {
  const ctx = paper.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return

  // Map CSS-px drawing onto the device-px backing store (≈dpr, exact
  // through the rounded canvas width). One uniform scale — splitting
  // x/y over independently-rounded edges would distort the glyphs.
  const scale = paper.width / cssW

  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const st = getComputedStyle(title)

  // Full DOM typography — shorthand + stretch/variant/kerning/letter-
  // spacing/feature/variation axes — so the paper never drifts from the
  // title's real glyphs (the "effect changed the font" bug class). Ink
  // comes from the pre-hide capture: the element's live color is
  // transparent while the canvas owns the pixels.
  syncCanvasFont(ctx, st)
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'

  const text = canvasTransformText(
    (title.textContent || ATTR_VALUES.EMPTY).trim(),
    st.textTransform
  )
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line: string = ATTR_VALUES.EMPTY

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word

    if (line && ctx.measureText(trial).width > cssW) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }

  if (line) lines.push(line)
  if (!lines.length) return

  const fontPx = parseFloat(st.fontSize) || 12
  const lineH = parseFloat(st.lineHeight) || fontPx * 1.2
  const descent = fontPx * 0.22

  // Anchor the block to the paper's bottom like flex-end does in the DOM.
  const firstBase = cssH - (lines.length - 1) * lineH - descent

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, firstBase + i * lineH)
  }
}

/**
 * A letter's own burn progress — global progress scaled by the letter's
 * speed, shifted by its ignition delay. Letters ignite at different
 * moments and race at different rates, so one glyph can be ash while a
 * neighbour is untouched.
 */
function letterProgress(L: LetterBurn, progress: number): number {
  return Math.min(1, Math.max(0, progress * L.v - L.delay))
}

/**
 * Per-column burn front inside one letter — the paper-space y of the
 * live edge at column x. The front climbs BOTTOM→TOP through the
 * letter's own ink extent (y1 → y0), so a descender's stem burns up from
 * the baseline, not from the paper's bottom edge.
 */
function letterFrontY(
  s: BurnSession,
  L: LetterBurn,
  x: number,
  progress: number,
  jagAmp: number
): number {
  const p = letterProgress(L, progress)

  // Once a letter has fully burned, push the front above the paper so the
  // destination-out consume polygon erases every last pixel — otherwise
  // anti-aliased tops or noise can leave faint residual lines.
  if (p >= 1) return -1

  const travel = L.y1 - L.y0 + jagAmp * 2

  return L.y1 + jagAmp - p * travel + edgeNoise(x, s.t * 3) * jagAmp
}

/**
 * Spawns particles along live letter fronts. `rate` is fractional — the
 * accumulator pattern (spawn whole particles, keep the remainder in
 * `t`-space implicitly by probabilistic gating) keeps density steady
 * without a second counter. Emissions come only from columns that
 * carry glyph ink and whose letter front is mid-flight, so embers pour
 * off burning edges — never out of the spaces between letters.
 *
 * Burn sessions (dir +1) emit AT the front with upward velocity — the
 * classic rising-ember look. Rebuild sessions (dir −1) instead seed the
 * still-empty zone ABOVE the front and launch downward: deposits rain
 * top→bottom and land on the climbing edge, knitting the glyphs back.
 */
function spawn(s: BurnSession, progress: number, jagAmp: number, dt: number): void {
  const want = _SPAWN_PER_S * dt
  const rebuild = s.dir < 0

  for (let i = 0; i < want; i++) {
    if (Math.random() > want - i) continue
    if (s.particles.length >= _P_MAX) return

    const L = s.letters[(Math.random() * s.letters.length) | 0]

    if (!L) return

    const xp = Math.round(L.x0 + Math.random() * (L.x1 - L.x0))

    if (!s.colInk[xp]) continue

    const fy = letterFrontY(s, L, xp, progress, jagAmp)

    // The front only emits while it is inside the letter's ink extent —
    // pre-ignition and fully-consumed letters spawn nothing.
    if (fy < L.y0 - jagAmp || fy > L.y1 + jagAmp) continue

    // Rebuild seeds anywhere in the empty zone above the front — as the
    // edge nears the ink top the zone shrinks to nothing and deposits
    // land the same frame they spawn.
    const zoneTop = L.y0 - jagAmp
    const x = s.paperX + xp
    const y = rebuild
      ? s.paperY + zoneTop + Math.random() * Math.max(0, fy - zoneTop)
      : s.paperY + fy

    const fleck = Math.random() < _CHAR_FRACTION
    const maxLife = fleck
      ? _FLECK_LIFE_MIN + Math.random() * (_FLECK_LIFE_MAX - _FLECK_LIFE_MIN)
      : _EMBER_LIFE_MIN + Math.random() * (_EMBER_LIFE_MAX - _EMBER_LIFE_MIN)

    s.particles.push({
      x,
      y,
      vx: (Math.random() * 2 - 1) * (fleck ? _FLECK_VX : _EMBER_VX),
      vy: rebuild
        ? Math.random() * _DEPOSIT_VY
        : fleck
          ? -(Math.random() * _FLECK_VY)
          : -(_EMBER_VY_MIN + Math.random() * (_EMBER_VY_MAX - _EMBER_VY_MIN)),
      life: 0,
      maxLife,
      size: fleck ? 1 + Math.random() * _FLECK_SIZE : 0.8 + Math.random() * _EMBER_SIZE,
      kind: fleck ? 1 : 0,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() * 2 - 1) * 6,
      phase: Math.random() * Math.PI * 2,
      L: rebuild ? L : undefined,
    })
  }
}

/**
 * Resolves the burn palette from the root CSS custom properties — dark
 * theme publishes a cyan-blue plasma ramp, light theme an airy
 * paper-fire ramp. Falls back to the fixed canvas inks when the
 * properties are absent (older stylesheet, non-themed host).
 */
function readBurnInk(): BurnInk {
  const root = typeof document !== TYPE_STRINGS.UNDEFINED ? document.documentElement : null
  const cs = root ? getComputedStyle(root) : null
  const pick = (prop: string, fallback: string): string =>
    (cs?.getPropertyValue(prop) || ATTR_VALUES.EMPTY).trim() || fallback

  return {
    core: pick(THEME_CSS_PROPS.BURN_CORE, CANVAS_STRINGS.EMBER_CORE),
    mid: pick(THEME_CSS_PROPS.BURN_MID, CANVAS_STRINGS.EMBER_MID),
    edge: pick(THEME_CSS_PROPS.BURN_EDGE, CANVAS_STRINGS.EMBER_MID),
    scorch: pick(THEME_CSS_PROPS.BURN_SCORCH, CANVAS_STRINGS.BURN_SCORCH),
  }
}

/**
 * Anchors the canvas once at arm size, then tracks POSITION only. The
 * card's expand ease animates the h2's `cqw` font-size for ~0.42s after
 * hover; re-measuring the box every step baked that shrink into the
 * raster, so the burning glyphs visibly collapsed with the DOM font (the
 * reported font-reduction bug). Freezing the raster keeps the title the
 * size it was when it caught fire — only the canvas slides along the
 * moving box. `lastBox`/`lastPos` signatures skip all work when nothing
 * moved.
 */
function syncPaper(s: BurnSession): void {
  const box = s.titleEl.getBoundingClientRect()
  const oBox = s.overlayEl.getBoundingClientRect()

  if (box.width < 4 || box.height < 4 || oBox.width < 1) return

  const posSig = `${box.left - oBox.left},${box.top - oBox.top}`

  // Paper already rasterized — position-only re-anchor, never re-measure.
  if (s.lastBox) {
    if (posSig === s.lastPos) return

    s.lastPos = posSig

    s.canvas.style.left = `${box.left - oBox.left - _PAD_X}px`
    s.canvas.style.top = `${box.top - oBox.top - _PAD_TOP}px`

    return
  }

  const dpr = Math.min(_DPR_CAP, globalThis.devicePixelRatio || 1)

  s.lastBox = `${box.width},${box.height},${dpr}`
  s.lastPos = posSig

  const cssW = box.width + _PAD_X * 2
  const cssH = box.height + _PAD_TOP + _PAD_BOTTOM
  const w = Math.max(2, Math.round(cssW * dpr))
  const h = Math.max(2, Math.round(cssH * dpr))

  s.w = w
  s.h = h
  s.paperW = Math.max(2, Math.round(box.width * dpr))
  s.paperH = Math.max(2, Math.round(box.height * dpr))
  s.paperX = _PAD_X * dpr
  s.paperY = _PAD_TOP * dpr

  s.canvas.width = w
  s.canvas.height = h
  s.canvas.style.left = `${box.left - oBox.left - _PAD_X}px`
  s.canvas.style.top = `${box.top - oBox.top - _PAD_TOP}px`
  s.canvas.style.width = `${cssW}px`
  s.canvas.style.height = `${cssH}px`

  s.paper.width = s.paperW
  s.paper.height = s.paperH
  rasterizeTitle(s.titleEl, s.paper, box.width, box.height, s.inkColor)
  analyzePaper(s)
}

/**
 * Reads the rasterized paper's alpha channel to locate each glyph:
 * columns that carry ink form runs — a space leaves a transparent gap,
 * so each contiguous run IS one letter (kerned pairs may fuse, which
 * just makes them burn as a unit). Builds:
 *
 *  - `colInk`: 1 where a paper-x column has any glyph pixel — ember
 *    spawning and the char band use it so nothing glows in the spaces.
 *  - `letters`: per-run ink bounds (x0..x1, y0..y1) plus a random burn
 *    speed and ignition delay. Speeds spread 0.55..1.45×, delays up to
 *    22% of total progress — letters catch at different moments and
 *    burn at different paces.
 *  - `colLetter`: paper-x → owning letter index; gap columns bind to
 *    the nearest run so the erase polygon stays coherent across spaces.
 *
 * Finally every letter's speed is normalized so the SLOWEST ignitor
 * finishes at ~98% progress — the burn ends with the description's
 * typing, never after.
 */
function analyzePaper(s: BurnSession): void {
  const ctx = s.paper.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return

  const pw = s.paperW
  const ph = s.paperH
  const data = ctx.getImageData(0, 0, pw, ph).data

  s.colInk = new Uint8Array(pw)
  s.colLetter = new Int16Array(pw).fill(-1)

  // Column ink extents — topmost / bottommost opaque row per column.
  const y0s = new Int32Array(pw).fill(-1)
  const y1s = new Int32Array(pw)

  for (let y = 0; y < ph; y++) {
    const row = y * pw * 4 + _ALPHA_STRIDE

    for (let x = 0; x < pw; x++) {
      if (data[row + x * 4] <= _INK_ALPHA_MIN) continue

      s.colInk[x] = 1

      if (y0s[x] < 0) y0s[x] = y

      y1s[x] = y
    }
  }

  // Ink runs → letters. A run ends where a gap column appears; trailing
  // gap columns are not part of the letter span.
  const letters: LetterBurn[] = []
  let x = 0

  while (x < pw) {
    while (x < pw && !s.colInk[x]) x++

    if (x >= pw) break

    const x0 = x
    let y0 = ph
    let y1 = 0

    while (x < pw && s.colInk[x]) {
      y0 = Math.min(y0, y0s[x])
      y1 = Math.max(y1, y1s[x])
      x++
    }

    letters.push({
      x0,
      x1: x,
      y0,
      y1,
      v: _COL_SPEED_MIN + Math.random() * _COL_SPEED_SPAN,
      delay: Math.random() * _IGNITE_DELAY,
    })
  }

  // Every column binds to its nearest letter — the gap between two runs
  // splits at its midpoint, so a front lookup inside a space still
  // resolves coherently.
  for (let li = 0; li < letters.length; li++) {
    const L = letters[li]
    const prev = letters[li - 1]
    const next = letters[li + 1]
    const lo = prev ? (prev.x1 + L.x0) >> 1 : 0
    const hi = next ? (L.x1 + next.x0) >> 1 : pw

    for (let cx = lo; cx < hi; cx++) s.colLetter[cx] = li
  }

  // Normalize: the last letter to finish lands at ~_BURN_END progress so
  // the combustion completes with the description typing. A letter's
  // finish progress is (1+delay)/v — scaling v by worst/_BURN_END pulls
  // the slowest finisher exactly onto _BURN_END (the reciprocal would
  // stretch it past progress 1 and freeze the burn mid-letter).
  let worst = 0

  for (const L of letters) worst = Math.max(worst, (1 + L.delay) / L.v)

  const norm = worst > 0 ? worst / _BURN_END : 1

  for (const L of letters) L.v *= norm

  s.letters = letters

  s.work.width = pw
  s.work.height = ph
}

/**
 * Advances + draws particles. Burn embers flicker upward on buoyancy and
 * flecks tumble down; rebuild deposits (dir −1) fall under gravity from
 * the empty zone above each letter and die the moment they reach the
 * climbing front — the landing reads as the glyph re-inking itself.
 */
function drawParticles(s: BurnSession, dt: number, stage: number, jagAmp: number): void {
  const { ctx } = s
  const rebuild = s.dir < 0

  ctx.save()

  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i]

    p.life += dt

    if (p.life >= p.maxLife) {
      s.particles.splice(i, 1)
      continue
    }

    const k = p.life / p.maxLife

    if (p.kind === 0) {
      // Ember — burn: buoyancy lifts it; rebuild: gravity pulls the
      // deposit down toward the front it landed from.
      p.vy += (rebuild ? _FLECK_G : -8) * dt
      p.x += p.vx * dt + Math.sin(p.phase + s.t * 9) * 14 * dt
      p.y += p.vy * dt

      const flick = 0.55 + 0.45 * Math.sin(p.phase + s.t * 31)
      const alpha = (1 - k) * flick

      // Rebuild: a deposit that reaches its letter's front has landed —
      // remove it so the glyph edge appears to swallow the mote.
      if (rebuild && p.L && p.y >= s.paperY + letterFrontY(s, p.L, p.x - s.paperX, stage, jagAmp)) {
        s.particles.splice(i, 1)
        continue
      }

      ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_LIGHTER
      ctx.globalAlpha = alpha
      ctx.fillStyle = k < 0.35 ? s.ink.core : k < 0.7 ? s.ink.mid : s.ink.edge
      ctx.fillRect(p.x, p.y, p.size, p.size)
    } else {
      // Char fleck — heat lifts it, then gravity wins; it tumbles dark.
      // Rebuild flecks already fall — same gravity keeps them sinking.
      p.vy += _FLECK_G * dt
      p.x += p.vx * dt + Math.sin(p.phase + s.t * 4) * 10 * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt

      if (rebuild && p.L && p.y >= s.paperY + letterFrontY(s, p.L, p.x - s.paperX, stage, jagAmp)) {
        s.particles.splice(i, 1)
        continue
      }

      ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
      ctx.globalAlpha = 1 - k
      ctx.fillStyle = s.ink.scorch
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7)
      ctx.restore()
    }
  }

  ctx.restore()
  ctx.globalAlpha = 1
}

/**
 * Rebuilds the burning title inside the work canvas for this frame.
 *
 * Layers, per letter (paper-space coords, i.e. 0..paperW / 0..paperH):
 *
 *  1. `paper` — the pristine glyph raster.
 *  2. Scorch — a `source-atop` band painted only over the letter's own
 *     span just above its live front; `source-atop` composites onto ink
 *     pixels only, so the glyph visibly chars dark before it erodes and
 *     the gaps between letters stay untouched.
 *  3. Ember glow — a soft `lighter` wash hugging the front, ink-clipped
 *     the same way: the glyph's still-alive lower edge smoulders.
 *  4. Consume — a `destination-out` polygon below each letter's jagged
 *     front erases the raster bottom-up at that letter's own pace.
 *
 * The composite then blits to the display canvas — the DOM ink is long
 * hidden, so what the user reads IS this raster burning through itself.
 */
function burnPaper(s: BurnSession, stage: number, jagAmp: number): void {
  const { workCtx: wc, paperW: pw, paperH: ph } = s
  const rebuild = s.dir < 0

  wc.setTransform(1, 0, 0, 1, 0, 0)
  wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
  wc.globalAlpha = 1
  wc.clearRect(0, 0, pw, ph)
  wc.drawImage(s.paper, 0, 0)

  // stage 0 only exists on the forward path — a rebuild's first frame has
  // already decremented prog below 1, so the fully-missing state paints
  // through the lp <= 0 column-clear instead.
  if (stage <= 0) return

  if (stage >= _BURN_END && !rebuild) {
    wc.clearRect(0, 0, pw, ph)
    return
  }

  // Band direction: burn chars the ink ABOVE the live front; rebuild
  // smolders BELOW it — the edge that just re-materialized.
  const bs = rebuild ? 1 : -1
  // Consume edge: burn erases below the front (ph + 1 anchor), rebuild
  // erases the still-missing top (-1 anchor).
  const edge = rebuild ? -1 : ph + 1

  for (const L of s.letters) {
    const lp = letterProgress(L, stage)

    // Skip letters with no live front: burn skips the un-ignited, rebuild
    // skips the fully restored.
    if (rebuild ? lp >= 1 : lp <= 0) continue

    const x0 = Math.max(0, L.x0 - 1)
    const x1 = Math.min(pw, L.x1 + 1)

    // Column-clear: burn's fully-consumed letter and rebuild's
    // still-missing letter both wipe the whole column.
    if (rebuild ? lp <= 0 : lp >= 1) {
      wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_DESTINATION_OUT
      wc.globalAlpha = 1
      wc.fillRect(x0, 0, x1 - x0, ph + 1)
      continue
    }

    const fy = (x: number): number => letterFrontY(s, L, x, stage, jagAmp)
    const span = L.x1 - L.x0

    // 1) Scorch band — chars the ink on the live side of the front.
    const band = Math.max(_BAND_MIN, (L.y1 - L.y0) * _SCORCH_RATIO)
    const frontTop = fy(L.x0)

    wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_ATOP
    wc.globalAlpha = _BAND_ALPHA
    wc.beginPath()
    wc.moveTo(L.x0, frontTop)

    for (let x = L.x0; x <= L.x1; x += _FRONT_STEP) wc.lineTo(x, fy(x))

    wc.lineTo(L.x1, fy(L.x1))

    for (let x = L.x1; x >= L.x0; x -= _FRONT_STEP) {
      wc.lineTo(x, fy(x) + bs * band * (1 + edgeNoise(x, s.t * 2.3) * 0.4))
    }

    wc.lineTo(L.x0, fy(L.x0) + bs * band * (1 + edgeNoise(L.x0, s.t * 2.3) * 0.4))
    wc.closePath()

    const sg = wc.createLinearGradient(0, frontTop, 0, frontTop + bs * band)

    sg.addColorStop(0, s.ink.scorch)
    sg.addColorStop(1, CANVAS_STRINGS.INK_CLEAR)
    wc.fillStyle = sg
    wc.fill()

    // 2) Ember glow — soft additive wash where the ink is alight.
    wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_ATOP
    wc.globalAlpha = _GLOW_ALPHA
    wc.beginPath()
    wc.moveTo(L.x0, frontTop)

    for (let x = L.x0; x <= L.x1; x += _FRONT_STEP) wc.lineTo(x, fy(x))

    wc.lineTo(L.x1, fy(L.x1))

    for (let x = L.x1; x >= L.x0; x -= _FRONT_STEP) {
      wc.lineTo(x, fy(x) + bs * span * _GLOW_RATIO * 0.4)
    }

    wc.lineTo(L.x0, fy(L.x0) + bs * span * _GLOW_RATIO * 0.4)
    wc.closePath()

    const eg = wc.createLinearGradient(0, frontTop, 0, frontTop + bs * band)

    eg.addColorStop(0, s.ink.mid)
    eg.addColorStop(1, CANVAS_STRINGS.INK_CLEAR)
    wc.fillStyle = eg
    wc.fill()

    // 3) Consume — burn erases below the ragged front, rebuild erases the
    // still-missing region above it so glyphs re-materialize bottom→top.
    wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_DESTINATION_OUT
    wc.globalAlpha = 1
    wc.beginPath()
    wc.moveTo(x0, edge)

    for (let x = x0; x <= x1; x += _FRONT_STEP) wc.lineTo(x, fy(x))

    wc.lineTo(x1, fy(x1))
    wc.lineTo(x1, edge)
    wc.closePath()
    wc.fill()
  }

  wc.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
}

/**
 * Final session teardown — restores the DOM title's ink, drops the burn
 * canvas + rewrite slot, and detaches the session from its card. Runs
 * when a reversed (rebuild) pass reaches progress 0; the pristine raster
 * painted that frame is pixel-identical to the restored DOM text, so the
 * handoff is seamless.
 */
function teardownBurn(s: BurnSession): void {
  s.active = false
  s.raf = 0

  s.canvas.remove()
  ;(s.cardEl as BurnCard)._burn = null

  s.titleEl.classList.remove(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)
  s.cardEl.classList.remove(HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING)
  s.cardEl.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_SLOT}`)?.remove()
}

/**
 * One combustion frame: rebuild the burned paper (char → glow → consume,
 * per letter), blit it, spawn + draw particles. When every letter's front
 * has passed its ink top the title is ash; the loop idles until the last
 * particle dies. Reversed sessions (dir −1) count progress down — the
 * stage climbs bottom→top again, re-inking each letter base-to-cap
 * while deposit particles rain onto the moving edge until the raster
 * is whole again and the DOM takes the pixels back.
 */
function frame(s: BurnSession): void {
  const now = performance.now()
  const dt = Math.min(0.05, (now - s.lastT) / 1000 || 0.016)

  s.lastT = now
  s.t += dt

  // Re-anchor to the live title box before painting — the card's expand
  // ease keeps moving the DOM glyphs (cqw font-size, flex-end pin) while
  // the burn runs, so the paper must chase the real render.
  syncPaper(s)

  const { ctx, w, h } = s
  const jagAmp = Math.max(2, s.paperH * _JAG_RATIO)

  // Forward progress rides the elapsed clock (tests rebase it through
  // s.t); reverse progress counts down its own state at _REBUILD_RATIO
  // of the burn duration — the same raster pipeline, played backwards.
  let progress: number

  if (s.dir < 0) {
    s.prog = Math.max(0, s.prog - dt / ((s.dur / 1000) * _REBUILD_RATIO))
    progress = s.prog
  } else {
    progress = Math.min(1, s.t / (s.dur / 1000))
  }

  // Stage maps both directions onto a 0→1 climb: burn consumes bottom→top
  // as stage rises; rebuild (dir −1) re-materializes bottom→top as stage
  // rises too — prog counts down, so stage = 1 − prog.
  const stage = s.dir < 0 ? 1 - progress : progress

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = CANVAS_STRINGS.COMPOSITE_SOURCE_OVER
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, w, h)

  burnPaper(s, stage, jagAmp)
  ctx.drawImage(s.work, s.paperX, s.paperY)

  // Embers pour off the live burn edge; on rebuild the same live edge
  // instead receives deposits raining down through the empty zone.
  if (stage > 0 && stage < _BURN_END) spawn(s, stage, jagAmp, dt)

  drawParticles(s, dt, stage, jagAmp)

  // Rebuild complete — hand the (pristine) pixels back to the DOM ink.
  if (s.dir < 0 && s.prog <= 0) {
    teardownBurn(s)
    return
  }

  const settling = s.dir > 0 && progress >= _BURN_END && s.particles.length === 0

  if (settling) {
    ctx.clearRect(0, 0, w, h)
  }

  s.raf = s.active && !settling ? requestAnimationFrame(() => frame(s)) : 0
}

/**
 * Inserts the rewrite slot above the description: an aria-hidden spacer
 * holds the layout space (zero reflow when the clone animates) and a
 * <draw-text> replays the title. The whole slot is aria-hidden — the
 * original h2 remains the single a11y source for the title.
 */
function insertTitleSlot(cardEl: Element, titleText: string): void {
  const detail = cardEl.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_DETAILS}`)

  if (!detail || detail.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_SLOT}`)) return

  const slot = document.createElement(HTML_TAGS.DIV)

  slot.className = HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_SLOT
  slot.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

  const dup = document.createElement(HTML_TAGS.SPAN)

  dup.className = HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_DUP
  dup.textContent = titleText

  const rewrite = document.createElement(COMPONENT_TAGS.DRAW_TEXT)

  rewrite.classList.add(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_REWRITE)
  rewrite.setAttribute(FORM_ATTRS.TEXT, titleText)
  rewrite.setAttribute(COMMON_ATTRS.DELAY, CHAR_STRINGS.DELAY_8)

  slot.appendChild(dup)
  slot.appendChild(rewrite)
  detail.insertBefore(slot, detail.firstChild)
}

/**
 * Arms the burn on card `i`: hides the h2 ink, mounts the combustion
 * canvas over it, and inserts the rewrite slot above the description.
 * The burn length follows the description draw time so the last ember
 * dies as the description finishes writing. Reduced motion skips the
 * canvas entirely — the title swap happens instantly.
 *
 * The canvas work is deferred until the card's expand transition settles:
 * measuring the h2 mid-ease anchors the burn to a box the title has
 * already left (its flex-end pin and cqw font-size both move during the
 * 0.42s height transition), which left the flame edge burning empty air
 * beside the real glyphs.
 */

/**
 * Mounts the combustion canvas over the title's current box: measures
 * the h2 and overlay at hover-instant and plays the dissolve exactly
 * where the glyphs stand. The DOM ink hides as soon as the canvas takes
 * over, so the card's expand ease running behind it can't double-draw
 * the title at its moving flex-end position.
 */
function mountBurn(
  cardEl: Element,
  overlay: HTMLElement,
  titleEl: HTMLElement,
  item: MosaicItem
): void {
  const box = titleEl.getBoundingClientRect()

  if (box.width < 4 || box.height < 4) return

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  canvas.className = HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURN

  const ctx = canvas.getContext(WEBGL_STRINGS.CONTEXT_2D) as CanvasRenderingContext2D | null

  if (!ctx) {
    canvas.remove()
    return
  }

  const work = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement
  const workCtx = work.getContext(WEBGL_STRINGS.CONTEXT_2D) as CanvasRenderingContext2D | null

  if (!workCtx) {
    canvas.remove()
    return
  }

  const s: BurnSession = {
    canvas,
    ctx,
    paper: document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement,
    w: 2,
    h: 2,
    paperX: 0,
    paperY: 0,
    paperW: 2,
    paperH: 2,
    t: 0,
    prog: 0,
    dir: 1,
    cardEl,
    dur: Math.min(
      _BURN_MS_MAX,
      Math.max(_BURN_MS_MIN, (item.description?.length || 0) * _DESC_CHAR_MS + _DESC_TAIL_MS)
    ),
    lastT: performance.now(),
    raf: 0,
    active: true,
    particles: [],
    letters: [],
    colLetter: new Int16Array(0),
    colInk: new Uint8Array(0),
    work,
    workCtx,
    inkColor: getComputedStyle(titleEl).color,
    titleEl,
    overlayEl: overlay,
    ink: readBurnInk(),
    lastBox: ATTR_VALUES.EMPTY,
    lastPos: ATTR_VALUES.EMPTY,
  }

  // First layout + raster — later frames re-anchor POSITION only, so the
  // cqw font-size drift during expand never shrinks the burning glyphs.
  syncPaper(s)

  overlay.appendChild(canvas)

  // Paint the paper BEFORE hiding the DOM ink — the canvas must already
  // hold the pixel-identical title when the swap happens, or the text
  // visibly "disappears then an effect starts" instead of the glyphs
  // themselves combusting.
  ctx.drawImage(s.paper, s.paperX, s.paperY)
  titleEl.classList.add(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)

  // Silence the card's border sheen while the burn owns the hover effect.
  cardEl.classList.add(HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING)
  ;(cardEl as BurnCard)._burn = s

  s.raf = requestAnimationFrame(() => frame(s))
}

/**
 * Arms the burn on card `i`: inserts the rewrite slot, then mounts the
 * combustion canvas IMMEDIATELY — the user expects the dissolve the
 * moment the pointer lands, not after the card's expand ease. The
 * canvas is measured against the title's hover-instant box and plays
 * the burn where the glyphs stood while the card grows behind it (the
 * h2's ink is hidden as soon as the canvas takes over, so the moving
 * DOM title never shows through). Reduced motion skips the canvas
 * entirely — the title swap happens instantly.
 */
export function armCardBurn(host: HomeMosaic, i: number, item: MosaicItem): void {
  const cardEl = host.$(`${MOSAIC_SELECTORS.HOME_MOSAIC_ITEM}[${DATA_ATTRS.DATA_INDEX}="${i}"]`)

  if (!cardEl) return

  const overlay = cardEl.querySelector<HTMLElement>(
    `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_OVERLAY}`
  )
  const titleEl = overlay?.querySelector<HTMLElement>(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE}`)
  const titleText = item.label || item.title || ATTR_VALUES.EMPTY

  if (!overlay || !titleEl || !titleText) return

  insertTitleSlot(cardEl, titleText)

  const card = cardEl as BurnCard

  if (store.getters.getReducedMotion?.()) {
    titleEl.classList.add(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)
    return
  }

  if (card._burn) {
    // Re-hover mid-rebuild — rebase the forward clock onto the rebuild
    // progress and combust again; the front turns around mid-glyph
    // instead of restarting the burn from scratch.
    const s = card._burn

    s.dir = 1
    s.t = s.prog * (s.dur / 1000)

    if (!s.raf) s.raf = requestAnimationFrame(() => frame(s))

    return
  }

  mountBurn(cardEl, overlay, titleEl, item)
}

/**
 * Un-arms the burn by reversing it: the consume front descends and
 * un-chars the glyphs until the title raster is whole again — the same
 * effect played backwards, not an instant DOM-ink pop. `prog` captures
 * where the burn stopped so the front returns from exactly the consumed
 * edge; frame() runs the teardown once the text is rebuilt. A card with
 * no session (reduced motion, never armed) restores instantly — safe to
 * call unconditionally.
 */
export function disarmCardBurn(host: HomeMosaic, i: number): void {
  const cardEl = host.$(`${MOSAIC_SELECTORS.HOME_MOSAIC_ITEM}[${DATA_ATTRS.DATA_INDEX}="${i}"]`)

  if (!cardEl) return

  const s = (cardEl as BurnCard)._burn

  if (s) {
    s.dir = -1
    s.prog = Math.min(1, s.t / (s.dur / 1000))

    // A settled loop already stopped scheduling — restart it so the
    // rebuild actually plays.
    if (!s.raf) s.raf = requestAnimationFrame(() => frame(s))

    return
  }

  cardEl
    .querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE}`)
    ?.classList.remove(HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_BURNING)

  cardEl.classList.remove(HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_BURNING)

  cardEl.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_SLOT}`)?.remove()
}
