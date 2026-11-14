/**
 * @file nav-menu.tsx
 * @description Fullscreen menu overlay behavior for <app-nav>, extracted
 * from AppNav.tsx: the persistent burger/menu/close canvas factories and
 * the open → settled → closing → closed state machine with its WebGL
 * widget mounting. Canvases are created once and survive re-renders so
 * each GL context lives for the whole open cycle.
 */

import { NAV_BURGER_CLASSES, NAV_CLASSES, NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { KEYS } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h } from '@core/jsx.js'
import { MenuBackgroundWebGL } from '@core/utils/canvas/loaders/menu-background-webgl.js'
import { BurgerButtonWebGL } from '@core/utils/canvas/widgets/burger-button-webgl.js'
import { webglContextDead } from '@core/utils/canvas/webgl-mode.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { NAV_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { joustChip, joustClick, joustCollapseAll } from '@core/utils/dom/joust.js'
import store from '@core/store.js'

/** Host surface the menu helpers need (satisfied by AppNav). */
export interface NavMenuHost {
  /** Menu overlay open flag. */
  _menuOpen: boolean
  /** performance.now() of the open transition — feeds the residual-input guard. */
  _menuOpenedAt: number
  /** Close animation in flight — guards double-close. */
  _menuClosing: boolean
  /** Open animation completed — entrance animations stop re-running. */
  _menuSettled: boolean
  /** Settle-delay timer handle; cleared on destroy/close. */
  _menuSettleTimer: ReturnType<typeof setTimeout> | null
  /** Live menu-background widget over the fullscreen canvas. */
  _menuBg: MenuBackgroundWebGL | null
  /** Live burger widget — doubles as the menu's close control when open. */
  _burgerBtn: BurgerButtonWebGL | null
  /** Persistent burger canvas (survives re-renders). */
  _burgerCanvasEl: HTMLCanvasElement | null
  /** Persistent menu background canvas. */
  _menuCanvasEl: HTMLCanvasElement | null
  /** True while the nav floats over a dark band (contrast variant). */
  _onDark: boolean
  /** The shadow root — read for the focused element during close-restore. */
  shadowRoot?: ShadowRoot | null
  /** Shadow-scoped querySelector. */
  $(selector: string): Element | null
  /** Shadow-scoped querySelectorAll (live menu item list) — absent on minimal stub hosts, treated as no items. */
  $$?<T extends Element = HTMLElement>(selector: string): T[]
  /** Triggers a template re-render. */
  _updateDom(): void
}

/**
 * The burger icon's canvas element — lazily created once and kept for
 * the component's lifetime so its WebGL context is never churned by
 * re-renders (canvas recreation would force a fresh GL context).
 * Purely presentational: pointer presses reach its widget click
 * listener, but keyboard focus and the a11y tree belong to the real
 * <button> layered under it — a focusable overlay over a focusable
 * button gave the chip two tab stops, and the canvas's opacity-0 rest
 * state painted a ring around nothing. Each call still re-syncs the
 * on-dark class since it changes without recreating the element.
 * @param host AppNav instance.
 * @returns The persistent canvas element.
 */
export const navBurgerCanvas = (host: NavMenuHost): HTMLCanvasElement => {
  if (!host._burgerCanvasEl) {
    host._burgerCanvasEl = (
      <canvas
        className={NAV_BURGER_CLASSES.NAV_BURGER_CANVAS}
        width={NAV_DIMENSIONS.BURGER_CANVAS_SIZE}
        height={NAV_DIMENSIONS.BURGER_CANVAS_SIZE}
        aria-hidden={ATTR_VALUES.TRUE}
      />
    ) as HTMLCanvasElement
  }

  host._burgerCanvasEl.classList.toggle(NAV_CLASSES.NAV_ON_DARK, !!host._onDark)

  return host._burgerCanvasEl
}

/** Canvas JSX for the WebGL menu background. */
export const navMenuCanvas = (host: NavMenuHost): HTMLCanvasElement => {
  if (!host._menuCanvasEl) {
    host._menuCanvasEl = (
      <canvas className={NAV_MENU_CLASSES.NAV_MENU_MODAL_CANVAS} aria-hidden={ATTR_VALUES.TRUE} />
    ) as HTMLCanvasElement
  }

  return host._menuCanvasEl
}

/**
 * Opens/closes the fullscreen menu overlay. The joust gate applies to the
 * closed → open edge only: on hover-less input the first pointer tap on a
 * collapsed chip pours the menu label out instead of opening the overlay,
 * and the second tap opens it. While the menu is already open the close
 * path stays single-tap — the gate is skipped entirely.
 * @param host AppNav instance.
 * @param e The click event from the fallback button or label span (absent
 *   for programmatic toggles — those always fire).
 * @param chip Explicit gate element for event-less callers — the burger
 *   canvas widget's click callback passes its canvas so the wrap still
 *   resolves through `closest`.
 */
