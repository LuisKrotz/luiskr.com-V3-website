/**
 * @file CardStack.tsx
 * @description <card-stack> — the "Selected work" coverflow on the home
 * page: landscape project covers fanned in 3D around a face-on front
 * card, dragged or swiped horizontally (or stepped with prev/next +
 * dots), beside a text column carrying the front project's burn-animated
 * title, Jost description and "Check out" link, plus a "view all" index
 * overlay listing every project. Shows the skeleton fan while project
 * data loads. The stylesheet owns the responsive grid (stacked on
 * phones/portrait tablets, side-by-side from landscape tablets up, a
 * centred max-width wrapper on ultrawide); deck.ts owns the per-tier
 * camera.
 *
 * Facade — behavior lives in ./cardstack-* modules:
 *   cardstack/deck          tier pick, coverflow geometry, measurement, pose + chrome writes
 *   cardstack/info          text-column copy split + re-typing on nav
 *   cardstack/gestures      pointer-drag tracking (slop/velocity/settle)
 *   cardstack/interactions  goTo/click/nav/index-toggle/keys
 *   cardstack/events        scoped listener bindings
 *   cardstack/render        JSX template
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { CARD_STACK_SELECTORS } from '@core/tokens/selectors/card-stack.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { CARD_STACK_LAYOUT, CARD_STACK_TIERS } from '@core/tokens/motion/card-stack.js'
import type { CardStackTier } from '@core/tokens/motion/card-stack.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import { predictiveLoader } from '@core/predictive-loader.js'
import { h } from '@core/jsx.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { onMediaManifest } from '@core/utils/media/manifest.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { teardownBurn } from '@core/utils/burn/loop.js'
import type { BurnCard } from '@core/utils/burn/types.js'
import { applyPoses, deckItems, fitDeckToFront, measure, updateChrome } from './cardstack/deck.js'
import { bindEvents } from './cardstack/events.js'
import {
  applyIndexState,
  closeIndex,
  goTo,
  onCardClick,
  onDotClick,
  onKeyDown,
  onNextClick,
  onPrevClick,
  toggleIndex,
} from './cardstack/interactions.js'
import { onPointerDown, onPointerEnd, onPointerMove } from './cardstack/gestures.js'
import { armAutoplay, applyAutoChrome, holdAutoplay } from './cardstack/autoplay.js'
import { holdBurns } from './cardstack/info.js'
import { warmPrintCopy } from './cardstack/print.js'
import { renderCardStack } from './cardstack/render.js'
import type { CardStackItem, CardStackTranslations } from './cardstack/types.js'
import '@website/components/media/DrawText.js'
import cardStackStyles from '@core/sass/components/home/card-stack.scss?tiers'

/**
 * The CardStack — stacked featured-project deck.
 */
