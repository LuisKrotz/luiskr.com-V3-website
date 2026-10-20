/**
 * @file legal/Footer.js
 * @description <legal-footer> — footer strip shared by internals and the
 * legal pages: legal links, credits/source line and the disclaimer note.
 * getFallbackLegalLinks() provides the bundled link list until the CMS
 * node loads.
 */

import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CONTACT_CLASSES } from '@core/tokens/classes/contact.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { ROUTER_CLASSES } from '@core/tokens/classes/router.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { SOURCE_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { DB_PATHS, ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h, Fragment } from '@core/jsx.js'
import { isPlainClick } from '@core/utils/dom.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import internalStyles from '@core/sass/components/internals/internals.scss?inline'

import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { mountDividerSheen } from '@core/utils/gpu/divider-sheen.js'
import { getFallbackLegalLinks, type LegalLink } from '@core/utils/data/legal-links.js'
import { componentText, rightsParts } from '@core/locale/ui-text.js'
import { devError } from '@core/devlog.js'

export { getFallbackLegalLinks }

/**
 * The LegalFooter — footer class.
 */
export class LegalFooter extends BaseComponent {
  private _unsubRouter: (() => void) | null = null

  private _dividerTeardowns: (() => void)[] = [] // live divider-sheen mounts (re-bound per render)

  constructor() {
    super(internalStyles)
  }

  override onMounted() {
    this.subscribe(store)

    this._ensureData()

    this._unsubRouter = router.subscribe(() => {
      this._updateDom()
    })

    // Delegated click handler on shadowRoot — plain clicks route through
    // the SPA; modified/middle clicks fall through to the anchor's href
    // so open-in-new-tab works natively.
    this.addScopedListener(this.shadowRoot, MOUSE_EVENTS.CLICK, (e) => {
      const a = (e.target as Element | null)?.closest(HTML_TAGS.A)

      if (a) {
        if (!isPlainClick(e)) return

        e.preventDefault()

        const href = a.getAttribute(LINK_ATTRS.HREF)

        if (href) router.push(href)
      }
    })
  }

  /** Loads the legal-links node when missing (SWR). */

  private _ensureData(): void {
    const lang = store.getters.getlang()

    const locale = lang?.locale || LOCALES.EN

    const dbpath = `${lang?.database || DB_PATHS.TRANSLATIONS}${locale}${DB_PATHS.COMPONENTS}`

    fetchFirebaseDb(dbpath)
      .then((snapshot) => {
        if (snapshot?.exists()) {
          store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, snapshot.val())

          this._updateDom()
        }
      })
      .catch(devError)
  }

  override onUpdated() {
    // The divider <hr> is recreated on every render — dispose the
    // stale mounts (canvas + IO + rAF + widget), then re-mount on the
    // fresh nodes. Without navigator.gpu or under reduced-motion the
    // helper is a no-op and the CSS ::after sweep stays the path.
    this._dividerTeardowns.forEach((teardown) => teardown())

    this._dividerTeardowns = []

    for (const hr of this.$$(`hr.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER}`)) {
      this._dividerTeardowns.push(
        mountDividerSheen(hr as HTMLElement, INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER_CANVAS)
      )
    }
  }

  override onDestroy() {
    this._dividerTeardowns.forEach((teardown) => teardown())

    this._dividerTeardowns = []

    if (typeof this._unsubRouter === TYPE_STRINGS.FUNCTION) {
      this._unsubRouter?.()

      this._unsubRouter = null
    }
  }

  override onStoreUpdate() {
    this._updateDom()
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    const locale = store.getters.getLang()

    const components = store.getters.getlang()?.components as
      Record<string, { links?: LegalLink[] }> | undefined

    const rawLinks = components?.[CMS_KEYS.LEGAL_FOOTER]?.links

    const links: LegalLink[] =
      rawLinks && rawLinks.length ? rawLinks : getFallbackLegalLinks(locale)

    const currentPath = router.currentRoute?.path || CHAR_STRINGS.EMPTY

    return (
      <footer className={INTERNAL_CLASSES.INTERNAL_FOOTER}>
        <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS}>
          {links.map((item, n) => {
            // Exact match OR suffix match (localized prefix means the
            // stored '/privacy' appears as '/br/privacy'); '/' itself is
            // excluded from suffix matching — every path ends with it.
            const isActive =
              currentPath === item.link ||
              (item.link !== ROUTE_PATHS.ROOT && currentPath.endsWith(item.link))

            const activeClass = isActive
              ? `${ROUTER_CLASSES.ROUTER_LINK_EXACT_ACTIVE} ${ROUTER_CLASSES.ROUTER_LINK_ACTIVE} ${STATE_CLASSES.ACTIVE}`
              : CHAR_STRINGS.EMPTY

            return (
              <Fragment key={item.link || n}>
                <a
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${CONTACT_CLASSES.CONTACT_OTHER_LINK} ${activeClass}`}
                  href={item.link}
                  onClick={(e: Event) => {
                    if (!isPlainClick(e)) return

                    e.preventDefault()

                    if (item.link) router.push(item.link)
                  }}
                >
                  {item.page}
                </a>
                {n < links.length - 1 && (
                  <span
                    className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP} ${CONTACT_CLASSES.CONTACT_SEPARATOR}`}
                  >
                    {CHAR_STRINGS.DOT_SEP}
                  </span>
                )}
              </Fragment>
            )
          })}
          {/* Animated hairline above the authorship block — same sheen
              pattern as the related footer's divider. */}
          <hr
            className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER}
            aria-hidden={ATTR_VALUES.TRUE}
          />
          <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_CREDIT}>
            {componentText(SOURCE_COMPONENT_KEYS.SOURCE_CREDIT)}
          </p>
          <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_RIGHTS}>
            {(() => {
              const r = rightsParts()

              return (
                <Fragment>
                  {r.pre}
                  <b>{r.copy}</b>
                  {r.mid}
                  <b>{r.year}</b>
                  {r.post}
                </Fragment>
              )
            })()}
          </p>
        </div>
      </footer>
    )
  }
}

if (!customElements.get(COMPONENT_TAGS.LEGAL_FOOTER)) {
  customElements.define(COMPONENT_TAGS.LEGAL_FOOTER, LegalFooter)
}
