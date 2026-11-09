/**
 * @file ContactSection.js
 * @description <contact-section> — the home page's contact footer: heading,
 * subtitle, the primary mailto channel beside the secondary link list, and
 * the embedded <mentions-deck> awards fan, rendered over the dark contact
 * band the nav's --on-dark variant keys off.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { CONTACT_CLASSES } from '@core/tokens/classes/contact.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { A11Y_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import { FALLBACK_COMPONENTS } from '@core/locale/fallback.js'
import { appText, componentText } from '@core/locale/ui-text.js'
import { h, Fragment } from '@core/jsx.js'
import '@website/components/media/DrawText.js'
import '@website/components/carousel/MentionsDeck.js'
import contactStyles from '@core/sass/components/home/contact.scss?tiers'

import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { SECTION_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { devError } from '@core/devlog.js'

interface ContactLink {
  link: string
  description?: string
  caption?: string
}

interface ContactTranslation {
  title?: string
  subtitle?: string
  line1?: ContactLink[]
}

interface MentionsDeckEl extends HTMLElement {
  items?: unknown[] | null
  title: string
  translations?: unknown
}

type ComponentsMap = Record<string, ContactTranslation | undefined>

/**
 * Bundled post-redesign contact heading ("Contact / Get in Touch") used when
 * live Firebase RTDB returns the pre-redesign single-word "Contact" title.
 */
const FALLBACK_CONTACT_TITLE = (FALLBACK_COMPONENTS.contact as Required<ContactTranslation>).title

/**
 * contacts section.
 */
export class ContactSection extends BaseComponent {
  /** pages/HOME translations forwarded into <mentions-deck> (deckHint). */
  _mentionsTranslations: unknown = null

  constructor() {
    super(contactStyles)
  }

  /** Setter/getter — the pages/HOME locale node the deck hint reads. */

  set mentionsTranslations(val: unknown) {
    this._mentionsTranslations = val

    if (this._isMounted) this._syncMentionsDeck()
  }

  get mentionsTranslations(): unknown {
    return this._mentionsTranslations
  }

