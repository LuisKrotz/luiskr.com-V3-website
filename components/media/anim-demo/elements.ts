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
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { mountScene3d, SCENE3D_NONE } from '@core/utils/gpu/scene3d.js'
import type { Scene3dHandle, Scene3dSurface } from '@core/utils/gpu/scene3d.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { loadDemoData } from './data.js'
import { DEMO_BEAT_LONG_MS, reducedMotion } from './cycle.js'
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
  configure?(o: { items?: unknown; folder?: string; forceActive?: boolean }): void
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
        // configure; the guard keeps the demo inert there.
        const items = portfolioRows(home, related).map((item) => ({
          src: item.image,
          label: (item.label || item.title || ATTR_VALUES.EMPTY) as string,
        }))

        el.configure?.({
          items,
          folder: DB_PATHS.COVERS,
          // The project view's rule: more items than the strip fits
          // keeps the transport affordances visibly active.
          forceActive: items.length > 2,
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

/* ── Scene-3d demo constants ─────────────────────────────────────── */

/** Star count in the engine mini-scene — a compact cloud that still
 *  reads as the playground's star field at the demo's small box. */
const _SCENE_STARS = 300

/** Star-cloud radius in world units — the disc the camera orbits. */
const _SCENE_RADIUS = 200

/** Orbit distance — the camera stands back far enough to frame the
 *  whole cloud inside the demo's ~4:3 box. */
const _SCENE_DIST = 320

/** Vertical field of view, degrees — the engines' standard lens. */
const _SCENE_FOV = 55

/** Camera near clip — inside the cloud's inner edge. */
const _CLIP_NEAR = 1

/** Camera far clip — past the cloud's outer edge. */
const _CLIP_FAR = 1000

/** Point-sprite diameter in world units. */
const _POINT_SIZE = 1.4

/** Star-cloud yaw drift (rad/s) — a slow turn, not a spin. */
const _SCENE_DRIFT = 0.06

/** Orbit yaw sway amplitude (rad) — a gentle camera bob. */
const _SCENE_SWAY = 0.15

/** Orbit sway rate (rad/s). */
const _SCENE_SWAY_RATE = 0.12

/** Resting orbit pitch (rad) — lifted so the cloud reads as a disc,
 *  not a line. */
const _SCENE_PITCH = 0.22

/** set_material_flags slots — front faces, additive blending (stars
 *  accumulate light; the API takes the enum's numeric index). */
const _SIDE_FRONT = 0
const _BLEND_ADDITIVE = 1

/**
 * Seeds the mounted scene3d surface with a mini star field — a flat
 * point cloud in an additive material on a slowly orbiting camera, the
 * same vocabulary the real playground scene speaks (points, orbit rig,
 * one rAF-driven `frame()`). Runs the engine's own API so the demo is
 * a real scene, not a canned recording; under reduced motion it paints
 * one settled frame and stops.
 * @param canvas The GPU canvas (computed-style anchor for the ink).
 * @param surface The live engine handle's surface.
 * @returns The rAF id to cancel on teardown (0 when settled/mocked).
 */
const seedScene = (canvas: HTMLCanvasElement, surface: Scene3dSurface): number => {
  const ink = parseCssColor(
    getComputedStyle(canvas).getPropertyValue(THEME_CSS_PROPS.TEXT_MUTED_ON_DARK)
  ) || [1, 1, 1]

  surface.set_clear(0, 0, 0, 0)
  surface.set_fov(_SCENE_FOV)
  surface.set_clip(_CLIP_NEAR, _CLIP_FAR)

  // SoA geometry — positions carry the cloud; normals/uvs/indices only
  // satisfy the upload signature (points ignore shading attrs anyway).
  const positions = new Float32Array(_SCENE_STARS * 3)
  const normals = new Float32Array(_SCENE_STARS * 3)
  const uvs = new Float32Array(_SCENE_STARS * 2)
  const indices = new Uint32Array(_SCENE_STARS)

  for (let i = 0; i < _SCENE_STARS; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2 * _SCENE_RADIUS
    positions[i * 3 + 1] = (Math.random() - 0.5) * _SCENE_RADIUS
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * _SCENE_RADIUS
    normals[i * 3 + 1] = 1
    indices[i] = i
  }

  const geo = surface.upload_geometry(positions, normals, uvs, indices, true)
  const mat = surface.add_material_points(ink[0], ink[1], ink[2], 1, _POINT_SIZE, SCENE3D_NONE)

  surface.set_material_flags(mat, _SIDE_FRONT, _BLEND_ADDITIVE, true, false)

  const node = surface.add_points(SCENE3D_NONE, geo, mat)

  const dpr = () => window.devicePixelRatio || 1

  if (reducedMotion()) {
    surface.set_orbit(0, 0, 0, _SCENE_DIST, 0, _SCENE_PITCH)
    surface.frame(0, dpr())

    return 0
  }

  // Per-frame writes stay scalar: node yaw + orbit sway + one frame —
  // no allocations inside the tick (frame-budget rule). A dead wasm
  // surface throws inside rAF — outside every promise chain — so a
  // throwing frame retires the loop instead of spamming exceptions;
  // the 2D underlay remains the live paint.
  const tick = (now: number) => {
    const t = now / 1000

    try {
      surface.set_euler(node, 0, t * _SCENE_DRIFT, 0)
      surface.set_orbit(
        0,
        0,
        0,
        _SCENE_DIST,
        Math.sin(t * _SCENE_SWAY_RATE) * _SCENE_SWAY,
        _SCENE_PITCH
      )
      surface.frame(t, dpr())
    } catch {
      return
    }

    raf = requestAnimationFrame(tick)
  }

  let raf = requestAnimationFrame(tick)

  return raf
}

/**
 * 3D-scene demo — the stage carries two stacked full-size canvases:
 * the first always paints the 2D starfield approximation (it is also
 * the fallback surface); the real scene3d engine mounts on the last
 * one and, where WebGPU is available, composites its own seeded mini
 * scene over the field. Splitting the surfaces keeps the fallback's
 * 2D context alive — a shared canvas can't re-bind '2d' once the
 * engine claims it for WebGPU, which is how the single-canvas version
 * stranded the stage on a transparent blank.
 * @param ctx The demo context (stage owns the canvas pair).
 * @returns Teardown — destroys whichever surfaces mounted.
 */
export const mountScene3dDemo = (ctx: DemoContext): (() => void) => {
  const canvases = ctx.stage.querySelectorAll<HTMLCanvasElement>(HTML_TAGS.CANVAS)

  const under = canvases[0]

  if (!under) return () => undefined

  // The engine claims the LAST canvas — mountSceneDemo's
  // `.anim-demo-canvas` pick keeps the first one painting underneath;
  // `under` surviving the guard above proves the last slot holds an
  // element.
  const gpu = canvases[canvases.length - 1]

  // The GPU surface has no synchronous repaint hook, so a capture could
  // serialize a buffer the async mount never painted — the 2D field
  // underneath stays the faithful print still. `data-print-skip` retires
  // it outright (print-src) so the generic canvas arm can't blind-capture
  // its transparent buffer either.
  if (gpu !== under) {
    gpu.removeAttribute(DATA_ATTRS.PRINT_CAPTURE)
    gpu.setAttribute(DATA_ATTRS.PRINT_SKIP, '')
  }

  const fallback = mountScene2d(ctx)

  let handle: Scene3dHandle | null = null
  let raf = 0

  const armed = { current: true }

  mountScene3d(gpu)
    .then((h) => {
      if (!armed.current) {
        h?.destroy()
        return
      }

      if (!h) return

      handle = h

      // The surface field is optional at runtime (tests stub the
      // handle without it) — an unseeded engine simply paints clear.
      if (h.surface) raf = seedScene(gpu, h.surface)
    })
    .catch(() => undefined)

  return () => {
    armed.current = false

    if (raf) cancelAnimationFrame(raf)

    handle?.destroy()
    fallback()
  }
}
