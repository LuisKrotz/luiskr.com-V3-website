/**
 * @file mosaic/burn/loop.ts — the combustion RAF loop: per-frame stage
 * bookkeeping, paper re-anchor, raster compositing, particle stepping,
 * and the final teardown that hands the pixels back to the DOM ink.
 * Split from the monolithic burn.ts.
 */
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { syncPaper } from './paper.js'
import { burnPaper } from './paper-fx.js'
import { drawParticles, spawn } from './particles.js'
import { destroyBurnWasm, frameBurnWasm, liveBurnParticles } from './wasm.js'
import { _BURN_END, _JAG_RATIO, _REBUILD_RATIO } from './tuning.js'
import type { BurnCard, BurnSession } from './types.js'

/**
 * Final session teardown — restores the DOM title's ink, drops the burn
 * canvas + rewrite slot, and detaches the session from its card. Runs
 * when a reversed (rebuild) pass reaches progress 0; the pristine raster
 * painted that frame is pixel-identical to the restored DOM text, so the
 * handoff is seamless.
 * @param s The finished session — torn down in place.
 */
export function teardownBurn(s: BurnSession): void {
  s.active = false
  s.raf = 0

  destroyBurnWasm(s)

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
 * @param s The live session — self-reschedules on requestAnimationFrame.
 */
export function frame(s: BurnSession): void {
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
  // The wasm artifact owns the whole particle layer when mounted —
  // one instanced-quad draw for the whole mote field.
  if (s.wasm) {
    frameBurnWasm(s, stage, jagAmp, dt)
  } else {
    if (stage > 0 && stage < _BURN_END) spawn(s, stage, jagAmp, dt)

    drawParticles(s, dt, stage, jagAmp)
  }

  // Rebuild complete — hand the (pristine) pixels back to the DOM ink.
  if (s.dir < 0 && s.prog <= 0) {
    teardownBurn(s)
    return
  }

  const liveParticles = s.wasm ? liveBurnParticles(s) : s.particles.length

  const settling = s.dir > 0 && progress >= _BURN_END && liveParticles === 0

  if (settling) {
    ctx.clearRect(0, 0, w, h)
  }

  s.raf = s.active && !settling ? requestAnimationFrame(() => frame(s)) : 0
}
