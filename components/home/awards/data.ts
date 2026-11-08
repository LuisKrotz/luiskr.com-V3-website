/**
 * @file home/awards/data.ts
 * @description Data helpers for <awards-mentions>: the legal-links list
 * (CMS list preferred, bundled fallback otherwise — bare locale-root
 * entries are filtered since the CMS stores the home link in the same
 * list but the footer should only show real legal destinations) and the
 * SWR fetch that populates the components dictionary.
 */

import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import store from '@core/store.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { legalLinks } from '@core/utils/data/legal-links.js'
import type { AwardsMentions } from '../AwardsMentions.js'
import { devError } from '@core/devlog.js'

/** A CMS-stored link row — both fields optional at the data boundary. */
export interface AwardLink {
  /** Destination URL/path. */
  link?: string
  /** Page name the link points at (used for the visible label). */
  page?: string
}

export { legalLinks }

export type { LegalLink } from '@core/utils/data/legal-links.js'

/**
 * Loads the components dictionary node for the current locale when missing
 * (stale-while-revalidate) — commits SET_COMPONENT_LANG so the footer
 * links/mentions re-render once the snapshot lands.
 * @param _el The AwardsMentions element (unused — data flows via the store).
 */
export function ensureAwardsData(_el: AwardsMentions): void {
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
