/**
 * @file about/glitch/types.ts — shared session type + tunables for the
 * about-portrait VHS glitch (see ../glitch.ts for the mechanism). Split
 * from the monolithic glitch.ts so the painter and lifecycle modules
 * stay small; constants keep the module-private `_` convention.
 */
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'

/** Device-pixel cap — corruption resolution beyond 2× is invisible. */
export const _DPR_CAP = 2

/** Wrapper/img selector pair, resolved fresh each tick (re-render safe). */
export const _PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`
/** Live img selector — re-resolved each tick after shadow re-renders. */
export const _IMG_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}`

// Idle (always-on) intensity.
/** Chance an idle frame runs a small tear/fringe burst. */
export const _IDLE_HIT = 0.05
/** Idle grain pixels per frame — sparse film dust. */
export const _IDLE_GRAIN = 16
/** Idle RGB fringe bound in device px — sub-pixel shimmer. */
export const _IDLE_RGB = 1.4
/** Idle tear distance bound as a frame-width fraction. */
export const _IDLE_TEAR = 0.02
/** Idle slice-band count + height bounds (frame-height fractions). */
export const _IDLE_BANDS = 2
/** Idle tear-band minimum height (frame-height fraction). */
export const _IDLE_BAND_MIN = 0.006
/** Idle tear-band maximum height (frame-height fraction). */
export const _IDLE_BAND_MAX = 0.03

// Hover (VHS) intensity.
/** Chance a hover frame runs the heavy corruption pass. */
export const _HOVER_HIT = 0.65
/** Hover grain pixels per frame — dense film grain. */
export const _HOVER_GRAIN = 460
/** Grain alpha — film noise sits visibly on the image. */
export const _GRAIN_ALPHA = 0.22
/** Hover RGB ghost bounds in device px. */
export const _HOVER_RGB_MIN = 1
/** Hover RGB ghost offset ceiling in device px — visible CRT fringe. */
export const _HOVER_RGB_MAX = 5
/** Hover tear distance bound as a frame-width fraction. */
export const _HOVER_TEAR = 0.035
/** Hover band count/height bounds (frame-height fractions). */
export const _HOVER_BANDS = 6
/** Hover tear-band minimum height (frame-height fraction). */
export const _HOVER_BAND_MIN = 0.01
/** Hover tear-band maximum height (frame-height fraction). */
export const _HOVER_BAND_MAX = 0.06
/** Hover block-tear count/size bounds. */
export const _HOVER_BLOCKS = 3
/** Block-tear max width (frame-width fraction). */
export const _BLOCK_W_MAX = 0.18
/** Block-tear max height (frame-height fraction). */
export const _BLOCK_H_MAX = 0.05
/** Block-tear max duplicate offset (frame-width fraction). */
export const _BLOCK_THROW = 0.05
/** VHS tracking bar — thin brightened horizontal strip. */
export const _TRACK_H = 0.02
/** Chance per hover frame of an inversion flash. */
export const _INVERT_CHANCE = 0.02

// Shared.
/** Rolling-bar height as a fraction of frame height. */
export const _ROLL_H = 0.12
/** Rolling-bar sweep speed (frame-heights per second). */
export const _ROLL_SPEED = 0.4
/** Scanline row period in device px + alpha. */
export const _SCAN_PERIOD = 3
/** Scanline dark-line alpha — a whisper of raster, not a grid. */
export const _SCAN_ALPHA = 0.06
/** Hover-only chroma-noise chance inside the grain loop. */
export const _CHROMA_CHANCE = 0.3
/** Un-armed retry poll rate in Hz — arms as soon as the portrait decodes. */
export const _POLL_HZ = 4
/** Percent scale for parsing object-position ("50%" → 0.5). */
export const _POS_PCT = 100
/** object-position fallback when the keyword parse fails — center. */
export const _POS_CENTER = 50

/** Live glitch session parked on `host._glitch`. */
export interface GlitchSession {
  /** Overlay canvas inside the picture wrapper. */
  canvas: HTMLCanvasElement
  /** 2D backend context — null while the WebGPU arm mounts and forever
   *  after it succeeds; the rust/glitch shader replaces every painter. */
  ctx: CanvasRenderingContext2D | null
  /** Canvas size in device px. */
  w: number
  h: number
  /** Cover-fit destination rect of the portrait (device px). */
  dx: number
  dy: number
  dw: number
  dh: number
  /** Live image element — re-resolved after shadow re-renders. */
  img: HTMLImageElement
  /** Natural size the cover rect was computed against — a srcset
   *  candidate swap changes naturalWidth while `complete` stays true,
   *  silently invalidating dx/dy/dw/dh (the stale rect then scales a
   *  wrong-aspect portrait = the "zoomed portrait" bug). */
  srcW: number
  srcH: number
  /** Precomputed red / cyan channel canvases for the RGB split. */
  red: HTMLCanvasElement
  cyan: HTMLCanvasElement
  /** Scanline tile canvas (1×_SCAN_PERIOD) used as a repeat pattern. */
  scan: HTMLCanvasElement
  /** Elapsed seconds — drives the rolling bar. */
  t: number
  lastT: number
  /** Pending rAF handle. */
  raf: number
  /** True while the loop should keep running. */
  active: boolean
  /** Intensity — idle ambient or full VHS under hover. */
  hover: boolean
  /** Frame counter — paces un-armed retry polls. */
  tick: number
  /** Wrapper ResizeObserver — the CSS canvas is width:100%, so any post-arm
   *  layout change (resize, grid reflow, mosaic expand above) would stretch
   *  the stale device-px raster into a zoomed/cropped portrait without it. */
  ro: ResizeObserver | null
  /** Live rust/glitch widget — the WebGPU render backend. Null while the
   *  mount is in flight or after it fails (the 2D painters run instead). */
  wasm: WidgetHandle | null
}

/**
 * Narrowed view of the session for the 2D painters — `frame()` guards on
 * `s.ctx` once and passes this type down, so every painter keeps a
 * non-nullable context without per-call checks (the wasm arm never
 * reaches them).
 */
export type Glitch2dSession = GlitchSession & { ctx: CanvasRenderingContext2D }
