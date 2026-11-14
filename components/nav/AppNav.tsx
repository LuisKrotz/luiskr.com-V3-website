/**
 * @file AppNav.js
 * @description <app-nav> — the persistent top navigation bar: logo, burger
 * button opening the fullscreen menu overlay, and the strip chips (globe →
 * language dialog, magnifier → search modal, brush → preferences). Hosts
 * the WebGL burger and menu-background widgets plus the chips' ring-fill
 * aura, tracks scroll section state for the --on-dark variant over the
 * dark contact band, and owns the genie-open origin for the dialogs.
 */

import { KEYS } from '@core/tokens/primitives.js'
import { SECTIONS } from '@core/tokens/base.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ROUTE_NAMES, ROUTE_PREFIXES } from '@core/tokens/routes/names.js'
import { h } from '@core/jsx.js'
import { BaseComponent } from '@core/Component.js'
import { armResidualInputGuard } from '@core/utils/dom.js'
import { joustCollapseAll } from '@core/utils/dom/joust.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { isEarthPlaygroundRoute, isStarFieldRoute } from '@core/router/playground.js'
import { predictiveLoader } from '@core/predictive-loader.js'
import type { MenuBackgroundWebGL } from '@core/utils/canvas/loaders/menu-background-webgl.js'
import type { BurgerButtonWebGL } from '@core/utils/canvas/widgets/burger-button-webgl.js'
import { destroyNavIconAura, mountNavIconAura } from './icon-aura.js'
import type { RingFillSession } from '@core/utils/gpu/ring-fill.js'
import { goToAbout, scrollToContact, scrollToTop } from './scroll.js'
import {
  captureOrigin,
  handleAbout,
  handleAction,
  handleLang,
  handleLogo,
  handlePreferences,
  handleSearch,
} from './handlers.js'
import { renderAppNav } from './render.js'
import {
  closeNavMenu,
  mountNavBurgerWebGL,
  mountNavMenuWebGL,
  navBurgerCanvas,
  navMenuCanvas,
  navMenuKeyDown,
  openNavMenu,
  toggleNavMenu,
} from './menu.js'
import appStyles from '@core/sass/components/shell/app/nav-shell.scss?tiers'

/**
 * The slice of the APP translation dictionary the nav template reads —
 * all fields optional since the dictionary arrives incrementally and the
 * template falls back to English snapshot copy per key.
 */
interface AppNavTranslations {
  title?: string
  about?: { description?: string }
  contact?: string
  featured?: string
  related?: string
  menu?: string
  close?: string
  earthPlayground?: string
  starField?: string
  preferences?: string
  experiments?: string
  scrollUp?: string
  search?: string
  setLanguage?: string
}

/**
 * <app-nav> — persistent top bar (logo, burger, language/search/preferences
 * chips) plus the fullscreen menu overlay. Owns the burger and menu
 * background WebGL widgets on persistent canvases that are never
 * re-created by re-renders — one GL context per widget for the element's
 * lifetime.
 */
export class AppNav extends BaseComponent {
  /** APP dictionary pushed by <app-root>; null until first fetch lands. */
  _translations: AppNavTranslations | null = null
  /** Locale the pushed `_translations` were fetched for — the getter returns null on mismatch so stale copy never renders mid-switch. */
  _translationsLocale: string | null = null
  /** Home anchor the scroll position sits in — drives nav-active styles. */
  activeSection: string = SECTIONS.HOME
  /** Within 200px of document bottom — flips CTA to "selected work". */
  onBottom = false

  /** Live ring-fill aura session on the strip chips (null without WebGPU). */
  _navIconAura: RingFillSession | null = null
  /** True while the nav floats over a dark section — drives the --on-dark variant for contrast inversion. */
  _onDark = false

  // Menu overlay state machine: open → (settling) → settled → closing →
  // closed. _menuSettled marks the end of the open animation — the
  // overlay's staggered-entrance animations stop re-running from there.
  /** Menu overlay is open. */
  _menuOpen = false
  /** performance.now() of the open transition — feeds the residual-input guard. */
  _menuOpenedAt = 0
  /** Close animation in flight — blocks re-entry/double-close. */
  _menuClosing = false
  /** Open animation completed — entrance animations settle to final state. */
  _menuSettled = false
  /** Handle for the settle delay; cleared on destroy so no timer outlives the element. */
  _menuSettleTimer: ReturnType<typeof setTimeout> | null = null

  /** MenuBackgroundWebGL instance — owns the fullscreen contour canvas. */
  _menuBg: MenuBackgroundWebGL | null = null
  /** BurgerButtonWebGL on the persistent burger canvas — morphs into the close control while the menu is open. */
  _burgerBtn: BurgerButtonWebGL | null = null

  // Persistent canvas elements — created once, never re-created by
  // re-renders, so each keeps one GL context for its widget's lifetime.
  /** Burger button canvas host. */
  _burgerCanvasEl: HTMLCanvasElement | null = null
  /** Fullscreen menu background canvas host. */
  _menuCanvasEl: HTMLCanvasElement | null = null

