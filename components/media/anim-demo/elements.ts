/**
 * @file anim-demo/elements.ts — real-element demo drivers: the demos
 * that mount the production custom elements themselves (card-stack,
 * mentions-deck, awards-carousel, custom-carousel, about-section) and
 * feed them the same CMS nodes the real views push (see ./data.ts).
 * The elements' tags are registered by the view; a driver never
 * imports a component folder — props are pushed through duck-typed
 * surfaces so the media component stays portable (the same contract
 * home/children.ts uses to push data into its children). Every driver
 * returns a teardown that only blocks late data writes — the mounted
 * element dies with the stage DOM it lives in.
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { AWC_VARIANTS } from '@core/tokens/classes/awards-carousel.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { mountScene3d } from '@core/utils/gpu/scene3d.js'
import type { Scene3dHandle } from '@core/utils/gpu/scene3d.js'
import { loadDemoData } from './data.js'
import { DEMO_BEAT_LONG_MS } from './cycle.js'
import { mountSceneDemo as mountScene2d } from './canvas2d.js'
import type { AnimDemoData } from './data.js'
import type { DemoContext } from './types.js'

/** Duck-typed <card-stack> surface — the real props the home view pushes. */
interface CardStackEl extends HTMLElement {
  processedItems: unknown
  translations: unknown
}

/** Duck-typed <mentions-deck> surface — title + items + deckHint copy
 *  (Omit re-bases `title` — the element widens HTMLElement's own
 *  `title: string` accessor to accept null like the real component). */
type MentionsDeckEl = Omit<HTMLElement, 'title'> & {
  title: string | null
  items: unknown
  translations: unknown
}

/** Duck-typed <awards-carousel> surface — variant/dots/dwell config + slides. */
interface AwardsCarouselEl extends HTMLElement {
  variant: string
  showDots: boolean
  duration: number
  items: unknown
}

/** Duck-typed <custom-carousel> surface — the batch assign the project
 *  view calls (optional: unregistered in test envs that skip the
 *  component registry). */
interface CustomCarouselEl extends HTMLElement {
  setItems?(o: { items?: unknown; folder?: string; forceActive?: number }): void
}

/** Duck-typed <about-section> surface — the two props the home view pushes. */
interface AboutSectionEl extends HTMLElement {
  aboutTranslations: unknown
  profilePicture: string | null
}

/**
 * Demo cadence for the awards-carousel autoplay dwell — the production
 * strip idles 30s per slide, which reads as a static frame inside a
 * demo box; the dwell is a host-configured prop, so the demo mounts
 * the real element with a demo-visible dwell. The scroll/momentum
 * animation itself is the production path either way.
 */
const _DEMO_DWELL_MS = DEMO_BEAT_LONG_MS

/**
 * The featured flag normalization the home view applies to
 * portfoliolist rows — explicit true/'true'/1 on the row, or membership
 * in the canonical featured-links set from components/projects.
 * @param item The raw portfoliolist row.
 * @param featuredLinks Links flagged featured in components/projects.
 * @returns The row with a boolean `featured`.
 */
const processedItem = (
  item: Record<string, unknown>,
  featuredLinks: Set<string>
): Record<string, unknown> => ({
  ...item,
  featured:
    item.featured === true ||
    item.featured === ATTR_VALUES.TRUE ||
    item.featured === 1 ||
    Boolean(item.link && featuredLinks.has(item.link as string)),
})

/**
 * The canonical featured-links set — the components/related rows
 * flagged featured; the same source the home view reads to fan the
 * deck.
 * @param related The loaded components/related node.
 * @returns Project links flagged featured in the CMS.
 */
const featuredLinks = (
  related: Record<string, { featured?: unknown; link?: string }> | null
): Set<string> => {
  const links = new Set<string>()

  Object.values(related || {}).forEach((p) => {
    if (p.featured === true && p.link) links.add(p.link)
  })

  return links
}

/**
 * The portfoliolist rows of the loaded HOME node, normalized to the
 * array shape card-stack/custom-carousel consume (the DB stores the
 * list as either an array or a keyed object), featured flags resolved
 * the same way home's processedItems resolves them.
 * @param home The loaded pages/HOME node.
 * @param related The loaded components/related node (featured source).
 * @returns The portfolio rows, featured flags resolved.
 */
const portfolioRows = (
  home: Record<string, unknown> | null,
  related: Record<string, { featured?: unknown; link?: string }> | null
): Record<string, unknown>[] => {
  const raw = home?.portfoliolist

  const list: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : (Object.values(raw || {}) as Record<string, unknown>[])

  const links = featuredLinks(related)

  return list.map((item) => processedItem(item, links))
}

/**
 * The mention_items rows of the loaded ABOUT node — the same records
 * the real deck/awards strip fan (link + icon + description).
 * @param about The loaded pages/ABOUT node.
 * @returns The mention rows.
 */
const mentionRows = (about: Record<string, unknown> | null): unknown[] => {
  const raw = about?.mention_items

  return Array.isArray(raw) ? raw : Object.values(raw || {})
}

/**
 * Guarded data write — resolves the shared demo data and assigns it
 * into the element only while the mount is still live (a demo that
 * scrolled away or unmounted discards the late payload).
 * @param alive The liveness flag the teardown flips.
 * @param apply Pushes the resolved node pair into the element.
 * @returns The liveness flag's flip function — the driver teardown.
 */
const feed = (alive: { current: boolean }, apply: (d: AnimDemoData) => void) => {
  loadDemoData().then((d) => {
    if (alive.current) apply(d)
  })

  return () => {
    alive.current = false
  }
}

