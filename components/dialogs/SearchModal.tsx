/**
 * @file SearchModal.js
 * @description <search-modal> — the hamburger-menu search dialog: a
 * centered panel hosting the standalone <route-search> component over a
 * click-away backdrop. Opens via store.searchModalOpen (nav "Search"
 * item → OPEN_SEARCH_MODAL event → `modal.open = true`), closes on Esc,
 * backdrop click or the ✕ button; focus lands inside the search input.
 */
/** @jsx h */
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SEARCH_MODAL_CLASSES as C } from '@core/tokens/classes/search-modal.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { SECTION_UI_KEYS, NAV_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { KEYBOARD_EVENTS } from '@core/tokens/events.js'
import { KEYS } from '@core/tokens/primitives.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { h } from '@core/jsx.js'
import { appText } from '@core/locale/ui-text.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { CloseButtonWebGL } from '@core/utils/canvas/widgets/close-button.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { genieEnter, genieLeave, type GenieClasses } from '@core/utils/motion/genie.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import modalStyles from '@core/sass/components/dialogs/search-modal.scss?tiers'
import '@website/components/search/RouteSearch.js'

/**
 * Genie class contract — the search modal's own block, same mechanics as
 * the preferences/language dialogs (backdrop carries the enter/leave
 * modifier, the panel scales from store.modalOrigin).
 */
const SEARCH_GENIE_CLASSES: GenieClasses = {
  backdrop: C.SEARCH_MODAL_BACKDROP,
  backdropEnter: C.SEARCH_MODAL_BACKDROP_ENTER,
  backdropLeave: C.SEARCH_MODAL_BACKDROP_LEAVE,
  dialog: C.SEARCH_MODAL_PANEL,
}

/**
 * The <search-modal> element — search dialog facade.
 */
export class SearchModal extends BaseComponent {
  /** Local open state — mirrors store.searchModalOpen via the setter. */
  _isOpen = false

  /** Genie-leave in flight — blocks re-entry and mid-collapse re-renders. */
  _closing = false

  /** CloseButtonWebGL on the header ✕ canvas — liquid-fill, WebGL-first. */
  _closeBtn: CloseButtonWebGL | null = null

  constructor() {
    super(modalStyles)
  }

  /** Setter/getter — drives the dialog's open state through the store. */
  set open(val: boolean) {
    this._isOpen = !!val

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, this._isOpen)
  }

  get open(): boolean {
    return this.isOpen
  }

  /** Open flag — store getter when available, local state otherwise. */
  get isOpen(): boolean {
    return store.getters.getSearchModalOpen
      ? (store.getters.getSearchModalOpen() as boolean)
      : this._isOpen
  }

  override onMounted() {
    this.subscribe(store)

    this.addScopedListener(window, KEYBOARD_EVENTS.KEYDOWN, (e) => {
      if ((e as KeyboardEvent).key === KEYS.ESCAPE) this.close()
    })
  }

  /** Store change → open/close the dialog and focus the input on open. */
  override onStoreUpdate() {
    // Re-rendering mid-genie-leave would reset the collapse transition.
    if (this._closing) return

    if (this.isOpen && !this.hasAttribute(COMMON_ATTRS.OPEN)) {
      this._updateDom()

      this.setAttribute(COMMON_ATTRS.OPEN, ATTR_VALUES.TRUE)

      this._mountCloseButton()

      // Zoom-from-trigger entrance — reads store.modalOrigin captured by
      // the nav search chip click; falls back to a center zoom.
      genieEnter(this, SEARCH_GENIE_CLASSES)

      const search = this.$(COMPONENT_TAGS.ROUTE_SEARCH) as { focusInput?: () => void } | null

      search?.focusInput?.()
    } else if (!this.isOpen && this.hasAttribute(COMMON_ATTRS.OPEN)) {
      this.removeAttribute(COMMON_ATTRS.OPEN)

      this._destroyCloseButton()

      this._updateDom()
    }
  }

  /** Releases the WebGL ✕ context with the element. */
  override onDestroy() {
    this._destroyCloseButton()
  }

  /** Mounts the liquid-fill ✕ on its live canvas (rebuilds on swap). */
  private _mountCloseButton(): void {
    const canvas = this.$<HTMLCanvasElement>(`.${C.SEARCH_MODAL_CLOSE_CANVAS}`)

    if (!canvas) return

    if (this._closeBtn && this._closeBtn.canvas !== canvas) {
      this._closeBtn.destroy()
      this._closeBtn = null
    }

    if (!this._closeBtn) {
      applyAnimationDesc(canvas, ANIMATION_IDS.CLOSE_BUTTON)

      this._closeBtn = new CloseButtonWebGL(canvas, () => this.close())

      this._closeBtn.setReducedMotion(!!store.getters.getReducedMotion?.())
    }
  }

  /** Tears the GL context down — close and teardown both release it. */
  private _destroyCloseButton(): void {
    this._closeBtn?.destroy()
    this._closeBtn = null
  }

  /**
   * Dismisses the dialog — backdrop click, ✕ button or Escape. The
   * genie-leave collapse back into the trigger plays first, THEN the
   * closed state commits — committing early would unmount the panel mid-
   * animation (a hard vanish instead of the zoom-out).
   */
  close(): void {
    if (this._closing || !this.isOpen) return

    this._closing = true

    genieLeave(
      this,
      () => {
        this._closing = false

        this._isOpen = false

        store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, false)
      },
      SEARCH_GENIE_CLASSES
    )
  }

  /** JSX template — backdrop + panel + the hosted route-search surface. */
  override render() {
    if (!this.isOpen) return ATTR_VALUES.EMPTY

    const title = String(appText(SECTION_UI_KEYS.SEARCH) || ATTR_VALUES.EMPTY)
    const closeLabel = String(appText(NAV_UI_KEYS.CLOSE) || ATTR_VALUES.EMPTY)
    const RouteSearchTag = COMPONENT_TAGS.ROUTE_SEARCH

    return (
      <div className={C.SEARCH_MODAL}>
        <div
          className={C.SEARCH_MODAL_BACKDROP}
          aria-hidden={ATTR_VALUES.TRUE}
          onClick={() => this.close()}
        />
        <div
          className={C.SEARCH_MODAL_PANEL}
          role={ARIA_ATTRS.ROLE_DIALOG}
          aria-modal={ATTR_VALUES.TRUE}
          aria-labelledby={APP_IDS.SEARCH_MODAL_TITLE}
        >
          <h2 className={C.SEARCH_MODAL_TITLE} id={APP_IDS.SEARCH_MODAL_TITLE}>
            {title}
          </h2>
          <button
            className={C.SEARCH_MODAL_CLOSE_BTN}
            type={FORM_ATTRS.TYPE_BUTTON}
            aria-label={closeLabel}
            onClick={() => this.close()}
          >
            <canvas className={C.SEARCH_MODAL_CLOSE_CANVAS} aria-hidden={ATTR_VALUES.TRUE} />
          </button>
          <div className={C.SEARCH_MODAL_BODY}>
            <RouteSearchTag />
          </div>
        </div>
      </div>
    )
  }
}

if (!customElements.get(COMPONENT_TAGS.SEARCH_MODAL)) {
  customElements.define(COMPONENT_TAGS.SEARCH_MODAL, SearchModal)
}
