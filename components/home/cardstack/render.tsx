/**
 * @file cardstack/render.tsx — shadow-DOM template for <card-stack>:
 * the featured title + view-all toggle, the fanned card deck, the
 * counter/hint/nav chrome, the all-projects index panel, and the
 * skeleton fan shown while project data loads.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { BREAKPOINTS } from '@core/tokens/layout/breakpoints.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { IMAGE_SIZES } from '@core/tokens/media/sizes.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { CARD_STACK_LAYOUT } from '@core/tokens/motion/card-stack.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import {
  coverVariants,
  mediaManifestReady,
  mediaManifestFailed,
} from '@core/utils/media/manifest.js'
import { ladderCeiling } from '@core/utils/media/policy.js'
import { IMAGE_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { coverLadderStep, encodeMediaUrl } from '@core/utils/media.js'
import { svgPlaceholder, viewportWidth } from '@core/utils/dom.js'
import { FALLBACK_APP } from '@core/locale/fallback.js'
import { appText } from '@core/locale/ui-text.js'
import { NAV_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import store from '@core/store.js'
import { h, Fragment } from '@core/jsx.js'
import { padNum, tierPose } from './deck.js'
import { cardInfo, projectHref } from './info.js'
import type { CardStackItem, CardStackTranslations } from './types.js'
import type { CardStack } from '../CardStack.js'

const C = CARD_STACK_CLASSES

/**
 * Breaks one `<br>`-free title segment into its two word halves at the
 * middle space — the featured heading always stacks over two lines
 * ("Selected / work") even when the CMS string ships as a single line.
 * One-word segments pass through untouched.
 * @param line A single title segment (no `<br>` markup left).
 * @returns The two half-lines, or the segment itself when it holds a
 *   single word.
 */
function titleLineHalves(line: string): string[] {
  const words = line.trim().split(/\s+/).filter(Boolean)

  if (words.length <= 1) return [line]

  const mid = Math.ceil(words.length / 2)

  return [
    words.slice(0, mid).join(CHAR_STRINGS.SPACE_CHAR),
    words.slice(mid).join(CHAR_STRINGS.SPACE_CHAR),
  ]
}

/** Emission-encoded original cover URL for one item stem. */
function coverSrc(host: CardStack, item: CardStackItem): string {
  return encodeMediaUrl(`${host.storage}${DB_PATHS.COVERS}${item.image}${host.ext}`)
}

/** One coverflow card — a stretched-link cover over the in-card project
 *  copy. Geometry arrives via applyPoses() writes (translate3d + tilt in
 *  the deck's perspective). The media fills the whole card on fan tiers
 *  (the text column carries the copy there); on the stacked phone/
 *  portrait layouts the media crops to the card's top band and the
 *  title/description/link show in the card body — the "entire card"
 *  presentation — so deeper cards' title bands peek below the front. */
