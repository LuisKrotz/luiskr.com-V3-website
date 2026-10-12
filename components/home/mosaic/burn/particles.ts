/**
 * @file mosaic/burn/particles.ts — the combustion particle sim: embers
 * that rise off the live burn front, char flecks that tumble dark, and
 * the rebuild-mode deposits that rain top→bottom onto the climbing edge
 * so glyphs appear to re-ink themselves. Split from the monolithic
 * burn.ts.
 */
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { letterFrontY } from './front.js'
import {
  _CHAR_FRACTION,
  _DEPOSIT_VY,
  _EMBER_LIFE_MAX,
  _EMBER_LIFE_MIN,
  _EMBER_SIZE,
  _EMBER_VX,
  _EMBER_VY_MAX,
  _EMBER_VY_MIN,
  _FLECK_G,
  _FLECK_LIFE_MAX,
  _FLECK_LIFE_MIN,
  _FLECK_SIZE,
  _FLECK_VX,
  _FLECK_VY,
  _P_MAX,
  _SPAWN_PER_S,
} from './tuning.js'
import type { BurnSession } from './types.js'

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
 * @param s The live session — pushes into s.particles.
 * @param progress Global burn stage 0..1.
 * @param jagAmp Jagged-edge amplitude in device px.
 * @param dt Seconds since the last frame.
 */
export function spawn(s: BurnSession, progress: number, jagAmp: number, dt: number): void {
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
 * Advances + draws particles. Burn embers flicker upward on buoyancy and
 * flecks tumble down; rebuild deposits (dir −1) fall under gravity from
 * the empty zone above each letter and die the moment they reach the
 * climbing front — the landing reads as the glyph re-inking itself.
 * @param s The live session — mutates s.particles, paints on s.ctx.
 * @param dt Seconds since the last frame.
 * @param stage Global burn stage 0..1 (1 − prog on rebuild).
 * @param jagAmp Jagged-edge amplitude in device px.
 */
export function drawParticles(s: BurnSession, dt: number, stage: number, jagAmp: number): void {
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
