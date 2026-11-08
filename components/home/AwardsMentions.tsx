/**
 * @file AwardsMentions.js
 * @description <awards-mentions> — the legal footer band on home: the
 * legal links row + project source-code pill, the docs-portal entry, the
 * sheen divider and the authorship/copyright lines. The mentions fan it
 * used to host now lives inside <contact-section> as <mentions-deck>.
 * Data comes from the CMS translations nodes with bundled fallbacks.
 * Implementation lives in home/awards/{data,render} — this facade keeps
 * the property + lifecycle surface.
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { FOOTER_CLASSES } from '@core/tokens/classes/footer.js'
import { BaseComponent } from '@core/Component.js'
import { isPlainClick } from '@core/utils/dom.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { ensureAwardsData, legalLinks } from './awards/data.js'
import { renderAwards } from './awards/render.js'
import { mountDividerSheen } from '@core/utils/gpu/divider-sheen.js'
import { watchOrphanSeps } from '@core/utils/dom/orphan-seps.js'
import type { LegalLink } from './awards/data.js'
import awardsFooterStyles from '@core/sass/components/home/awards-footer.scss?tiers'

/**
 * The AwardsMentions — legal footer band class.
 */
export class AwardsMentions extends BaseComponent {
  _lastLocale: string | null = null // locale the legal links were loaded for
  _dividerTeardowns: (() => void)[] = [] // live divider-sheen mounts (re-bound per render)
  _sepsTeardown: (() => void) | null = null // live orphan-sep watcher (re-bound per render)

  constructor() {
    super(awardsFooterStyles)
  }

  /** Legal-page links for the footer row (see awards/data.ts). */

  get legalLinks(): LegalLink[] {
    return legalLinks()
  }

  override onMounted() {
    this._lastLocale = store.getters.getLang()

    this.subscribe(store)

    this._ensureData()

    this._bindLinks()
  }

  override onStoreUpdate() {
    const currentLocale = store.getters.getLang()

    if (this._lastLocale !== currentLocale) {
      this._lastLocale = currentLocale

      this._updateDom()
    }
  }

  /** Loads the mentions + legal-links nodes when missing (SWR). */

  _ensureData(): void {
    ensureAwardsData(this)
  }

  override onUpdated() {
    this._mountDividerSheen()

    // The legal nav is recreated on every render — rebind the
    // orphan-sep watcher so a wrapped line never opens on a dot.
    this._sepsTeardown?.()

    this._sepsTeardown = null

    const legalNav = this.$(`nav.${AWARDS_CLASSES.AWARDS_FOOTER_LINKS}`)

    if (legalNav) {
      this._sepsTeardown = watchOrphanSeps(
        legalNav,
        AWARDS_CLASSES.AWARDS_FOOTER_PAIR,
        AWARDS_CLASSES.AWARDS_FOOTER_PAIR_LEAD
      )
    }
  }

  /**
   * Re-mounts the divider-sheen WebGPU widgets on the footer's `<hr>`
   * divider — the node is recreated on every render, so each update
   * disposes the stale mounts first (canvas + IO + rAF + widget).
   * Without `navigator.gpu` or under reduced-motion the mount helper
   * is a no-op and the CSS `::after` sweep stays the render path.
   */
  _mountDividerSheen(): void {
    this._dividerTeardowns.forEach((teardown) => teardown())

    this._dividerTeardowns = []

    for (const hr of this.$$(`hr.${FOOTER_CLASSES.FOOTER_DIVIDER}`)) {
      this._dividerTeardowns.push(
        mountDividerSheen(hr as HTMLElement, FOOTER_CLASSES.FOOTER_DIVIDER_CANVAS)
      )
    }
  }

  /** Lifecycle: releases the divider mounts before the shadow root goes. */
  override onDestroy() {
    this._dividerTeardowns.forEach((teardown) => teardown())

    this._dividerTeardowns = []

    this._sepsTeardown?.()

    this._sepsTeardown = null
  }

  /** Wires internal links through the SPA router. */

  _bindLinks(): void {
    // Delegated click handler on shadowRoot: handles all legal links across DOM re-renders
    this.addScopedListener(this.shadowRoot, MOUSE_EVENTS.CLICK, (e) => {
      const a = (e.target as Element).closest?.(`.${AWARDS_CLASSES.AWARDS_FOOTER_ITEM}`)

      if (a) {
        // Modified/middle clicks keep native anchor semantics (new tab);
        // the feed link targets an XML file, not an SPA route — let the
        // browser navigate to it natively.
        if (!isPlainClick(e) || a.classList.contains(AWARDS_CLASSES.AWARDS_FOOTER_FEED)) return

        e.preventDefault()

        router.push(a.getAttribute('href') || CHAR_STRINGS.EMPTY)
      }
    })
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    return renderAwards(this)
  }
}

if (!customElements.get(COMPONENT_TAGS.AWARDS_MENTIONS)) {
  customElements.define(COMPONENT_TAGS.AWARDS_MENTIONS, AwardsMentions)
}
