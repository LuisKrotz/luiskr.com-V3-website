/**
 * @file project/data.ts
 * @description Data plumbing for <view-project>: slug resolution from the
 * route or URL, robots-meta toggling for draft/hidden projects, and the
 * SWR fetch that renders the project node, sets the document title and
 * publishes the JSON-LD article graph.
 */

import { BASE_TITLE } from '@core/tokens/routes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { LOCALES } from '@core/tokens/locales.js'
import { PROJECT_ALIASES } from '@core/tokens/routes/aliases.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import { generateProjectSchema, updateJsonLd } from '@core/utils/index.js'
import { toMetaDescription } from '@core/utils/string.js'
import { setMetaContent, setMetaDescription } from '@core/router/navigate.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import type { DbSnapshot } from '@core/utils/data/db.js'
import { wasmSmoothScroll } from '@core/utils/wasm/wasm-scroll.js'
import type { RouteDescriptor } from '@core/router/router.js'
import type { ViewProject } from '@website/views/project/Project.js'
import type { ProjectTranslations } from './types.js'
import { SCROLL_TIMINGS } from '@core/tokens/media/dimensions.js'
import { devError } from '@core/devlog.js'

/** Toggles the noindex meta for draft/hidden projects. */
export function updateRobotsMeta(noindex: boolean): void {
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  let meta = document.querySelector<HTMLMetaElement>(QUERY_STRINGS.META_ROBOTS)

  if (noindex) {
    if (!meta) {
      meta = document.createElement(HTML_TAGS.META)

      meta.name = 'robots'

      document.head.appendChild(meta)
    }

    meta.content = SCHEMA_STRINGS.NOINDEX_NOFOLLOW
  } else {
    if (meta) {
      meta.remove()
    }
  }
}

/**
 * Recursively finds the first paragraph string inside a project's nested
 * `sections` payload (paragraphs and expandable media items are interleaved
 * two levels deep — media objects are skipped, only text qualifies).
 */
const firstParagraph = (node: unknown): string => {
  if (typeof node === TYPE_STRINGS.STRING) return node as string

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstParagraph(item)

      if (found) return found
    }
  }

  return ATTR_VALUES.EMPTY
}

/** Derives the project key from the route params, falling back to the URL. */
export function resolveProjectSlug(_view: ViewProject): string {
  const route = router.currentRoute

  const slug = route?.params?.projectSlug || route?.params?.rawSlug || ATTR_VALUES.EMPTY

  if (slug) return slug

  if (typeof window === TYPE_STRINGS.UNDEFINED) return ATTR_VALUES.EMPTY

  const match = window.location.pathname.match(/\/portfolio\/([^/?#]+)/)

  return match?.[1] || ATTR_VALUES.EMPTY
}

/** Initializes the resolved project record for the current route. */
export function initProject(view: ViewProject): void {
  view.projectSlug = resolveProjectSlug(view)

  view.loadData()
}

/** Fetches the project node for the route's slug via SWR (optionally deferred). */
export function loadData(view: ViewProject, wait: number | false = false): void {
  let projectKey = view.projectSlug || resolveProjectSlug(view)

  if (!projectKey) return

  const lang = store.getters.getlang()

  const currentLocale = lang.locale || LOCALES.EN

  view._lastLocale = currentLocale

  // Normalize legacy slugs using the shared aliases map from constants.js
  projectKey = (PROJECT_ALIASES as Record<string, string>)[projectKey] || projectKey

  const dbpath = `${lang.database}${currentLocale}${lang.projectPath}${projectKey}`

  const apply = (snap: DbSnapshot) => {
    if (snap?.exists()) {
      const data = snap.val() as ProjectTranslations

      if (data.title) {
        document.title = `${BASE_TITLE} ${CHAR_STRINGS.PIPE_SEP} ${data.title}`

        setMetaContent(QUERY_STRINGS.META_OG_TITLE, document.title)

        setMetaContent(QUERY_STRINGS.META_TW_TITLE, document.title)

        setMetaContent(QUERY_STRINGS.META_DC_TITLE, document.title)
      }

      // First body paragraph becomes the SERP snippet, resolved from the
      // fetched (localized) project node — same source the static
      // generator compacts for the emitted /<loc>/portfolio/<slug> page.
      setMetaDescription(toMetaDescription(firstParagraph(data.sections)))

      view.updateRobotsMeta(data.noindex === true)

      // params.slug is the media deep-link segment — when present the
      // graph recenters on that asset (WebPage + media entity + crumb),
      // matching the static page emitted for the same URL.
      const schemaGraph = generateProjectSchema(
        data,
        projectKey,
        currentLocale,
        router.currentRoute?.params?.slug
      )

      updateJsonLd(schemaGraph)

      const reveal = () => {
        view.translations = data

        view._updateDom()

        requestAnimationFrame(() => {
          view._bindCarousels()

          view.checkAutoOpenModal()
        })
      }

      if (!wait) {
        reveal()
      } else {
        setTimeout(reveal, wait)
      }
    }
  }

  fetchFirebaseDb(dbpath, apply).then(apply).catch(devError)
}

/** Router hook — project→project navigations reload data without remounting. */
export function onRouteParamChange(view: ViewProject, to: RouteDescriptor | null): void {
  const nextSlug = to?.params?.projectSlug || ATTR_VALUES.EMPTY

  if (nextSlug !== view.projectSlug) {
    view.projectSlug = nextSlug

    view.translations = null

    view._updateDom()

    wasmSmoothScroll({
      duration: SCROLL_TIMINGS.SCROLL_DURATION_FULL,
      updateHistory: false,
      scrollTo: 0,
    })

    view.loadData(SCROLL_TIMINGS.SCROLL_DURATION_FULL)
  } else {
    view.checkAutoOpenModal()
  }
}
