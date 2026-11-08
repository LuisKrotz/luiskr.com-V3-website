/**
 * @file about/titlefit.ts — portrait-to-title fitting: measures the rendered
 * width of the section title's text line ("ABOUT ME", or its localized
 * twin) and publishes it as --about-picture-w on the portrait wrapper.
 *
 * The stylesheet reads the var inside `max()` against the space-token floor,
 * so the circular photo tracks the title line exactly on every locale and
 * breakpoint — it only ever GROWS past the token size, never collapses.
 *
 * Measurement rides the h2's first element child (the <draw-text> host —
 * display:inline, so its border box IS the text's rendered width; before
 * translations land it is the skeleton shimmer bar). Three triggers keep
 * the published width honest:
 *
 *   - every render pass (attachTitleFit from onMounted/onUpdated — the
 *     synchronous write lands before paint, so the portrait never jumps),
 *   - a ResizeObserver on the h2 — breakpoint steps change the guttered
 *     column box even when the text itself is unchanged,
 *   - whenFontsReady — the Poiret One swap alters glyph widths without
 *     moving the h2's block box, so no observer fires for it.
 *
 * The session is self-healing like mesh/hud: a shadow-root re-render swaps
 * in a fresh h2, so every attach re-resolves the observed node. No math
 * runs per frame — this is a layout-write helper, not a loop.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { ABOUT_CSS_PROPS } from '@core/tokens/css/about.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { whenFontsReady } from '@core/utils/canvas/dom-font.js'
import { measureLayout } from '@core/utils/dom.js'
import type { AboutSection } from '../AboutSection.js'

/** Live fit session parked on the host. */
export interface TitleFitSession {
  /** Observer on the h2 — re-targeted every render pass. */
  ro: ResizeObserver | null
  /** One-shot guard — the fonts-ready re-sync is wired once per session. */
  fontsWired: boolean
}

/** Title + picture selectors — resolved fresh each fit so re-renders
 *  inside the shadow root never read a detached element. */
const _TITLE_SEL = `.${ABOUT_CLASSES.ABOUT_TITLE}`
const _PIC_SEL = `.${ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}`

/** Last measured title width per host — also the "already read this
 *  task" dedupe: present ⇒ syncTitleFit republishes instead of
 *  re-reading. Cleared on the task boundary via queueMicrotask. */
const _LAST_TEXT_W = new WeakMap<AboutSection, number>()

/**
 * Measures the title's rendered text width and writes it to the portrait
 * wrapper's --about-picture-w. Reads the h2's first element child — the
 * inline <draw-text> host whose border box IS the text line — and skips
 * degenerate reads (no nodes yet, zero-width layout in tests). The write
 * is dirty-checked so repeat syncs never churn inline style.
 * @param host The <about-section> component the session parks on.
 */
export function syncTitleFit(host: AboutSection): void {
  const lastW = _LAST_TEXT_W.get(host)
  const pic = host.shadowRoot?.querySelector<HTMLElement>(_PIC_SEL)

  // One LAYOUT READ per task: attach's own sync, a synchronous RO
  // dispatch, and the fonts-ready re-sync can all land inside a single
  // mount task — each extra gBCR after a write is an interleaved forced
  // reflow. But the WRITE still lands on every call: back-to-back
  // renders in one task replace the pic element, and the last measured
  // width must republish onto the fresh node.
  if (lastW !== undefined) {
    if (pic && lastW > 0) {
      const px = `${Math.round(lastW)}${COMMON_ATTRS.PX}`

      if (pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W) !== px) {
        pic.style.setProperty(ABOUT_CSS_PROPS.ABOUT_PICTURE_W, px)
      }
    }

    return
  }

  _LAST_TEXT_W.set(host, 0)

  queueMicrotask(() => {
    _LAST_TEXT_W.delete(host)
  })

  const title = host.shadowRoot?.querySelector<HTMLElement>(_TITLE_SEL)
  const child = title?.firstElementChild

  // The width MUST reflect the just-written DOM — a deliberate
  // measure-after-write inside the sanctioned flush window, not thrash.
  const textW = child ? measureLayout(() => child.getBoundingClientRect().width) : 0

  _LAST_TEXT_W.set(host, textW)

  if (!pic || textW <= 0) return

  const px = `${Math.round(textW)}${COMMON_ATTRS.PX}`

  if (pic.style.getPropertyValue(ABOUT_CSS_PROPS.ABOUT_PICTURE_W) !== px) {
    pic.style.setProperty(ABOUT_CSS_PROPS.ABOUT_PICTURE_W, px)
  }
}

/**
 * Arms the fit session: seeds the parked session, (re)targets the h2
 * observer — the node is re-created on every render — and wires the
 * one-shot fonts-ready re-sync, then runs a synchronous measure so the
 * portrait's first paint already carries the title-matched width.
 * Idempotent — safe to call from every render pass.
 * @param host The <about-section> component the session parks on.
 */
export function attachTitleFit(host: AboutSection): void {
  if (!host._titleFit) host._titleFit = { ro: null, fontsWired: false }

  const s = host._titleFit
  const title = host.shadowRoot?.querySelector<HTMLElement>(_TITLE_SEL)

  // Measure FIRST — attach is called at the end of the render pass when
  // the DOM is complete, so this is the meaningful read of the task.
  // Some test environments fire the RO callback synchronously inside
  // observe(); that dispatch must not beat this one to the task dedupe.
  syncTitleFit(host)

  if (title && typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
    if (!s.ro) s.ro = new ResizeObserver(() => syncTitleFit(host))

    // Drop stale targets (dead h2 nodes from prior renders) and watch the
    // live one — a breakpoint step resizes its column box and re-syncs.
    s.ro.disconnect()
    s.ro.observe(title)
  }

  if (!s.fontsWired) {
    s.fontsWired = true

    whenFontsReady(() => syncTitleFit(host))
  }
}

/**
 * Stops the observer and drops the session — the element is leaving the
 * DOM, so the next mount re-arms from scratch.
 * @param host The <about-section> component the session parks on.
 */
export function disarmTitleFit(host: AboutSection): void {
  const s = host._titleFit

  if (!s) return

  s.ro?.disconnect()

  host._titleFit = null
}