function renderCard(host: CardStack, item: CardStackItem, i: number) {
  const src = coverSrc(host, item)

  const covers = coverVariants(src)

  const isEager = i < CARD_STACK_LAYOUT.EAGER_TILES

  const decoding = isEager ? MEDIA_ATTRS.DECODING_SYNC : MEDIA_ATTRS.DECODING_ASYNC

  const loading = isEager ? MEDIA_ATTRS.LOADING_EAGER : MEDIA_ATTRS.LOADING_LAZY

  const fetchpriority = isEager ? MEDIA_ATTRS.FETCH_PRIORITY_HIGH : MEDIA_ATTRS.FETCH_PRIORITY_LOW

  const reached = host._loadedCovers.get(src)

  const alreadyLoaded = covers.rungs.length > 0 && Boolean(reached)

  const altText = item.label || item.title || ATTR_VALUES.EMPTY

  // The 768px `-mobile` derivative stem only ever enters on phone-class
  // viewports — a desktop card climbs the full ladder instead (its CSS
  // box may be ≤768px wide, but the mobile stem's top rung under-resolves
  // it on retina and reads as a blurry upscale).
  const mobileRungs = viewportWidth() <= BREAKPOINTS[768] ? covers.mobileRungs : []

  return (
    <article key={item.link || i} className={C.CARD_STACK_CARD} data-index={i}>
      <a
        className={C.CARD_STACK_CARD_LINK}
        draggable={ATTR_VALUES.FALSE}
        href={projectHref(item)}
        tabindex={i === host.activeIdx ? ATTR_VALUES.TABINDEX_ZERO : ATTR_VALUES.NEGATIVE_TABINDEX}
      >
        <div className={C.CARD_STACK_CARD_MEDIA}>
          <img
            draggable={ATTR_VALUES.FALSE}
            className={`${C.CARD_STACK_CARD_IMG} ${C.CARD_STACK_CARD_IMG_PLACEHOLDER}`}
            src={svgPlaceholder(
              GENERIC_DIMENSIONS.DEFAULT_WIDTH,
              GENERIC_DIMENSIONS.DEFAULT_HEIGHT
            )}
            alt={altText}
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

            <img
              draggable={ATTR_VALUES.FALSE}
              decoding={decoding}
              loading={loading}
              fetchpriority={fetchpriority}
              className={`${C.CARD_STACK_CARD_IMG} ${C.CARD_STACK_CARD_IMG_THUMB}`}
              src={
                mediaManifestReady() || mediaManifestFailed()
                  ? covers.src
                  : svgPlaceholder(
                      GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                      GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                    )
              }
              alt={altText}
              width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
              height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
              sizes={IMAGE_SIZES.CARD_STACK}
            />
          </picture>

          {covers.rungs.length > 0 && (
            <picture>
              {!reached && mobileRungs.length > 0 && (
                <source
                  media={MEDIA_QUERIES.MAX_WIDTH_768}
                  srcset={mobileRungs[0].webp || mobileRungs[0].jpg}
                  type={mobileRungs[0].webp ? MEDIA_ATTRS.IMAGE_WEBP : undefined}
                />
              )}

              {!reached && covers.rungs[0].jpg !== src && covers.rungs[0].webp && (
                <source srcset={covers.rungs[0].webp} type={MEDIA_ATTRS.IMAGE_WEBP} />
              )}

              <img
                draggable={ATTR_VALUES.FALSE}
                decoding={decoding}
                loading={loading}
                fetchpriority={fetchpriority}
                className={`${C.CARD_STACK_CARD_IMG} ${C.CARD_STACK_CARD_IMG_HIGH} ${alreadyLoaded ? C.CARD_STACK_CARD_IMG_LOADED : ATTR_VALUES.EMPTY}`}
                src={reached || (covers.rungs[0].jpg === src ? covers.src : covers.rungs[0].jpg)}
                alt={altText}
                aria-hidden={ATTR_VALUES.TRUE}
                width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
                sizes={IMAGE_SIZES.CARD_STACK}
                onLoad={(e: Event) =>
                  coverLadderStep(
                    host._loadedCovers,
                    src,
                    e.currentTarget as HTMLImageElement,
                    covers.rungs,
                    C.CARD_STACK_CARD_IMG_LOADED,
                    mobileRungs,
                    viewportWidth()
                  )
                }
              />
            </picture>
          )}
        </div>

        <div className={C.CARD_STACK_CARD_INFO}>
          <h2 className={C.CARD_STACK_CARD_INFO_TITLE}>{altText}</h2>

          {item.description && (
            <p className={C.CARD_STACK_CARD_INFO_DESC}>
              {/* Every card keeps its own writer — writeInfo() arms the
                  front card's text on each nav so the description
                  typewrites on stacked tiers exactly like the desktop
                  info column; behind cards stay empty (their info is
                  hidden, so no writer burns frames off-front). The
                  viewport trigger holds the reveal until the card is
                  actually on screen — the auto trigger would spend the
                  stagger at mount while the section is still below the
                  fold, leaving the desc pre-typed on first sight. */}
              <draw-text
                text={CHAR_STRINGS.EMPTY}
                delay={CHAR_STRINGS.DELAY_15}
                trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
              />
            </p>
          )}

          <span className={C.CARD_STACK_CARD_INFO_CTA}>
            {host._t.explore} <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.ARROW_RIGHT}</span>
          </span>
        </div>
      </a>

      <span className={C.CARD_STACK_TIMER} aria-hidden={ATTR_VALUES.TRUE} />
    </article>
  )
}

