/**
 * @file anim-demo/mounts.ts — core-mount demo drivers: the staged mini
 * surfaces the shared mount helpers take over. The WebGPU mounts
 * (divider/ring/brackets) degrade exactly like production — no GPU,
 * artifact failure or reduced motion leaves the authored CSS effect as
 * the live paint; the burn + genie mounts run on every browser.
 */

import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { EASING, ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import store from '@core/store.js'
import { armCardBurn, disarmCardBurn } from '@core/utils/burn/burn.js'
import type { BurnClasses, BurnItem } from '@core/utils/burn/types.js'
import { mountDividerSheen } from '@core/utils/gpu/divider-sheen.js'
import { mountRingSheen } from '@core/utils/gpu/ring-sheen.js'
import { mountCornerBrackets } from '@core/utils/gpu/corner-brackets.js'
import { genieEnter, genieLeave } from '@core/utils/motion/genie.js'
import type { GenieClasses } from '@core/utils/motion/genie.js'
import { animationAlt, animationLongDesc } from '@core/utils/a11y/animation-desc.js'
import { after, cycle, DEMO_BEAT_MS, DEMO_BEAT_LONG_MS } from './cycle.js'
import type { DemoContext } from './types.js'

const C = ANIM_DEMO_CLASSES

/** The card selector arm/disarmCardBurn resolves (index 0 — one demo card). */
const _CARD_SEL = `.${C.CARD}`

/** The BurnClasses contract satisfied by the demo's own classes. */
const _BURN_CLASSES: BurnClasses = {
  ITEM_BURNING: C.CARD_BURNING,
  TITLE_OVERLAY: C.OVERLAY,
  TITLE: C.TITLE,
  TITLE_BURNING: C.TITLE_BURNING,
  TITLE_BURN: C.TITLE_BURN,
  TITLE_SLOT: C.TITLE_SLOT,
  TITLE_DUP: C.TITLE_DUP,
  TITLE_REWRITE: C.TITLE_REWRITE,
  DETAILS: C.DETAILS,
}

/**
 * Card-stack title combustion — the REAL burn pipeline (utils/burn)
 * armed on a one-card demo surface: raster, consume front, ember
 * particles, <draw-text> rewrite, then the un-burn rebuild — the
 * consume/rebuild choreography the card-stack's project names play on
 * every deal-through, replayed on the cycle.
 * @param ctx The demo context — host supplies the `$` contract.
 * @returns Teardown — stops the cycle and disarms any live session.
 */
export const mountBurnDemo = (ctx: DemoContext): (() => void) => {
  const item: BurnItem = {
    label: animationAlt(ctx.id),
    description: animationLongDesc(ctx.id),
  }

  const stop = cycle(DEMO_BEAT_LONG_MS, [
    () => {
      const card = ctx.host.$(_CARD_SEL)

      const armed = card && (card as { _burn?: unknown })._burn

      if (armed) {
        disarmCardBurn(ctx.host, 0, _BURN_CLASSES, _CARD_SEL)
      } else {
        armCardBurn(ctx.host, 0, item, _BURN_CLASSES, _CARD_SEL, 1, null)
      }
    },
  ])

  // First arm lands on a breath, not inside mount — the stage must paint
  // the pristine title once before the canvas takes over.
  const start = after(DEMO_BEAT_MS, () => {
    armCardBurn(ctx.host, 0, item, _BURN_CLASSES, _CARD_SEL, 1, null)
  })

  return () => {
    start()
    stop()
    disarmCardBurn(ctx.host, 0, _BURN_CLASSES, _CARD_SEL)
  }
}

/**
 * Footer divider sheen — the real `<hr>` fallback paint (authored in
 * anim-demo.scss) plus the WebGPU overlay attempt; the mount no-ops
 * without a GPU so the CSS band always plays.
 * @param ctx The demo context (stage owns the hr).
 * @returns Teardown — destroys the widget mount when it exists.
 */
export const mountDividerDemo = ({ stage }: DemoContext): (() => void) => {
  const hr = stage.querySelector<HTMLElement>(`.${C.DIVIDER}`)

  const teardown = hr ? mountDividerSheen(hr, C.CANVAS) : null

  return () => teardown?.()
}

/**
 * Tile ring sheen — real tiles carrying the authored ring CSS plus the
 * WebGPU instanced overlay attempt on the row container.
 * @param ctx The demo context (stage owns the tiles row).
 * @returns Teardown — destroys the sheen session when it mounted.
 */
export const mountRingSheenDemo = ({ stage }: DemoContext): (() => void) => {
  const tiles = stage.querySelector<HTMLElement>(`.${C.TILES}`)

  const session = tiles ? mountRingSheen(tiles, `.${C.TILE}`, C.CANVAS) : null

  // Session is null without WebGPU — the teardown must no-op, not throw.
  return () => session?.destroy()
}

/**
 * Action-button corner brackets — the authored ::before/::after L-brackets
 * expanding on the hover modifier (the production fallback path), plus the
 * WebGPU widget attempt keyed on the same class contract.
 * @param ctx The demo context (stage owns the button).
 * @returns Teardown — stops the hover cycle and destroys the mount.
 */
export const mountBracketsDemo = ({ stage }: DemoContext): (() => void) => {
  const btn = stage.querySelector<HTMLElement>(`.${C.BUTTON}`)

  let teardown: (() => void) | null = null

  if (btn) {
    teardown = mountCornerBrackets(btn, {
      canvasClass: C.CANVAS,
      insetVar: '--space-2xs',
      ease: EASING.EASING_POINTS,
      ms: ANIMATION_DURATIONS.BRACKET_MS,
    })
  }

  const stop = cycle(DEMO_BEAT_LONG_MS, [
    () => btn?.classList.add(C.BUTTON_HOVER),
    () => btn?.classList.remove(C.BUTTON_HOVER),
  ])

  return () => {
    stop()
    teardown?.()
  }
}

/** The GenieClasses contract satisfied by the demo's own classes. */
const _GENIE_CLASSES: GenieClasses = {
  backdrop: C.BACKDROP,
  backdropEnter: C.BACKDROP_ENTER,
  backdropLeave: C.BACKDROP_LEAVE,
  dialog: C.DIALOG,
}

/**
 * Genie modal — the real genieEnter/genieLeave helper driving a mini
 * backdrop + dialog: the origin dot's rect is committed as
 * store.modalOrigin each cycle, exactly like a trigger button would,
 * then the real warp plays between the enter/leave modifiers.
 * @param ctx The demo context — host supplies the `$` contract.
 * @returns Teardown — stops the cycle and clears the origin.
 */
export const mountGenieDemo = (ctx: DemoContext): (() => void) => {
  let open = false

  const stop = cycle(
    DEMO_BEAT_LONG_MS,
    [
      () => {
        const origin = ctx.stage.querySelector<HTMLElement>(`.${C.ORIGIN}`)

        const rect = origin?.getBoundingClientRect()

        store.commit(MODAL_MUTATIONS.SET_MODAL_ORIGIN, {
          x: rect ? rect.left + rect.width / 2 : 0,
          y: rect ? rect.top + rect.height / 2 : 0,
        })

        if (open) {
          genieLeave(ctx.host, () => undefined, _GENIE_CLASSES)
        } else {
          genieEnter(ctx.host, _GENIE_CLASSES)
        }

        open = !open
      },
    ],
    true
  )

  return () => {
    stop()
    store.commit(MODAL_MUTATIONS.SET_MODAL_ORIGIN, null)
  }
}
