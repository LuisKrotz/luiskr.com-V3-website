/**
 * @file mosaic/burn/types.ts — shared session/particle types for the
 * paper-combustion title effect (see ../burn.ts for the mechanism). The
 * pipeline modules all operate on one `BurnSession` record instead of
 * loose arguments, so the types live in their own module.
 */

/** A live combustion session, keyed by card element in `_sessions`. */
export interface BurnSession {
  /** Overlay canvas absolutely positioned over the title box. */
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /**
   * Optional WebGPU particle canvas — mounted over `canvas` when the
   * per-widget wasm burn artifact loads; the paper raster stays 2D
   * (canvas contexts are mutually exclusive per element), particles
   * move to the GPU canvas.
   */
  gpuCanvas?: HTMLCanvasElement
  /**
   * Live WebGPU wasm handle — the particle sim+renderer runs in the
   * artifact (begin/set_letters/set_ink/set_colors/set_dir/set_stage/
   * frame); unset on failure or before the mount resolves.
   */
  wasm?: import('@core/utils/gpu/webgpu-widget.js').WidgetHandle | null
  /** In-flight mount — teardown must not double-resolve. */
  wasmPending?: boolean
  /** Latch — a failed wasm mount never retries this session. */
  wasmFailed?: boolean
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
export interface BurnInk {
  core: string
  mid: string
  edge: string
  scorch: string
  /** Smoke-puff tint — the rising ash column behind the embers. */
  smoke: string
}

/**
 * One glyph's burn unit — the ink-run span in the paper raster plus its
 * ignition profile. `v` is the burn-speed multiplier, `delay` the share
 * of total progress before this letter ignites (letters catch fire at
 * different moments), and y0/y1 bound the letter's ink extent so the
 * front only travels through its own glyph.
 */
export interface LetterBurn {
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
export interface BurnParticle {
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
export interface BurnCard extends Element {
  _burn?: BurnSession | null
}