export class CardStack extends BaseComponent {
  _processedItems: CardStackItem[] = [] // portfolio items pushed by the view (featured flag rides on each)
  _translations: CardStackTranslations | null = null // pages/HOME locale node
  _printCopy = new Map<string, string[]>() // warmed projects/<slug> feature paragraphs — print prefers them over the card blurb
  activeIdx = 0 // deck index of the front card
  indexOpen = false // whether the all-projects index overlay is revealed
  ext: string = MEDIA.EXT // CDN image extension
  _tier: CardStackTier = CARD_STACK_TIERS[CARD_STACK_TIERS.length - 1] // active coverflow camera — measure() re-picks it per viewport
  _cardW: number = CARD_STACK_LAYOUT.CARD_W_FALLBACK // measured card width px
  _cardH: number = CARD_STACK_LAYOUT.CARD_W_FALLBACK * this._tier.CARD_H_RATIO
  _step: number = CARD_STACK_LAYOUT.CARD_W_FALLBACK * this._tier.FIRST_STEP // drag px per card
  _peek: number = this._tier.PEEK // visible cards per side — fitted to the deck width
  _sizesDirty = true // card width/height + perspective writes pending after a measure()
  _dragX = 0 // live drag offset px — the fan's virtual front is activeIdx - _dragX/_step
  _dragStartX = 0 // pointer-down clientX
  _dragStartY = 0 // pointer-down clientY
  _lastPX = 0 // last coalesced sample clientX (velocity window)
  _lastT = 0 // last coalesced sample timestamp
  _velX = 0 // flick velocity px/ms
  _dragActive = false // slop committed — the gesture owns the fan
  _gestureDead = false // vertical scroll won — ignore until next pointer-down
  _pointerId: number | null = null // tracked pointer id (null = no gesture)
  _suppressClick = false // trailing click after a committed drag — swallowed once
  _rafId: number | null = null // pending pose write rAF
  _cardEls: Element[] = [] // cached card nodes — the rAF loop never re-queries
  _deckEl: Element | null = null // cached deck region — pose/size writes target it
  _deckW = 0 // last measured deck box — the pose math's fit input
  _deckH = 0
  _stageH = 0 // the section's viewport allotment (vh minus header/foot chrome) — measure()'s height bound for card sizing; 0 until the section rect is measurable. Copy-carrying cards never cap to it — content sizes them and the page absorbs the overflow
  _autoStage = false // content-sized section (the ≥3840 rung): min-height computed to 0 — the fan's 1fr deck row has no allotment, so fitDeckToFront publishes the card band itself
  _deckRO: ResizeObserver | null = null // re-measures when the grid resizes the deck stage
  _fitRO: ResizeObserver | null = null // re-fits the deck when the front card's copy height changes
  _fitFront: Element | null = null // the card node _fitRO currently watches
  _frontExtra = 0 // px the stacked front card's live height differs from the ratio height (pileH input — signed: copy growth positive, short copy negative); the card never caps — copy sizes it and the page absorbs the overflow
  _loadedCovers = new Map<string, string>() // cover key → highest confirmed painted tier
  _unsubManifest: (() => void) | null = null // media-manifest arrival — re-renders with proven rungs
  _autoOn = false // autoplay armed — the 10s border-light countdown is live (running or paused)
  _autoPaused = false // user-paused via the play/pause transport (resumes only through it)
  _autoHeld = false // visibility-held — IO/visibilitychange froze the clock; resumes by itself
  _autoBank = 0 // elapsed ms banked before the current clock segment (pause/hold carry-over)
  _autoT0 = 0 // performance.now() at the current segment's start — autoElapsed reads against it
  _autoTimer: ReturnType<typeof setTimeout> | null = null // pending autoTick timeout (null = unarmed)
  _autoRaf = 0 // autoplay progress-paint rAF — writes --card-stack-timer-p on the host each frame while running
  _autoIO: IntersectionObserver | null = null // section on/off-screen hold for the countdown
  _burnHeld = false // burn sessions frozen by the section's off-screen hold — spin() leaves them disarmed until holdBurns releases (the in-card title draw-in waits for scroll-in)
  _autoArmed = false // one-shot mount arm — the countdown starts once items exist
  _printing = false // print job in flight — gates applyPoses/fitDeckToFront so the live posers can't rewrite the inline geometry print.ts stripped for the snapshot

  constructor() {
    super(cardStackStyles)
  }

  /** Pre-render sizing pass — measure() runs once before the very first
   *  render so the skeleton pile (and the real cards' first paint) draw
   *  at their measured dimensions instead of the CARD_W_FALLBACK guess:
   *  without it the skeleton paints ~40% taller than the settled card
   *  box and pops smaller when items land. The deck element doesn't
   *  exist yet, so the read is viewport-based — close enough that the
   *  first fit's correction is a few px, not a visible reflow. */
  override onInit(): void {
    measure(this)
  }

  /** The one-rAF-per-frame pose write armed by the drag path — a bound
   *  field so the gesture loop allocates zero closures per frame. */
  _dragTick = () => {
    this._rafId = null

    applyPoses(this)
  }

  /** Setter/getter — portfolio items pushed by the view. */

  set processedItems(val: CardStackItem[]) {
    this._processedItems = Array.isArray(val) ? val : []

    const len = deckItems(this).length

    if (len && this.activeIdx >= len) this.activeIdx = len - 1

    if (this._isMounted) {
      this._updateDom()
    }

    if (len) warmPrintCopy(this)
  }

  get processedItems(): CardStackItem[] {
    return this._processedItems
  }

  /** Setter/getter — locale strings for the section labels. */

  set translations(val: CardStackTranslations | null) {
    this._translations = val

    if (this._isMounted) {
      this._updateDom()
    }

    // A locale swap invalidates the warmed feature copy — re-arm so the
    // paper version speaks the same language as the deck.
    if (deckItems(this).length) warmPrintCopy(this)
  }