/** Skeleton fan — three shimmer cards in the coverflow pose so the
 *  swap doesn't shift the section geometry. */
function renderSkeleton(host: CardStack) {
  const offsets = [-1, 0, 1]

  return (
    <div className={C.CARD_STACK_DECK}>
      {offsets.map((s) => {
        const pose = tierPose(host._tier, s, offsets.length, host._cardW, host._cardH, host._peek)

        return (
          <div
            key={s}
            className={`${C.CARD_STACK_CARD} ${SKELETON_CLASSES.SKELETON_SHIMMER}`}
            style={`width: ${host._cardW}${COMMON_ATTRS.PX}; height: ${host._cardH}${COMMON_ATTRS.PX}; transform: translate(-50%, -50%) translate3d(${pose.x}${COMMON_ATTRS.PX}, ${pose.y}${COMMON_ATTRS.PX}, ${pose.depth}${COMMON_ATTRS.PX}) rotateY(${pose.rot}deg) rotate(${pose.rotZ}deg) scale(${pose.scale});`}
            aria-hidden={ATTR_VALUES.TRUE}
          />
        )
      })}
    </div>
  )
}

/** The active-project text column — the burn-animated title, the
 *  <draw-text> description writer and the "Check out" link; writeInfo()
 *  re-aims them on every nav without re-rendering the section. */
function renderInfo(host: CardStack, t: CardStackTranslations) {
  const info = cardInfo(host.deckItems[host.activeIdx])

  return (
    <div className={C.CARD_STACK_INFO}>
      <h2 className={C.CARD_STACK_INFO_TITLE} hidden={!info.title}>
        {info.title}
      </h2>

      <div className={C.CARD_STACK_INFO_DESC} hidden={!info.body}>
        {/* Viewport trigger — the mount-time arm must not spend the
            stagger while the section is still below the fold; the
            writer replays on every nav via writeInfo() either way. */}
        <draw-text
          text={info.body}
          delay={CHAR_STRINGS.DELAY_15}
          trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
        />
      </div>

      <a className={C.CARD_STACK_INFO_CTA} href={info.href} hidden={!info.href}>
        {t.explore} <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.ARROW_RIGHT}</span>
      </a>
    </div>
  )
}

/** The all-projects index — every item numbered with a cover thumb; CSS
 *  lays the list out as a desktop rail and a mobile bottom sheet. */