  /**
   * Snapshot of the store inputs the template actually consumes —
   * compared in onStoreUpdate so unrelated commits (dialog open/close,
   * modal origin, scroll flags) don't force a DOM wipe that replays the
   * draw-text letter animation.
   */
  _navStoreSig: {
    locale: unknown
    app: unknown
    components: unknown
    slugs: unknown
    modalOpen: boolean
    searchOpen: boolean
    reduced: boolean
  } | null = null

  constructor() {
    super(appStyles)
  }

  /** Setter/getter — the APP translation dictionary pushed by <app-root>. */

  set translations(val: AppNavTranslations | null) {
    this._translations = val

    this._translationsLocale = this.locale

    if (this._isMounted) this._updateDom()
  }

  get translations() {
    if (this._translationsLocale && this._translationsLocale !== this.locale) {
      return null
    }

    return this._translations
  }

  /** The router's active route descriptor. */

  get currentRoute() {
    return router.currentRoute
  }

  /** True on home/about/contact routes (nav shows section links). */

  get isHomePage() {
    const name = this.currentRoute?.name || ROUTE_NAMES.HOME

    return (
      name.startsWith(ROUTE_PREFIXES.HOME) ||
      name.startsWith(ROUTE_PREFIXES.ABOUT) ||
      name.startsWith(ROUTE_PREFIXES.CONTACT)
    )
  }

  /**
   * True on the playground route (nav renders in its alternate variant).
   * The shared router/playground predicates do the checking: resolved
   * route name first, then the last URL segment against canonical and
   * localized slugs.
   */
  get isPlaygroundPage() {
    return this.isEarthPlaygroundPage || this.isStarFieldPage
  }

  /** True on the earth-playground route (or its space-playground alias). */
  get isEarthPlaygroundPage() {
    return isEarthPlaygroundRoute(this.currentRoute?.name)
  }

  /** True on the star-field experiment route — same resolution order. */
  get isStarFieldPage() {
    return isStarFieldRoute(this.currentRoute?.name)
  }

  /** Active locale code. */

  get locale() {
    return store.getters.getLang()
  }

  /** Lifecycle: wires store subscription, scroll/nav event listeners, router subscription and mounts the WebGL nav widgets. */

  override onMounted() {
    this.subscribe(store)

    this.subscribeRouter()

    this._bindEvents()

    predictiveLoader.scanAndObserve(this.shadowRoot)

    this._mountBurgerWebGL()

    this._mountMenuWebGL()

    mountNavIconAura(this)
  }

  /** Lifecycle: after re-render, re-mounts WebGL widgets that the new DOM replaced. */

  override onUpdated() {
    predictiveLoader.scanAndObserve(this.shadowRoot)

    mountNavIconAura(this)

    this._mountBurgerWebGL()

    this._mountMenuWebGL()
  }

  /** Lifecycle: destroys the burger/menu GL widgets + chip aura and unbinds listeners. */

  override onDestroy() {
    // Dying mid-open/mid-close must not leave the page-wide pause flag
    // latched — carousels and videos would stay frozen forever.
    if (this._menuOpen) {
      store.commit(MODAL_MUTATIONS.SET_NAV_MENU, false)
    }

    // Any chip label still joustered open detaches with the nav — collapse
    // the pin set so the dead nodes never linger in the gate's registry.
    joustCollapseAll()

    this._destroyNavIconAura()

    if (this._menuSettleTimer) {
      clearTimeout(this._menuSettleTimer)

      this._menuSettleTimer = null
    }

    if (this._burgerBtn) {
      this._burgerBtn.destroy()

      this._burgerBtn = null
    }

    if (this._menuBg) {
      this._menuBg.destroy?.()

      this._menuBg = null
    }
  }

  /** Tears down the icon-aura session. */

  _destroyNavIconAura() {
    destroyNavIconAura(this)
  }

  /** Subscribes to route changes so nav state/links refresh per page. */

  subscribeRouter() {
    router.subscribe(() => {
      this._updateDom()
    })
  }

  /**
   * Store change → re-render only when a value the template consumes
   * actually moved: the locale, the live dictionaries `appText` resolves
   * against (app/components/slugs — mutations replace them wholesale, so
   * identity comparison works), the media-modal open flag (nav renders
   * empty behind it) and reduced-motion. Dialog open/close, modal-origin
   * and other commits leave the DOM alone — critically, while the menu
   * is open behind a dialog this keeps every <draw-text> label mounted
   * and already-drawn instead of replaying the letter animation.
   */
  override onStoreUpdate() {
    const lang = store.getters.getlang()

    const modalOpen = store.getters.getModal()?.open === true

    const searchOpen = store.getters.getSearchModalOpen?.() === true

    const reduced = store.getters.getReducedMotion()

    const prev = this._navStoreSig

    if (
      !prev ||
      lang.locale !== prev.locale ||
      lang.app !== prev.app ||
      lang.components !== prev.components ||
      lang.slugs !== prev.slugs ||
      modalOpen !== prev.modalOpen ||
      searchOpen !== prev.searchOpen ||
      reduced !== prev.reduced
    ) {
      this._navStoreSig = {
        locale: lang.locale,
        app: lang.app,
        components: lang.components,
        slugs: lang.slugs,
        modalOpen,
        searchOpen,
        reduced,
      }

      this._updateDom()
    }
  }

