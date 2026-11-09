/**
 * @file routes/views/home/parallax.ts
 * @description Scroll-driven parallax for <view-home> — desktop-only
 * (≥1280, the `desktop` width class) layered drift: each section's INNER
 * content slides inside its painted frame — the card-stack deck recedes
 * while its foot controls rise, the about columns split against each
 * other, the contact copy drifts over the mentions deck, and the awards
 * band's rows counter-drift. Section hosts, backgrounds and boundary
 * chrome never transform, so no seam can open a colour gap.
 *
 * Mechanics (per shared/docs/animations — "parallax progress is sampled
 * once per frame and written to CSS custom properties"):
 *
 *   measure pass (attach, re-render, ResizeObserver, resize): caches
 *   every layer's UNTRANSFORMED document-space top + height inside the
 *   sanctioned flush window — the scroll tick never touches layout.
 *
 *   scroll tick: one rAF per event burst reads scrollY, maps each
 *   layer's centre-vs-viewport-centre distance to progress ∈ [-1, 1],
 *   and writes `progress × amplitude` to the layer's CSS var(s). The
 *   stylesheets own the translate3d() declarations consuming the vars —
 *   compositor-only motion.
 *
 *   gates: matchMedia(WIDTH_CLASS_GATES.desktop) AND no reduced-motion
 *   (explicit localStorage pref wins, else the live OS flag). Either
 *   gate dropping disarms the loop and removes every var so elements
 *   snap back to their natural position.
 *
 * framePool is deliberately NOT used: it freezes every queued tick
 * while isScrolling() is true — designed to starve work during flings,
 * which is exactly when a scroll parallax must paint.
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { SECTIONS } from '@core/tokens/base.js'
import { PARALLAX_CSS_PROPS } from '@core/tokens/css/parallax.js'
import { PREF_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { FORM_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { SECTION_IDS } from '@core/tokens/ids/sections.js'
import { WIDTH_CLASS_GATES } from '@core/tokens/layout/css-classes.js'
import { PARALLAX } from '@core/tokens/motion/parallax.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { measureLayout, viewportHeight } from '@core/utils/dom.js'
import type { ViewHome } from './Home.js'

/** One CSS-var write a layer performs per scroll tick. */
export interface ParallaxWrite {
  /** Custom property set inline on the layer element. */
  prop: string
  /** Signed translateY amplitude (px) at progress ±1. */
  amp: number
  /** Last value actually written — dedupe + self-measure correction. */
  last: number
}

/**
 * A moving layer: `el` receives inline vars whose translate3d consumers
 * live INSIDE the element's shadow tree (its own box never transforms),
 * and `measureEl` supplies the document-space geometry. Because only
 * inner content moves, every measured rect is always untransformed —
 * no painted-position correction is ever needed.
 */
export interface ParallaxLayer {
  /** Element receiving the inline CSS vars. */
  el: HTMLElement
  /** Element measured for document-space position. */
  measureEl: HTMLElement
  /** Cached untransformed document-space top (px). */
  top: number
  /** Cached border-box height (px). */
  height: number
  /** Per-var writes applied each tick. */
  writes: ParallaxWrite[]
}

/** Session slot names — the four moving layers of the home page. */
type ParallaxSlot = 'hero' | 'about' | 'contact' | 'awards'

/**
 * Live parallax session parked on the view (`view._parallax`). Created
 * by attachParallax, dropped by detachParallax; syncParallax re-resolves
 * the layer nodes and re-evaluates the gates on every render pass and
 * store push.
 */
export interface ParallaxSession {
  /** <card-stack> inside the #home anchor — deck var + foot var. */
  hero: ParallaxLayer | null
  /** <about-section> inside the #about anchor — the two column vars
   *  consumed inside the component's own shadow sheet. */
  about: ParallaxLayer | null
  /** <contact-section> inside the #contact anchor — copy-block var. */
  contact: ParallaxLayer | null
  /** <awards-mentions> band — self-measuring (no wrapper anchor). */
  awards: ParallaxLayer | null
  /** Geometry watcher — content landing/reflowing shifts layer tops. */
  ro: ResizeObserver | null
  /** ≥1280 gate (the `desktop` width class) — its change re-evaluates. */
  mql: MediaQueryList | null
  /** Live OS reduced-motion flag — consulted only when the user holds
   *  no explicit pref (the site contract: localStorage wins). */
  motionMql: MediaQueryList | null
  /** Armed rAF coalescing scroll bursts into one paint per frame. */
  raf: number
  /** Viewport height cached on each measure pass (px). */
  vh: number
  /** Whether the scroll loop currently paints (gates open). */
  armed: boolean
}

