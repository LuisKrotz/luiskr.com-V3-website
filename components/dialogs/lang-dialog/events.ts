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
  MOUSE_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import type { LangDialog } from '../LangDialog.js'

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

/** Hosts whose window-level bindings exist — Escape/resize bind once per element. */
const BOUND_HOSTS = new WeakSet<LangDialog>()

/**
 * Nodes already wired per event type — bindEvents runs after every render
 * while open and duplicate listeners on the same node would double-fire.
 * Weak keys let detached re-render casualties GC instead of being retained.
 */
const BOUND_NODES = new WeakMap<EventTarget, Set<string>>()

/** Wires `handler` onto `node` only when this node hasn't been wired for `event` yet. */
function bindNodeOnce(
  host: LangDialog,
  node: EventTarget,
  event: string,
  handler: EventListener
): void {
  let boundEvents = BOUND_NODES.get(node)

  if (!boundEvents) {
    boundEvents = new Set()

    BOUND_NODES.set(node, boundEvents)
  }

  if (boundEvents.has(event)) return

  boundEvents.add(event)

  host.addScopedListener(node, event, handler)
}

/**
 * Window-level dismissal + follower-reposition bindings. Bound once per
 * element — re-running bindEvents after each store update would otherwise
 * pile duplicate window listeners onto the persistent element (its
 * disposers only drain on disconnect, which never happens for a shell
 * child). Handlers query the live shadow tree so stale-node captures are
 * impossible.
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
}

/** Wires the glass-follower tracking (hover/focus/leave). */
function bindGlassFollower(host: LangDialog, langBtns: Element[]): void {
  const grid = host.$(`.${PREF_CLASSES.PREF_OPTIONS}`)

  const follower = host.$(`.${LANG_CLASSES.LANG_GLASS_FOLLOWER}`)

  if (!grid || !follower) return

  // Two RAFs: offset* reads are 0 until the grid has been laid out;
  // the second frame catches post-font-load metric changes.
  requestAnimationFrame(() => {
    updateToActive(host, follower)

    requestAnimationFrame(() => updateToActive(host, follower))
  })

  langBtns.forEach((btn) => {
    bindNodeOnce(host, btn, POINTER_EVENTS.POINTERENTER, () =>
      moveFollower(follower, btn as HTMLElement)
    )

    bindNodeOnce(host, btn, MOUSE_EVENTS.MOUSEENTER, () =>
      moveFollower(follower, btn as HTMLElement)
    )

    bindNodeOnce(host, btn, FOCUS_EVENTS.FOCUS, () => moveFollower(follower, btn as HTMLElement))
  })

  bindNodeOnce(host, grid, POINTER_EVENTS.POINTERLEAVE, () => {
    const activeBtn = host.$(`.${PREF_CLASSES.PREF_OPTION_BTN}.${STATE_CLASSES.ACTIVE}`)

    if (activeBtn) {
      moveFollower(follower, activeBtn as HTMLElement)
    } else {
      ;(follower as HTMLElement).style.opacity = '0'
    }
  })
}

/**
 * Binds glass-follower tracking + window dismissal. Option/backdrop/close
 * clicks are JSX `onClick` props on the rendered buttons — duplicating
 * them here would fire selectLang/close twice per click.
 */
export function bindEvents(host: LangDialog): void {
  if (!host.isOpen) return

  bindWindowDismissal(host)

  bindGlassFollower(host, host.$$(`[${DATA_ATTRS.DATA_LANG}]`))
}