  get translations(): CardStackTranslations | null {
    return this._translations
  }

  /** The featured subset the deck fans (whole list when none flagged). */

  get deckItems(): CardStackItem[] {
    return deckItems(this)
  }

  /** CDN base URL for card media. */

  get storage() {
    return store.getters.getStorage()
  }

  /** Resolved copy — live translations over the build-time English
   *  snapshot, so every label renders text before Firebase resolves. */

  get _t(): Required<CardStackTranslations> {
    const fb = FALLBACK_PAGES[TRANSLATION_KEYS.HOME] as Required<CardStackTranslations>

    return { ...fb, ...(this._translations as CardStackTranslations) }
  }

  override onMounted() {
    bindEvents(this)

    // The covers manifest is boot-idle-deferred — first render emits
    // originals-only <img>s; on arrival the cards rebuild with proven
    // thumb/webp rungs and the browser re-fetches the light variants.
    this._unsubManifest = onMediaManifest(() => {
      this._updateDom()
    })

    // The fan's slide/tilt motion is the carousel animation class — its
    // crawler description already ships under components.animations.
    applyAnimationDesc(this, ANIMATION_IDS.CARD_STACK)

    // Autoplay's off-screen hold — the countdown banks while the deck
    // scrolls out of view and resumes on re-entry (a user pause stays
    // paused; holdAutoplay only frees its own hold). The same observer
    // freezes every burn session: a deck mounted below the fold keeps
    // its title draw-in banked until the section actually enters the
    // viewport instead of spending it off-screen.
    if (typeof IntersectionObserver !== TYPE_STRINGS.UNDEFINED) {
      this._autoIO = new IntersectionObserver((entries) => {
        const hit = entries[0]

        if (!hit) return

        holdAutoplay(this, !hit.isIntersecting)

        holdBurns(this, !hit.isIntersecting)
      })

      this._autoIO.observe(this)
    }
  }

  override onDestroy() {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId)

    this._rafId = null

    this._deckRO?.disconnect()

    this._deckRO = null

    this._fitRO?.disconnect()

    this._fitRO = null

    this._fitFront = null

    // A re-mount must re-observe even if the same deck node survives.
    this._deckEl = null

    // A live title burn must not keep stepping its rAF on the detached
    // shadow tree — cancel the pending frame, then run the normal
    // teardown so the ink/classes restore on the still-queryable DOM.
    // The text column's session and every in-card session (the stacked
    // tiers burn the project title inside the card itself) all drain.
    const burn = (this.$(CARD_STACK_SELECTORS.CARD_STACK_INFO) as BurnCard | null)?._burn

    if (burn) {
      if (burn.raf) cancelAnimationFrame(burn.raf)

      burn.raf = 0

      teardownBurn(burn)
    }

    this._cardEls.forEach((cardEl) => {
      const s = (cardEl as BurnCard)._burn

      if (!s) return

      if (s.raf) cancelAnimationFrame(s.raf)

      s.raf = 0

      teardownBurn(s)
    })

    if (typeof this._unsubManifest === TYPE_STRINGS.FUNCTION) {
      this._unsubManifest?.()

      this._unsubManifest = null
    }

    // Drain the autoplay surfaces — a detached deck can't tick a dead
    // clock or hold an observer on a stale node. _autoArmed resets so a
    // re-mount starts a fresh countdown (respecting reduced-motion).
    if (this._autoTimer) {
      clearTimeout(this._autoTimer)

      this._autoTimer = null
    }

    if (this._autoRaf) {
      cancelAnimationFrame(this._autoRaf)

      this._autoRaf = 0
    }

    this._autoIO?.disconnect()

    this._autoIO = null

    this._autoOn = false

