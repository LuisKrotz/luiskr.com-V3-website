/**
 * @file anim-demo/types.ts — shared demo-driver contracts. A driver is
 * the mount function bound to one ANIMATION_IDS entry: it wires the
 * stage's live animation and returns the teardown the host runs on
 * destroy.
 */

import type { AnimDemo } from '../AnimDemo.js'

/**
 * One driver's mount context — everything it needs from the host.
 */
export interface DemoContext {
  /** The <anim-demo> host — exposes the shadow-scoped `$`/`$$` helpers
   *  the genie + burn contracts require and owns the demo's lifecycle. */
  host: AnimDemo
  /** The stage root (`anim-demo` class element) rendered for this id. */
  stage: HTMLElement
  /** The ANIMATION_IDS entry being demoed — drivers read record copy
   *  (alt/longdesc) through it when staged text is needed. */
  id: string
}

/**
 * A demo mount — wires the stage and returns a teardown (or nothing
 * when the animation needs no explicit teardown, e.g. the skeleton
 * layer the base component owns).
 */
export type DemoMount = (_ctx: DemoContext) => (() => void) | void
