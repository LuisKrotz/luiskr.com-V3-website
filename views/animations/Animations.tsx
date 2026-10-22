/**
 * @file Animations.js
 * @description <view-animations> — the animations-reference route: lists
 * every animated element's authored alt + longdesc record
 * (`components.animations` × `pages.animations` chrome copy) inside the
 * internals chrome with the shared legal footer. The runtime mirror of the
 * statically prerendered /animations hub page — crawlers and AI agents read
 * the same records from the build-time `content` markup.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ANIMATIONS_CLASSES } from '@core/tokens/classes/animations.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { LOCALES } from '@core/tokens/locales.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { h } from '@core/jsx.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { appText, componentText } from '@core/locale/ui-text.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import type { DbSnapshot } from '@core/utils/data/db.js'
import { stripHtml, toMetaDescription } from '@core/utils/index.js'
import { setMetaDescription } from '@core/router/navigate.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import '@website/components/media/DrawText.js'
import animationsStyles from './animations.scss?inline'
import '@website/components/legal/Footer.js'
import { devError } from '@core/devlog.js'

/** The pages.animations chrome copy — title + meta/intro description. */
interface AnimationsPage {
  title?: string
  description?: string
}

/** One animations record — components.animations.<id>. */
interface AnimationsRecord {
  alt?: string
  longdesc?: string
}

/**
 * The ViewAnimations — animations class.
 */
export class ViewAnimations extends BaseComponent {
  translations: AnimationsPage | null = null
  private _lastLocale: string | null = null

  constructor() {
    super(animationsStyles)
  }

  /** Lifecycle: kicks off document loading. */

  override onMounted() {
    this.subscribe(store)

    this.loadData()

    setTimeout(() => {
      window.scrollTo(0, 0)
    }, 500)
  }

  /** Reloads when the locale changes. */

  override onStoreUpdate() {
    const currentLocale = store.getters.getLang()
    if (this._lastLocale && this._lastLocale !== currentLocale) {
      this._lastLocale = currentLocale
      this.loadData()
    }
  }

  /**
   * Fetches the animations page chrome node (title + description) for the
   * current locale — the record list itself streams from the components
   * dictionary which is already loaded globally. The route's meta
   * description rides the fetched node so the tag carries the localized
   * text, not the booted shell's.
   */
  loadData(): void {
    const route = router.currentRoute
    if (route?.meta?.title) {
      document.title = route.meta.title
    }

    const lang = store.getters.getlang()

    const currentLocale = lang.locale || LOCALES.EN
    this._lastLocale = currentLocale

    const dbpath = `${lang.database}${currentLocale}${lang.pagesPath}${TRANSLATION_KEYS.ANIMATIONS}`

    const apply = (snapshot: DbSnapshot) => {
      if (!snapshot?.exists()) return

      const val = snapshot.val() as AnimationsPage

      // setMetaDescription no-ops on empty input.
      setMetaDescription(toMetaDescription(val.description || CHAR_STRINGS.EMPTY))

      this.translations = val
      this._updateDom()
    }

    fetchFirebaseDb(dbpath, apply).then(apply).catch(devError)
  }

  /**
   * JSX template — two states: loaded renders the title, intro paragraph and
   * one definition-list row per animation record (alt = term, longdesc =
   * definition); loading renders skeleton rows mirroring the real geometry.
   * Each record carries `id` so an entry is deep-linkable.
   */
  override render() {
    const t = this.translations
    const LegalFooter = COMPONENT_TAGS.LEGAL_FOOTER

    const records = componentText(CMS_KEYS.ANIMATIONS) as
      Record<string, AnimationsRecord> | undefined

    const entries = Object.entries(records || {})

    return (
      <article>
        <div id="main" className={ANIMATIONS_CLASSES.ANIMATIONS}>
          <h1
            className={INTERNAL_CLASSES.INTERNAL_TITLE}
            aria-label={
              stripHtml(
                t?.title ||
                  (FALLBACK_PAGES[TRANSLATION_KEYS.ANIMATIONS] as AnimationsPage | undefined)
                    ?.title ||
                  String(appText(SECTION_UI_KEYS.LOADING) || CHAR_STRINGS.EMPTY)
              ) || undefined
            }
          >
            {t?.title ? (
              <draw-text
                key="ttl1"
                text={t.title}
                trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
                fit={ATTR_VALUES.EMPTY}
                ordered={ATTR_VALUES.TRUE}
              />
            ) : (
              <span
                key="ttl2"
                className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_TITLE_SM}`}
              />
            )}
          </h1>

          {t?.description ? (
            <p className={INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT}>{t.description}</p>
          ) : (
            <p
              className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_FULL}`}
            />
          )}

          {entries.length ? (
            <dl className={ANIMATIONS_CLASSES.ANIMATIONS_LIST}>
              {entries.map(([id, record]) => (
                <div key={id} id={id} className={ANIMATIONS_CLASSES.ANIMATIONS_RECORD}>
                  <dt className={ANIMATIONS_CLASSES.ANIMATIONS_TERM}>{record.alt || id}</dt>
                  <dd className={ANIMATIONS_CLASSES.ANIMATIONS_DESC}>{record.longdesc || ''}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div key="data-load">
              {[1, 2, 3].map((n) => (
                <section key={n} className={INTERNAL_CLASSES.INTERNAL_DESCRIPTION}>
                  <h2
                    aria-hidden={ATTR_VALUES.TRUE}
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_SECTION_TITLE}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_FULL}`}
                  />
                  <p
                    className={`${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_94}`}
                  />
                </section>
              ))}
            </div>
          )}
        </div>

        <LegalFooter />
      </article>
    )
  }
}

if (!customElements.get(VIEW_TAGS.VIEW_ANIMATIONS)) {
  customElements.define(VIEW_TAGS.VIEW_ANIMATIONS, ViewAnimations)
}
