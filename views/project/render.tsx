/**
 * @file routes/views/project/render.tsx
 * @description JSX for ViewProject — title, cover figure, and the section list (text columns + media carousels) with per-section item heights.
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { INTERNAL_CLASSES, PROJECT_CLASSES } from '@core/tokens/classes/project.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { CAROUSEL_CSS_PROPS } from '@core/tokens/css/carousel.js'
import { MOSAIC_CSS_PROPS } from '@core/tokens/css/mosaic.js'
import { A11Y_UI_KEYS, MEDIA_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h, Fragment } from '@core/jsx.js'
import { appText, indexedText } from '@core/locale/ui-text.js'
import { excerptHeading, stripHtml, svgPlaceholder } from '@core/utils/index.js'
import type { ProjectMediaItem, SectionChild } from './types.js'
import type { ViewProject } from './Project.js'
import { COVER_DIMENSIONS, GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'
import { TITLE_MARQUEE } from '@core/tokens/motion/marquee.js'

/**
 * Lead text naming one media carousel — the first item's label; '' lets
 * the caller render the ordinal template alone.
 * @param items the carousel's media rows
 */
const carouselLeadText = (items: ProjectMediaItem[]): string =>
  String(items[0]?.label || ATTR_VALUES.EMPTY)

/**
 * Lead text naming one project section — the first paragraph of its first
 * text block when present, else the first media label; '' lets the caller
 * fall back to the generic ordinal heading.
 * @param section one row of mixed text/media children
 */
const sectionLeadText = (section: SectionChild[]): string => {
  const textChild = section.find((child) => typeof child[0] === TYPE_STRINGS.STRING)

  if (textChild) return String(textChild[0] || ATTR_VALUES.EMPTY)

  const mediaChild = section.find((child) => typeof child[0] !== TYPE_STRINGS.STRING)

  return String((mediaChild as ProjectMediaItem[] | undefined)?.[0]?.label || ATTR_VALUES.EMPTY)
}

/**
 * Renders project.
 * @param c — the component
 */
