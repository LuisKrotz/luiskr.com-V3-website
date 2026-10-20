/**
 * @file lang-dialog/locale.ts — maps the current URL to its equivalent in
 * the new locale:
 *   base = '/<lang>' prefix ('' for English — EN is the canonical root)
 *   known routes rebuild from their localized slug (s.about, s.terms…)
 *   unknown/dynamic routes (project pages) keep the path minus the old
 *   '/xx' locale prefix — the regex strips '/pt', '/es' etc. at the root
 * Store commit re-fetches translations; push() swaps the URL so the
 * browser history holds the localized address (SEO + shareable links).
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_NAMES, ROUTE_PREFIXES } from '@core/tokens/routes/names.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { routeSlugs } from '@core/locale/ui-text.js'

/**
 * `localeUrl` — the pure half of a locale switch: resolves the current
 * route's URL in `newLang` without committing anything. Rendered as the
 * lang options' `href` so translated routes are real links (crawlable,
 * open-in-new-tab); `applyLang` pushes the same path on plain clicks.
 * @param newLang Target locale code (EN yields the unprefixed root).
 * @returns The localized path for the current route.
 */
export function localeUrl(newLang: string): string {
  const route = router.currentRoute

  const routeName = route?.name || ATTR_VALUES.EMPTY

  const s = routeSlugs(newLang)

  const base = newLang === LOCALES.EN ? ATTR_VALUES.EMPTY : `${ROUTE_PATHS.ROOT}${newLang}`

  if (routeName.startsWith(ROUTE_PREFIXES.HOME)) return `${base}${ROUTE_PATHS.ROOT}`
  if (routeName.startsWith(ROUTE_PREFIXES.ABOUT)) return `${base}${ROUTE_PATHS.ROOT}${s.about}`
  if (routeName.startsWith(ROUTE_PREFIXES.CONTACT)) return `${base}${ROUTE_PATHS.ROOT}${s.contact}`
  if (routeName.startsWith(ROUTE_PREFIXES.PRIVACY)) return `${base}${ROUTE_PATHS.ROOT}${s.privacy}`
  if (routeName.startsWith(ROUTE_PREFIXES.GDPR)) return `${base}${ROUTE_PATHS.ROOT}${s.gdpr}`
  if (routeName.startsWith(ROUTE_PREFIXES.TERMS)) return `${base}${ROUTE_PATHS.ROOT}${s.terms}`
  if (routeName.startsWith(ROUTE_PREFIXES.LICENSE)) return `${base}${ROUTE_PATHS.ROOT}${s.license}`

  if (routeName === ROUTE_NAMES.EARTH_PLAYGROUND) {
    return `${base}${ROUTE_PATHS.ROOT}${s.earthPlayground || ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT}`
  }

  const rawPath = window.location.pathname.replace(/^\/([a-z]{2,3})(\/|$)/, ROUTE_PATHS.ROOT)

  return base + (rawPath.startsWith(ROUTE_PATHS.ROOT) ? rawPath : `${ROUTE_PATHS.ROOT}${rawPath}`)
}

/** Applies the chosen locale: commits the language + rewrites the URL. */
export function applyLang(newLang: string): void {
  store.commit(LANG_MUTATIONS.SET_LANG, newLang)

  router.push(localeUrl(newLang))
}
