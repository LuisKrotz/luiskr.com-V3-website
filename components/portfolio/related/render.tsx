/**
 * @file portfolio/related/render.tsx — shadow-DOM template for
 * <portfolio-related>: footer title (translated or skeleton), the
 * related-mosaic card strip (real cards or skeleton tiles), and the
 * socials/disclaimer row.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { webpIfExists } from '@core/utils/media/manifest.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { ROUTER_CLASSES } from '@core/tokens/classes/router.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { SOURCE_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h, Fragment } from '@core/jsx.js'
import { componentText, rightsParts } from '@core/locale/ui-text.js'
import { getFallbackLegalLinks } from '@core/utils/data/legal-links.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import type { RelatedCard, RelatedSocial } from './types.js'
import type { PortfolioRelated } from '../Related.js'

/** Skeleton-tile count matching the loaded mosaic's geometry. */
const SKELETON_TILES = [1, 2, 3, 4, 5, 6]

/** Skeleton social-link placeholder count. */
const SKELETON_SOCIALS = 4

/** One related-project card (link + cover + title/description). */
const renderCard = (project: RelatedCard, isCurrent: boolean) => {
  const activeClass = isCurrent ? ROUTER_CLASSES.ROUTER_LINK_ACTIVE : ATTR_VALUES.EMPTY

  // <source> selection is type-based — a 404 webp never falls back to the
  // <img>, so the variant is offered only when the bucket manifest lists it.
  const coverWebp = webpIfExists(project.imageSrc)

  return (
    <a
      href={project.fullPath}
      className={`${RELATED_CLASSES.RELATED_MOSAIC_ITEM} ${project.featured ? RELATED_CLASSES.RELATED_MOSAIC_ITEM_FEATURED : CHAR_STRINGS.EMPTY} ${activeClass}`}
      onClick={(e: Event) => {
        e.preventDefault()

        if (project.fullPath) router.push(project.fullPath)
      }}
    >
      <div className={RELATED_CLASSES.RELATED_MOSAIC_MEDIA}>
        {project.imageSrc ? (
          <picture>
            {coverWebp && <source srcset={coverWebp} type={MEDIA_ATTRS.IMAGE_WEBP} />}

            <img
              src={project.imageSrc}
              alt={project.description || ATTR_VALUES.EMPTY}
              className={RELATED_CLASSES.RELATED_MOSAIC_IMG}
              loading={MEDIA_ATTRS.LOADING_LAZY}
              decoding={MEDIA_ATTRS.DECODING_ASYNC}
            />
          </picture>
        ) : (
          <div className={SKELETON_CLASSES.SKELETON_MEDIA} />
        )}
        <div className={RELATED_CLASSES.RELATED_MOSAIC_OVERLAY} />
      </div>
      <div className={RELATED_CLASSES.RELATED_MOSAIC_INFO}>
        <span className={RELATED_CLASSES.RELATED_MOSAIC_TITLE}>{project.page}</span>
        {project.description ? (
          <div className={RELATED_CLASSES.RELATED_MOSAIC_DESC}>
            <draw-text text={project.description} delay={ATTR_VALUES.DELAY_25} />
          </div>
        ) : null}
      </div>
    </a>
  )
}

/** Skeleton mosaic — tiles 1 and 3-6 carry the featured modifier so the shimmer matches the loaded layout. */
const renderSkeletonMosaic = () => (
  <div className={RELATED_CLASSES.RELATED_MOSAIC}>
    {SKELETON_TILES.map((n) => (
      <div
        key={n}
        className={`${RELATED_CLASSES.RELATED_MOSAIC_ITEM} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${n === 1 || n >= 3 ? RELATED_CLASSES.RELATED_MOSAIC_ITEM_FEATURED : CHAR_STRINGS.EMPTY}`}
      />
    ))}
  </div>
)

/** Back-home link — first item of the footer's link row (localized route +
    label), resolved through the same live-then-fallback path <legal-footer>
    uses. The -home modifier sets the label in lowercase. */