function renderIndex(host: CardStack, prevText: string, nextText: string) {
  const t = host._t

  return (
    <div
      className={C.CARD_STACK_INDEX}
      aria-hidden={host.indexOpen ? ATTR_VALUES.FALSE : ATTR_VALUES.TRUE}
      inert={!host.indexOpen}
    >
      <div className={C.CARD_STACK_INDEX_HEAD}>
        <h2 className={C.CARD_STACK_INDEX_TITLE}>{t.allProjects}</h2>

        <div className={C.CARD_STACK_INDEX_NAV}>
          <button
            className={C.CARD_STACK_INDEX_PREV}
            type={FORM_ATTRS.BUTTON}
            aria-label={prevText}
          >
            <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.ARROW_LEFT}</span>
          </button>

          <button
            className={C.CARD_STACK_INDEX_NEXT}
            type={FORM_ATTRS.BUTTON}
            aria-label={nextText}
          >
            <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.ARROW_RIGHT}</span>
          </button>

          <button
            className={C.CARD_STACK_INDEX_CLOSE}
            type={FORM_ATTRS.BUTTON}
            aria-label={appText(NAV_UI_KEYS.CLOSE) as string}
          >
            <span aria-hidden={ATTR_VALUES.TRUE}>{CHAR_STRINGS.CLOSE_GLYPH}</span>
          </button>
        </div>
      </div>

      <ol className={C.CARD_STACK_INDEX_LIST}>
        {host.processedItems.map((item, i) => {
          const sub = item.category || item.subtitle

          const covers = coverVariants(coverSrc(host, item))

          // The tile box is well under SMALL_BOX_PX, so the display pick
          // comes from the `-mobile` derivative ladder (full-stem rungs
          // would be wasted bytes); ladderCeiling applies the same
          // connection/box budget the card covers climb by — q75-grade on
          // a free link, q50 on a constrained one. covers.mobileJpg is
          // NOT a candidate — it is the mobile kodak LQIP placeholder,
          // not a display tier. No rungs (absent manifest) falls back to
          // covers.src, which is then the original anyway.
          const rungs = covers.mobileRungs.length ? covers.mobileRungs : covers.rungs

          const rung = rungs[ladderCeiling(rungs.length, IMAGE_DIMENSIONS.SMALL_BOX_PX)]

          const thumbSrc = rung ? rung.webp || rung.jpg : covers.src

          return (
            <li key={item.link || i} className={C.CARD_STACK_INDEX_ITEM} data-index={i}>
              <a href={projectHref(item)}>
                <span className={C.CARD_STACK_INDEX_NUM}>{padNum(i + 1)}.</span>

                <span className={C.CARD_STACK_INDEX_NAME}>
                  {item.label || item.title || ATTR_VALUES.EMPTY}
                </span>

                {sub && <span className={C.CARD_STACK_INDEX_SUB}>{sub}</span>}

                <img
                  draggable={ATTR_VALUES.FALSE}
                  className={C.CARD_STACK_INDEX_THUMB}
                  src={
                    mediaManifestReady() || mediaManifestFailed()
                      ? thumbSrc
                      : svgPlaceholder(
                          GENERIC_DIMENSIONS.DEFAULT_WIDTH,
                          GENERIC_DIMENSIONS.DEFAULT_HEIGHT
                        )
                  }
                  alt={ATTR_VALUES.EMPTY}
                  loading={MEDIA_ATTRS.LOADING_LAZY}
                  decoding={MEDIA_ATTRS.DECODING_ASYNC}
                  width={GENERIC_DIMENSIONS.DEFAULT_WIDTH}
                  height={GENERIC_DIMENSIONS.DEFAULT_HEIGHT}
                />
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** JSX template for the component's shadow DOM. */
export function renderCardStack(host: CardStack) {
  const t = host._t

  const items = host.deckItems

  const lang = store.getters.getCarouselLang() as
    { prev?: string; next?: string; ofLabel?: string } | undefined

  const fallbackCarousel = FALLBACK_APP.carousel as {
    prev: string
    next: string
    ofLabel: string
  }

  // The mock's chrome reads "← Previous" / "Next →" — plain action words,
  // not the aria-style "Previous item" the carousel keys resolve to.
  const prevText = (lang?.prev || fallbackCarousel.prev).split(' ')[0]

  const nextText = (lang?.next || fallbackCarousel.next).split(' ')[0]

  const ofLabel = lang?.ofLabel || fallbackCarousel.ofLabel

  const titleLines = (t.featured || ATTR_VALUES.EMPTY).split(/<br\s*\/?>/i).flatMap(titleLineHalves)

  const titleText = titleLines.join(CHAR_STRINGS.SPACE_CHAR)

  // The hint reads the short "Swipe." copy on every input method —
  // the long drag-or-swipe sentence crowded the transport button.
  const hintText = t.swipeHint || t.deckHint

  return (
    <section
      className={`${C.CARD_STACK} ${host.indexOpen ? C.CARD_STACK_INDEX_OPEN : ATTR_VALUES.EMPTY}`}
    >
      <header className={C.CARD_STACK_HEADER}>
        <h1 className={C.CARD_STACK_TITLE} aria-label={titleText}>
          {host.translations ? (
            <Fragment>
              {titleLines.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line.trim()}
                </Fragment>
              ))}
            </Fragment>
          ) : (
            <span
              aria-hidden={ATTR_VALUES.TRUE}
              className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_TITLE_MD}`}
            />
          )}
        </h1>

        {host.processedItems.length > 0 && (
          <button
            className={C.CARD_STACK_TOGGLE}
            type={FORM_ATTRS.BUTTON}
            aria-expanded={host.indexOpen ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE}
          >
            {t.viewAll}{' '}
            <span className={C.CARD_STACK_TOGGLE_COUNT}>({host.processedItems.length})</span>
          </button>
        )}
      </header>

      {items.length ? (
        <div className={C.CARD_STACK_DECK} aria-label={t.featured} role={ARIA_ATTRS.ROLE_GROUP}>
          {items.map((item, i) => renderCard(host, item, i))}
        </div>
      ) : (
        renderSkeleton(host)
      )}

      {items.length > 0 && renderInfo(host, t)}

      {items.length > 0 && (
        <div className={C.CARD_STACK_FOOT}>
          <p className={C.CARD_STACK_HINT}>
            <svg
              className={C.CARD_STACK_HINT_ICON}
              viewBox="0 0 24 24"
              aria-hidden={ATTR_VALUES.TRUE}
              focusable={ATTR_VALUES.FALSE}
            >
              <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 4 11.5 4S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.96-1.38z" />
            </svg>
            {hintText}
            <button
              className={C.CARD_STACK_AUTOPLAY}
              type={FORM_ATTRS.BUTTON}
              aria-label={t.autoplayPlay}
            >
              <span className={C.CARD_STACK_AUTOPLAY_PLAY} aria-hidden={ATTR_VALUES.TRUE} />
              <span className={C.CARD_STACK_AUTOPLAY_PAUSE} aria-hidden={ATTR_VALUES.TRUE} />
            </button>
          </p>

          <nav className={C.CARD_STACK_NAV} aria-label={t.featured}>
            <button className={C.CARD_STACK_PREV} type={FORM_ATTRS.BUTTON}>
              <span className={C.CARD_STACK_ARROW} aria-hidden={ATTR_VALUES.TRUE}>
                {CHAR_STRINGS.ARROW_LEFT}
              </span>{' '}
              {prevText}
            </button>

            <div className={C.CARD_STACK_DOTS}>
              {items.map((item, i) => (
                <button
                  key={item.link || i}
                  className={`${C.CARD_STACK_DOT} ${i === host.activeIdx ? C.CARD_STACK_DOT_ACTIVE : ATTR_VALUES.EMPTY}`}
                  aria-label={`${i + 1} ${ofLabel} ${items.length}`}
                  data-index={i}
                  type={FORM_ATTRS.BUTTON}
                >
                  <span className={C.CARD_STACK_DOT_NUM}>{i + 1}</span>
                </button>
              ))}
            </div>

            <button
              className={C.CARD_STACK_NAV_INDEX}
              type={FORM_ATTRS.BUTTON}
              aria-label={`${host._t.projectLabel} ${host.activeIdx + 1} ${CHAR_STRINGS.SLASH} ${items.length}`}
            >
              <svg
                className={C.CARD_STACK_NAV_INDEX_ICON}
                viewBox="0 0 24 24"
                aria-hidden={ATTR_VALUES.TRUE}
                focusable={ATTR_VALUES.FALSE}
              >
                <rect x="4" y="10" width="9" height="9" rx="1.5" opacity="0.35" />
                <rect x="7.5" y="7" width="9" height="9" rx="1.5" opacity="0.7" />
                <rect x="11" y="4" width="9" height="9" rx="1.5" />
              </svg>
              <span className={C.CARD_STACK_NAV_INDEX_NUM} aria-hidden={ATTR_VALUES.TRUE}>
                {host.activeIdx + 1} {CHAR_STRINGS.SLASH} {items.length}
              </span>
            </button>

            <button className={C.CARD_STACK_NEXT} type={FORM_ATTRS.BUTTON}>
              {nextText}{' '}
              <span className={C.CARD_STACK_ARROW} aria-hidden={ATTR_VALUES.TRUE}>
                {CHAR_STRINGS.ARROW_RIGHT}
              </span>
            </button>
          </nav>
        </div>
      )}

      {host.processedItems.length > 0 && renderIndex(host, prevText, nextText)}
    </section>
  )
}