/**
 * Static layer spec — the selectors a slot resolves inside the view's
 * shadow root plus the (prop, amplitude) pairs written per tick. A null
 * `measure` self-measures the moved element.
 */
interface ParallaxSpec {
  /** Selector for the element that receives the inline vars. */
  el: string
  /** Selector for the untransformed measure anchor — null self-measures. */
  measure: string | null
  /** Session slot the resolved layer parks on. */
  slot: ParallaxSlot
  /** CSS vars written per tick — parallel to `amps`. */
  props: string[]
  /** px amplitudes at progress ±1 — parallel to `props`. */
  amps: number[]
}

/**
 * The home layer table. `el` is the section host — the inline vars
 * inherit into its shadow where the component's own sheet consumes
 * them on inner content; the hosts themselves never transform, so the
 * anchors' (and hosts') rects stay clean. The awards band has no
 * anchor div and self-measures.
 */
const _LAYER_SPECS: readonly ParallaxSpec[] = [
  {
    slot: 'hero',
    el: `#${SECTIONS.HOME} > ${COMPONENT_TAGS.CARD_STACK}`,
    measure: `#${SECTIONS.HOME}`,
    props: [PARALLAX_CSS_PROPS.DECK_Y, PARALLAX_CSS_PROPS.FOOT_Y],
    amps: [PARALLAX.DECK_Y, PARALLAX.DECK_FOOT_Y],
  },
  {
    slot: 'about',
    el: `#${SECTION_IDS.ABOUT} > ${COMPONENT_TAGS.ABOUT_SECTION}`,
    measure: `#${SECTION_IDS.ABOUT}`,
    props: [PARALLAX_CSS_PROPS.ABOUT_MAIN_Y, PARALLAX_CSS_PROPS.ABOUT_TEXT_Y],
    amps: [PARALLAX.ABOUT_MAIN_Y, PARALLAX.ABOUT_TEXT_Y],
  },
  {
    slot: 'contact',
    el: `#${SECTION_IDS.CONTACT} > ${COMPONENT_TAGS.CONTACT_SECTION}`,
    measure: `#${SECTION_IDS.CONTACT}`,
    props: [PARALLAX_CSS_PROPS.CONTACT_Y],
    amps: [PARALLAX.CONTACT_Y],
  },
  {
    slot: 'awards',
    el: COMPONENT_TAGS.AWARDS_MENTIONS,
    measure: null,
    props: [PARALLAX_CSS_PROPS.AWARDS_Y],
    amps: [PARALLAX.AWARDS_Y],
  },
]

/**
 * Reduced-motion check honoring the site contract: an explicit
 * localStorage pref always wins; without one the live OS flag rules —
 * the store's merged flag only seeds the OS value at boot and follows
 * the in-app toggle, so mid-session OS flips come from the mql.
 * @param s The parallax session holding the motion mql.
 * @returns true when the parallax must stay disarmed.
 */
const reducedMotionActive = (s: ParallaxSession): boolean => {
  const stored =
    typeof localStorage !== TYPE_STRINGS.UNDEFINED
      ? localStorage.getItem(PREF_STORAGE_KEYS.REDUCED_MOTION)
      : null

  if (stored !== null) return stored === ATTR_VALUES.TRUE

  return store.getters.getReducedMotion() || s.motionMql?.matches === true
}

/** Both runtime gates: the ≥1280 media query matches AND motion is allowed. */
const gatesOpen = (s: ParallaxSession): boolean =>
  s.mql?.matches === true && !reducedMotionActive(s)

/**
 * Re-resolves one layer's elements, preserving the parked layer (and
 * its write dedupe state) when the same nodes still serve the spec —
 * the identity shortcut keeps store-push syncs allocation-free.
 * @param prev The layer parked on the session slot (or null).
 * @param view The view whose shadow root supplies the elements.
 * @param spec The layer spec to satisfy.
 * @returns The parked layer, a rebuilt layer, or null when the spec's
 *   elements are absent.
 */