const renderHomeLink = () => {
  const home = getFallbackLegalLinks(store.getters.getLang())[0]

  return (
    <Fragment>
      <a
        className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_HOME}`}
        href={home.link}
        onClick={(e: Event) => {
          e.preventDefault()

          router.push(home.link)
        }}
      >
        {home.page}
      </a>
      <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP}>{CHAR_STRINGS.DOT_SEP}</span>
    </Fragment>
  )
}

/** Authorship block — animated hairline + self-made credit + copyright
    with ©/year set in bold. */
const renderCreditBlock = () => {
  const r = rightsParts()

  return (
    <Fragment>
      <hr
        className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER}
        aria-hidden={ATTR_VALUES.TRUE}
      />
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
    </Fragment>
  )
}

/** Social links + separator dots + the HTML disclaimer note. */
const renderSocials = (host: PortfolioRelated, socials: RelatedSocial[]) => (
  <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS}>
    {renderHomeLink()}
    {socials.map((social, socialkey) => (
      <Fragment key={socialkey}>
        <a
          href={social.link}
          target={DOM_STRINGS.BLANK}
          rel={DOM_STRINGS.NOOPENER}
          className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK}
        >
          {social.network}
        </a>
        {socialkey < socials.length - 1 && (
          <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP}>{CHAR_STRINGS.DOT_SEP}</span>
        )}
      </Fragment>
    ))}
    {/* Animated hairline separating the socials row from the note below. */}
    <hr className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER} aria-hidden={ATTR_VALUES.TRUE} />
    {/*
      Disclaimer: justified text clamped to its first line (CSS ellipsis)
      inside -note-text; the trailing -note-more dots pulse while the note
      is truncated and collapsed — the "show more" affordance. The whole
      thing is a real <button> so Enter/Space expand it and screen readers
      get aria-expanded; is-truncated is measured from the DOM because CSS
      cannot detect whether line-clamp actually clipped.
    */}
    <button
      type={FORM_ATTRS.TYPE_BUTTON}
      className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE} ${host._noteOpen ? STATE_CLASSES.IS_OPEN : CHAR_STRINGS.EMPTY} ${host._noteTruncated ? STATE_CLASSES.IS_TRUNCATED : CHAR_STRINGS.EMPTY}`}
      aria-expanded={host._noteOpen ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE}
      onClick={() => host._toggleNote()}
    >
      <span
        className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_TEXT}
        dangerouslySetInnerHTML={{ __html: host.translations.note || CHAR_STRINGS.EMPTY }}
      />
      <span
        className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_MORE}
        aria-hidden={ATTR_VALUES.TRUE}
      >
        {[0, 1, 2].map((i) => (
          <i key={i} className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_DOT} />
        ))}
      </span>
    </button>
    {renderCreditBlock()}
  </div>
)

/** Skeleton socials row — placeholder link pills + note bars. */
const renderSkeletonSocials = () => (
  <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS} data-nosnippet>
    {renderHomeLink()}
    {Array.from({ length: SKELETON_SOCIALS }, (_, i) => (
      <Fragment key={i}>
        <span
          className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK} ${SKELETON_CLASSES.SKELETON_FOOTER_LINK}`}
        />
        {i < SKELETON_SOCIALS - 1 && (
          <span className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_SEP}>{CHAR_STRINGS.DOT_SEP}</span>
        )}
      </Fragment>
    ))}
    <hr className={INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_DIVIDER} aria-hidden={ATTR_VALUES.TRUE} />
    {[SKELETON_CLASSES.SKELETON_FOOTER_NOTE_1, SKELETON_CLASSES.SKELETON_FOOTER_NOTE_2].map(
      (cls) => (
        <p key={cls} className={`${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE} ${cls}`} />
      )
    )}
    {renderCreditBlock()}
  </div>
)

/** JSX template for the component's shadow DOM. */
export function renderRelated(host: PortfolioRelated) {
  const projects = host.projectsList

  // Firebase may deliver list nodes as keyed objects (CMS writes) — the same
  // normalization related/match.ts applies to `projects`; a raw object would
  // throw on .map inside renderSocials and take the whole footer down.
  const rawSocials = host.translations?.socials

  const socials: RelatedSocial[] = Array.isArray(rawSocials)
    ? rawSocials
    : rawSocials
      ? Object.values(rawSocials)
      : []

  const currentPath =
    typeof window !== TYPE_STRINGS.UNDEFINED
      ? window.location.pathname.replace(/\/$/, CHAR_STRINGS.EMPTY)
      : ATTR_VALUES.EMPTY

  const isCurrent = (project: RelatedCard) =>
    Boolean(project.link) &&
    (currentPath.endsWith(`${ROUTE_PATHS.ROOT}${project.link}`) ||
      currentPath.endsWith(`${ROUTE_PATHS.ROOT}${project.page}`))

  return (
    <footer className={INTERNAL_CLASSES.INTERNAL_FOOTER}>
      <h2 className={INTERNAL_CLASSES.INTERNAL_FOOTER_TITLE}>
        {host.translations?.title ? (
          <draw-text
            text={host.translations.title}
            dangerouslySetInnerHTML={{ __html: host.translations.title }}
          />
        ) : (
          <span className={SKELETON_CLASSES.SKELETON_TITLE_SM} />
        )}
      </h2>

      <div className={INTERNAL_CLASSES.INTERNAL_FOOTER_RELATED}>
        {projects.length ? (
          <div className={RELATED_CLASSES.RELATED_MOSAIC}>
            {projects.map((project, projectkey) => (
              <Fragment key={projectkey}>{renderCard(project, isCurrent(project))}</Fragment>
            ))}
          </div>
        ) : (
          renderSkeletonMosaic()
        )}
      </div>

      {rawSocials ? renderSocials(host, socials) : renderSkeletonSocials()}
    </footer>
  )
}
