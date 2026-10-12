/**
 * @file mosaic/burn/mount.ts — session bootstrap: insert the aria-hidden
 * rewrite slot above the description, create the session canvases and
 * BurnSession record, do the first layout + raster, and hand the loop
 * its first frame. Split from the monolithic burn.ts.
 */
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { frame } from './loop.js'
import { readBurnInk, syncPaper } from './paper.js'
import { _BURN_MS_MAX, _BURN_MS_MIN, _DESC_CHAR_MS, _DESC_TAIL_MS } from './tuning.js'
import type { BurnCard, BurnSession } from './types.js'
import type { MosaicItem } from '../pack.js'

/**
 * Inserts the rewrite slot above the description: an aria-hidden spacer
 * holds the layout space (zero reflow when the clone animates) and a
 * <draw-text> replays the title. The whole slot is aria-hidden — the
 * original h2 remains the single a11y source for the title.
 * @param cardEl The expanded mosaic card.
 * @param titleText The title string the slot replays.
 */
export function insertTitleSlot(cardEl: Element, titleText: string): void {
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
 * Mounts the combustion canvas over the title's current box: measures
 * the h2 and overlay at hover-instant and plays the dissolve exactly
 * where the glyphs stand. The DOM ink hides as soon as the canvas takes
 * over, so the card's expand ease running behind it can't double-draw
 * the title at its moving flex-end position.
 * @param cardEl The expanded mosaic card.
 * @param overlay The title overlay element (canvas parent).
 * @param titleEl The h2 whose ink the canvas replaces.
 * @param item The card's mosaic item (description length paces the burn).
 */
export function mountBurn(
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