const syncLayer = (
  prev: ParallaxLayer | null,
  view: ViewHome,
  spec: ParallaxSpec
): ParallaxLayer | null => {
  const el = view.$<HTMLElement>(spec.el)

  const measureEl = spec.measure ? view.$<HTMLElement>(spec.measure) : el

  if (!el || !measureEl) return null

  // el-identity alone proves the parking: the measure anchor is the
  // same-shadowDOM ancestor — a surviving el implies a surviving anchor.
  if (prev && prev.el === el) return prev

  const writes = spec.props.map((prop, i) => ({
    prop,
    amp: spec.amps[i],
    last: 0,
  }))

  return { el, measureEl, top: 0, height: 0, writes }
}

/**
 * Re-resolves every layer against the live shadow DOM — re-renders swap
 * nodes, so parked layers re-bind instead of writing to dead elements.
 * @param view The home view.
 * @param s The parallax session parked on it.
 * @returns true when any slot changed hands (fresh measure required).
 */
const syncLayers = (view: ViewHome, s: ParallaxSession): boolean => {
  let changed = false

  for (const spec of _LAYER_SPECS) {
    const next = syncLayer(s[spec.slot], view, spec)

    if (next !== s[spec.slot]) {
      s[spec.slot] = next

      changed = true
    }
  }

  return changed
}

/**
 * Caches every layer's untransformed geometry + the viewport height —
 * one batched read pass inside the sanctioned flush window
 * (measureLayout marks the deliberate post-write read for the reflow
 * gate). Only inner content translates, so every measured rect already
 * IS the element's natural position — no offset correction needed.
 * @param view The home view holding the session.
 * @param s The parallax session parked on it.
 */
const measure = (view: ViewHome, s: ParallaxSession): void => {
  measureLayout(() => {
    s.vh = viewportHeight()

    const y = window.scrollY

    for (const spec of _LAYER_SPECS) {
      const layer = s[spec.slot]

      if (!layer) continue

      const rect = layer.measureEl.getBoundingClientRect()

      layer.top = rect.top + y
      layer.height = rect.height
    }
  })
}

/**
 * Maps a layer's centre-vs-viewport-centre distance to progress ∈
 * [-1, 1]: 0 at centre, +1 when the element's centre sits one transit
 * range below (entering from the bottom), -1 above (leaving top). The
 * transit range (vh + layer height) / 2 is the scroll distance over
 * which the element crosses the viewport edge-to-edge.
 * @param layer The measured layer.
 * @param y Current window.scrollY (px).
 * @param vh Viewport height (px).
 * @returns Clamped progress.
 */
const layerProgress = (layer: ParallaxLayer, y: number, vh: number): number => {
  const range = (vh + layer.height) * 0.5

  if (range <= 0) return 0

  const p = (layer.top + layer.height * 0.5 - y - vh * 0.5) / range

  return p > 1 ? 1 : p < -1 ? -1 : p
}

/**
 * One scroll-frame paint: writes `progress × amplitude` to each layer's
 * var(s), deadbanded by WRITE_EPSILON so sub-pixel deltas don't churn
 * style recalcs. Reads only cached geometry + scrollY — never layout.
 * @param view The home view holding the session.
 * @param s The parallax session parked on it.
 */
const paint = (view: ViewHome, s: ParallaxSession): void => {
  if (!s.armed) return

  const y = window.scrollY

  for (const spec of _LAYER_SPECS) {
    const layer = s[spec.slot]

    if (!layer) continue

    const p = layerProgress(layer, y, s.vh)

    for (const w of layer.writes) {
      const next = Math.round(p * w.amp * 100) / 100

      if (Math.abs(next - w.last) < PARALLAX.WRITE_EPSILON) continue

      w.last = next

      layer.el.style.setProperty(w.prop, `${next}${COMMON_ATTRS.PX}`)
    }
  }
}

/**
 * rAF callback — clears the armed handle then paints; one is scheduled
 * per scroll-event burst.
 * @param view The home view holding the session.
 */
const tick = (view: ViewHome): void => {
  const s = view._parallax

  if (!s) return

  s.raf = 0

  paint(view, s)
}

/**
 * Scroll listener — coalesces bursts into one rAF paint; subsequent
 * events inside the same frame see `raf` set and drop out (the boot.ts
 * convention). Cheap enough to stay bound while disarmed — the armed
 * check makes it a no-op.
 * @param view The home view holding the session.
 */
const onScroll = (view: ViewHome): void => {
  const s = view._parallax

  if (!s?.armed || s.raf) return

  s.raf = requestAnimationFrame(() => tick(view))
}

