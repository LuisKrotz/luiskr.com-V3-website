/**
 * @file mentions-deck/types.ts — data shapes for <mentions-deck>: the CMS
 * mention row, the per-card pose record written to the DOM, and the
 * translations subset the component reads.
 */

/**
 * A mention_items row as pushed by the store — `link` is the outbound
 * award URL, `media` the optional badge image (path + intrinsic size for
 * aspect layout), `icon`/`description`/`label` the rendered copy fields.
 * All optional: cards tolerate partial CMS rows without render guards.
 */
export interface MentionItem {
  /** Outbound award/mention URL. */
  link?: string
  /** Badge/trophy image descriptor — path joins the CDN storage base. */
  media?: { path?: string; width?: number | string; height?: number | string }
  /** Emoji/glyph fallback shown when no media ships. */
  icon?: string
  /** Card copy — may carry `<br>`/inline markup from the CMS. */
  description?: string
  /** Accessible label when description is absent. */
  label?: string
}

/**
 * The computed strip pose for one card — written into inline styles by
 * applyPoses(); `visible` also drives aria-hidden/tabindex on the card.
 */
export interface MentionPose {
  x: number
  y: number
  rot: number
  scale: number
  opacity: number
  z: number
  visible: boolean
}

/** The pages/HOME translation keys <mentions-deck> consumes. */
export interface MentionsDeckTranslations {
  /** "Drag or swipe to explore" affordance copy under the strip. */
  deckHint?: string
}
