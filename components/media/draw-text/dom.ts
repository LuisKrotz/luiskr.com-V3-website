/**
 * @file draw-text/dom.ts — shadow-DOM update: shared sheet adoption,
 * content wrapper, state classes, and content swap.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { DRAW_TEXT_CLASSES } from '@core/tokens/classes/draw-text.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import drawTextStyles from '@core/sass/components/media/draw-text.scss?inline'
import { stripHtml } from '@core/utils/string.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import type { DrawText } from '../DrawText.js'
import { renderContent, RENDER_MODES } from './render.js'
import { getSharedSheet } from './sheet.js'

/** Re-renders the shadow DOM for current props. */
export function updateDom(host: DrawText): void {
  const visibleClass =
    host._isVisible && !host._hasAnimated ? DRAW_TEXT_CLASSES.DRAW_TEXT_VISIBLE : ATTR_VALUES.EMPTY

  const doneClass = host._hasAnimated ? DRAW_TEXT_CLASSES.DRAW_TEXT_DONE : ATTR_VALUES.EMPTY

  const pendingClass =
    !host._isVisible && !host._hasAnimated ? DRAW_TEXT_CLASSES.DRAW_TEXT_PENDING : ATTR_VALUES.EMPTY

  // Every rendered word/char span is aria-hidden, so the accessible text
  // must come from elsewhere. Two surfaces carry it:
  //   1. aria-label on the host — honored where AT computes a name for
  //      the element itself (and satisfies label-content-name-mismatch:
  //      the label IS the visible string). `aria-label` is not an
  //      observed attribute, so no loop.
  //   2. The .sr-only shadow child — real text, visually clipped. Generic
  //      elements' aria-labels are skipped by Chromium's accName walk, so
  //      wrapping <h2>/<a>/<button> would compute an EMPTY name off the
  //      aria-hidden spans alone; a genuine text node is what name-from-
  //      content and screen-reader browse mode actually read (NVDA/
  //      Narrator "no text" regression).
  const label = stripHtml(host.text).trim()

  if (label) {
    host.setAttribute(ARIA_ATTRS.ARIA_LABEL, label)
  } else if (host.hasAttribute(ARIA_ATTRS.ARIA_LABEL)) {
    host.removeAttribute(ARIA_ATTRS.ARIA_LABEL)
  }

  if (!host._srEl) {
    host._srEl = document.createElement(HTML_TAGS.SPAN)

    host._srEl.className = A11Y_CLASSES.SR_ONLY

    host.shadowRoot!.appendChild(host._srEl)
  }

  host._srEl.textContent = label

  if (!host._styleEl) {
    const sheet = getSharedSheet()

    if (sheet) {
      host.shadowRoot!.adoptedStyleSheets = [sheet]

      host._styleEl = sheet
    } else {
      host._styleEl = document.createElement(HTML_TAGS.STYLE)

      host._styleEl.textContent = drawTextStyles

      host.shadowRoot!.appendChild(host._styleEl)
    }
  }

  if (!host._contentEl) {
    host._contentEl = document.createElement(HTML_TAGS.SPAN)

    host.shadowRoot!.appendChild(host._contentEl)
  }

  host._contentEl.className =
    `${DRAW_TEXT_CLASSES.DRAW_TEXT} ${visibleClass} ${doneClass} ${pendingClass}`.trim()

  // Render mode: chars only while the reveal runs; 'words' for `fit`
  // hosts (fitText measures .draw-text__word boxes — a fit element that
  // rendered plain could overflow unscaled until its trigger fires);
  // 'plain' everywhere else — a paragraph collapses into per-run spans
  // instead of holding ~2 nodes per word for its whole lifetime.
  const mode = host._needsCharSpans
    ? RENDER_MODES.CHARS
    : host.hasAttribute(COMMON_ATTRS.FIT)
      ? RENDER_MODES.WORDS
      : RENDER_MODES.PLAIN

  host._contentEl.innerHTML = renderContent(host.text, host.delay, host.offset, mode)
}