export const toggleNavMenu = (host: NavMenuHost, e?: Event, chip?: Element | null): void => {
  if (host._menuOpen) {
    closeNavMenu(host)

    return
  }

  if (!(chip ? joustChip(chip, true) : joustClick(e))) return

  openNavMenu(host)
}

/**
 * Opens the menu: flips the state flags and re-renders — the new DOM
 * mounts the menu canvases, then onUpdated → mountNavMenuWebGL attaches
 * the widgets. Scroll-lock is handled by the CSS class on the wrapper.
 */
export const openNavMenu = (host: NavMenuHost): void => {
  if (host._menuOpen) return

  // The overlay takes the whole screen — no chip label stays poured
  // behind it.
  joustCollapseAll()

  host._menuClosing = false

  host._menuSettled = false

  host._menuOpen = true

  // Page-wide pause signal: carousel autoplay and media videos read
  // navMenuOpen through their store subscriptions and stop for the whole
  // open cycle — a fullscreen overlay makes ambient playback underneath
  // invisible wasted decode/composite work.
  store.commit(MODAL_MUTATIONS.SET_NAV_MENU, true)

  // The burger's pooled droplet morphs into the close X while the
  // overlay opens — same morph the shader/fallback mirror on the way out.
  host._burgerBtn?.setOpen(true)

  // Arms the residual-input guard — the menu mounts synchronously inside
  // the burger click's dispatch, so a second press of an in-place
  // double-click would otherwise land on a freshly mounted menu item.
  host._menuOpenedAt = performance.now()

  host._updateDom()

  // Keyboard users get the first menu item immediately — the overlay is
  // the live navigation landmark while open, so arrows and Esc are
  // meaningful from the first keypress. Script focus after a pointer
  // activation never paints :focus-visible, so mouse users see no ring.
  focusNavMenuItem(host, 0)
}

/**
 * Binds the WebGL layers to the persistent menu canvases. Because the
 * canvas elements survive re-renders, each context is created once per
 * open cycle instead of once per store/router update.
 */
export const mountNavMenuWebGL = (host: NavMenuHost): void => {
  if (typeof window === TYPE_STRINGS.UNDEFINED || !host._menuOpen) return

  // The overlay itself carries the staggered-entrance description —
  // the canvas widgets get their own ids below.
  const modal = host.$(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL}`)

  if (modal) applyAnimationDesc(modal, ANIMATION_IDS.NAV_MENU)

  const canvas = host._menuCanvasEl

  if (canvas && canvas.isConnected && !host._menuBg) {
    applyAnimationDesc(canvas, ANIMATION_IDS.NAV_MENU_BACKGROUND)

    host._menuBg = new MenuBackgroundWebGL(canvas)

    host._menuBg.start()
  }

  if (!host._menuSettled && !host._menuSettleTimer) {
    host._menuSettleTimer = setTimeout(() => {
      host._menuSettleTimer = null

      if (host._menuOpen) {
        host._menuSettled = true
      }
    }, ANIMATION_DURATIONS.MENU_SETTLE_DURATION)
  }
}

/**
 * Attaches BurgerButtonWebGL to the persistent burger canvas — or tears
 * it down when the canvas left the DOM (menu states that remove the
 * burger, e.g. 404). Idempotent: a live widget is never re-created.
 */
export const mountNavBurgerWebGL = (host: NavMenuHost): void => {
  if (typeof window === TYPE_STRINGS.UNDEFINED) return

  let burgerCanvas = host._burgerCanvasEl

  // A real runtime context loss (GPU eviction — not a recoverable pool
  // purge) leaves the widget pinned on the CSS fallback while the canvas's
  // context binding stays permanently dead: retrying it can never recover.
  // Swap in a fresh canvas — a new binding gets a clean context — and let
  // the normal attach path rebuild the widget on it.
  if (
    host._burgerBtn &&
    host._burgerBtn.useWebGL === false &&
    burgerCanvas &&
    burgerCanvas.isConnected &&
    webglContextDead(burgerCanvas)
  ) {
    host._burgerBtn.destroy()

    host._burgerBtn = null

    host._burgerCanvasEl = null

    burgerCanvas.replaceWith(navBurgerCanvas(host))

    burgerCanvas = host._burgerCanvasEl
  }

  if (!burgerCanvas || !burgerCanvas.isConnected) {
    if (host._burgerBtn) {
      host._burgerBtn.destroy()

      host._burgerBtn = null
    }

    return
  }

  if (!host._burgerBtn) {
    applyAnimationDesc(burgerCanvas, ANIMATION_IDS.BURGER_BUTTON)

    host._burgerBtn = new BurgerButtonWebGL(burgerCanvas, () =>
      toggleNavMenu(host, undefined, burgerCanvas)
    )

    // Re-applies the open morph — a rebuilt widget starts at the closed
    // squares state even while the overlay is open.
    host._burgerBtn.setOpen(host._menuOpen)
  }
}

/**
 * Closes the menu through the full dissolve cycle: adds the -closing
 * class (CSS plays the item fade-out), releases the contour field so it
 * dissolves back to center, then after MENU_CLOSE_DURATION destroys
 * all three GL widgets + their canvases and re-renders the closed nav.
 * The _menuClosing guard makes double-close (Esc + click) a no-op.
 */
export const closeNavMenu = (host: NavMenuHost): void => {
  if (!host._menuOpen || host._menuClosing) return

  host._menuClosing = true

  // Capture where keyboard focus sits now — the close-tail re-render
  // swaps every element, so whether restoration is owed can only be
  // judged against the captured node (a detached focus target means the
  // overlay owned focus and must hand it back to the trigger).
  const restoreFocus = host.shadowRoot?.activeElement

  // The X morphs back into the four squares while the overlay dissolves.
  host._burgerBtn?.setOpen(false)

  const modal = host.$(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL}`)

  modal?.classList.add(NAV_MENU_CLASSES.NAV_MENU_MODAL_CLOSING)

  host._menuBg?.release()

  setTimeout(() => {
    if (!host._menuClosing) return

    if (host._menuSettleTimer) {
      clearTimeout(host._menuSettleTimer)

      host._menuSettleTimer = null
    }

    host._menuClosing = false

    host._menuSettled = false

    host._menuOpen = false

    // Release the page-wide pause only once the overlay is actually
    // gone — autoplay/videos resume through the same store notify.
    store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)

    if (host._menuBg) {
      host._menuBg.destroy()

      host._menuBg = null

      host._menuCanvasEl = null
    }

    host._updateDom()

    // Focus returns to the burger button when the overlay owned it —
    // the render just replaced every element, so a captured target that
    // is still connected (e.g. the button itself) needs no work.
    if (restoreFocus && !restoreFocus.isConnected) {
      ;(host.$(`.${NAV_BURGER_CLASSES.NAV_BURGER_FALLBACK}`) as HTMLElement | null)?.focus()
    }
  }, ANIMATION_DURATIONS.MENU_CLOSE_DURATION)
}

