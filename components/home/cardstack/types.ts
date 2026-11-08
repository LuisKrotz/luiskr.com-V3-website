/**
 * @file cardstack/types.ts — data shapes for <card-stack>: the portfolio
 * item, the per-card pose record written to the DOM, and the translations
 * subset the component reads.
 */

/**
 * A portfoliolist entry as pushed by the view — `link` joins to project
 * routes, `featured` selects the deck subset, and the index signature
 * passes through extra CMS fields untouched.
 */
export interface CardStackItem {
  /** Route the card links to. */
  link?: string
  /** Cover image stem. */
  image?: string
  /** Accessible label. */
  label?: string
  /** Card heading. */
  title?: string
  /** Body copy (may carry `<br>` markup from the CMS). */
  description?: string
  /** Optional index subtitle (category/tagline when the CMS provides one). */
  category?: string
  subtitle?: string
  /** Deck membership — featured items fan in the stack. */
  featured?: boolean
  [key: string]: unknown
}

/**
 * The computed coverflow pose for one card — written into inline styles
 * by applyPoses(); `visible` also drives the --hidden class and the
 * reveal/dissolve transitions.
 */
export interface CardPose {
  /** Horizontal centre offset from the deck centre (px). */
  x: number
  /** Vertical centre offset from the deck centre (px) — 0 on fan tiers;
   *  the stacked tiers' down-right cascade carries it. */
  y: number
  /** Z recess (px, ≤ 0) — the perspective divide shrinks the card. */
  depth: number
  /** Y-axis turn (deg) — side cards face the front card on fan tiers. */
  rot: number
  /** Z-axis tilt (deg) — 0 on fan tiers; the stacked cascade leans
   *  deeper cards like a dealt deck. */
  rotZ: number
  /** Opacity written for visible cards. */
  opacity: number
  /** Extra scale — the fan's active-card boost (CARD_STACK_LAYOUT.
   *  FRONT_SCALE) easing to 1 as the card slides away; 1 on stacked
   *  tiers. */
  scale: number
  /** z-index ladder — the front card paints on top. */
  z: number
  /** Inside the per-side peek window. */
  visible: boolean
}

/** One project's copy for the text column — split from the CMS item. */
export interface CardStackInfo {
  /** Project name — the paper-burn's raster source. */
  title: string
  /** Full CMS description (`<br>` markup kept for <draw-text>). */
  body: string
  /** First-sentence summary of `body` — the stacked cards' ≤4-line
   *  mobile description (the desktop column keeps the full text). */
  summary: string
  /** Localized project route ('' without a slug). */
  href: string
}

/** The pages/HOME translation keys <card-stack> consumes. */
export interface CardStackTranslations {
  featured?: string
  /** Top-left section title ("FEATURED PROJECTS") — distinct from the
   *  mid-left two-line counter so the phrase isn't repeated. */
  featuredTitle?: string
  explore?: string
  deckHint?: string
  /** The touch-only hint shown instead of deckHint when the input
   *  method is touch — "Swipe." (no drag affordance exists there). */
  swipeHint?: string
  viewAll?: string
  allProjects?: string
  projectLabel?: string
  /** Autoplay transport aria-labels — state-describing actions read
   *  on the play/pause button ("Play autoplay"/"Pause autoplay"). */
  autoplayPlay?: string
  autoplayPause?: string
}
