/**
 * @file ContactSection.js
 * @description <contact-section> — the home page's contact footer: heading,
 * email/social links and the CTA copy, rendered over the dark contact band
 * the nav's --on-dark variant keys off.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
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
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import { appText, componentText } from '@core/locale/ui-text.js'
import { h, Fragment } from '@core/jsx.js'
import '@website/components/media/DrawText.js'
import contactStyles from '@core/sass/components/home/contact.scss?inline'

import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { SECTION_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'
import { devError } from '@core/devlog.js'

interface ContactLink {
  link: string
  description?: string
}

interface ContactTranslation {
  title?: string
  line1?: ContactLink[]
}

type ComponentsMap = Record<string, ContactTranslation | undefined>

/**
 * contacts section.
 */
export class ContactSection extends BaseComponent {
  constructor() {
    super(contactStyles)
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

    return (
      <footer className={CONTACT_CLASSES.CONTACT}>
        {/* Landmark heading for AT navigation — sr-only + data-nosnippet:
            a jump target ('Footer > Contact'), never indexed. */}
        <h2 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
          {appText(A11Y_UI_KEYS.A11Y_FOOTER)}
        </h2>
        <h3 className={CONTACT_CLASSES.CONTACT_TITLE}>
          {/* Light-DOM text mirrors `text` — tests/no-upgrade paths read it;
              unslotted children never paint. */}
          <draw-text
            text={String(translations.title || componentText(SECTION_COMPONENT_KEYS.CONTACT_TITLE))}
          >
            {String(translations.title || componentText(SECTION_COMPONENT_KEYS.CONTACT_TITLE))}
          </draw-text>
        </h3>
        <div className={CONTACT_CLASSES.CONTACT_SOCIAL}>
          {line1.map((item, n) => (
            <Fragment key={item.link}>
              {/* Heading per social link — AT heading-jump lands on it,
                  Tab reaches the anchor next. sr-only, never indexed;
                  skipped when the link has no copy (empty headings are
                  an axe violation). */}
              {item.description ? (
                <h4 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                  {item.description}
                </h4>
              ) : null}
              <a
                href={item.link}
                target={DOM_STRINGS.BLANK}
                rel={DOM_STRINGS.NOOPENER}
                className={CONTACT_CLASSES.CONTACT_SOCIAL_LINK}
              >
                {item.description}
              </a>
              {n < line1.length - 1 && (
                <span className={CONTACT_CLASSES.CONTACT_SEPARATOR}>{CHAR_STRINGS.DOT_SEP}</span>
              )}
            </Fragment>
          ))}
        </div>
      </footer>
    )
  }
}

if (!customElements.get(COMPONENT_TAGS.CONTACT_SECTION)) {
  customElements.define(COMPONENT_TAGS.CONTACT_SECTION, ContactSection)
}
