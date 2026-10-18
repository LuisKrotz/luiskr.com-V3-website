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
 *
 * The pipeline is split into ./burn/* modules — types + tunables, front
 * geometry, the paper raster, the compositing pass, the particle sim,
 * the RAF loop, and session mount — leaving this file as the arm/disarm
 * orchestrator.
 */

import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { MOSAIC_SELECTORS } from '@core/tokens/selectors/mosaic.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import store from '@core/store.js'
import { frame } from './burn/loop.js'
import { insertTitleSlot, mountBurn } from './burn/mount.js'
import { setBurnDirWasm } from './burn/wasm.js'
import type { BurnCard } from './burn/types.js'
import type { MosaicItem } from './pack.js'
import type { HomeMosaic } from '../HomeMosaic.js'

export type { BurnSession, BurnCard } from './burn/types.js'

/**
 * Arms the burn on card `i`: inserts the rewrite slot, then mounts the
 * combustion canvas IMMEDIATELY — the user expects the dissolve the
 * moment the pointer lands, not after the card's expand ease. The
 * canvas is measured against the title's hover-instant box and plays
 * the burn where the glyphs stood while the card grows behind it (the
 * h2's ink is hidden as soon as the canvas takes over, so the moving
 * DOM title never shows through). Reduced motion skips the canvas
 * entirely — the title swap happens instantly.
 * @param host The <home-mosaic> component instance.
 * @param i The card index inside the mosaic data set.
 * @param item The card's mosaic item (label drives the rewrite slot).
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

    // The crate's set_dir restarts the particle stream on a flip.
    setBurnDirWasm(s)

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
 * @param host The <home-mosaic> component instance.
 * @param i The card index inside the mosaic data set.
 */
export function disarmCardBurn(host: HomeMosaic, i: number): void {
  const cardEl = host.$(`${MOSAIC_SELECTORS.HOME_MOSAIC_ITEM}[${DATA_ATTRS.DATA_INDEX}="${i}"]`)

  if (!cardEl) return

  const s = (cardEl as BurnCard)._burn

  if (s) {
    s.dir = -1
    s.prog = Math.min(1, s.t / (s.dur / 1000))

    // The crate's set_dir restarts the particle stream on a flip.
    setBurnDirWasm(s)

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