export function renderProject(c: ViewProject) {
  const t = c.translations

  // Global carousel ordinals — 'Carousel 1, 2, 3…' counts every media
  // block on the page regardless of which section hosts it, so hidden
  // headings stay unique jump targets in a screen reader's heading list.
  let carouselSeq = 0

  const carouselNums = (t?.sections ?? []).map((section) =>
    section.map((child) => (typeof child[0] === TYPE_STRINGS.STRING ? 0 : ++carouselSeq))
  )

  return (
    <article>
      <div id="main" className={`${PROJECT_CLASSES.PROJECT} ${MODAL_CLASSES.MODAL_BELOW}`}>
        <h1
          className={`${INTERNAL_CLASSES.INTERNAL_TITLE} ${INTERNAL_CLASSES.INTERNAL_TITLE_MARQUEE_MOD}`}
          aria-label={t?.title ? stripHtml(t.title) : undefined}
          aria-hidden={t?.title ? undefined : ATTR_VALUES.TRUE}
        >
          {t?.title ? (
            // Uppercase marquee ticker: two identical halves, each repeating
            // "TITLE |" enough times to span the viewport, loop seamlessly
            // on translateX(-50%); aria-hidden because the h1's aria-label
            // already names the heading for AT.
            <span className={INTERNAL_CLASSES.INTERNAL_TITLE_STRIP} aria-hidden={ATTR_VALUES.TRUE}>
              {Array.from({ length: TITLE_MARQUEE.COPIES }, (_, i) => (
                <span key={i} className={INTERNAL_CLASSES.INTERNAL_TITLE_COPY}>
                  {Array.from({ length: c._titleRepeat }, (_, j) => (
                    <span key={j} className={INTERNAL_CLASSES.INTERNAL_TITLE_UNIT}>
                      {stripHtml(t.title as string)}
                      <span className={INTERNAL_CLASSES.INTERNAL_TITLE_SEP}>
                        {CHAR_STRINGS.PIPE_SEP}
                      </span>
                    </span>
                  ))}
                </span>
              ))}
            </span>
          ) : (
            <span className={SKELETON_CLASSES.SKELETON_TITLE_MD} />
          )}
        </h1>

        <div className={INTERNAL_CLASSES.INTERNAL_MAIN}>
          {t?.cover ? (
            <media-figure
              className={INTERNAL_CLASSES.INTERNAL_MAIN_ITEM}
              classes={INTERNAL_CLASSES.INTERNAL_MAIN_ITEM}
              src={(t.folder || ATTR_VALUES.EMPTY) + t.cover.src}
              width={t.cover.size[0]}
              height={t.cover.size[1]}
              is-video={t.cover?.isVideo ?? false}
              auto-play={ATTR_VALUES.TRUE}
              label={t.cover.label || ATTR_VALUES.EMPTY}
            />
          ) : (
            <figure className={INTERNAL_CLASSES.INTERNAL_MAIN_ITEM}>
              <img
                decoding={MEDIA_ATTRS.DECODING_ASYNC}
                className={MEDIA_CLASSES.RENDER_PLACEHOLDER}
                src={svgPlaceholder(COVER_DIMENSIONS.COVER_WIDTH, COVER_DIMENSIONS.COVER_HEIGHT)}
                width={COVER_DIMENSIONS.COVER_WIDTH}
                height={COVER_DIMENSIONS.COVER_HEIGHT}
                // Skeleton paint — no project copy is loaded yet, so the
                // route slug stands in as the crawler-visible alt (the
                // layer is aria-hidden; AT never hears it).
                alt={c.projectSlug}
                aria-hidden={ATTR_VALUES.TRUE}
              />
              <div
                className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${INTERNAL_CLASSES.INTERNAL_MAIN_ITEM} ${MEDIA_CLASSES.RENDER_MEDIA}`}
              />
            </figure>
          )}
        </div>

        {t?.sections ? (
          <div>
            {t.sections.map((section, parentKey) => (
              <div
                key={parentKey}
                style={{
                  [CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT]: c.sectionItemHeight(section),
                  [MOSAIC_CSS_PROPS.MEDIA_MOSAIC_HEIGHT]: c.sectionMosaicHeight(section),
                }}
              >
                {/* Navigation heading (h2) per section — named after the
                    section's own lead text; the numbered template is the
                    fallback for content-less rows. sr-only visually, but the
                    content-derived name stays indexable for agents/SEO. */}
                <h2 className={A11Y_CLASSES.SR_ONLY}>
                  {excerptHeading(sectionLeadText(section)) ||
                    indexedText(A11Y_UI_KEYS.A11Y_SECTION, parentKey + 1)}
                </h2>
                {section.map((child, childKey) => {
                  if (typeof child[0] === TYPE_STRINGS.STRING) {
                    const textItems = child as string[]

                    return (
                      <div key={childKey} className={INTERNAL_CLASSES.INTERNAL_DESCRIPTION}>
                        {/* Body copy is paragraphs, not headings — the page's
                            only real heading is the h1 title (the related
                            block carries its own h2). */}
                        {textItems.map((item, itemKey) => (
                          <p key={itemKey} className={INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT}>
                            <draw-text
                              text={item}
                              trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
                              delay={c.textDelay(textItems)}
                              offset={c.textOffset(textItems, itemKey)}
                            />
                          </p>
                        ))}
                      </div>
                    )
                  } else {
                    const mediaItems = child as ProjectMediaItem[]

                    const lead = excerptHeading(carouselLeadText(mediaItems))

                    return (
                      <Fragment key={childKey}>
                        {/* Carousel heading — the localized ordinal ('Carousel
                            N') plus the carousel's own lead label so the jump
                            target is meaningful, not just a number. sr-only
                            visually; the derived name stays indexable. */}
                        <h3 className={A11Y_CLASSES.SR_ONLY}>
                          {lead
                            ? `${indexedText(A11Y_UI_KEYS.A11Y_CAROUSEL, carouselNums[parentKey][childKey])} ${CHAR_STRINGS.EM_DASH} ${lead}`
                            : indexedText(
                                A11Y_UI_KEYS.A11Y_CAROUSEL,
                                carouselNums[parentKey][childKey]
                              )}
                        </h3>
                        {c.isMosaicGroup(mediaItems) ? (
                          // Irregular-height groups render the natural-size
                          // masonry wall on desktop; <media-mosaic> swaps to
                          // the carousel itself at ≤640px.
                          <media-mosaic
                            {...{
                              [DATA_ATTRS.DATA_SEC_IDX]: parentKey,
                              [DATA_ATTRS.DATA_CAROUSEL_IDX]: childKey,
                            }}
                          />
                        ) : (
                          <custom-carousel
                            {...{
                              [DATA_ATTRS.DATA_SEC_IDX]: parentKey,
                              [DATA_ATTRS.DATA_CAROUSEL_IDX]: childKey,
                            }}
                          />
                        )}
                      </Fragment>
                    )
                  }
                })}
              </div>
            ))}
          </div>
        ) : (
          // Pending-content stand-in: the host reserves flow height while
          // the placeholder paints as an absolute overlay inside it — a
          // flow-positioned placeholder's removal counts its vacated area
          // as a layout shift (measured ~0.16 CLS), while the overlay's
          // removal moves no sibling box.
          <div className={SKELETON_CLASSES.SKELETON_HOST}>
            <div className={SKELETON_CLASSES.SKELETON_OVERLAY}>
              {/* Same wrapper + carousel height var as the loaded block, so content lands without a shift */}
              <div
                style={{
                  [CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT]: CAROUSEL_LAYOUT.SKELETON_ITEM_HEIGHT,
                }}
              >
                <div className={INTERNAL_CLASSES.INTERNAL_DESCRIPTION}>
                  <div
                    aria-hidden={ATTR_VALUES.TRUE}
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_SECTION_TITLE}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_FULL}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_94}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_98}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_FULL}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_65}`}
                  />
                </div>
                <div className={INTERNAL_CLASSES.INTERNAL_EXTRA}>
                  <div className={INTERNAL_CLASSES.INTERNAL_EXTRA_SCROLL}>
                    <div className={INTERNAL_CLASSES.INTERNAL_EXTRA_ITEM}>
                      <figure>
                        <img
                          decoding={MEDIA_ATTRS.DECODING_ASYNC}
                          className={MEDIA_CLASSES.RENDER_PLACEHOLDER}
                          src={svgPlaceholder(
                            GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                            GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                          )}
                          width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                          height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
                          alt={c.projectSlug}
                          aria-hidden={ATTR_VALUES.TRUE}
                        />
                        <div
                          className={`${MEDIA_CLASSES.RENDER_MEDIA} ${SKELETON_CLASSES.SKELETON_MEDIA}`}
                        />
                      </figure>
                    </div>
                    <div className={INTERNAL_CLASSES.INTERNAL_EXTRA_ITEM}>
                      <figure>
                        <img
                          decoding={MEDIA_ATTRS.DECODING_ASYNC}
                          className={MEDIA_CLASSES.RENDER_PLACEHOLDER}
                          src={svgPlaceholder(
                            GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                            GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                          )}
                          width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                          height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
                          alt={c.projectSlug}
                          aria-hidden={ATTR_VALUES.TRUE}
                        />
                        <div
                          className={`${MEDIA_CLASSES.RENDER_MEDIA} ${SKELETON_CLASSES.SKELETON_MEDIA}`}
                        />
                      </figure>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <portfolio-related />

        {/* Shared site footer — the same <legal-footer> the legal and
            animations views mount; it owns the nav/socials/docs/note/
            credit chrome the related strip used to render inline. */}
        <legal-footer />
      </div>

      {/* Modal above: native dialog populated imperatively by _updateModalDOM() */}
      <dialog
        className={MODAL_CLASSES.MODAL_ABOVE}
        aria-label={appText(MEDIA_UI_KEYS.MEDIA_PREVIEW)}
      />
    </article>
  )
}
