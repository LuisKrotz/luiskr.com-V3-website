/**
 * @file mosaic/burn/front.ts — burn-front geometry: the organic edge
 * noise and the per-letter progress/front-position math every pipeline
 * module (spawn, particle landing, paper compositing) samples. Split
 * from the monolithic burn.ts.
 */
import type { BurnSession, LetterBurn } from './types.js'

/**
 * Deterministic smooth edge noise — three detuned sines read as an
 * organic flame line rather than static noise. `ph` (seconds) animates
 * the jag so the burn boundary itself licks sideways as it descends.
 * @param x Paper-space column the jag is sampled at (device px).
 * @param ph Animation phase — the session clock in seconds.
 */
export function edgeNoise(x: number, ph: number): number {
  return (
    Math.sin(x * 0.09 + ph * 2.1) * 0.5 +
    Math.sin(x * 0.023 - ph * 1.3) * 0.34 +
    Math.sin(x * 0.17 + ph * 3.7) * 0.16
  )
}

/**
 * A letter's own burn progress — global progress scaled by the letter's
 * speed, shifted by its ignition delay. Letters ignite at different
 * moments and race at different rates, so one glyph can be ash while a
 * neighbour is untouched.
 * @param L The letter's burn unit (speed multiplier + ignition delay).
 * @param progress Global burn stage 0..1.
 */
export function letterProgress(L: LetterBurn, progress: number): number {
  return Math.min(1, Math.max(0, progress * L.v - L.delay))
}

/**
 * Per-column burn front inside one letter — the paper-space y of the
 * live edge at column x. The front climbs BOTTOM→TOP through the
 * letter's own ink extent (y1 → y0), so a descender's stem burns up from
 * the baseline, not from the paper's bottom edge.
 * @param s The live session (its clock animates the edge noise).
 * @param L The letter whose front is sampled.
 * @param x Paper-space column inside the letter (device px).
 * @param progress Global burn stage 0..1.
 * @param jagAmp Jagged-edge amplitude in device px.
 */
export function letterFrontY(
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
