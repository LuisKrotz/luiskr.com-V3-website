/**
 * @file legal/Footer.js
 * @description <legal-footer> — the single site footer shared by the
 * internals (project detail), legal and animations pages: legal links +
 * locale RSS feed on the left of the top row, the project source-code
 * pill and the home/socials row on the right, then the docs-portal
 * entry, the disclaimer note and the authorship/copyright
 * lines. getFallbackLegalLinks() provides the bundled link list until
 * the CMS node loads.
 */

import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CONTACT_CLASSES } from '@core/tokens/classes/contact.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { ROUTER_CLASSES } from '@core/tokens/classes/router.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { A11Y_UI_KEYS, SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { SOURCE_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { DB_PATHS, ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { SOCIAL_URLS } from '@core/tokens/media/urls.js'
import { h, Fragment } from '@core/jsx.js'
import { isPlainClick } from '@core/utils/dom.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import internalStyles from '@core/sass/components/internals/internals.scss?inline'

import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { mountDividerSheen } from '@core/utils/gpu/divider-sheen.js'
import {
  animationsHrefFor,
  feedGlyph,
  feedHrefFor,
  sitemapHrefFor,
} from '@core/utils/data/footer-links.js'
import { getFallbackLegalLinks, legalLinks, type LegalLink } from '@core/utils/data/legal-links.js'
import { appText, componentText, rightsParts } from '@core/locale/ui-text.js'
import { devError } from '@core/devlog.js'

export { getFallbackLegalLinks, feedHrefFor }

/**
 * A social-channel row from the components/related CMS node — `link`
 * the destination (mailto:/tel:/https:) and `network` the label.
 */
interface FooterSocial {
  /** Destination URL — external, mailto: or tel:. */
  link?: string
  /** Visible channel name (Mail, Phone, Linkedin, Github…). */
  network?: string
}

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

    // Delegated click handler on shadowRoot — plain clicks on internal
    // links route through the SPA; external links (socials, the source
    // repo), modified/middle clicks and the feed link all fall through
    // to the anchor's native behavior.
    this.addScopedListener(this.shadowRoot, MOUSE_EVENTS.CLICK, (e) => {
      const a = (e.target as Element | null)?.closest(HTML_TAGS.A)

      if (a) {
        // The feed link targets an XML file, not an SPA route — let the
        // browser navigate to it natively.
        if (
          !isPlainClick(e) ||
          a.classList.contains(INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_LINK)
        )
          return

        const href = a.getAttribute(LINK_ATTRS.HREF)

        // Non-root-relative hrefs (https:, mailto:, tel:) are external —
        // the SPA router must never see them.
        if (!href || !href.startsWith(ROUTE_PATHS.ROOT)) return

        e.preventDefault()

        router.push(href)
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
    // The divider <hr>s are recreated on every render — dispose the
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

    const links: LegalLink[] = legalLinks()

    const currentPath = router.currentRoute?.path || CHAR_STRINGS.EMPTY

    // Home link — first fallback row (localized route + label); it leads
    // the right column's socials row, matching the home footer layout.
    const home = getFallbackLegalLinks(locale)[0]

    // components/related supplies the socials row + disclaimer note —
    // Firebase may deliver list nodes as keyed objects, so normalize the
    // same way the related conveyor does before rendering.
    const rawSocials = componentText(`${CMS_KEYS.RELATED}.socials`) as
      FooterSocial[] | Record<string, FooterSocial> | undefined

    const socials: FooterSocial[] = Array.isArray(rawSocials)
      ? rawSocials
      : rawSocials
        ? Object.values(rawSocials)
        : []

    const note = String(componentText(`${CMS_KEYS.RELATED}.note`) || CHAR_STRINGS.EMPTY)

    const r = rightsParts()

    return (
      <footer className={INTERNAL_CLASSES.INTERNAL_FOOTER}>
        {/* Landmark heading for AT navigation — sr-only + data-nosnippet:
            a jump target ('Footer > …'), never indexed. */}
        <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
          {appText(A11Y_UI_KEYS.A11Y_FOOTER)}
        </h2>
        <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS}>
          <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_TOP}>
            {/* Left column — legal pages nav, ending on the locale RSS
                feed (the type hint lets feed readers/extensions pick it
                up). Each separator is bound to the FOLLOWING item in a
                nowrap pair, so a wrapped line always opens on "· item"
                and a dot can never dangle at a line's end. */}
            {/* Labeled "Sitemap" — this nav is the site's link
                directory (legal + animations + sitemap + feed). Reusing
                the awards legalNav label here would emit a second
                identically-labeled nav landmark on pages that mount
                both footers — an axe landmark-unique violation. */}
            <nav
              className={INTERNAL_CLASSES.INTERNAL_FOOTER_LEGAL}
              aria-label={appText(SECTION_UI_KEYS.SITEMAP)}
            >
              {links.map((item, i) => {
                // Exact match OR suffix match (localized prefix means the
                // stored '/privacy' appears as '/br/privacy'); '/' itself
                // is excluded from suffix matching — every path ends
                // with it.
                const isActive =
                  currentPath === item.link ||
                  (item.link !== ROUTE_PATHS.ROOT && currentPath.endsWith(item.link))

                const activeClass = isActive
                  ? `${ROUTER_CLASSES.ROUTER_LINK_EXACT_ACTIVE} ${ROUTER_CLASSES.ROUTER_LINK_ACTIVE} ${STATE_CLASSES.ACTIVE}`
                  : CHAR_STRINGS.EMPTY

                const anchor = (
                  <a
                    className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${CONTACT_CLASSES.CONTACT_OTHER_LINK} ${activeClass}`}
                    href={item.link}
                    onClick={(e: Event) => {
                      if (!isPlainClick(e)) return

                      e.preventDefault()

                      router.push(item.link)
                    }}
                  >
                    {item.page}
                  </a>
                )

                return (
                  <Fragment key={item.link}>
                    {/* Heading per footer link — AT heading-jump lands on
                        it, Tab reaches the anchor next. sr-only, never
                        indexed; skipped when the link has no copy
                        (empty headings are an axe violation). */}
                    {item.page ? (
                      <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                        {item.page}
                      </h3>
                    ) : null}
                    {/* The first item leads the nav separator-free;
                        every later item arrives glued to its dot. */}
                    {i === 0 ? (
                      anchor
                    ) : (
                      <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_PAIR}>
                        <span
                          className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP} ${CONTACT_CLASSES.CONTACT_SEPARATOR}`}
                        >
                          {CHAR_STRINGS.DOT_SEP}
                        </span>
                        {anchor}
                      </span>
                    )}
                  </Fragment>
                )
              })}
              {/* Animations reference — SPA-routed like the legal items,
                  glued to its own leading sep. */}
              <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                {appText(CMS_KEYS.ANIMATIONS)}
              </h3>
              <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_PAIR}>
                <span
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP} ${CONTACT_CLASSES.CONTACT_SEPARATOR}`}
                >
                  {CHAR_STRINGS.DOT_SEP}
                </span>
                <a
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${CONTACT_CLASSES.CONTACT_OTHER_LINK}`}
                  href={animationsHrefFor(locale)}
                  onClick={(e: Event) => {
                    if (!isPlainClick(e)) return

                    e.preventDefault()

                    router.push(animationsHrefFor(locale))
                  }}
                >
                  {appText(CMS_KEYS.ANIMATIONS)}
                </a>
              </span>
              {/* Localized sitemap page — SPA-routed like the legal items,
                  glued to its own leading sep; RSS stays the last nav
                  entry. */}
              <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                {appText(SECTION_UI_KEYS.SITEMAP)}
              </h3>
              <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_PAIR}>
                <span
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP} ${CONTACT_CLASSES.CONTACT_SEPARATOR}`}
                >
                  {CHAR_STRINGS.DOT_SEP}
                </span>
                <a
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${CONTACT_CLASSES.CONTACT_OTHER_LINK}`}
                  href={sitemapHrefFor(locale)}
                  onClick={(e: Event) => {
                    if (!isPlainClick(e)) return

                    e.preventDefault()

                    router.push(sitemapHrefFor(locale))
                  }}
                >
                  {appText(SECTION_UI_KEYS.SITEMAP)}
                </a>
              </span>
              {/* Locale RSS feed — last nav item, glued to its own
                  leading sep. */}
              <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                {appText(SECTION_UI_KEYS.RSS_FEED)}
              </h3>
              <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_PAIR}>
                <span
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP} ${CONTACT_CLASSES.CONTACT_SEPARATOR}`}
                >
                  {CHAR_STRINGS.DOT_SEP}
                </span>
                <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED}>
                  <a
                    className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_LINK}`}
                    href={feedHrefFor(locale)}
                    type={NET_STRINGS.MIME_RSS}
                  >
                    {feedGlyph(
                      INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_ICON,
                      INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_WAVE
                    )}
                    {appText(SECTION_UI_KEYS.RSS_FEED)}
                  </a>
                </span>
              </span>
            </nav>
            {/* Right column — the project source-code pill above the
                home + social-channels row. */}
            <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_SIDE}>
              <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                {componentText(SOURCE_COMPONENT_KEYS.SOURCE_LABEL)}
              </h3>
              <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_SOURCE}>
                {componentText(SOURCE_COMPONENT_KEYS.SOURCE_LABEL)}
                {CHAR_STRINGS.SPACE_CHAR}
                <a
                  className={INTERNAL_CLASSES.INTERNAL_FOOTER_SOURCE_LINK}
                  href={SOCIAL_URLS.GITHUB_REPO}
                  target={DOM_STRINGS.BLANK}
                  rel={DOM_STRINGS.NOOPENER}
                >
                  {componentText(SOURCE_COMPONENT_KEYS.SOURCE_LINK)}
                </a>
              </p>
              <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_SOCIALS}>
                {/* Home leads the row — localized route + label. */}
                <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                  {home.page}
                </h3>
                <a
                  className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_HOME}`}
                  href={home.link}
                  onClick={(e: Event) => {
                    if (!isPlainClick(e)) return

                    e.preventDefault()

                    router.push(home.link)
                  }}
                >
                  {home.page}
                </a>
                {socials.map((social, socialkey) =>
                  social.link ? (
                    <Fragment key={socialkey}>
                      <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP}>
                        {CHAR_STRINGS.DOT_SEP}
                      </span>
                      <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                        {social.network}
                      </h3>
                      <a
                        href={social.link}
                        target={DOM_STRINGS.BLANK}
                        rel={DOM_STRINGS.NOOPENER}
                        className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK}
                      >
                        {social.network}
                      </a>
                    </Fragment>
                  ) : null
                )}
              </div>
            </div>
          </div>
          {/* Docs-portal entry — English title/route, localized
              description. Heading before the link so AT heading-jump
              reaches it. */}
          <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
            {DOCS_STRINGS.TITLE}
          </h3>
          <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_DOCS}>
            <a
              className={INTERNAL_CLASSES.INTERNAL_FOOTER_DOCS_LINK}
              href={ROUTE_PATHS.DOCS}
              onClick={(e: Event) => {
                if (!isPlainClick(e)) return

                e.preventDefault()

                router.push(ROUTE_PATHS.DOCS)
              }}
            >
              {DOCS_STRINGS.TITLE}
              <span
                className={INTERNAL_CLASSES.INTERNAL_FOOTER_DOCS_ARROW}
                {...{ [ARIA_ATTRS.ARIA_HIDDEN]: ATTR_VALUES.TRUE }}
              >
                {CHAR_STRINGS.ARROW_RIGHT}
              </span>
            </a>
            {CHAR_STRINGS.SPACE_CHAR}
            <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_DOCS_DESC}>
              {String(
                componentText(`${DOCS_STRINGS.CMS_COMPONENT}.description`) ||
                  DOCS_STRINGS.DESC_FALLBACK
              )}
            </span>
          </p>
          {/* Animated hairline separating the nav/docs block from the
              disclaimer note. */}
          <hr
            className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER}
            aria-hidden={ATTR_VALUES.TRUE}
          />
          {note ? (
            <Fragment>
              {/* Disclaimer: the full note always renders — no clamp,
                  no expand affordance. */}
              <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE}>
                <span
                  className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_TEXT}
                  dangerouslySetInnerHTML={{ __html: note }}
                />
              </p>
              {/* Second hairline isolates the authorship block. */}
              <hr
                className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER}
                aria-hidden={ATTR_VALUES.TRUE}
              />
            </Fragment>
          ) : null}
          <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_CREDIT}>
            {componentText(SOURCE_COMPONENT_KEYS.SOURCE_CREDIT)}
          </p>
          <p className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_RIGHTS}>
            {r.pre}
            <b>{r.copy}</b>
            {r.mid}
            <b>{r.year}</b>
            {r.post}
          </p>
        </div>
      </footer>
    )
  }
}

if (!customElements.get(COMPONENT_TAGS.LEGAL_FOOTER)) {
  customElements.define(COMPONENT_TAGS.LEGAL_FOOTER, LegalFooter)
}
