/**
 * @file home/awards/render.tsx
 * @description JSX template for <awards-mentions> — the footer band with
 * section title + circular progress arc, the auto-advancing carousel (or
 * skeleton badges while items load), the legal links row routed through
 * the SPA router, and the source credit line.
 */

import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { AWC_CLASSES } from '@core/tokens/classes/awards-carousel.js'
import { FOOTER_CLASSES } from '@core/tokens/classes/footer.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { A11Y_UI_KEYS, AWARDS_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { h, Fragment } from '@core/jsx.js'
import { isPlainClick } from '@core/utils/dom.js'
import '@website/components/media/DrawText.js'
import router from '@core/router/router.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { appText, componentText, indexedText, rightsParts } from '@core/locale/ui-text.js'
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

  return (
    <footer className={AWARDS_CLASSES.AWARDS_FOOTER}>
      {/* Landmark heading for AT navigation — sr-only + data-nosnippet:
          a jump target ('Footer > …'), never indexed. */}
      <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
        {appText(A11Y_UI_KEYS.A11Y_FOOTER)}
      </h2>
      <div className={AWARDS_CLASSES.AWARDS_FOOTER_HEADER}>
        <h3 className={AWARDS_CLASSES.AWARDS_FOOTER_TITLE}>
          <draw-text text={el.title}>{el.title}</draw-text>
        </h3>

        <div
          className={AWARDS_CLASSES.AWARDS_FOOTER_PROGRESS}
          role="progressbar"
          aria-label={appText(AWARDS_UI_KEYS.AWARDS_NEXT)}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
        >
          <div className={AWARDS_CLASSES.AWARDS_FOOTER_PROGRESS_FILL} />
        </div>
      </div>

      {el.items && el.items.length ? (
        // Hidden navigation heading for the carousel — the ordinal
        // template ('Carousel 1' localized). sr-only + data-nosnippet: an
        // a11y jump target, never indexed.
        <Fragment>
          <h4 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
            {indexedText(A11Y_UI_KEYS.A11Y_CAROUSEL, 1)}
          </h4>
          <awards-carousel className={AWC_CLASSES.AWC_AWARDS} />
        </Fragment>
      ) : (
        <div className={AWARDS_CLASSES.AWARDS_FOOTER_SKEL}>
          <span className={SKELETON_CLASSES.SKELETON_BADGE} />
          <span className={SKELETON_CLASSES.SKELETON_BADGE} />
          <span className={SKELETON_CLASSES.SKELETON_BADGE} />
        </div>
      )}

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
            {i < links.length - 1 && (
              <span className={AWARDS_CLASSES.AWARDS_FOOTER_SEP}>&bull;</span>
            )}
          </Fragment>
        ))}
      </nav>

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
        </a>
        {CHAR_STRINGS.SPACE_CHAR}
        <span className={FOOTER_CLASSES.FOOTER_DOCS_DESC}>
          {String(
            componentText(`${DOCS_STRINGS.CMS_COMPONENT}.description`) || DOCS_STRINGS.DESC_FALLBACK
          )}
        </span>
      </p>

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
