/**
 * @file mosaic-render.tsx — shadow-DOM template for <home-mosaic>:
 * section title (draw-text or shimmer), the packed card wall, and the
 * skeleton placeholder wall shown while project data loads.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { IMAGE_SIZES } from '@core/tokens/media/sizes.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import {
  coverVariants,
  mediaManifestReady,
  mediaManifestFailed,
} from '@core/utils/media/manifest.js'
import { coverLadderStep, encodeMediaUrl } from '@core/utils/media.js'
import { svgPlaceholder } from '@core/utils/dom.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { h } from '@core/jsx.js'
import type { MosaicItem } from './pack.js'
import type { HomeMosaic } from '../HomeMosaic.js'
import { projectHref } from './interactions.js'
import { SKELETON_MOSAIC } from '@core/tokens/motion/skeleton.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'

interface MosaicTranslations {
  featured?: string
  explore?: string
}

/** Style object for one skeleton placeholder box. */
export function skeletonStyle(box: { top: number; left: number; w: number; h: number }): string {
  return `position: absolute; top: ${box.top}px; left: ${box.left}px; width: ${box.w}px; height: ${box.h}px;`
}

/** One packed card — media, title overlay, and expandable details. */
function renderCard(host: HomeMosaic, item: MosaicItem, i: number, exploreText?: string) {
  const expanded = host.hoveredIdx === i || host.touchIdx === i

  // Emission-encoded — cover basenames can resolve to bucket keys with
  // literal spaces ('brazilian leather/…') which break srcset parsing.
  const coverSrc = encodeMediaUrl(`${host.storage}${DB_PATHS.COVERS}${item.image}${host.ext}`)

  // Manifest-gated progressive matrix — the kodak LQIP (plus its 768px
  // mobile tier and webp siblings) paints first; the high layer then
  // climbs the proven rungs (q50 → q75 → original → uncompressed) over
  // it, each confirmed tier swapped into the same painted box. Every
  // variant is manifest-proven; no LQIP ⇒ the original stands alone.
  const covers = coverVariants(coverSrc)

  const isLcpTile = i < SKELETON_MOSAIC.MOSAIC_LCP_TILES

  const decoding = isLcpTile ? MEDIA_ATTRS.DECODING_SYNC : MEDIA_ATTRS.DECODING_ASYNC

  const loading = isLcpTile ? MEDIA_ATTRS.LOADING_EAGER : MEDIA_ATTRS.LOADING_LAZY

  const fetchpriority = isLcpTile ? MEDIA_ATTRS.FETCH_PRIORITY_HIGH : MEDIA_ATTRS.FETCH_PRIORITY_LOW

  // The loaded class rides on the markup when the cover already upgraded
  // — _updateDom rebuilds every card node, so without the registry the
  // fade would replay from opacity 0 on each hover/translations render.
  // The registry holds the highest confirmed tier, so a rebuilt card
  // re-emits that rung directly and the ladder resumes from there.
  const reached = host._loadedCovers?.get(coverSrc)

  const alreadyLoaded = covers.rungs.length > 0 && Boolean(reached)

  return (
    <a
      key={item.link || i}
      className={`${HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM} ${item.featured ? HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM_FEATURED : ATTR_VALUES.EMPTY}`}
      data-index={i}
      href={projectHref(item)}
      style={host.cards[i]?.card || ATTR_VALUES.EMPTY}
    >
      <div
        className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_MEDIA}
        style={host.cards[i]?.media || ATTR_VALUES.EMPTY}
      >
        <img
          className={`${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG} ${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_PLACEHOLDER}`}
          src={svgPlaceholder(GENERIC_DIMENSIONS.DEFAULT_WIDTH, GENERIC_DIMENSIONS.DEFAULT_HEIGHT)}
          alt={ATTR_VALUES.EMPTY}
          aria-hidden={ATTR_VALUES.TRUE}
          width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
          height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
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

          {/* The manifest is boot-idle-deferred: until it settles the real
              URL stays off the wire — the LQIP placeholder owns the box, so
              a never-proven original can't drag a ~300KB jpg into the
              LCP/first-payload budget. On arrival the manifest listener
              re-renders with proven thumbs/webp. */}
          <img
            decoding={decoding}
            loading={loading}
            fetchpriority={fetchpriority}
            className={`${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG} ${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_THUMB}`}
            src={
              mediaManifestReady() || mediaManifestFailed()
                ? covers.src
                : svgPlaceholder(
                    GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                    GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                  )
            }
            alt={item.label || item.title || ATTR_VALUES.EMPTY}
            width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
            height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
            sizes={IMAGE_SIZES.HOME_MOSAIC}
          />
        </picture>

        {/* Degenerate ladders (the original is the ONLY proven rung) can't
            pay a full-res fetch a card box resolves — the entry img then
            rides the already-warm kodak thumb URL (a cache hit, zero new
            bytes) and its original-webp <source> stays out of the DOM.
            Real ladders still enter at their lightest rung. */}
        {covers.rungs.length > 0 && (
          <picture>
            {/* Mobile-stem entry rung for ≤768px viewports — the climb
                continues on covers.mobileRungs once it paints, so the
                first fetch is already the 768px-wide derivative. */}
            {!reached && covers.mobileRungs.length > 0 && (
              <source
                media={MEDIA_QUERIES.MAX_WIDTH_768}
                srcset={covers.mobileRungs[0].webp || covers.mobileRungs[0].jpg}
                type={covers.mobileRungs[0].webp ? MEDIA_ATTRS.IMAGE_WEBP : undefined}
              />
            )}

            {!reached && covers.rungs[0].jpg !== coverSrc && covers.rungs[0].webp && (
              <source srcset={covers.rungs[0].webp} type={MEDIA_ATTRS.IMAGE_WEBP} />
            )}

            <img
              decoding={decoding}
              loading={loading}
              fetchpriority={fetchpriority}
              className={`${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG} ${HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_HIGH} ${alreadyLoaded ? HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_LOADED : ATTR_VALUES.EMPTY}`}
              src={reached || (covers.rungs[0].jpg === coverSrc ? covers.src : covers.rungs[0].jpg)}
              alt={ATTR_VALUES.EMPTY}
              aria-hidden={ATTR_VALUES.TRUE}
              width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
              height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
              sizes={IMAGE_SIZES.HOME_MOSAIC}
              onLoad={(e: Event) =>
                coverLadderStep(
                  host._loadedCovers,
                  coverSrc,
                  e.currentTarget as HTMLImageElement,
                  covers.rungs,
                  HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_LOADED,
                  covers.mobileRungs
                )
              }
            />
          </picture>
        )}
        <div className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE_OVERLAY}>
          <h2 className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE}>
            {item.label || item.title || ATTR_VALUES.EMPTY}
          </h2>
        </div>
      </div>
      <div
        className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_BOTTOM}
        style={host.cards[i]?.bottom || ATTR_VALUES.EMPTY}
      >
        <div className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_DETAILS} data-index={i}>
          {item.description && expanded && (
            <p className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_DESC}>
              <draw-text text={item.description} delay={CHAR_STRINGS.DELAY_30} />
            </p>
          )}
          <span className={HOME_MOSAIC_CLASSES.HOME_MOSAIC_BTN}>{exploreText}</span>
        </div>
      </div>
    </a>
  )
}