  override onMounted() {
    this.subscribe(store)

    const components = store.getters.getlang()?.components as ComponentsMap | undefined

    if (!components?.contact) {
      const lang = store.getters.getlang()
      const locale = lang?.locale || LOCALES.EN

      const dbpath = `${lang?.database || DB_PATHS.TRANSLATIONS}${locale}/components`

      fetchFirebaseDb(dbpath)
        .then((snapshot) => {
          if (snapshot?.exists()) {
            store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, snapshot.val())
          }
        })
        .catch(devError)
    }
  }

  override onStoreUpdate() {
    this._updateDom()
  }

  /**
   * Pushes the live mentions slice into the embedded <mentions-deck> —
   * re-run after every render since the deck node is recreated per
   * _updateDom (its setters guard identity so repeat pushes are cheap).
   */
  override onUpdated() {
    this._syncMentionsDeck()
  }

  /** Forwards mentions title/items + deck translations to the child element. */
  _syncMentionsDeck(): void {
    const deck = this.$<MentionsDeckEl>(COMPONENT_TAGS.MENTIONS_DECK)

    if (!deck) return

    const mentions = store.getters.getMentions()

    deck.title = mentions.title || CHAR_STRINGS.EMPTY

    deck.items = (mentions.items as unknown[] | null) || []

    deck.translations = this._mentionsTranslations
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    const translations = (store.getters.getlang().components as ComponentsMap | undefined)?.contact

    if (!translations) {
      return (
        <footer className={CONTACT_CLASSES.CONTACT}>
          {/* Landmark heading for AT navigation — sr-only + data-nosnippet:
              a jump target ('Footer > Contact'), never indexed. */}
          <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
            {appText(A11Y_UI_KEYS.A11Y_FOOTER)}
          </h2>
          <h3 className={CONTACT_CLASSES.CONTACT_TITLE}>
            <span
              {...{ [ARIA_ATTRS.ARIA_HIDDEN]: ATTR_VALUES.TRUE }}
              className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_TITLE_SM}`}
            />
            <span className={A11Y_CLASSES.SR_ONLY}>{appText(CMS_KEYS.CONTACT)}</span>
          </h3>
          <div className={CONTACT_CLASSES.CONTACT_SOCIAL}>
            {Array.from({ length: 4 }, (_, i) => (
              <span
                key={i}
                className={`${CONTACT_CLASSES.CONTACT_SOCIAL_LINK} ${SKELETON_CLASSES.SKELETON_FOOTER_LINK}`}
              />
            ))}
          </div>
        </footer>
      )
    }

    const line1 = translations.line1 || []

    const mailItem = line1.find((item) => item.link?.startsWith(NET_STRINGS.SCHEME_MAILTO))

    const restItems = line1.filter((item) => item !== mailItem)

    const subtitle = translations.subtitle || componentText(SECTION_COMPONENT_KEYS.CONTACT_SUBTITLE)

    const title =
      !translations.title || translations.title === NAV_TEXT.CONTACT
        ? FALLBACK_CONTACT_TITLE
        : translations.title

    return (
      <footer className={CONTACT_CLASSES.CONTACT}>
        {/* Landmark heading for AT navigation — sr-only + data-nosnippet:
            a jump target ('Footer > Contact'), never indexed. */}
        <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
          {appText(A11Y_UI_KEYS.A11Y_FOOTER)}
        </h2>
        <h3 className={CONTACT_CLASSES.CONTACT_TITLE}>
          {/* Light-DOM text mirrors `text` — tests/no-upgrade paths read it;
              unslotted children never paint. Contact sits below the fold,
              so the viewport trigger holds the reveal until the section
              scrolls in (auto would spend the stagger at mount). */}
          <draw-text text={String(title)} trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}>
            {String(title)}
          </draw-text>
        </h3>
        {subtitle ? <p className={CONTACT_CLASSES.CONTACT_SUBTITLE}>{String(subtitle)}</p> : null}

        <div className={CONTACT_CLASSES.CONTACT_ROW}>
          {mailItem ? (
            <Fragment>
              {/* Heading for the mail channel — AT heading-jump lands on it,
                  Tab reaches the anchor next. sr-only, never indexed;
                  skipped when the row has no copy (empty headings are an
                  axe violation). */}
              {mailItem.description ? (
                <h4 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                  {mailItem.description}
                </h4>
              ) : null}
              <a
                href={mailItem.link}
                target={DOM_STRINGS.BLANK}
                rel={DOM_STRINGS.NOOPENER}
                className={CONTACT_CLASSES.CONTACT_MAIL}
              >
                <span className={CONTACT_CLASSES.CONTACT_MAIL_LABEL}>{mailItem.description}</span>
                <span className={CONTACT_CLASSES.CONTACT_MAIL_ADDR}>
                  {mailItem.link.replace(NET_STRINGS.SCHEME_MAILTO, CHAR_STRINGS.EMPTY)}
                  <span
                    className={CONTACT_CLASSES.CONTACT_LINKS_ARROW}
                    {...{ [ARIA_ATTRS.ARIA_HIDDEN]: ATTR_VALUES.TRUE }}
                  >
                    {CHAR_STRINGS.ARROW_RIGHT}
                  </span>
                </span>
              </a>
            </Fragment>
          ) : null}

          <ul className={CONTACT_CLASSES.CONTACT_LINKS}>
            {restItems.map((item) => {
              const caption = item.caption

              return (
                <li key={item.link} className={CONTACT_CLASSES.CONTACT_LINKS_ITEM}>
                  {/* Heading per channel link — same AT contract as the mail
                      channel above. */}
                  {item.description ? (
                    <h4 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                      {item.description}
                    </h4>
                  ) : null}
                  <a
                    href={item.link}
                    target={DOM_STRINGS.BLANK}
                    rel={DOM_STRINGS.NOOPENER}
                    className={CONTACT_CLASSES.CONTACT_LINKS_LINK}
                  >
                    {item.description}
                    <span
                      className={CONTACT_CLASSES.CONTACT_LINKS_ARROW}
                      {...{ [ARIA_ATTRS.ARIA_HIDDEN]: ATTR_VALUES.TRUE }}
                    >
                      {CHAR_STRINGS.ARROW_RIGHT}
                    </span>
                  </a>
                  {caption ? (
                    <span className={CONTACT_CLASSES.CONTACT_LINKS_CAPTION}>{caption}</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>

        <mentions-deck className={CONTACT_CLASSES.CONTACT_MENTIONS} />
      </footer>
    )
  }
}

if (!customElements.get(COMPONENT_TAGS.CONTACT_SECTION)) {
  customElements.define(COMPONENT_TAGS.CONTACT_SECTION, ContactSection)
}