/** Live menu item anchors inside the open overlay (empty while closed). */
const navMenuItems = (host: NavMenuHost): HTMLElement[] =>
  host.$$?.<HTMLElement>(`.${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}`) ?? []

/**
 * Moves focus to a menu item by index, wrapping past the ends. No-op
 * while the overlay is closed — the items only exist in the open
 * render, so an empty list is the whole guard.
 * @param host AppNav instance.
 * @param idx Target item index (negative/over-length values wrap).
 */
export const focusNavMenuItem = (host: NavMenuHost, idx: number): void => {
  const items = navMenuItems(host)

  if (!items.length) return

  items[((idx % items.length) + items.length) % items.length].focus()
}

/**
 * Arrow/Home/End roving inside the open overlay — Up/Left step back,
 * Down/Right step forward (both wrap), Home/End jump to the ends. The
 * anchor currently holding focus is the step origin; focus anywhere
 * else (burger, document body) starts the wrap from the edges.
 * @param host AppNav instance.
 * @param e The keydown event routed by the component's window listener.
 * @returns True when the key was consumed — callers preventDefault only
 *   for handled keys so all other keys keep their native behavior.
 */
export const navMenuKeyDown = (host: NavMenuHost, e: KeyboardEvent): boolean => {
  const key = e.key

  const isNav =
    key === KEYS.ARROW_LEFT ||
    key === KEYS.ARROW_RIGHT ||
    key === KEYS.ARROW_UP ||
    key === KEYS.ARROW_DOWN ||
    key === KEYS.HOME ||
    key === KEYS.END

  // The closing dissolve still shows the items, but they are already on
  // their way out — steering focus into dying elements would only make
  // the restore path noisier.
  if (!isNav || !host._menuOpen || host._menuClosing) return false

  const items = navMenuItems(host)

  if (!items.length) return false

  const idx = items.indexOf(host.shadowRoot?.activeElement as HTMLElement)

  let next: number

  if (key === KEYS.HOME) {
    next = 0
  } else if (key === KEYS.END) {
    next = items.length - 1
  } else {
    next = idx + (key === KEYS.ARROW_LEFT || key === KEYS.ARROW_UP ? -1 : 1)
  }

  focusNavMenuItem(host, next)

  return true
}
