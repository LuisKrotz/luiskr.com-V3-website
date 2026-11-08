/**
 * @file anim-demo/dom.ts — staged-DOM demo drivers: the CSS-surface
 * animations replayed by flipping the same modifier classes a pointer
 * or the app shell would (menu open, toast in/out, progress bar
 * active/done, related-tile stagger, draw-text replay). The surfaces
 * themselves are the staged replicas from stages.tsx carrying the real
 * animation choreography in anim-demo.scss — drivers only drive state.
 */

import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { cycle, DEMO_BEAT_MS, DEMO_BEAT_LONG_MS } from './cycle.js'
import type { DemoContext } from './types.js'

const C = ANIM_DEMO_CLASSES

/** Loader counter steps the demo writes into the readout (percent text). */
const _LOADER_STEPS = ['0%', '25%', '50%', '75%', '100%']

/** Intro-loader demo — the percent readout counts 0→100 on coarse
 * beats while the staged rings/fill sweep in CSS (keyframes own the
 * smooth interpolation, JS only writes the coarse text like the real
 * loader's percent ticker).
 * @param ctx The demo context (stage owns the counter span).
 * @returns Teardown — stops the counter cycle.
 */
export const mountLoaderDemo = ({ stage }: DemoContext): (() => void) => {
  const counter = stage.querySelector<HTMLElement>(`.${C.LOADER_COUNTER}`)

  let step = 0

  const stop = cycle(DEMO_BEAT_MS / 2, [
    () => {
      if (!counter) return

      step = (step + 1) % _LOADER_STEPS.length

      counter.textContent = _LOADER_STEPS[step]
    },
  ])

  return () => {
    stop()

    if (counter) counter.textContent = _LOADER_STEPS[0]
  }
}

/** Nav menu demo — toggles the open modifier so the staged items play
 * the real menu's staggered rise/fade entrance and exit.
 * @param ctx The demo context (stage owns the menu column).
 * @returns Teardown — stops the open/close cycle.
 */
export const mountMenuDemo = ({ stage }: DemoContext): (() => void) => {
  const menu = stage.querySelector<HTMLElement>(`.${C.MENU}`)

  const stop = cycle(
    DEMO_BEAT_LONG_MS,
    [() => menu?.classList.add(C.MENU_OPEN), () => menu?.classList.remove(C.MENU_OPEN)],
    true
  )

  return () => {
    stop()
    menu?.classList.remove(C.MENU_OPEN)
  }
}

/** Site-toast demo — alternates the staged pill between the slide/fade
 * entrance and the exit states, the same choreography a real
 * notification item plays.
 * @param ctx The demo context (stage owns the toast item).
 * @returns Teardown — stops the in/out cycle.
 */
export const mountToastDemo = ({ stage }: DemoContext): (() => void) => {
  const item = stage.querySelector<HTMLElement>(`.${C.TOAST_ITEM}`)

  const stop = cycle(
    DEMO_BEAT_LONG_MS,
    [
      () => {
        item?.classList.add(C.TOAST_IN)
        item?.classList.remove(C.TOAST_OUT)
      },
      () => {
        item?.classList.add(C.TOAST_OUT)
        item?.classList.remove(C.TOAST_IN)
      },
    ],
    true
  )

  return () => {
    stop()
    item?.classList.remove(C.TOAST_IN, C.TOAST_OUT)
  }
}

/** Mosaic-tile spring demo — toggles the hover modifier on the spring
 * tile so the transform transition replays the real tile's overshoot
 * ease (the displaced lift is a CSS var the class animates).
 * @param ctx The demo context (stage owns the spring tile).
 * @returns Teardown — stops the hover cycle.
 */
export const mountTileSpringDemo = ({ stage }: DemoContext): (() => void) => {
  const tile = stage.querySelector<HTMLElement>(`.${C.TILE_SPRING}`)

  const stop = cycle(
    DEMO_BEAT_LONG_MS,
    [() => tile?.classList.add(C.TILE_HOVER), () => tile?.classList.remove(C.TILE_HOVER)],
    true
  )

  return () => {
    stop()
    tile?.classList.remove(C.TILE_HOVER)
  }
}

/** Related-tile reveal demo — walks the staged tiles' hover modifier
 * one index per beat so the lift rises tile-by-tile like the related
 * list's staggered scroll reveal.
 * @param ctx The demo context (stage owns the tile row).
 * @returns Teardown — stops the stagger cycle.
 */
