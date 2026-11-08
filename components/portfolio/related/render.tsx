/**
 * @file portfolio/related/render.tsx — shadow-DOM template for
 * <portfolio-related>: the related strip title (translated or skeleton)
 * and the related-list conveyor (real rows or skeleton tiles). The site
 * footer chrome that used to live here now belongs to <legal-footer>.
 *
 * The list is an accordion conveyor: the first RELATED_LAYOUT.VISIBLE_COUNT
 * rows render unfolded; the rest carry --closed (zero-height grid slot +
 * inert/aria-hidden) until a manual step in Related.tsx folds the top
 * row and unfolds the next — the wrap back to the first item lands through
 * the same expand-from-collapsed motion. Steps are user-driven only
 * (prev/next buttons, ↑/↓ keys) — no autoplay.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import {
  coverVariants,
  mediaManifestReady,
  mediaManifestFailed,
} from '@core/utils/media/manifest.js'
import { coverLadderStep } from '@core/utils/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { ROUTER_CLASSES } from '@core/tokens/classes/router.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { RELATED_LAYOUT } from '@core/tokens/motion/related.js'
import { h, Fragment } from '@core/jsx.js'
import { isPlainClick, svgPlaceholder } from '@core/utils/dom.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { IMAGE_SIZES } from '@core/tokens/media/sizes.js'
import { appText } from '@core/locale/ui-text.js'
import { CAROUSEL_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import type { RelatedCard } from './types.js'
import type { PortfolioRelated } from '../Related.js'

/** Skeleton-row count matching the loaded list's three-card window. */
const SKELETON_TILES = [1, 2, 3]

