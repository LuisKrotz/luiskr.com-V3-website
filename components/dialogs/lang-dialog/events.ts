/**
 * @file lang-dialog/events.ts — option clicks, backdrop/Escape dismissal,
 * and the GPU-composited glass-follower highlight that glides between
 * option buttons (tracks hover/focus, falls back to the active locale).
 */

import { KEYS } from '@core/tokens/primitives.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { LANG_CLASSES } from '@core/tokens/classes/lang.js'
import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import {
  FOCUS_EVENTS,
  KEYBOARD_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import type { LangDialog } from '../LangDialog.js'

/** Selector matching any rendered option button (locale or theme row). */
const OPTION_SEL = `[${DATA_ATTRS.DATA_LANG}]`

/** Selector matching the options grid that wraps the buttons. */
const GRID_SEL = `.${PREF_CLASSES.PREF_OPTIONS}`

/** Positions the glass follower over `btn` (transform only — no layout). */
function moveFollower(follower: Element, btn: HTMLElement): void {
  const x = btn.offsetLeft

  const y = btn.offsetTop

  const w = btn.offsetWidth

  const h = btn.offsetHeight

  const style = (follower as HTMLElement).style

  style.width = `${w}px`

  style.height = `${h}px`

  style.transform = `translate3d(${x}px, ${y}px, 0)`

  style.opacity = '1'
}

/** Snaps the follower back onto the active locale's button. */
function updateToActive(host: LangDialog, follower: Element): void {
  const activeBtn = host.$(`.${PREF_CLASSES.PREF_OPTION_BTN}.${STATE_CLASSES.ACTIVE}`)

  if (activeBtn && (activeBtn as HTMLElement).offsetWidth > 0) {
    moveFollower(follower, activeBtn as HTMLElement)
  }
}

/** Hosts whose once-only bindings exist — Escape/resize + delegated follower. */
const BOUND_HOSTS = new WeakSet<LangDialog>()

/**
 * Tracks pointer/focus movement across the option grid through a single
 * delegated listener set on the persistent shadow root. Re-rendering swaps
 * the option nodes wholesale every store update, so per-node listeners
 * would both re-bind and strand dead disposers on the host until
 * disconnect; delegation resolves the live target at event time instead.
 */
function bindDelegatedFollower(host: LangDialog): void {
  const glide = (e: Event) => {
    const btn = (e.target as Element | null)?.closest?.(OPTION_SEL)

    const follower = host.$(`.${LANG_CLASSES.LANG_GLASS_FOLLOWER}`)

    if (btn && follower) moveFollower(follower, btn as HTMLElement)
  }

  host.addScopedListener(host.shadowRoot, POINTER_EVENTS.POINTEROVER, glide)

  host.addScopedListener(host.shadowRoot, FOCUS_EVENTS.FOCUSIN, glide)

  host.addScopedListener(host.shadowRoot, POINTER_EVENTS.POINTEROUT, (e) => {
    const leaving =
      (e.target as Element | null)?.closest?.(GRID_SEL) &&
      !((e as MouseEvent).relatedTarget as Element | null)?.closest?.(GRID_SEL)

    if (!leaving) return

    const follower = host.$(`.${LANG_CLASSES.LANG_GLASS_FOLLOWER}`)

    if (!follower) return

    const activeBtn = host.$(`.${PREF_CLASSES.PREF_OPTION_BTN}.${STATE_CLASSES.ACTIVE}`)

    if (activeBtn) {
      moveFollower(follower, activeBtn as HTMLElement)
    } else {
      ;(follower as HTMLElement).style.opacity = '0'
    }
  })
}

/**
 * Window-level dismissal + follower-reposition bindings plus the delegated
 * follower tracking. Bound once per element — re-running bindEvents after
 * each store update would otherwise pile duplicate window listeners onto
 * the persistent element (its disposers only drain on disconnect, which
 * never happens for a shell child). Handlers query the live shadow tree
 * so stale-node captures are impossible.
 */
function bindWindowDismissal(host: LangDialog): void {
  if (BOUND_HOSTS.has(host)) return

  BOUND_HOSTS.add(host)

  host.addScopedListener(window, KEYBOARD_EVENTS.KEYDOWN, (e) => {
    if ((e as KeyboardEvent).key === KEYS.ESCAPE) host.close()
  })

  host.addScopedListener(window, WINDOW_EVENTS.RESIZE, () => {
    const follower = host.$(`.${LANG_CLASSES.LANG_GLASS_FOLLOWER}`)

    const hovered =
      host.$(`.${PREF_CLASSES.PREF_OPTION_BTN}:hover`) ||
      host.$(`.${PREF_CLASSES.PREF_OPTION_BTN}.${STATE_CLASSES.ACTIVE}`)

    if (follower && hovered) moveFollower(follower, hovered as HTMLElement)
  })

  bindDelegatedFollower(host)
}

/**
 * Repositions the follower after each open/re-render and binds the
 * once-only window + delegated listeners. Option/backdrop/close clicks
 * are JSX `onClick` props on the rendered buttons — duplicating them
 * here would fire selectLang/close twice per click.
 */
export function bindEvents(host: LangDialog): void {
  if (!host.isOpen) return

  bindWindowDismissal(host)

  const follower = host.$(`.${LANG_CLASSES.LANG_GLASS_FOLLOWER}`)

  if (!follower) return

  // Two RAFs: offset* reads are 0 until the grid has been laid out;
  // the second frame catches post-font-load metric changes.
  requestAnimationFrame(() => {
    updateToActive(host, follower)

    requestAnimationFrame(() => updateToActive(host, follower))
  })
}
