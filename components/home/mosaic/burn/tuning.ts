/**
 * @file mosaic/burn/tuning.ts — shared tunables for the paper-combustion
 * title effect (see ../burn.ts for the full mechanism). Split from the
 * monolithic burn.ts so each pipeline module stays small; every constant
 * is module-private-style by convention (leading `_`) and consumed only
 * by the sibling burn modules.
 */

/** Device-pixel cap on the burn canvas — glow beyond 2× is invisible. */
export const _DPR_CAP = 2
/** Side/vertical bleed (css px) around the title box — embers need room,
 *  and the smoke wander (~30px lateral drift over a puff's life) must not
 *  slice at the canvas edge. */
export const _PAD_X = 60
/** Top bleed (css px) — the smoke plume climbs at up to ~90px/s with a
 *  life up to 3.2s (~250px of headroom needed) before it thins out; the
 *  canvas must hold the whole column so the plume dissipates instead of
 *  slicing at the canvas edge. */
export const _PAD_TOP = 260
/** Bottom bleed (css px) — the front ignites at the baseline edge. */
export const _PAD_BOTTOM = 8
/** Jagged-edge amplitude as a fraction of the paper height — a small
 *  organic waver on top of the per-letter speed spread. */
export const _JAG_RATIO = 0.08
/**
 * Per-letter burn-speed range — each glyph bucket burns between ~55%
 * and ~145% of the base rate, so letters vanish at visibly different
 * moments while all still finish inside the description's draw time.
 */
export const _COL_SPEED_MIN = 0.7
/** Random speed spread above the minimum — v lands in 0.7..2.0×. */
export const _COL_SPEED_SPAN = 1.3
/** Scorch-band height below the burn front (fraction of letter height). */
export const _SCORCH_RATIO = 0.09
/** Scorch-band minimum height in device px (tiny letters still char visibly). */
export const _BAND_MIN = 6
/** Opacity of the char band laid over ink just above the front. */
export const _BAND_ALPHA = 0.82
/** Opacity of the additive ember wash hugging the live front. */
export const _GLOW_ALPHA = 0.55
/** X stride for tracing a letter's jagged front polygon (device px). */
export const _FRONT_STEP = 3
/** Seconds the front spends travelling the paper. Falls under desc time. */
export const _BURN_MS_MIN = 450
/** Burn duration ceiling — long descriptions cap here, never run on. */
export const _BURN_MS_MAX = 2400
/** Per-char desc draw estimate (ms) — mirrors the 8ms char delay + draw. */
export const _DESC_CHAR_MS = 8
/** Trailing draw allowance (ms) after the description's last char. */
export const _DESC_TAIL_MS = 260
/** Particle budget — hard cap on live embers + flecks. */
export const _P_MAX = 110
/** Ember spawn per second along the front while it burns. */
export const _SPAWN_PER_S = 90
/** Fraction of spawns that are dark char flecks (rest are embers). */
export const _CHAR_FRACTION = 0.3
/** Particle lifetime bounds (seconds). */
export const _EMBER_LIFE_MIN = 0.35
/** Ember lifetime ceiling — sparks die well before the front finishes. */
export const _EMBER_LIFE_MAX = 0.9
/** Fleck lifetime floor — char flecks outlast embers (they tumble). */
export const _FLECK_LIFE_MIN = 0.5
/** Fleck lifetime ceiling (seconds). */
export const _FLECK_LIFE_MAX = 1.1
/** Ember upward velocity bounds (canvas px/s). */
export const _EMBER_VY_MIN = 26
/** Ember upward velocity ceiling — the fastest sparks outrun the front. */
export const _EMBER_VY_MAX = 74
/** Ember sideways drift bound (canvas px/s). */
export const _EMBER_VX = 18
/** Fleck launch velocity + gravity pull (canvas px/s, px/s²). */
export const _FLECK_VY = 46
/** Fleck sideways drift bound (canvas px/s). */
export const _FLECK_VX = 22
/** Gravity accelerating flecks + rebuild deposits downward (px/s²). */
export const _FLECK_G = 60
/**
 * Rebuild deposit launch speed (canvas px/s) — motes leave the empty
 * zone drifting down gently, then _FLECK_G accelerates the fall.
 */
export const _DEPOSIT_VY = 18
/** Particle size bounds in device px. */
export const _EMBER_SIZE = 2.2
/** Fleck size bound — char scraps read bigger than ember sparks. */
export const _FLECK_SIZE = 3.4
/** Byte offset of the alpha channel inside a getImageData pixel quad. */
export const _ALPHA_STRIDE = 3
/** Alpha floor for "has ink" — anti-aliased feather below ~12% is ignored. */
export const _INK_ALPHA_MIN = 32
/**
 * Max ignition delay, as a fraction of total progress — letters catch
 * fire anywhere in the first ~fifth of the burn.
 */
export const _IGNITE_DELAY = 0.15
/**
 * Progress at which the slowest letter finishes — the last glyph ashes
 * out just before the description's final chars land, never after.
 */
export const _BURN_END = 0.92
/** Ember glow band height, as a share of letter height. */
export const _GLOW_RATIO = 0.55
/**
 * Rebuild speed on un-hover — the un-burn replays the consume front
 * downward at this fraction of the burn duration, so rebuilding the
 * title reads quicker than burning it away while staying visible.
 */
export const _REBUILD_RATIO = 0.55