  /** Receives active-section + near-bottom flags from <app-root>'s scroll tracker and toggles the --on-dark variant. */

  updateScrollState(activeSection: string, onBottom: boolean): void {
    if (this.activeSection === activeSection && this.onBottom === onBottom) {
      return
    }

    this.activeSection = activeSection

    this.onBottom = onBottom

    this._updateDom()
  }

  /** Binds click/scroll/menu-toggle handlers inside the shadow root. */

  _bindEvents() {
    this.addScopedListener(window, KEYBOARD_EVENTS.KEYDOWN, (e) => {
      // Dialogs rendered above the overlay own the keyboard while open —
      // Escape and the arrow row must not close/steer the menu behind one.
      const dialogAbove = store.getters.getPreferencesOpen() || store.getters.getLangDialogOpen()

      if (!this._menuOpen || dialogAbove) return

      if ((e as KeyboardEvent).key === KEYS.ESCAPE) {
        this._closeMenu()

        return
      }

      // The overlay is the live navigation landmark — arrows rove its
      // items, Home/End jump to the ends (navMenuKeyDown answers whether
      // the key was consumed so only handled keys are prevented).
      if (navMenuKeyDown(this, e as KeyboardEvent)) {
        e.preventDefault()
      }
    })

    armResidualInputGuard(
      this,
      () => this._menuOpen,
      () => this._menuOpenedAt
    )
  }

  /** Smooth-scrolls the window back to the top. */

  scrollToTop() {
    scrollToTop(this)
  }

  /** Navigates to (or scrolls to) the about section — route-aware. */

  goToAbout() {
    goToAbout(this)
  }

  /** Navigates to (or scrolls to) the contact footer — route-aware. */

  scrollToContact() {
    scrollToContact(this)
  }

  /** Logo click: navigates home, or scrolls top when already on home. */

  handleLogo(e?: Event): void {
    handleLogo(this, e)
  }

  /** About link click: routes to the localized about slug. */

  handleAbout(e?: Event): void {
    handleAbout(this, e)
  }

  /** Contact/CTA click: routes to the localized contact slug. */

  handleAction(e?: Event): void {
    handleAction(this, e)
  }

  /**
   * Records the clicked button's center point in store.modalOrigin — the
   * preferences/lang dialogs read it to zoom their "genie" open animation
   * out from the trigger instead of from screen center.
   */
  _captureOrigin(e?: Event): void {
    captureOrigin(e)
  }

  /** Opens the preferences modal (fires open-preferences-modal after capturing origin). */

  handlePreferences(e?: Event): void {
    handlePreferences(this, e)
  }

  /** Opens the language dialog (fires open-lang-dialog after capturing origin). */

  handleLang(e?: Event): void {
    handleLang(this, e)
  }

  /** Opens the search modal (fires open-search-modal; plain clicks only). */

  handleSearch(e?: Event): void {
    handleSearch(this, e)
  }

  /**
   * JSX template: logo button, burger, and the fullscreen menu overlay —
   * the markup lives in nav-render.tsx; this delegates with `this`.
   */
  override render() {
    return renderAppNav(this)
  }

  /** Persistent burger canvas (pointer overlay) — created once, survives re-renders so its GL context does. */
  _burgerCanvas(): HTMLCanvasElement {
    return navBurgerCanvas(this)
  }

  /** Canvas JSX for the WebGL menu background. */

  _menuCanvas(): HTMLCanvasElement {
    return navMenuCanvas(this)
  }

  /** Opens/closes the fullscreen menu overlay — passes the click event through so toggleNavMenu's joust gate can read currentTarget/detail. */

  _toggleMenu(e?: Event) {
    toggleNavMenu(this, e)
  }

  /** Opens the menu (see nav-menu.ts for the state machine). */

  _openMenu() {
    openNavMenu(this)
  }

  /** Binds the WebGL layers to the persistent menu canvases. */

  _mountMenuWebGL() {
    mountNavMenuWebGL(this)
  }

  /** Attaches BurgerButtonWebGL to the persistent burger canvas. */

  _mountBurgerWebGL() {
    mountNavBurgerWebGL(this)
  }

  /**
   * Closes the menu through the full dissolve cycle (see nav-menu.ts).
   * The _menuClosing guard makes double-close (Esc + click) a no-op.
   */

  _closeMenu() {
    closeNavMenu(this)
  }
}

// Registration guard: customElements.define throws on a duplicate tag —
// the `get` check keeps module re-evaluation (HMR, coverage re-imports)
// safe since the registry is global, not per-module-instance.
if (!customElements.get(COMPONENT_TAGS.APP_NAV)) {
  customElements.define(COMPONENT_TAGS.APP_NAV, AppNav)
}