export const mountRelatedTilesDemo = ({ stage }: DemoContext): (() => void) => {
  const tiles = stage.querySelectorAll<HTMLElement>(`.${C.TILE}`)

  let i = 0

  const stop = cycle(
    DEMO_BEAT_MS,
    [
      () => {
        if (!tiles.length) return

        i = (i + 1) % (tiles.length + 1)

        tiles.forEach((tile, j) => tile.classList.toggle(C.TILE_HOVER, j < i))
      },
    ],
    true
  )

  return () => {
    stop()
    tiles.forEach((tile) => tile.classList.remove(C.TILE_HOVER))
  }
}

/** DrawText demo — resets then re-triggers the element so the
 * letter-drawing replay loop mirrors the real heading's reveal.
 * @param ctx The demo context (stage owns the <draw-text> element).
 * @returns Teardown — stops the replay cycle.
 */
export const mountDrawDemo = ({ stage }: DemoContext): (() => void) => {
  const el = stage.querySelector<HTMLElement & { trigger?: () => void; reset?: () => void }>(
    `.${C.DRAW}`
  )

  const replay = () => {
    if (!el?.trigger || !el.reset) return

    el.reset()
    el.trigger()
  }

  const stop = cycle(DEMO_BEAT_LONG_MS, [replay])

  replay()

  return () => stop()
}

/** Route progress-bar demo — walks the staged bar through the real
 * nprogress choreography: crawl (active) → complete (done) → reset,
 * on long beats so each phase reads.
 * @param ctx The demo context (stage owns the bar element).
 * @returns Teardown — stops the phase cycle.
 */
export const mountProgressBarDemo = ({ stage }: DemoContext): (() => void) => {
  const bar = stage.querySelector<HTMLElement>(`.${C.BAR}`)

  let phase = 0

  const stop = cycle(
    DEMO_BEAT_LONG_MS / 2,
    [
      () => {
        if (!bar) return

        phase = (phase + 1) % 3

        bar.classList.toggle(C.BAR_ACTIVE, phase === 1)
        bar.classList.toggle(C.BAR_DONE, phase === 2)
      },
    ],
    true
  )

  return () => {
    stop()
    bar?.classList.remove(C.BAR_ACTIVE, C.BAR_DONE)
  }
}

/** Body-glow demo — the staged glow surface drifts entirely in CSS
 * (the ::before wash mirrors the document-level glow); mounted for
 * completeness so the registry covers every id.
 * @param _ctx The demo context — unused, no JS state to drive.
 */
export const mountGlowDemo = (_ctx: DemoContext): void => undefined

/** Skeleton-shimmer demo — the staged placeholders carry the shared
 * skeleton classes whose shimmer sweeps in CSS; no JS state to drive.
 * @param _ctx The demo context — unused.
 */
export const mountSkeletonDemo = (_ctx: DemoContext): void => undefined

/** Carousel demo — the staged track marquees + progress rail sweeps in
 * CSS keyframes; no JS state to drive.
 * @param _ctx The demo context — unused.
 */
export const mountCarouselDemo = (_ctx: DemoContext): void => undefined

/** Media-progressive demo — the real <media-figure> mounts its own
 * decode/progressive lifecycle; no JS state to drive.
 * @param _ctx The demo context — unused.
 */
export const mountMediaDemo = (_ctx: DemoContext): void => undefined

/** Card-stack demo — walks each staged card's slot one step per beat so
 * the fanned cards deal through the front slot (data-index −2…2 maps to
 * the SCSS transform/z-index ladder; the wrap-around card slides to the
 * far end the way the real deck recycles a dealt card).
 * @param ctx The demo context (stage owns the fanned cards).
 * @returns Teardown — stops the deal cycle.
 */
export const mountFanDemo = ({ stage }: DemoContext): (() => void) => {
  const cards = Array.from(stage.querySelectorAll<HTMLElement>(`.${C.FAN_CARD}`))

  const slots = cards.map((card) => Number(card.getAttribute(DATA_ATTRS.DATA_INDEX)) || 0)

  const deal = () => {
    cards.forEach((card, i) => {
      slots[i] = slots[i] - 1 < -2 ? 2 : slots[i] - 1

      card.setAttribute(DATA_ATTRS.DATA_INDEX, String(slots[i]))
    })
  }

  const stop = cycle(DEMO_BEAT_MS, [deal], true)

  return () => stop()
}

/** Nav icon-aura demo — alternates the armed modifier across the two
 * staged chips so the comet-trail ring-fill sweeps each outline in turn,
 * the hover path the real chips play.
 * @param ctx The demo context (stage owns the chip row).
 * @returns Teardown — stops the aura cycle.
 */