/** One related-project row (link + media column + title/description). */
const renderCard = (
  host: PortfolioRelated,
  project: RelatedCard,
  isCurrent: boolean,
  closed: boolean
) => {
  const activeClass = isCurrent ? ROUTER_CLASSES.ROUTER_LINK_ACTIVE : ATTR_VALUES.EMPTY

  // Manifest-gated progressive matrix — the kodak LQIP (mobile tier +
  // webp siblings) paints first; the high layer then climbs the proven
  // rungs (q50 → q75 → original → uncompressed) over it, each confirmed
  // tier swapped into the same painted box. Every variant is
  // manifest-proven so no <source> can 404 into a dead card.
  const covers = coverVariants(project.imageSrc)

  // The loaded class rides on the markup when the cover already upgraded
  // — _updateDom rebuilds every row node, so without the registry the
  // fade would replay from opacity 0 on each re-render. The registry
  // holds the highest confirmed tier, so a rebuilt card re-emits that
  // rung directly and the ladder resumes from there.
  const reached = project.imageSrc ? host._loadedCovers?.get(project.imageSrc) : undefined

  const alreadyLoaded = covers.rungs.length > 0 && Boolean(reached)

  // The placeholder + high layers are aria-hidden duplicates of the
  // thumb, so they share its alt: screen readers skip them, and audit
  // crawlers counting alt="" as missing still see text on every <img>.
  const altText = project.description || project.link || ATTR_VALUES.EMPTY

  return (
    <a
      href={project.fullPath}
      className={`${RELATED_CLASSES.RELATED_LIST_ITEM} ${closed ? RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED : CHAR_STRINGS.EMPTY} ${activeClass}`}
      aria-hidden={closed ? ATTR_VALUES.TRUE : undefined}
      inert={closed}
      onClick={(e: Event) => {
        // Modified/middle clicks keep native anchor semantics (new tab).
        if (!isPlainClick(e)) return

        e.preventDefault()

        if (project.fullPath) router.push(project.fullPath)
      }}
    >
      <div className={RELATED_CLASSES.RELATED_LIST_INNER}>
        <div className={RELATED_CLASSES.RELATED_LIST_MEDIA}>
          {project.imageSrc ? (
            <Fragment>
              <img
                className={`${RELATED_CLASSES.RELATED_LIST_IMG} ${RELATED_CLASSES.RELATED_LIST_IMG_PLACEHOLDER}`}
                src={svgPlaceholder(
                  project.imageW || GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                  project.imageH || GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                )}
                alt={altText}
                aria-hidden={ATTR_VALUES.TRUE}
                width={project.imageW || GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                height={project.imageH || GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
              />

              <picture>
                {(covers.mobileWebp || covers.mobileJpg) && (
                  <source
                    media={MEDIA_QUERIES.MAX_WIDTH_768}
                    srcset={covers.mobileWebp || covers.mobileJpg}
                    type={covers.mobileWebp ? MEDIA_ATTRS.IMAGE_WEBP : undefined}
                  />
                )}

                {covers.webp && <source srcset={covers.webp} type={MEDIA_ATTRS.IMAGE_WEBP} />}

                {/* The manifest is boot-idle-deferred: until it settles the
                    real URL stays off the wire — the LQIP placeholder owns
                    the box, so a never-proven original can't drag a ~300KB
                    jpg into the LCP/first-payload budget. On arrival the
                    manifest listener re-renders with proven thumbs/webp. */}
                <img
                  src={
                    mediaManifestReady() || mediaManifestFailed()
                      ? covers.src
                      : svgPlaceholder(
                          project.imageW || GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                          project.imageH || GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                        )
                  }
                  alt={altText}
                  className={`${RELATED_CLASSES.RELATED_LIST_IMG} ${RELATED_CLASSES.RELATED_LIST_IMG_THUMB}`}
                  loading={MEDIA_ATTRS.LOADING_LAZY}
                  decoding={MEDIA_ATTRS.DECODING_ASYNC}
                  width={project.imageW || GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                  height={project.imageH || GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
                  sizes={IMAGE_SIZES.RELATED_LIST}
                />
              </picture>

              {/* Degenerate ladders (the original is the ONLY proven rung)
                  can't pay a full-res fetch a card box resolves — the entry
                  img then rides the already-warm kodak thumb URL (a cache
                  hit, zero new bytes) and its original-webp <source> stays
                  out of the DOM. Real ladders still enter at their lightest
                  rung. */}
              {covers.rungs.length > 0 && (
                <picture>
                  {/* Mobile-stem entry rung for ≤768px viewports — the
                      climb continues on covers.mobileRungs once it paints. */}
                  {!reached && covers.mobileRungs.length > 0 && (
                    <source
                      media={MEDIA_QUERIES.MAX_WIDTH_768}
                      srcset={covers.mobileRungs[0].webp || covers.mobileRungs[0].jpg}
                      type={covers.mobileRungs[0].webp ? MEDIA_ATTRS.IMAGE_WEBP : undefined}
                    />
                  )}

                  {!reached && covers.rungs[0].jpg !== project.imageSrc && covers.rungs[0].webp && (
                    <source srcset={covers.rungs[0].webp} type={MEDIA_ATTRS.IMAGE_WEBP} />
                  )}

                  <img
                    src={
                      reached ||
                      (covers.rungs[0].jpg === project.imageSrc ? covers.src : covers.rungs[0].jpg)
                    }
                    alt={altText}
                    aria-hidden={ATTR_VALUES.TRUE}
                    className={`${RELATED_CLASSES.RELATED_LIST_IMG} ${RELATED_CLASSES.RELATED_LIST_IMG_HIGH} ${alreadyLoaded ? RELATED_CLASSES.RELATED_LIST_IMG_LOADED : ATTR_VALUES.EMPTY}`}
                    loading={MEDIA_ATTRS.LOADING_LAZY}
                    decoding={MEDIA_ATTRS.DECODING_ASYNC}
                    width={project.imageW || GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                    height={project.imageH || GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
                    sizes={IMAGE_SIZES.RELATED_LIST}
                    onLoad={(e: Event) =>
                      coverLadderStep(
                        host._loadedCovers,
                        project.imageSrc,
                        e.currentTarget as HTMLImageElement,
                        covers.rungs,
                        RELATED_CLASSES.RELATED_LIST_IMG_LOADED,
                        covers.mobileRungs
                      )
                    }
                  />
                </picture>
              )}
            </Fragment>
          ) : (
            <div className={SKELETON_CLASSES.SKELETON_MEDIA} />
          )}
        </div>
        <div className={RELATED_CLASSES.RELATED_LIST_INFO}>
          {/* Project name is the card's heading — real <h3> under the
              footer's h2, not a lookalike div (text_block_heading). */}
          <h3 className={RELATED_CLASSES.RELATED_LIST_TITLE}>{project.page}</h3>
          {project.description ? (
            <div className={RELATED_CLASSES.RELATED_LIST_DESC}>
              <draw-text text={project.description} delay={ATTR_VALUES.DELAY_25} />
            </div>
          ) : null}
        </div>
      </div>
    </a>
  )
}

/** Skeleton list — three shimmer rows matching the loaded window. */
const renderSkeletonList = () => (
  <div className={RELATED_CLASSES.RELATED_LIST}>
    {SKELETON_TILES.map((n) => (
      <div key={n} className={RELATED_CLASSES.RELATED_LIST_ITEM}>
        <div
          className={`${RELATED_CLASSES.RELATED_LIST_INNER} ${SKELETON_CLASSES.SKELETON_SHIMMER}`}
        />
      </div>
    ))}
  </div>
)

/** JSX template for the component's shadow DOM. */
export function renderRelated(host: PortfolioRelated) {
  const projects = host.projectsList

  // Stepping needs something to fold INTO — a list that fits its window
  // (≤ VISIBLE_COUNT rows) renders fully open, and reduced-motion pins the
  // same static layout (the conveyor is motion by definition).
  const cycling =
    !store.getters.getReducedMotion() && projects.length > RELATED_LAYOUT.VISIBLE_COUNT

  const currentPath =
    typeof window !== TYPE_STRINGS.UNDEFINED
      ? window.location.pathname.replace(/\/$/, CHAR_STRINGS.EMPTY)
      : ATTR_VALUES.EMPTY

  const isCurrent = (project: RelatedCard) =>
    Boolean(project.link) &&
    (currentPath.endsWith(`${ROUTE_PATHS.ROOT}${project.link}`) ||
      currentPath.endsWith(`${ROUTE_PATHS.ROOT}${project.page}`))

  return (
    <section className={INTERNAL_CLASSES.INTERNAL_FOOTER}>
      <h2
        className={INTERNAL_CLASSES.INTERNAL_FOOTER_TITLE}
        aria-hidden={host.translations?.title ? undefined : ATTR_VALUES.TRUE}
      >
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
          <Fragment>
            <div className={RELATED_CLASSES.RELATED_LIST}>
              {projects.map((project, projectkey) => (
                <Fragment key={projectkey}>
                  {renderCard(
                    host,
                    project,
                    isCurrent(project),
                    cycling && projectkey >= RELATED_LAYOUT.VISIBLE_COUNT
                  )}
                </Fragment>
              ))}
              {/* Prev/next step buttons glued to the list's top-right
                  corner — only while the conveyor can rotate (a static
                  list has nothing to step through). Absolute, so the
                  children scans never see them as rows. */}
              {cycling && (
                <div className={RELATED_CLASSES.RELATED_LIST_CONTROLS}>
                  <button
                    type={FORM_ATTRS.TYPE_BUTTON}
                    className={`${RELATED_CLASSES.RELATED_LIST_BTN} ${RELATED_CLASSES.RELATED_LIST_BTN_PREV}`}
                    aria-label={`${appText(CAROUSEL_UI_KEYS.CAROUSEL_PREV)}`}
                    onClick={() => host._stepList(-1)}
                  >
                    <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.ARROW_UP_CHAR}</span>
                  </button>
                  <button
                    type={FORM_ATTRS.TYPE_BUTTON}
                    className={`${RELATED_CLASSES.RELATED_LIST_BTN} ${RELATED_CLASSES.RELATED_LIST_BTN_NEXT}`}
                    aria-label={`${appText(CAROUSEL_UI_KEYS.CAROUSEL_NEXT)}`}
                    onClick={() => host._stepList(1)}
                  >
                    <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.ARROW_DOWN_CHAR}</span>
                  </button>
                </div>
              )}
            </div>
          </Fragment>
        ) : (
          renderSkeletonList()
        )}
      </div>
    </section>
  )
}
