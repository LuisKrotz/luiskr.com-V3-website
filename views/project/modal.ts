/**
 * @file routes/views/project/modal.ts
 * @description Auto-open logic for ViewProject — when the route slug matches a media item label, commits the expand-modal payload (source/thumb/size) to the store.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ROUTE_PATHS } from '@core/tokens/routes.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import store from '@core/store.js'
import { mediaSlugSeq, buildMediaUrls, slugify } from '@core/utils/index.js'
import router from '@core/router/router.js'
import type { ViewProject } from './Project.js'
import type { ProjectMediaItem } from './types.js'

/**
 * Commits the expand-modal payload for a matched media item — the same
 * shape `openMediaModal` writes so deep-link opens and click opens
 * behave identically.
 * @param storage CDN base URL from the store.
 * @param folder Project folder segment for the media path.
 * @param item The matched project media item.
 */
const openModalForItem = (storage: string, folder: string, item: ProjectMediaItem): void => {
  const { source, thumb, isVideo } = buildMediaUrls(storage, folder, item)

  store.commit(MODAL_MUTATIONS.SET_MODAL, {
    transform: window.scrollY,
    class: MODAL_CLASSES.MODAL_OPEN,
    open: true,
    media: {
      source,
      thumb,
      alt: item.label,
      width: item.size[0],
      height: item.size[1],
      isVideo,
    },
  })
}

/**
 * Checks auto open modal.
 * @param c — the component
 */
export function checkAutoOpenModal(c: ViewProject): void {
  const route = router.currentRoute

  const slug = route?.params?.slug

  if (!slug || !c.translations) return

  const storage = store.getters.getStorage()

  const folder = c.translations.folder || ATTR_VALUES.EMPTY

  // Per-project slug assignment — document-order numbering resolves
  // label collisions the same way the build emit + sitemap do, so a
  // `<label>-2` deep link opens the second same-slug item, not the first.
  const seen = new Map<string, number>()

  const items: ProjectMediaItem[] = []

  for (const section of c.translations.sections || []) {
    for (const group of section) {
      if (!Array.isArray(group) || typeof group[0] === TYPE_STRINGS.STRING) continue

      for (const item of group as ProjectMediaItem[]) {
        items.push(item)
      }
    }
  }

  // One traversal derives both slug forms per item. `canonical` is the
  // `mediaSlugSeq` slug (capped + ordinaled) the build emit, sitemap,
  // modal write, and genie all agree on — only labelled src'd items
  // consume a sequence slot, the same gate the emit's mediaRowsOf
  // applies, keeping ordinals aligned. `raw` is the uncapped,
  // un-ordinaled `slugify(label)` older modal opens wrote.
  const rows = items.map((item) => {
    const label = item.label || ATTR_VALUES.EMPTY

    const canonical = label && item.src ? mediaSlugSeq(seen, label) : ATTR_VALUES.EMPTY

    return { item, raw: slugify(label), canonical }
  })

  // Pass 1 — canonical slugs only, so a raw slug can never shadow a
  // later item's canonical slug.
  for (const { item, canonical } of rows) {
    if (canonical === slug) {
      openModalForItem(storage, folder, item)
      return
    }
  }

  // Pass 2 — legacy raw slugs; already-shared links keep resolving.
  for (const { item, raw, canonical } of rows) {
    if (canonical && raw === slug) {
      openModalForItem(storage, folder, item)

      // Canonicalize the address bar to the emitted slug — the raw
      // variant has no prerendered dist route and competing URLs split
      // indexing. replaceState, not pushState — same route, same item.
      const segments = window.location.pathname
        .replace(/\/$/, ATTR_VALUES.EMPTY)
        .split(ROUTE_PATHS.ROOT)

      segments[segments.length - 1] = canonical

      window.history.replaceState({}, ATTR_VALUES.EMPTY, segments.join(ROUTE_PATHS.ROOT))
      return
    }
  }
}
