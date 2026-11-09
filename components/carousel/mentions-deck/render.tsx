/**
 * @file mentions-deck/render.tsx — shadow-DOM template for
 * <mentions-deck>: the "Some mentions" section title, the flat card
 * strip (numbered award/mention cards with optional badge media), the
 * hint + dot-nav chrome, and the skeleton strip shown while data loads.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { MENTIONS_DECK_CLASSES } from '@core/tokens/classes/mentions-deck.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { h, Fragment } from '@core/jsx.js'
import store from '@core/store.js'
import { encodeMediaUrl } from '@core/utils/media.js'
import { excerptHeading, toMetaDescription } from '@core/utils/string.js'
import { FALLBACK_APP } from '@core/locale/fallback.js'
import '@website/components/media/DrawText.js'
import { stripPose } from './deck.js'
import type { MentionItem } from './types.js'
import type { MentionsDeck } from '../MentionsDeck.js'

const C = MENTIONS_DECK_CLASSES

/**
 * One strip card — the stretched outbound link carries the zero-padded
 * ordinal, the CMS description markup, and the badge image (or the icon
 * glyph when no media ships). Geometry arrives via applyPoses() writes.
 * @param host The MentionsDeck element.
 * @param item The mention row.
 * @param i Deck index — drives the printed ordinal.
 * @param len Deck length — drives the group aria-label denominator.
 * @param ofLabel Localized "of" connector for the group label.
 */
function renderCard(
  host: MentionsDeck,
  item: MentionItem,
  i: number,
  len: number,
  ofLabel: string
) {
  const storage = store.getters.getStorage()

  const desc = item.description || item.label || ATTR_VALUES.EMPTY

  // Per-card heading — the AT jump target that names this mention;
  // emitted only when the item has real copy so cards never produce an
  // empty heading (the role=group aria-label already names bare items).
  // tabindex=-1 lets SR focus land on it.
  const cardHeading = excerptHeading(item.description || item.label || ATTR_VALUES.EMPTY)

  return (
    <article
      key={item.link || i}
      className={C.MENTIONS_DECK_CARD}
      {...{ [DATA_ATTRS.DATA_INDEX]: i }}
      role={ARIA_ATTRS.ROLE_GROUP}
      aria-label={`${i + 1} ${ofLabel} ${len}`}
    >
      {cardHeading ? (
        <h4 className={A11Y_CLASSES.SR_ONLY} tabIndex={-1}>
          {cardHeading}
        </h4>
      ) : null}
      <a
        className={C.MENTIONS_DECK_CARD_LINK}
        href={item.link || ATTR_VALUES.EMPTY}
        target={DOM_STRINGS.BLANK}
        rel={DOM_STRINGS.NOOPENER}
        aria-label={cardHeading || `${i + 1} ${ofLabel} ${len}`}
        tabindex={i === host.activeIdx ? ATTR_VALUES.TABINDEX_ZERO : ATTR_VALUES.NEGATIVE_TABINDEX}
      >
        {item.icon ? (
          <span className={C.MENTIONS_DECK_CARD_ICON} aria-hidden={ATTR_VALUES.TRUE}>
            {item.icon}
          </span>
        ) : null}
        <span
          className={C.MENTIONS_DECK_CARD_TEXT}
          dangerouslySetInnerHTML={{ __html: item.description || ATTR_VALUES.EMPTY }}
        />
        {item.media ? (
          <img
            loading={MEDIA_ATTRS.LOADING_LAZY}
            decoding={MEDIA_ATTRS.DECODING_ASYNC}
            className={C.MENTIONS_DECK_CARD_IMG}
            src={encodeMediaUrl(storage + item.media.path)}
            alt={toMetaDescription(desc)}
            width={item.media.width || GENERIC_DIMENSIONS.AWARD_ICON_SIZE}
            height={item.media.height || GENERIC_DIMENSIONS.AWARD_ICON_SIZE}
          />
        ) : null}
      </a>
    </article>
  )
}

/** Skeleton strip — three shimmer cards centered like the loaded deck so
 *  the swap doesn't shift the section geometry. The poses come from the
 *  same stripPose() the real cards use (center anchor + margined step);
 *  the detached default skips the edge fade so all three stay visible. */
function renderSkeleton(host: MentionsDeck) {
  const offsets = [-1, 0, 1]

  return (
    <div className={C.MENTIONS_DECK_DECK}>
      {offsets.map((s) => {
        const pose = stripPose(s, offsets.length, host._cardW, host._step)

        return (
          <div
            key={s}
            className={`${C.MENTIONS_DECK_CARD} ${SKELETON_CLASSES.SKELETON_SHIMMER}`}
            style={`left: ${host._anchor}px; width: ${host._cardW}px; height: ${host._cardH}px; transform: translate(-50%, -50%) translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rot}deg) scale(${pose.scale}); opacity: ${pose.opacity};`}
            aria-hidden={ATTR_VALUES.TRUE}
          />
        )
      })}
    </div>
  )
}

/**
 * JSX template for the component's shadow DOM — the section title, the
 * absolutely-positioned strip cards, then the hint + dot nav chrome. An
 * empty item list emits the skeleton strip so the section keeps its box.
 * @param host The MentionsDeck element.
 */
export function renderMentionsDeck(host: MentionsDeck) {
  const items = host.items

  const lang = store.getters.getCarouselLang() as { ofLabel?: string } | undefined

  const ofLabel = lang?.ofLabel || (FALLBACK_APP.carousel as { ofLabel: string }).ofLabel

  return (
    <section className={C.MENTIONS_DECK} aria-label={host.title}>
      <h3 className={C.MENTIONS_DECK_TITLE}>
        {/* Light-DOM text mirrors `text` — tests/no-upgrade paths read it;
            unslotted children never paint. The deck sits below the fold,
            so the viewport trigger holds the reveal until the section
            actually scrolls in (auto would spend the stagger at mount). */}
        <draw-text text={host.title} trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}>
          {host.title}
        </draw-text>
      </h3>

      {items.length ? (
        <Fragment>
          <div className={C.MENTIONS_DECK_DECK}>
            {items.map((item, i) => renderCard(host, item, i, items.length, ofLabel))}
          </div>

          <div className={C.MENTIONS_DECK_FOOT}>
            <p className={C.MENTIONS_DECK_HINT}>
              <svg
                className={C.MENTIONS_DECK_HINT_ICON}
                viewBox="0 0 24 24"
                aria-hidden={ATTR_VALUES.TRUE}
                focusable={ATTR_VALUES.FALSE}
              >
                <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 4 11.5 4S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.96-1.38z" />
              </svg>
              {host._t.deckHint}
            </p>

            <div className={C.MENTIONS_DECK_DOTS}>
              {items.map((item, i) => (
                <button
                  key={item.link || i}
                  type={FORM_ATTRS.BUTTON}
                  className={`${C.MENTIONS_DECK_DOT} ${i === host.activeIdx ? C.MENTIONS_DECK_DOT_ACTIVE : ATTR_VALUES.EMPTY}`}
                  aria-label={`${i + 1} ${ofLabel} ${items.length}`}
                  {...{ [DATA_ATTRS.DATA_INDEX]: i }}
                >
                  <span className={C.MENTIONS_DECK_DOT_NUM} aria-hidden={ATTR_VALUES.TRUE}>
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Fragment>
      ) : (
        renderSkeleton(host)
      )}
    </section>
  )
}
