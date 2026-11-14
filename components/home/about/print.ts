/**
 * @file about/print.ts — the bio's printable form.
 *
 * Every bio paragraph lives inside a <draw-text> writer whose rendered
 * copy sits in its own shadow: a paragraph whose viewport reveal never
 * armed prints empty, and CSS ::first-letter can't reach inside the
 * shadow to catch the lead glyph for the feature drop cap. The item
 * text is component state, so the fill happens here on `printprepare`:
 * a `hidden`-contract `.print-fill` span seats inside each <p> carrying
 * the item's plain text — the same contract cardstack's print fill and
 * the `.print-caption` surfaces already use. The about print sheet hides
 * the draw-text hosts on paper and reveals the fills, which puts the bio
 * in light DOM where the drop cap and column flow can reach it.
 *
 * `afterprint` — and the matchMedia('print') false edge, which never
 * dispatches a native event — both restore: the fills leave the shadow
 * DOM and the writers keep their own lifecycle untouched.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import type { AboutSection } from '../AboutSection.js'

/**
 * Seats one hidden `.print-fill` span carrying `text` inside `para`, when
 * the paragraph doesn't already hold one — the idempotent guard lets a
 * second beforeprint inside the same job re-run the whole prepare.
 * @param para The `.about-item-text` paragraph to fill.
 * @param text Plain bio copy (DrawItem.text — markup-free by contract).
 */
const fillPara = (para: Element, text: string): void => {
  if (para.querySelector(`.${PRINT_CLASSES.FILL}`)) return

  const fill = document.createElement(HTML_TAGS.SPAN)

  fill.className = PRINT_CLASSES.FILL
  fill.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  // CMS copy carries inline markup (<br>, <q>, <a>, lang spans) — a
  // contextual fragment parses it into real nodes without innerHTML;
  // textContent would print the tags literally. Fragment parsing never
  // executes embedded content.
  fill.appendChild(document.createRange().createContextualFragment(text))

  para.appendChild(fill)
}

/**
 * Arms the printable form: walks the bio paragraphs in DOM order — the
 * intro statement first, then the profile-text items — and seats each
 * one's plain text. Runs inside the `printprepare` window event, before
 * print.ts's media walk, so the fills exist for the snapshot. Skips the
 * skeleton state outright (no translations means no real copy, and the
 * shimmer paras print as ruled boxes the sheet already handles).
 * @param host The AboutSection element.
 */
export function preparePrint(host: AboutSection): void {
  if (!host.aboutTranslations) return

  const draw = host.aboutDrawData
  const texts = [...(draw.intro ? [draw.intro.text] : []), ...draw.items.map((item) => item.text)]

  const paras = host.shadowRoot?.querySelectorAll(`.${ABOUT_CLASSES.ABOUT_ITEM_TEXT}`)

  paras?.forEach((para, i) => {
    const text = texts[i]

    if (text) fillPara(para, text)
  })
}

/**
 * Tears the printable form down: every injected `.print-fill` leaves the
 * shadow DOM. Idempotent — both restore channels (native afterprint and
 * the matchMedia false edge) may fire for one job.
 * @param host The AboutSection element.
 */
export function restorePrint(host: AboutSection): void {
  host.shadowRoot?.querySelectorAll(`.${PRINT_CLASSES.FILL}`).forEach((el) => el.remove())
}