/**
 * Geometry refresh (ResizeObserver / resize): caches the new
 * tops/heights immediately — RO fires post-layout so the reads are
 * free — then coalesces the repaint through the shared rAF so the
 * observer callback stays write-free.
 * @param view The home view holding the session.
 */
const remeasure = (view: ViewHome): void => {
  const s = view._parallax

  if (!s?.armed) return

  measure(view, s)

  if (!s.raf) s.raf = requestAnimationFrame(() => tick(view))
}

/**
 * Clears every layer var — with the property gone each stylesheet's
 * translate3d falls back to its seed and the elements sit at their
 * natural position (no transition: a gate drop is a mode switch, not
 * an animation moment).
 * @param s The parallax session.
 */
const clearVars = (s: ParallaxSession): void => {
  for (const spec of _LAYER_SPECS) {
    const layer = s[spec.slot]

    if (!layer) continue

    for (const w of layer.writes) {
      layer.el.style.removeProperty(w.prop)

      w.last = 0
    }
  }
}

/**
 * Single gate-evaluation path every trigger calls: re-resolves the
 * layer nodes, then either disarms (clearing the vars) or arms —
 * rebinding the geometry watcher to the live measure elements and
 * running a measure+paint so fresh nodes carry the correct offsets
 * before the next paint. Store-push syncs hit the armed/unchanged
 * early-out and cost a handful of selector queries only.
 * @param view The home view holding the session.
 */
const applyGate = (view: ViewHome): void => {
  const s = view._parallax

  if (!s) return

  const changed = syncLayers(view, s)
  const open = gatesOpen(s)

  if (!open) {
    if (s.armed) {
      s.armed = false

      if (s.raf) {
        cancelAnimationFrame(s.raf)

        s.raf = 0
      }

      clearVars(s)
    }

    return
  }

  if (s.armed && !changed) return

  s.armed = true

  if (s.ro) {
    s.ro.disconnect()

    for (const spec of _LAYER_SPECS) {
      const layer = s[spec.slot]

      if (layer) s.ro.observe(layer.measureEl)
    }
  }

  measure(view, s)

  paint(view, s)
}

/**
 * Arms the session: builds the media-query gates, binds the passive
 * scroll + resize listeners (auto-cleaned on disconnect through
 * addScopedListener) and the ResizeObserver, then runs the first gate
 * evaluation.
 * @param view The home view.
 */
export function attachParallax(view: ViewHome): void {
  if (view._parallax) return

  const s: ParallaxSession = {
    hero: null,
    about: null,
    contact: null,
    awards: null,
    ro: null,
    mql: null,
    motionMql: null,
    raf: 0,
    vh: 0,
    armed: false,
  }

  view._parallax = s

  if (typeof window !== TYPE_STRINGS.UNDEFINED) {
    if (typeof window.matchMedia === TYPE_STRINGS.FUNCTION) {
      s.mql = window.matchMedia(WIDTH_CLASS_GATES.desktop)
      s.motionMql = window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION)

      view.addScopedListener(s.mql, FORM_EVENTS.CHANGE, () => applyGate(view))
      view.addScopedListener(s.motionMql, FORM_EVENTS.CHANGE, () => applyGate(view))
    }

    view.addScopedListener(window, WINDOW_EVENTS.SCROLL, () => onScroll(view), {
      passive: true,
    })

    view.addScopedListener(window, WINDOW_EVENTS.RESIZE, () => remeasure(view))
  }

  if (typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
    s.ro = new ResizeObserver(() => remeasure(view))
  }

  applyGate(view)
}

/**
 * Public sync — the view calls this from onUpdated (fresh render →
 * re-resolve + re-gate) and onStoreUpdate (locale/reduced-motion pushes
 * re-evaluate the motion gate). Cheap when nothing changed: the
 * identity-parked layers skip straight to the gate compare.
 * @param view The home view.
 */
export function syncParallax(view: ViewHome): void {
  applyGate(view)
}

/**
 * Tears the session down — observer, pending rAF and the session
 * reference. Scoped listeners self-clean on disconnect; the elements
 * die with the view so vars need no clearing.
 * @param view The home view.
 */
export function detachParallax(view: ViewHome): void {
  const s = view._parallax

  if (!s) return

  s.ro?.disconnect()

  if (s.raf) {
    cancelAnimationFrame(s.raf)

    s.raf = 0
  }

  s.armed = false

  view._parallax = null
}
