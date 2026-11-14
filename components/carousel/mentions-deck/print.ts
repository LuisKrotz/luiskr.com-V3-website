/**
 * @file mentions-deck/print.ts — the deck's printable form.
 *
 * The strip's card poses are inline style writes from applyPoses/measure
 * (absolute positions, transforms, edge-dissolve opacities). print.ts's
 * generic `[style]` walk strips them at beforeprint, but the print-layout
 * reflow would fire the same posers again — the fanned strip would
 * return mid-snapshot (clustered, dissolved cards on paper).
 * `host._printing` gates measure/applyPoses for the duration of the job;
 * the shadow-local print sheet re-flows the deck into a static vertical
 * list so every mention prints with its full description.
 *
 * `afterprint` — and the matchMedia('print') false edge, which never
 * dispatches a native event — both restore: the flag drops and
 * applyPoses() re-writes the live strip poses (poses are pure derived
 * output, so re-posing needs no attr bookkeeping).
 */

import type { MentionsDeck } from '../MentionsDeck.js'

/**
 * Arms the printable form: freezes the posers so no measure/applyPoses
 * call between the prepare event and the snapshot can restore the fan
 * geometry the adapter strips. Called from the `printprepare` window
 * event — inside print.ts's enter pass, before the media/style walk.
 * @param host The MentionsDeck element.
 */
export function preparePrint(host: MentionsDeck): void {
  host._printing = true
}

/**
 * Tears the printable form down: the poser gate drops and applyPoses()
 * re-writes the strip geometry print.ts stripped (its exit pass also
 * restores recorded attrs — re-posing lands on the same values, so
 * listener order between exit() and this pass doesn't matter).
 * Idempotent — both restore channels may fire for one job.
 * @param host The MentionsDeck element.
 */
export function restorePrint(host: MentionsDeck): void {
  host._printing = false

  host.applyPoses()
}