/** Skeleton wall shown until processedItems lands. */
function renderSkeletonWall(host: HomeMosaic) {
  const skel = host._packSkeleton()

  return (
    <div
      className={HOME_MOSAIC_CLASSES.HOME_MOSAIC}
      style={{
        position: STATE_STRINGS.RELATIVE,
        width: CHAR_STRINGS.PERCENT_100,
        height: `${skel.height}px`,
      }}
    >
      {skel.boxes.map((box, idx) => (
        <div key={idx} className={SKELETON_CLASSES.SKELETON_SHIMMER} style={skeletonStyle(box)} />
      ))}
    </div>
  )
}

/** JSX template for the component's shadow DOM. */
export function renderMosaic(host: HomeMosaic) {
  const homeFallback = FALLBACK_PAGES[TRANSLATION_KEYS.HOME] as MosaicTranslations | undefined

  const featuredText = host.translations?.featured || ATTR_VALUES.EMPTY

  const exploreText = host.translations?.explore || homeFallback?.explore

  return (
    <section className={HOME_MOSAIC_CLASSES.HOME_PORTFOLIO_SECTION}>
      <h1
        className={HOME_MOSAIC_CLASSES.HOME_SECTION_TITLE}
        aria-label={featuredText || homeFallback?.featured}
      >
        {host.translations ? (
          <draw-text text={featuredText} fit={ATTR_VALUES.EMPTY} />
        ) : (
          <span
            aria-hidden={ATTR_VALUES.TRUE}
            className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_TITLE_MD}`}
          />
        )}
      </h1>

      {host.processedItems.length ? (
        <div
          className={HOME_MOSAIC_CLASSES.HOME_MOSAIC}
          style={{
            position: STATE_STRINGS.RELATIVE,
            width: CHAR_STRINGS.PERCENT_100,
            height: host.containerH,
          }}
        >
          {host.processedItems.map((item, i) => renderCard(host, item, i, exploreText))}
        </div>
      ) : (
        renderSkeletonWall(host)
      )}
    </section>
  )
}
