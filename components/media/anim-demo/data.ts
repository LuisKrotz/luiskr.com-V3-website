/**
 * @file anim-demo/data.ts — the demo-data source. Drivers that mount
 * real elements (card-stack, mentions-deck, awards-carousel,
 * custom-carousel, about-section) feed them the same RTDB nodes the
 * production views read — pages/<locale>/HOME for the portfolio list,
 * pages/<locale>/ABOUT for the mentions + profile picture — so the
 * staged demos carry real CMS content instead of fixtures. The
 * resolved pair is cached per locale: every demo on the page shares
 * one fetch round-trip, and a locale swap re-reads the new node set.
 */

import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { LOCALES } from '@core/tokens/locales.js'
import store from '@core/store.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import { devError } from '@core/devlog.js'

/**
 * The demo payload — the pages/HOME node (portfoliolist + deck copy),
 * the pages/ABOUT node (mention_items + profilePicture) and the
 * components/related node (canonical featured flags) — the raw locale
 * objects the real components consume, matching the home view's three
 * data sources.
 */
export interface AnimDemoData {
  /** pages/<locale>/HOME — portfoliolist, deckHint, home copy. */
  home: Record<string, unknown> | null

  /** pages/<locale>/ABOUT — mention_items + profilePicture + bio. */
  about: Record<string, unknown> | null

  /** components/<locale>/related — the canonical featured project flags. */
  related: Record<string, { featured?: unknown; link?: string }> | null
}

/** Per-locale memoized fetch — keyed so a locale swap re-resolves. */
let _cache: { locale: string; promise: Promise<AnimDemoData> } | null = null

/**
 * Loads (once per locale) the HOME + ABOUT page nodes the demo
 * elements read. Mirrors the home view's path grammar
 * (`lang.database + locale + lang.pagesPath + key`); a missing node
 * resolves null rather than rejecting so a demo still mounts with
 * whatever slice arrived.
 * @returns The shared data promise for the current locale.
 */
export const loadDemoData = (): Promise<AnimDemoData> => {
  const lang = store.getters.getlang()

  const locale = lang.locale || LOCALES.EN

  if (_cache && _cache.locale === locale) return _cache.promise

  const basePath = lang.database + locale + lang.pagesPath

  const relatedPath = lang.database + locale + DB_PATHS.COMPONENTS_RELATED_PROJECTS

  const promise = Promise.all([
    fetchFirebaseDb(basePath + CMS_KEYS.HOME).catch((err) => {
      devError(err)
      return null
    }),
    fetchFirebaseDb(basePath + CMS_KEYS.ABOUT).catch((err) => {
      devError(err)
      return null
    }),
    fetchFirebaseDb(relatedPath).catch((err) => {
      devError(err)
      return null
    }),
  ]).then(([homeSnap, aboutSnap, relatedSnap]) => ({
    home: homeSnap?.exists?.() ? (homeSnap.val() as Record<string, unknown>) : null,
    about: aboutSnap?.exists?.() ? (aboutSnap.val() as Record<string, unknown>) : null,
    related: relatedSnap?.exists?.()
      ? (relatedSnap.val() as Record<string, { featured?: unknown; link?: string }>)
      : null,
  }))

  _cache = { locale, promise }

  return promise
}
