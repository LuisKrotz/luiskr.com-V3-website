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
import { A11Y_UI_KEYS, MEDIA_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { h, Fragment } from '@core/jsx.js'
import { appText, indexedText } from '@core/locale/ui-text.js'
import { stripHtml, svgPlaceholder } from '@core/utils/index.js'
import type { ViewProject } from './Project.js'
import { COVER_DIMENSIONS, GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { CAROUSEL_LAYOUT } from '@core/tokens/motion/carousel.js'

/**
 * Renders project.
 * @param c — the component
 */
export function renderProject(c: ViewProject) {
  const t = c.translations

  return (
    <article>
      <div id="main" className={`${PROJECT_CLASSES.PROJECT} ${MODAL_CLASSES.MODAL_BELOW}`}>
        <h1
          className={INTERNAL_CLASSES.INTERNAL_TITLE}
          aria-label={t?.title ? stripHtml(t.title) : undefined}
          aria-hidden={t?.title ? undefined : ATTR_VALUES.TRUE}
        >
          {t?.title ? (
            <draw-text
              text={t.title}
              trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
              fit={ATTR_VALUES.EMPTY}
            />
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
                alt={ATTR_VALUES.EMPTY}
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
                style={{ [CAROUSEL_CSS_PROPS.CAROUSEL_ITEM_HEIGHT]: c.sectionItemHeight(section) }}
              >
                {/* Hidden navigation heading (h2) per section — sr-only +
                    data-nosnippet so assistive tech gets a jump target the
                    crawlers never index. Runtime-only: never prerendered. */}
                <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                  {indexedText(A11Y_UI_KEYS.A11Y_SECTION, parentKey + 1)}
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
                    // Carousel ordinal within THIS section — carousels are
                    // the non-string children, counted up to this child.
                    const carouselIdx = section
                      .slice(0, childKey + 1)
                      .filter((c) => typeof c[0] !== TYPE_STRINGS.STRING).length

                    return (
                      <Fragment key={childKey}>
                        <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                          {indexedText(A11Y_UI_KEYS.A11Y_CAROUSEL, carouselIdx)}
                        </h3>
                        <custom-carousel
                          {...{
                            [DATA_ATTRS.DATA_SEC_IDX]: parentKey,
                            [DATA_ATTRS.DATA_CAROUSEL_IDX]: childKey,
                          }}
                        />
                      </Fragment>
                    )
                  }
                })}
              </div>
            ))}
          </div>
        ) : (
          <div>
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
                        alt={ATTR_VALUES.EMPTY}
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
                        alt={ATTR_VALUES.EMPTY}
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
        )}

        <portfolio-related />
      </div>

      {/* Modal above: native dialog populated imperatively by _updateModalDOM() */}
      <dialog
        className={MODAL_CLASSES.MODAL_ABOVE}
        aria-label={appText(MEDIA_UI_KEYS.MEDIA_PREVIEW)}
      />
    </article>
  )
}
