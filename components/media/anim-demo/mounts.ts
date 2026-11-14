/**
 * @file anim-demo/mounts.ts — core-mount demo drivers: the staged mini
 * surfaces the shared mount helpers take over. The WebGPU mounts
 * (divider/ring/brackets) degrade exactly like production — no GPU,
 * artifact failure or reduced motion leaves the authored CSS effect as
 * the live paint; the burn + genie mounts run on every browser.
 */

import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { EASING, ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { GENIE_TIMING } from '@core/tokens/motion/genie.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { armCardBurn, disarmCardBurn } from '@core/utils/burn/burn.js'
import type { BurnClasses, BurnItem } from '@core/utils/burn/types.js'
import { mountDividerSheen } from '@core/utils/gpu/divider-sheen.js'
import { mountRingSheen } from '@core/utils/gpu/ring-sheen.js'
import { mountCornerBrackets } from '@core/utils/gpu/corner-brackets.js'
import { framePool } from '@core/utils/motion/frame.js'
import { animationAlt, animationLongDesc } from '@core/utils/a11y/animation-desc.js'
import { GENIE_DPR_CAP } from '../expanded/genie.js'
import type { GenieRect, GenieRenderer } from '../expanded/genie.js'
import { GenieCanvas2D } from '../expanded/genie-canvas.js'
import { buildGenieSheet } from '../expanded/genie-texture.js'
import type { GenieSheet } from '../expanded/genie-texture.js'
import { after, cycle, reducedMotion, DEMO_BEAT_MS, DEMO_BEAT_LONG_MS } from './cycle.js'
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

/**
 * Genie lightbox warp — the REAL expanded/genie strip-warp renderer
 * replayed on a mini lightbox: the media box liquid-funnels into the
 * origin card on the close beat and restores on the open beat, over the
 * production GENIE_TIMING clock (p = opening ? 1−raw : raw), the
 * landed-frame discipline, and the veil token hiding the unwarped
 * content while the overlay canvas owns the paint. The 2D backend is
 * universal — WebGPU is never required — so the demo is a 1:1 replica
 * of the real lightbox transition on every surface. Frame scheduling
 * rides the shared framePool (scroll-settled like production); the
 * open/close alternation lives on the long beat.
 * @param ctx The demo context — stage carries the mini lightbox
 *   (expand-modal-content + media figure) and the origin card.
 * @returns Teardown — cancels the cycle/frame loop, drops the overlay,
 *   and restores the painted modal state.
 */
export const mountGenieDemo = ({ stage, host }: DemoContext): (() => void) => {
  const content = stage.querySelector<HTMLElement>(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT}`)
  const figure = stage.querySelector<HTMLElement>(`.${ANIM_DEMO_CLASSES.GENIE_FIGURE}`)
  const mediaFig = stage.querySelector<HTMLElement>(
    `.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`
  )

  if (!content || !figure || !mediaFig || reducedMotion()) {
    // Reduced motion or a missing surface — the settled open modal stays.
    return () => undefined
  }

  let raf = 0
  let renderer: GenieRenderer | null = null
  let canvas: HTMLCanvasElement | null = null
  let sheet: GenieSheet | null = null
  let started = 0
  let last = 0
  let measured = false
  let landed = false
  let opening = false

  /** Disposes the renderer and removes the overlay canvas, if present. */
  const dropOverlay = (): void => {
    renderer?.dispose()

    renderer = null

    canvas?.remove()

    canvas = null
  }

  /** Cancels the armed frame and drops the overlay — the run is halted. */
  const halt = (): void => {
    if (raf) framePool.cancel(raf)

    raf = 0

    dropOverlay()
  }

  /**
   * Converged-settle: drop the overlay and leave the rest state — an
   * open run unveils the real content; a close run keeps it veiled (the
   * lightbox stays "closed", the origin card alone paints).
   */
  const settle = (): void => {
    halt()

    if (opening) content.classList.remove(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)
  }

  /**
   * First-frame attach — mirrors `measureAttach`: rect reads land inside
   * the rAF task, the sheet bakes once per mount (the renderer's media
   * slot restamps live on decode), the overlay canvas mounts sized to
   * the stage at the production dpr cap, and the close veil lands at
   * attach so the content paints until the warp can take over.
   * @returns False when no 2D context exists — the run settles instantly.
   */
  const attach = (): boolean => {
    const dpr = Math.min(GENIE_DPR_CAP, window.devicePixelRatio || 1)

    if (!sheet) sheet = buildGenieSheet(content, dpr)

    canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = `${C.CANVAS} ${EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS}`
    canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

    stage.appendChild(canvas)

    // The canvas box is the coordinate origin — its padding box is what
    // the ctx transform maps 1:1, so the stage border never skews the warp.
    const canvasR = canvas.getBoundingClientRect()

    canvas.width = Math.max(1, Math.round(canvasR.width * dpr))
    canvas.height = Math.max(1, Math.round(canvasR.height * dpr))

    const ctx = canvas.getContext(WEBGL_STRINGS.CONTEXT_2D, { desynchronized: true })

    if (!ctx) {
      canvas.remove()

      canvas = null

      return false
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const local = (r: DOMRect): GenieRect => ({
      x: r.left - canvasR.left,
      y: r.top - canvasR.top,
      w: r.width,
      h: r.height,
    })

    const from = local((opening ? figure : mediaFig).getBoundingClientRect())
    const to = local((opening ? mediaFig : figure).getBoundingClientRect())

    renderer = new GenieCanvas2D(canvas, ctx, sheet, from, to, opening, host)

    if (!opening) content.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)

    return true
  }

  /**
   * One frame tick — attaches on first run, draws, re-arms or settles.
   * The pump timestamp is the clock (production parity: the rAF arg is
   * a DOMHighResTimeStamp on the same timescale as performance.now()).
   * @param now The pump's frame timestamp (ms).
   */
  const tick = (now: number): void => {
    raf = 0

    const dt = Math.min(GENIE_TIMING.DT_MAX_S, Math.max(0, (now - last) / 1000))

    last = now

    if (!measured) {
      measured = true

      if (!attach()) {
        settle()

        return
      }

      started = now
    }

    const raw = Math.min(
      1,
      Math.max(0, (now - started) / (opening ? GENIE_TIMING.OPEN_MS : GENIE_TIMING.CLOSE_MS))
    )

    const p = opening ? 1 - raw : raw

    // A renderer that returns false is dead by contract; one that THROWS
    // is dead the same way (production parity — without the catch the
    // exception would latch the veil + overlay). The renderer is non-null
    // here by construction: attach() either installed it or the run
    // settled before this point — every dropOverlay callsite also cancels
    // the armed tick, so no frame can fire after the renderer clears.
    let alive: boolean

    try {
      alive = (renderer as GenieRenderer).frame(dt, p) !== false
    } catch {
      alive = false
    }

    const settled = raw >= 1 || now - started > GENIE_TIMING.MAX_MS

    if (settled && !landed && alive) {
      landed = true

      raf = framePool.request(tick)

      return
    }

    if (settled || !alive) {
      settle()

      return
    }

    raf = framePool.request(tick)
  }

  /**
   * Starts one warp run in the given direction — any in-flight run is
   * halted first so back-to-back beats never double the overlay.
   * @param dir True to fly figure→media (open), false media→figure (close).
   */
  const run = (dir: boolean): void => {
    halt()

    opening = dir
    measured = false
    landed = false
    last = 0
    started = 0

    if (dir) content.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)

    raf = framePool.request(tick)
  }

  const stopCycle = cycle(DEMO_BEAT_LONG_MS, [() => run(false), () => run(true)])

  return () => {
    stopCycle()

    halt()

    content.classList.remove(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)
  }
}