export const mountAuraDemo = ({ stage }: DemoContext): (() => void) => {
  const chips = stage.querySelectorAll<HTMLElement>(`.${C.CHIP}`)

  let i = -1

  const arm = () => {
    i = (i + 1) % (chips.length + 1)

    chips.forEach((chip, j) => chip.classList.toggle(C.CHIP_ARMED, j === i))
  }

  const stop = cycle(DEMO_BEAT_MS, [arm], true)

  return () => {
    stop()
    chips.forEach((chip) => chip.classList.remove(C.CHIP_ARMED))
  }
}

/** View-transition demo — alternates the gone modifier between the two
 * staged panes so the outgoing "page" fades out as the incoming one
 * fades in, the #view-outlet cross-fade in miniature.
 * @param ctx The demo context (stage owns the pane pair).
 * @returns Teardown — stops the cross-fade cycle.
 */
export const mountTransitionDemo = ({ stage }: DemoContext): (() => void) => {
  const panes = stage.querySelectorAll<HTMLElement>(`.${C.PANE}`)

  let flip = false

  const swap = () => {
    flip = !flip

    panes.forEach((pane, i) => pane.classList.toggle(C.PANE_GONE, flip ? i === 0 : i === 1))
  }

  const stop = cycle(DEMO_BEAT_LONG_MS, [swap], true)

  return () => {
    stop()
    panes.forEach((pane, i) => pane.classList.toggle(C.PANE_GONE, i === 1))
  }
}

/** Route-search demo — toggles the loading modifier so the staged field
 * alternates idle ↔ scoring-in-flight (spinning glyph + bouncing dots).
 * @param ctx The demo context (stage owns the field).
 * @returns Teardown — stops the loading cycle.
 */
export const mountSearchDemo = ({ stage }: DemoContext): (() => void) => {
  const field = stage.querySelector<HTMLElement>(`.${C.SEARCH}`)

  const stop = cycle(DEMO_BEAT_MS, [() => field?.classList.toggle(C.SEARCH_LOADING)], true)

  return () => {
    stop()
    field?.classList.remove(C.SEARCH_LOADING)
  }
}

/** Mentions-deck demo — two-phase swipe: the front card (slot 0) flies
 * out on the first beat, then re-seats at the back while the next card
 * slides to front — the drag-dismiss + autoplay cycle in miniature.
 * @param ctx The demo context (stage owns the deck cards).
 * @returns Teardown — stops the swipe cycle.
 */
export const mountDeckDemo = ({ stage }: DemoContext): (() => void) => {
  const cards = Array.from(stage.querySelectorAll<HTMLElement>(`.${C.DECK_CARD}`))

  const slots = cards.map((card) => Number(card.getAttribute(DATA_ATTRS.DATA_INDEX)) || 0)

  const front = () => cards[slots.indexOf(0)]

  const out = () => front()?.classList.add(C.DECK_GONE)

  const reseat = () => {
    cards.forEach((card, i) => {
      slots[i] = (slots[i] + 2) % 3

      card.setAttribute(DATA_ATTRS.DATA_INDEX, String(slots[i]))
    })

    cards.forEach((card) => card.classList.remove(C.DECK_GONE))
  }

  const stop = cycle(DEMO_BEAT_MS, [out, reseat], true)

  return () => {
    stop()
    cards.forEach((card) => card.classList.remove(C.DECK_GONE))
  }
}

/** Expand-modal loading demo — toggles the ready modifier so the staged
 * lightbox alternates spinner ↔ shimmer-sweep, the loading lifecycle
 * the real lightbox plays while the full-size asset decodes.
 * @param ctx The demo context (stage owns the modal panel).
 * @returns Teardown — stops the loading cycle.
 */
export const mountModalLoadingDemo = ({ stage }: DemoContext): (() => void) => {
  const modal = stage.querySelector<HTMLElement>(`.${C.MODAL}`)

  const stop = cycle(DEMO_BEAT_LONG_MS, [() => modal?.classList.toggle(C.MODAL_READY)], true)

  return () => {
    stop()
    modal?.classList.remove(C.MODAL_READY)
  }
}

/** Footer feed-wave demo — the staged link row ripples entirely in CSS
 * (per-item animation-delay staggers the opacity wave); no JS state.
 * @param _ctx The demo context — unused.
 */
export const mountFeedWaveDemo = (_ctx: DemoContext): void => undefined