/**
 * Card-stack demo — mounts the real <card-stack> coverflow and pushes
 * the real portfoliolist (featured flags resolved like home's
 * processedItems). The deck's own autoplay/drag/spring machinery owns
 * the animation; the demo only supplies data.
 * @param ctx The demo context (stage owns the element).
 * @returns Teardown — blocks the late data write.
 */
export const mountCardStackDemo = ({ stage }: DemoContext): (() => void) => {
  const el = stage.querySelector<CardStackEl>(COMPONENT_TAGS.CARD_STACK)

  const alive = { current: true }

  const stop = el
    ? feed(alive, ({ home, related }) => {
        el.translations = home
        el.processedItems = portfolioRows(home, related)
      })
    : () => {
        alive.current = false
      }

  return stop
}

/**
 * Mentions-deck demo — mounts the real <mentions-deck> and pushes the
 * real mention records + deck hint copy the contact section supplies.
 * The deck's drag-dismiss/autoplay choreography is the production path.
 * @param ctx The demo context (stage owns the element).
 * @returns Teardown — blocks the late data write.
 */
export const mountMentionsDeckDemo = ({ stage }: DemoContext): (() => void) => {
  const el = stage.querySelector<MentionsDeckEl>(COMPONENT_TAGS.MENTIONS_DECK)

  const alive = { current: true }

  const stop = el
    ? feed(alive, ({ home, about }) => {
        el.title = (about?.mentions as string) || ATTR_VALUES.EMPTY
        el.translations = home
        el.items = mentionRows(about)
      })
    : () => {
        alive.current = false
      }

  return stop
}

/**
 * Awards-carousel demo — mounts the real <awards-carousel> in its
 * awards variant with the real mention slides; the dwell is shortened
 * to a demo-visible cadence (the momentum/clone-wrap animation is the
 * production path regardless).
 * @param ctx The demo context (stage owns the element).
 * @returns Teardown — blocks the late data write.
 */
export const mountAwardsCarouselDemo = ({ stage }: DemoContext): (() => void) => {
  const el = stage.querySelector<AwardsCarouselEl>(COMPONENT_TAGS.AWARDS_CAROUSEL)

  if (!el) return () => undefined

  el.variant = AWC_VARIANTS.AWARDS
  el.showDots = true
  el.duration = _DEMO_DWELL_MS

  const alive = { current: true }

  return feed(alive, ({ about }) => {
    el.items = mentionRows(about)
  })
}

/**
 * Custom-carousel demo — mounts the real <custom-carousel> with cover
 * slides built from the real portfoliolist (CDN stem + label), the
 * same item shape project galleries push.
 * @param ctx The demo context (stage owns the element).
 * @returns Teardown — blocks the late data write.
 */
export const mountCustomCarouselDemo = ({ stage }: DemoContext): (() => void) => {
  const el = stage.querySelector<CustomCarouselEl>(COMPONENT_TAGS.CUSTOM_CAROUSEL)

  const alive = { current: true }

  const stop = el
    ? feed(alive, ({ home, related }) => {
        // The tag may be unregistered (shared axe suite mounts the view
        // without the component registry) — a plain element has no
        // setItems; the guard keeps the demo inert there.
        el.setItems?.({
          items: portfolioRows(home, related).map((item) => ({
            src: item.image,
            label: (item.label || item.title || ATTR_VALUES.EMPTY) as string,
          })),
          folder: DB_PATHS.COVERS,
        })
      })
    : () => {
        alive.current = false
      }

  return stop
}

/**
 * About-section demo — mounts the real <about-section> and pushes the
 * real about node + profile picture; the section's own machinery
 * mounts the glitch session, the warp mesh and the draw-text bio — so
 * the glitch-portrait and about-mesh records demo the production
 * surface itself.
 * @param ctx The demo context (stage owns the element).
 * @returns Teardown — blocks the late data write.
 */
export const mountAboutSectionDemo = ({ stage }: DemoContext): (() => void) => {
  const el = stage.querySelector<AboutSectionEl>(COMPONENT_TAGS.ABOUT_SECTION)

  const alive = { current: true }

  const stop = el
    ? feed(alive, ({ about }) => {
        el.aboutTranslations = about
        el.profilePicture = (about?.profilePicture as string) || null
      })
    : () => {
        alive.current = false
      }

  return stop
}

/**
 * 3D-scene demo — mounts the real mountScene3d WebGPU surface on the
 * stage canvas; where WebGPU/the wasm artifact is unavailable (the
 * common headless/fallback case) the 2D approximation driver keeps the
 * stage alive with the same motion vocabulary.
 * @param ctx The demo context (stage owns the canvas).
 * @returns Teardown — destroys whichever surface mounted.
 */
export const mountScene3dDemo = (ctx: DemoContext): (() => void) => {
  const canvas = ctx.stage.querySelector<HTMLCanvasElement>('canvas')

  if (!canvas) return () => undefined

  let handle: Scene3dHandle | null = null
  let fallback: (() => void) | null = null

  const armed = { current: true }

  mountScene3d(canvas)
    .then((h) => {
      if (!armed.current) {
        h?.destroy()
        return
      }

      if (h) {
        handle = h
      } else {
        fallback = mountScene2d(ctx)
      }
    })
    .catch(() => {
      if (armed.current) fallback = mountScene2d(ctx)
    })

  return () => {
    armed.current = false

    handle?.destroy()
    fallback?.()
  }
}
