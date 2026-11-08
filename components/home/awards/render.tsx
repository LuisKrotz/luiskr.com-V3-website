/**
 * @file home/awards/render.tsx
 * @description JSX template for <awards-mentions> — the legal footer band:
 * the legal links row + project source-code pill on the top line, the
 * docs-portal entry, the sheen divider and the authorship/copyright
 * lines. The mentions fan it used to host now lives inside
 * <contact-section> as <mentions-deck>.
 */

import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { FOOTER_CLASSES } from '@core/tokens/classes/footer.js'
import { A11Y_UI_KEYS, AWARDS_UI_KEYS, SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { h, Fragment } from '@core/jsx.js'
import { isPlainClick } from '@core/utils/dom.js'
import router from '@core/router/router.js'
import store from '@core/store.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { appText, componentText, rightsParts } from '@core/locale/ui-text.js'
import {
  animationsHrefFor,
  feedGlyph,
  feedHrefFor,
  sitemapHrefFor,
} from '@core/utils/data/footer-links.js'
import type { AwardsMentions } from '../AwardsMentions.js'
import { SOURCE_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { SOCIAL_URLS } from '@core/tokens/media/urls.js'

/** Copyright line with the © glyph and the year set in bold. */
const renderRights = () => {
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
}

/**
 * Renders awards.
 * @param el — the element
 */
export function renderAwards(el: AwardsMentions) {
  const links = el.legalLinks

  const locale = store.getters.getLang()

  const sitemapHref = sitemapHrefFor(locale)

  const animationsHref = animationsHrefFor(locale)

  return (
    <footer className={AWARDS_CLASSES.AWARDS_FOOTER}>
      {/* Landmark heading for AT navigation — sr-only + data-nosnippet:
          a jump target ('Footer > …'), never indexed. */}
      <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
        {appText(A11Y_UI_KEYS.A11Y_FOOTER)}
      </h2>
      <div className={AWARDS_CLASSES.AWARDS_FOOTER_TOP}>
        <nav
          className={AWARDS_CLASSES.AWARDS_FOOTER_LINKS}
          aria-label={appText(AWARDS_UI_KEYS.AWARDS_LEGAL_NAV)}
        >
          {links.map((link, i) => (
            <Fragment key={link.link}>
              {/* Heading per footer link — AT heading-jump lands on it,
                  Tab reaches the anchor next. sr-only, never indexed;
                  skipped when the link has no copy (empty headings are
                  an axe violation). */}
              {link.page ? (
                <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                  {link.page}
                </h3>
              ) : null}
              {/* Every item arrives glued to its own LEADING dot in a
                  nowrap pair — a wrap can only break before the pair,
                  so a separator never dangles at a line's end. */}
              {i === 0 ? (
                <a
                  className={AWARDS_CLASSES.AWARDS_FOOTER_ITEM}
                  href={link.link}
                  onClick={(e: Event) => {
                    if (!isPlainClick(e)) return

                    e.preventDefault()

                    router.push(link.link)
                  }}
                >
                  {link.page}
                </a>
              ) : (
                <span className={AWARDS_CLASSES.AWARDS_FOOTER_PAIR}>
                  <span className={AWARDS_CLASSES.AWARDS_FOOTER_SEP}>&bull;</span>
                  <a
                    className={AWARDS_CLASSES.AWARDS_FOOTER_ITEM}
                    href={link.link}
                    onClick={(e: Event) => {
                      if (!isPlainClick(e)) return

                      e.preventDefault()

                      router.push(link.link)
                    }}
                  >
                    {link.page}
                  </a>
                </span>
              )}
            </Fragment>
          ))}
          {/* Animations reference — SPA-routed like the legal items,
              glued to its own leading sep. */}
          <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
            {appText(CMS_KEYS.ANIMATIONS)}
          </h3>
          <span className={AWARDS_CLASSES.AWARDS_FOOTER_PAIR}>
            <span className={AWARDS_CLASSES.AWARDS_FOOTER_SEP}>&bull;</span>
            <a
              className={AWARDS_CLASSES.AWARDS_FOOTER_ITEM}
              href={animationsHref}
              onClick={(e: Event) => {
                if (!isPlainClick(e)) return

                e.preventDefault()

                router.push(animationsHref)
              }}
            >
              {appText(CMS_KEYS.ANIMATIONS)}
            </a>
          </span>
          {/* Localized sitemap page — SPA-routed like the legal items,
              glued to its own leading sep. */}
          <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
            {appText(SECTION_UI_KEYS.SITEMAP)}
          </h3>
          <span className={AWARDS_CLASSES.AWARDS_FOOTER_PAIR}>
            <span className={AWARDS_CLASSES.AWARDS_FOOTER_SEP}>&bull;</span>
            <a
              className={AWARDS_CLASSES.AWARDS_FOOTER_ITEM}
              href={sitemapHref}
              onClick={(e: Event) => {
                if (!isPlainClick(e)) return

                e.preventDefault()

                router.push(sitemapHref)
              }}
            >
              {appText(SECTION_UI_KEYS.SITEMAP)}
            </a>
          </span>
          {/* Locale RSS feed — last nav item, glued to its own leading
              sep; the delegated click handler skips the feed class so
              the browser fetches the XML file. */}
          <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
            {appText(SECTION_UI_KEYS.RSS_FEED)}
          </h3>
          <span className={AWARDS_CLASSES.AWARDS_FOOTER_PAIR}>
            <span className={AWARDS_CLASSES.AWARDS_FOOTER_SEP}>&bull;</span>
            <a
              className={`${AWARDS_CLASSES.AWARDS_FOOTER_ITEM} ${AWARDS_CLASSES.AWARDS_FOOTER_FEED}`}
              href={feedHrefFor(locale)}
              type={NET_STRINGS.MIME_RSS}
            >
              {feedGlyph(
                AWARDS_CLASSES.AWARDS_FOOTER_FEED_ICON,
                AWARDS_CLASSES.AWARDS_FOOTER_FEED_WAVE
              )}
              {appText(SECTION_UI_KEYS.RSS_FEED)}
            </a>
          </span>
        </nav>

        <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
          {componentText(SOURCE_COMPONENT_KEYS.SOURCE_LABEL)}
        </h3>
        <p className={FOOTER_CLASSES.FOOTER_SOURCE}>
          {componentText(SOURCE_COMPONENT_KEYS.SOURCE_LABEL)}
          {CHAR_STRINGS.SPACE_CHAR}
          <a
            className={FOOTER_CLASSES.FOOTER_SOURCE_LINK}
            href={SOCIAL_URLS.GITHUB_REPO}
            target={DOM_STRINGS.BLANK}
            rel={DOM_STRINGS.NOOPENER}
          >
            {componentText(SOURCE_COMPONENT_KEYS.SOURCE_LINK)}
          </a>
        </p>
      </div>

      {/* Docs-portal entry — English title/route, localized description.
          Heading before the link so AT heading-jump reaches it. */}
      <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
        {DOCS_STRINGS.TITLE}
      </h3>
      <p className={FOOTER_CLASSES.FOOTER_DOCS}>
        <a
          className={FOOTER_CLASSES.FOOTER_DOCS_LINK}
          href={ROUTE_PATHS.DOCS}
          onClick={(e: Event) => {
            if (!isPlainClick(e)) return

            e.preventDefault()

            router.push(ROUTE_PATHS.DOCS)
          }}
        >
          {DOCS_STRINGS.TITLE}
          <span
            className={FOOTER_CLASSES.FOOTER_DOCS_ARROW}
            {...{ [ARIA_ATTRS.ARIA_HIDDEN]: ATTR_VALUES.TRUE }}
          >
            {CHAR_STRINGS.ARROW_RIGHT}
          </span>
        </a>
        {CHAR_STRINGS.SPACE_CHAR}
        <span className={FOOTER_CLASSES.FOOTER_DOCS_DESC}>
          {String(
            componentText(`${DOCS_STRINGS.CMS_COMPONENT}.description`) || DOCS_STRINGS.DESC_FALLBACK
          )}
        </span>
      </p>

      {/* Animated hairline above the authorship block — same sheen
          pattern as the internals footer divider. */}
      <hr className={FOOTER_CLASSES.FOOTER_DIVIDER} aria-hidden={ATTR_VALUES.TRUE} />

      <p className={FOOTER_CLASSES.FOOTER_CREDIT}>
        {componentText(SOURCE_COMPONENT_KEYS.SOURCE_CREDIT)}
      </p>

      <p className={FOOTER_CLASSES.FOOTER_RIGHTS}>{renderRights()}</p>
    </footer>
  )
}
