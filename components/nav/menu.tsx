/**
 * @file nav-menu.tsx
 * @description Fullscreen menu overlay behavior for <app-nav>, extracted
 * from AppNav.tsx: the persistent burger/menu/close canvas factories and
 * the open → settled → closing → closed state machine with its WebGL
 * widget mounting. Canvases are created once and survive re-renders so
 * each GL context lives for the whole open cycle.
 */

import { NAV_BURGER_CLASSES, NAV_CLASSES, NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h } from '@core/jsx.js'
import { MenuBackgroundWebGL } from '@core/utils/canvas/loaders/menu-background-webgl.js'
import { BurgerButtonWebGL } from '@core/utils/canvas/widgets/burger-button-webgl.js'
import { webglContextDead } from '@core/utils/canvas/webgl-mode.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import type { NavFlagHost } from './flag.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { NAV_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import store from '@core/store.js'

/** Host surface the menu helpers need (satisfied by AppNav). */
export interface NavMenuHost extends NavFlagHost {
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
  /** Shadow-scoped querySelector. */
  $(selector: string): Element | null
  /** Triggers a template re-render. */
  _updateDom(): void
}

/**
 * The burger icon's canvas element — lazily created once and kept for
 * the component's lifetime so its WebGL context is never churned by
 * re-renders (canvas recreation would force a fresh GL context). Each
 * call also re-syncs the on-dark class and aria-label/expanded since
 * those change without recreating the element.
 * @param host AppNav instance.
 * @param label aria-label for the burger (localized "menu").
 * @returns The persistent canvas element.
 */
export const navBurgerCanvas = (host: NavMenuHost, label: string): HTMLCanvasElement => {
  if (!host._burgerCanvasEl) {
    host._burgerCanvasEl = (
      <canvas
        className={NAV_BURGER_CLASSES.NAV_BURGER_CANVAS}
        width={NAV_DIMENSIONS.BURGER_CANVAS_SIZE}
        height={NAV_DIMENSIONS.BURGER_CANVAS_SIZE}
        role={ARIA_ATTRS.ROLE_BUTTON}
        tabIndex={CHAR_STRINGS.ZERO}
      />
    ) as HTMLCanvasElement
  }

  host._burgerCanvasEl.classList.toggle(NAV_CLASSES.NAV_ON_DARK, !!host._onDark)

  host._burgerCanvasEl.setAttribute(ARIA_ATTRS.ARIA_LABEL, label)

  host._burgerCanvasEl.setAttribute(
    ARIA_ATTRS.ARIA_EXPANDED,
    host._menuOpen ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE
  )

  host._burgerCanvasEl.setAttribute(ARIA_ATTRS.ARIA_CONTROLS, APP_IDS.NAV_MENU_PANEL)

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

/** Opens/closes the fullscreen menu overlay. */
export const toggleNavMenu = (host: NavMenuHost): void => {
  if (host._menuOpen) {
    closeNavMenu(host)
  } else {
    openNavMenu(host)
  }
}

/**
 * Opens the menu: flips the state flags and re-renders — the new DOM
 * mounts the menu canvases, then onUpdated → mountNavMenuWebGL attaches
 * the widgets. Scroll-lock is handled by the CSS class on the wrapper.
 */
export const openNavMenu = (host: NavMenuHost): void => {
  if (host._menuOpen) return

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
    const label = burgerCanvas.getAttribute(ARIA_ATTRS.ARIA_LABEL) || ATTR_VALUES.EMPTY

    host._burgerBtn.destroy()

    host._burgerBtn = null

    host._burgerCanvasEl = null

    burgerCanvas.replaceWith(navBurgerCanvas(host, label))

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

    host._burgerBtn = new BurgerButtonWebGL(burgerCanvas, () => toggleNavMenu(host))

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

    // The flag widget is NOT torn down here — it moved out of the menu
    // into the persistent nav strip (round flag button), so its GL
    // context survives open/close like the burger's. It dies with the
    // component (onDestroy → _destroyNavFlag).
    host._updateDom()
  }, ANIMATION_DURATIONS.MENU_CLOSE_DURATION)
}
