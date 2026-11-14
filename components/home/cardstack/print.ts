/**
 * @file cardstack/print.ts — the deck's printable form.
 *
 * Two paper-only problems the shared adapter can't solve from outside
 * the component:
 *
 *   1. Descriptions — every card's body text lives inside a <draw-text>
 *      writer whose `text` attribute stays empty until that card's own
 *      viewport reveal arms it (behind cards never arm, so paper would
 *      print titles only). The item data is component state, so the
 *      fill happens here on `printprepare`: a `hidden`-contract
 *      `.print-fill` span seats inside each card's desc slot and the
 *      shadow-local print sheet reveals it — the same contract
 *      `.print-caption`/`.print-qr-link` already use.
 *   2. Pose re-writes — applyPoses/fitDeckToFront write card geometry
 *      inline from rAF and ResizeObserver loops. print.ts strips `style`
 *      on beforeprint, but the print-layout reflow fires those observers
 *      again and the fan pose would return mid-snapshot (rotated,
 *      clustered cards on paper). `host._printing` gates every poser
 *      for the duration of the job.
 *
 * `afterprint` — and the matchMedia('print') false edge, which never
 * dispatches a native event — both restore: the flag drops, injected
 * fills leave, and applyPoses() re-writes the live poses (no attr
 * bookkeeping needed — poses are pure derived output).
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { LOCALES } from '@core/tokens/locales.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import store from '@core/store.js'
import type { CardStack } from '../CardStack.js'

/**
 * Flattens a project node's `sections` into ordered body paragraphs —
 * each section's children are either a `string[]` text row or a media
 * row, and only the text rows print: the feature copy the internal
 * page shows on desktop, not the card's short portfoliolist blurb.
 * @param data The resolved `projects/<slug>` node.
 * @returns Paragraph strings in document order; empty for any other shape.
 */
const sectionsText = (data: unknown): string[] => {
  const sections = (data as { sections?: unknown } | null | undefined)?.sections

  if (!Array.isArray(sections)) return []

  return sections.flatMap((section) =>
    Array.isArray(section)
      ? section.flatMap((child) =>
          Array.isArray(child) && typeof child[0] === TYPE_STRINGS.STRING ? (child as string[]) : []
        )
      : []
  )
}

/**
 * Idle-warms each deck item's `projects/<slug>` node into
 * `host._printCopy` — one boot chunk resolves every project, and the
 * db layer dedups the reads, so the loop costs a single lazy import.
 * Runs off the critical path (idle slice): the fill falls back to the
 * card blurb whenever the feature copy hasn't resolved by print time.
 * Re-arms on every call — a locale swap clears resolved entries so
 * paper never mixes languages.
 * @param host The CardStack element.
 */
export function warmPrintCopy(host: CardStack): void {
  host._printCopy.clear()

  const lang = store.getters.getlang()

  const locale = lang.locale || LOCALES.EN

  // Same path shape the project view reads — translations/<locale>/projects/<slug>.
  const base = `${lang.database}${locale}${lang.projectPath}`

  const warm = () => {
    for (const item of host.deckItems) {
      const slug = item?.link

      // An empty entry marks the slug in-flight so a fast re-arm can't
      // double-read it — the resolution rewrites it with real copy.
      if (!slug || host._printCopy.has(slug)) continue

      host._printCopy.set(slug, [])

      fetchFirebaseDb(`${base}${slug}`)
        .then((snap) => {
          host._printCopy.set(slug, sectionsText(snap?.exists() ? snap.val() : undefined))
        })
        .catch(() => undefined)
    }
  }

  if (
    typeof window !== TYPE_STRINGS.UNDEFINED &&
    typeof window.requestIdleCallback === TYPE_STRINGS.FUNCTION
  ) {
    window.requestIdleCallback(warm, { timeout: PREFETCH_CONFIG.IDLE_TIMEOUT })
  } else {
    setTimeout(warm, PREFETCH_CONFIG.FALLBACK_DELAY)
  }
}

/**
 * Arms the printable form: freezes the posers and fills every card's
 * description slot with its item copy. Called from the `printprepare`
 * window event — inside print.ts's enter pass, before the media walk
 * strips inline styles, so no poser may run between freeze and strip.
 * @param host The CardStack element.
 */
export function preparePrint(host: CardStack): void {
  host._printing = true

  const items = host.deckItems

  const cards = host.shadowRoot?.querySelectorAll(
    `${CARD_STACK_SELECTORS.CARD_STACK_CARD}[${DATA_ATTRS.DATA_INDEX}]`
  )

  cards?.forEach((card) => {
    const idx = Number(card.getAttribute(DATA_ATTRS.DATA_INDEX))
    const item = items[idx]

    // The desc slot only renders when the item carries a blurb — a
    // blurb-less card with resolved feature copy still gets its seat,
    // appended to the copy column directly.
    const slot =
      card.querySelector(CARD_STACK_SELECTORS.CARD_STACK_CARD_INFO_DESC) ??
      card.querySelector(CARD_STACK_SELECTORS.CARD_STACK_CARD_INFO)

    if (!item || !slot || slot.querySelector(`.${PRINT_CLASSES.FILL}`)) return

    // The project's own sections copy (warmed at mount) is the feature
    // text a magazine spread needs — the card's two-line portfoliolist
    // blurb is the deck summary, kept as the unresolved-data fallback.
    const long = item.link ? host._printCopy.get(item.link) : undefined

    if (!long?.length && !item.description) return

    const fill = document.createElement(HTML_TAGS.SPAN)

    fill.className = PRINT_CLASSES.FILL
    fill.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

    if (long?.length) {
      for (const para of long) {
        const p = document.createElement(HTML_TAGS.SPAN)

        p.className = PRINT_CLASSES.FILL_PARA

        // Section copy carries inline markup (<strong>, links) — a
        // contextual fragment parses it into real nodes without
        // innerHTML; textContent would print the tags literally.
        p.appendChild(document.createRange().createContextualFragment(para))

        fill.appendChild(p)
      }
    } else {
      // CMS copy carries inline markup (<br>, <q>, inline links) — a
      // contextual fragment parses it into real nodes without innerHTML
      // or a cross-component import; textContent would print the tags
      // literally. Fragment parsing never executes embedded content.
      fill.appendChild(document.createRange().createContextualFragment(item.description as string))
    }

    slot.appendChild(fill)
  })
}

/**
 * Tears the printable form down: the poser gate drops first, the
 * injected description fills leave the shadow DOM, and applyPoses()
 * re-writes the fan geometry print.ts stripped (its exit pass also
 * restores recorded attrs — re-posing lands on the same values, so
 * listener order between exit() and this pass doesn't matter).
 * Idempotent — both restore channels may fire for one job.
 * @param host The CardStack element.
 */
export function restorePrint(host: CardStack): void {
  host._printing = false

  host.shadowRoot?.querySelectorAll(`.${PRINT_CLASSES.FILL}`).forEach((el) => el.remove())

  host.applyPoses()
}