    this._autoArmed = false
  }

  /** Re-caches card nodes + re-measures after every render, then republishes
   *  poses/chrome/index state against the fresh DOM. */

  override onUpdated() {
    this._cardEls = this.$$(CARD_STACK_SELECTORS.CARD_STACK_CARD)

    const deck = this.$(CARD_STACK_SELECTORS.CARD_STACK_DECK)

    if (deck !== this._deckEl) this._observeDeck(deck)

    this._deckEl = deck

    // Data gate before any layout read (forced-reflow governance): an
    // empty deck has no cards to pose, so measure/applyPoses/updateChrome
    // would only burn a getBoundingClientRect for nothing — and a second
    // _updateDom in the same task (items + translations pushed back to
    // back) would turn that read into an interleaved reflow.
    if (deckItems(this).length) {
      measure(this)

      applyPoses(this)

      updateChrome(this)

      // One-shot autoplay arm — the countdown starts once real items
      // exist. Reduced-motion users keep the deck manual (the play
      // transport can still arm it by hand — an explicit choice).
      if (!this._autoArmed) {
        this._autoArmed = true

        if (!document.documentElement.classList.contains(STATE_CLASSES.REDUCED_MOTION)) {
          armAutoplay(this)
        }
      }
    }

    applyIndexState(this)

    // Re-assert the autoplay chrome after every render — a re-render
    // rebuilds the section's className/inline-style from the template,
    // wiping the imperative --auto/--auto-paused/--armed classes while
    // the clock keeps running.
    applyAutoChrome(this)

    predictiveLoader.scanAndObserve(this.shadowRoot)
  }

  /**
   * Re-points the deck ResizeObserver at a (re-rendered) deck node. The
   * stylesheet owns the deck box — a grid row that grows/shrinks with
   * the text column, fonts, and orientation — so a box change re-runs
   * measure + applyPoses even when the window itself never resized.
   * The callback fires after layout, so its rect read never forces a
   * reflow; card writes are absolutely positioned and can't resize the
   * deck, so the observer never feeds itself.
   * @param deck The fresh deck element (null on skeleton-less renders).
   */
  _observeDeck(deck: Element | null): void {
    this._deckRO?.disconnect()

    if (!deck || typeof ResizeObserver === TYPE_STRINGS.UNDEFINED) {
      this._deckRO = null

      return
    }

    this._deckRO ??= new ResizeObserver(() => {
      if (!deckItems(this).length) return

      measure(this)

      applyPoses(this)

      // The fresh stage budget must re-fit the pile — the mount-time
      // fit ran before the deck had a measurable rect (budget 0, no
      // cap), so without this the band/band-cap never converge.
      fitDeckToFront(this)
    })

    this._deckRO.observe(deck)
  }

  /** Deck measurement — see cardstack/deck.ts. */

  measure(): void {
    measure(this)
  }

  /** Fan pose write — see cardstack/deck.ts. */

  applyPoses(): void {
    applyPoses(this)
  }

  /** Counter/dots/a11y refresh — see cardstack/deck.ts. */

  updateChrome(): void {
    updateChrome(this)
  }

  /** Navigate the fan to a deck index — see cardstack/interactions.ts. */

  goTo(idx: number): void {
    goTo(this, idx)
  }

  /** Prev control. */

  onPrevClick(): void {
    onPrevClick(this)
  }

  /** Next control. */

  onNextClick(): void {
    onNextClick(this)
  }

  /** Dot-nav click. */

  onDotClick(idx: number): void {
    onDotClick(this, idx)
  }

  /** Card activation — side cards reposition, front card navigates. */

  onCardClick(item: CardStackItem, idx: number): void {
    onCardClick(this, item, idx)
  }

  /** Toggles the all-projects index overlay. */

  toggleIndex(): void {
    toggleIndex(this)
  }

  /** Closes the index overlay. */

  closeIndex(): void {
    closeIndex(this)
  }

  /** Delegated keydown — arrows step the fan, Escape closes the index. */

  onKeyDown(e: Event): void {
    onKeyDown(this, e)
  }

  /** Pointer-down drag arm — see cardstack/gestures.ts. */

  onPointerDown(e: Event): void {
    onPointerDown(this, e)
  }

  /** Pointer-move drag tracking — see cardstack/gestures.ts. */

  onPointerMove(e: Event): void {
    onPointerMove(this, e)
  }

  /** Pointer-up/cancel settle — see cardstack/gestures.ts. */

  onPointerEnd(e: Event): void {
    onPointerEnd(this, e)
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    return renderCardStack(this)
  }
}

// Registration guard: define() throws on duplicate tag — `get` check keeps
// module re-evaluation (HMR, coverage re-imports) safe.
if (!customElements.get(COMPONENT_TAGS.CARD_STACK)) {
  customElements.define(COMPONENT_TAGS.CARD_STACK, CardStack)
}
