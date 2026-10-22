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

/** Pending focus-restore closure for the figure that opened the modal. */
let _trigger: (() => void) | null = null

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
