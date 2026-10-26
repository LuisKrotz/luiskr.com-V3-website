/**
 * @file media/modal-trigger.ts
 * @description Modal trigger-focus registry for <media-figure>/<media-expanded> —
 * openMediaModal records a restore closure for the figure that opened the
 * expand modal; teardownExpandedModal runs it after the native <dialog>
 * closes so keyboard/AT focus lands back on the exact control that
 * launched the modal (WCAG focus-order expectation for dismissible
 * dialogs). Module-level because the writer (figure) and reader
 * (expanded) are sibling submodules of the media component.
 */

import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

/** Pending focus-restore closure for the figure that opened the modal. */
let _trigger: (() => void) | null = null

/** Document title parked before the media deep-link suffix went on. */
let _pageTitle: string | null = null

/**
 * Registers the focus-restore closure for the current modal open.
 * @param fn — closure that focuses the trigger's expand control.
 */
export const setMediaModalTrigger = (fn: () => void): void => {
  _trigger = fn
}

/**
 * Runs the registered trigger-restore closure, then clears it — one-shot:
 * a stale closure must never fire on the next unrelated modal close.
 */
export const restoreMediaModalTrigger = (): void => {
  _trigger?.()

  _trigger = null
}

/**
 * Appends the media label to document.title while its deep-link URL is
 * in the address bar — a /portfolio/<p>/<media> URL names its own asset
 * (watch page), so the live title mirrors the emitted page's
 * "… | <label>" <title>. The pre-modal title parks once (a second open
 * never stacks suffixes) for restoreMediaPageTitle to hand back.
 * @param label — the media item's caption/label.
 */
export const setMediaPageTitle = (label: string): void => {
  if (!label) return

  if (_pageTitle === null) _pageTitle = document.title

  document.title = `${_pageTitle} ${CHAR_STRINGS.PIPE_SEP} ${label}`
}

/**
 * Hands the parked pre-modal title back to the document — the media
 * slug leaves the URL on close, so the title reverts with it.
 */
export const restoreMediaPageTitle = (): void => {
  if (_pageTitle === null) return

  document.title = _pageTitle

  _pageTitle = null
}
