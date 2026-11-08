/**
 * @file MentionsDeck.tsx
 * @description <mentions-deck> — the "Some mentions" card deck inside the
 * home contact band: award/mention cards in a flat edge-to-edge strip
 * centered on the front card, auto-advancing on a dwell clock (≥50%
 * visibility + reduced-motion gated), dragged or swiped horizontally (or
 * stepped with dots + arrow keys). Shows the skeleton strip while
 * mention data loads.
 *
 * Facade — behavior lives in ./mentions-deck-* modules:
 *   mentions-deck/deck          strip geometry, measurement, pose + chrome writes
 *   mentions-deck/gestures      pointer-drag tracking (slop/velocity/settle)
 *   mentions-deck/interactions  goTo/click/nav/keys
 *   mentions-deck/autoplay      dwell-clock auto-advance + pause/resume
 *   mentions-deck/observer      ≥50% visibility gate + resize refit
 *   mentions-deck/events        scoped listener bindings
 *   mentions-deck/render        JSX template
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MENTIONS_DECK_SELECTORS } from '@core/tokens/selectors/mentions-deck.js'
import { MENTIONS_DECK_LAYOUT } from '@core/tokens/motion/mentions-deck.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import mentionsDeckStyles from '@core/sass/components/carousel/mentions-deck.scss?inline'
import {
  startAutoplay,
  stopAutoplay,
  tickAutoplay,
  pauseAutoplay,
  resumeAutoplay,
} from './mentions-deck/autoplay.js'
import { bindEvents } from './mentions-deck/events.js'
import { applyPoses, measure, updateChrome } from './mentions-deck/deck.js'
import {
  cardIdxFromEvent,
  goTo,
  onCardClick,
  onDotClick,
  onKeyDown,
} from './mentions-deck/interactions.js'
import { onPointerDown, onPointerEnd, onPointerMove } from './mentions-deck/gestures.js'
import { onResize, setupObserver } from './mentions-deck/observer.js'
import { renderMentionsDeck } from './mentions-deck/render.js'
import type { MentionItem, MentionsDeckTranslations } from './mentions-deck/types.js'

/**
 * Bundled default heading for <mentions-deck> with any trailing colon stripped
 * so "Some mentions:" renders as "SOME MENTIONS" per the reference design.
 */
const DEFAULT_MENTIONS_TITLE = (
  FALLBACK_PAGES[TRANSLATION_KEYS.ABOUT] as { mentions: string }
).mentions.replace(/\s*:\s*$/, CHAR_STRINGS.EMPTY)

/**
 * <mentions-deck> element — a looping flat strip for the award/mention
 * rows. Ring-offset geometry means the loop wraps natively (no clone
 * slides); a dwell-clock autoplay advances the front card while ≥50%
 * visible, and pointer drags slide the strip 1:1 with slop/flick settle.
 * All behavior delegates to `./mentions-deck/*`; this class is the state
 * holder + custom-element facade.
 */
export class MentionsDeck extends BaseComponent {
  /** Mention rows pushed by the host — [] renders the skeleton strip. */
  _items: MentionItem[] = []
  /** Locale strings for the deck chrome (pages/HOME node). */
  _translations: MentionsDeckTranslations | null = null
  /** Section heading — defaults to the bundled about.mentions copy. */
  _title: string = DEFAULT_MENTIONS_TITLE
  /** Deck index of the front card. */
  activeIdx = 0
  /** Autoplay dwell per front card (ms) — pushes the strip when idle. */
  duration: number = MENTIONS_DECK_LAYOUT.AUTOPLAY_MS
  /** Measured card width px. */
  _cardW: number = MENTIONS_DECK_LAYOUT.CARD_W_FALLBACK
  _cardH: number = MENTIONS_DECK_LAYOUT.CARD_W_FALLBACK * MENTIONS_DECK_LAYOUT.CARD_H_RATIO
  _step: number = MENTIONS_DECK_LAYOUT.CARD_W_FALLBACK * (1 + MENTIONS_DECK_LAYOUT.GAP_RATIO)
  /** Front-card anchor x (px) — the strip centers on this point; it also
   *  doubles as the edge distance the card dissolve measures against. */
  _anchor: number = MENTIONS_DECK_LAYOUT.CARD_W_FALLBACK * MENTIONS_DECK_LAYOUT.ANCHOR_FRAC
  /** Edge-dissolve lane px — card width × FADE_FRAC on wide decks, 0 on
   *  mobile so partial neighbours peek at full opacity under the clip. */
  _fadeSpan: number = MENTIONS_DECK_LAYOUT.CARD_W_FALLBACK * MENTIONS_DECK_LAYOUT.FADE_FRAC
  /** Card width/height writes pending after a measure(). */
  _sizesDirty = true
  /** Live drag offset px — the strip's virtual front is activeIdx - _dragX/_step. */
  _dragX = 0
  _dragStartX = 0 // pointer-down clientX
  _dragStartY = 0 // pointer-down clientY
  _lastPX = 0 // last coalesced sample clientX (velocity window)
  _lastT = 0 // last coalesced sample timestamp
  _velX = 0 // flick velocity px/ms
  _dragActive = false // slop committed — the gesture owns the strip
  _gestureDead = false // vertical scroll won — ignore until next pointer-down
  _pointerId: number | null = null // tracked pointer id (null = no gesture)
  _suppressClick = false // trailing click after a committed drag — swallowed once
  _rafId: number | null = null // pending pose write rAF
  _cardEls: Element[] = [] // cached card nodes — the rAF loop never re-queries
  _deckEl: Element | null = null // cached deck region — pose/size writes target it
  /** Any viewport visibility ever observed. */
  isEnteredViewport = false
  /** ≥50% visible — the autoplay gate. */
  isFullyVisible = false
  /** RAF cycle active flag. */
  autoplayRunning = false
  /** performance.now() at cycle start. */
  autoplayStart: number | null = null
  /** Accumulated pause→resume offset so dwell survives interruptions. */
  autoplayElapsed = 0
  /** Autoplay RAF handle. */
  autoplayRafId: number | null = null
  /** IntersectionObserver handle driving the visibility flags. */
  observer: IntersectionObserver | null = null

  constructor() {
    super(mentionsDeckStyles)
  }

  /** The one-rAF-per-frame pose write armed by the drag path — a bound
   *  field so the gesture loop allocates zero closures per frame. */
  _dragTick = () => {
    this._rafId = null

    applyPoses(this)
  }

  /** Setter/getter — mention rows pushed by the host (identity-guarded
   *  so repeat pushes with identical data don't restart autoplay). */

  set items(val: MentionItem[] | null | undefined) {
    const newItems = Array.isArray(val) ? val : []

    if (
      this._items === newItems ||
      (this._items.length === newItems.length && this._items.every((it, i) => it === newItems[i]))
    ) {
      return
    }

    this._items = newItems

    if (this._items.length && this.activeIdx >= this._items.length) {
      this.activeIdx = this._items.length - 1
    }

    if (this._isMounted) {
      this._updateDom()
    }
  }

  get items(): MentionItem[] {
    return this._items
  }

  /** Setter/getter — locale strings for the deck chrome. */

  set translations(val: MentionsDeckTranslations | null) {
    if (this._translations === val) return

    this._translations = val

    if (this._isMounted) {
      this._updateDom()
    }
  }

  get translations(): MentionsDeckTranslations | null {
    return this._translations
  }

  /** Setter/getter — section heading text. */

  override set title(val: string | null | undefined) {
    const newTitle = (val || DEFAULT_MENTIONS_TITLE).replace(/\s*:\s*$/, CHAR_STRINGS.EMPTY)

    if (this._title === newTitle) return

    this._title = newTitle

    if (this._isMounted) this._updateDom()
  }

  override get title(): string {
    return this._title
  }

  /** Resolved copy — live translations over the build-time English
   *  snapshot, so the hint renders text before Firebase resolves. */

  get _t(): Required<MentionsDeckTranslations> {
    const fb = FALLBACK_PAGES[TRANSLATION_KEYS.HOME] as Required<MentionsDeckTranslations>

    return { ...fb, ...(this._translations as MentionsDeckTranslations) }
  }

  /** Mount: wire events/observer, subscribe to the store for reduced-motion/overlay. */
  override onMounted() {
    bindEvents(this)

    setupObserver(this)

    this.subscribe(store)

    // The strip's slide motion is the carousel animation class — its
    // crawler description already ships under components.animations.
    applyAnimationDesc(this, ANIMATION_IDS.CAROUSEL)
  }

  /** Re-caches card nodes + re-measures after every render, then republishes
   *  poses/chrome against the fresh DOM. */

  override onUpdated() {
    this._cardEls = this.$$(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_CARD)

    this._deckEl = this.$(MENTIONS_DECK_SELECTORS.MENTIONS_DECK_DECK)

    measure(this)

    applyPoses(this)

    updateChrome(this)
  }

  /**
   * Pref commits → kill autoplay immediately (no residual RAF); an
   * overlay closing resumes a stopped cycle only when the deck is still
   * ≥50% on screen. The !autoplayRunning guard matters: store commits
   * arrive for unrelated state too, and a bare _startAutoplay would
   * re-base the dwell clock on every commit.
   */
  override onStoreUpdate() {
    if (store.getters.getReducedMotion() || store.getters.getOverlayOpen()) {
      this._stopAutoplay()
    } else if (this.isFullyVisible && !this.autoplayRunning) {
      this._startAutoplay()
    }
  }

  /** Teardown: stop RAF + observer — every async handle is released so nothing fires after disconnect. */
  override onDestroy() {
    this._stopAutoplay()

    if (this.observer) {
      this.observer.disconnect()

      this.observer = null
    }

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)

      this._rafId = null
    }
  }

  // ─── Delegates — ./mentions-deck/* ─────────────────────────────────────────
  /** Deck measurement — see mentions-deck/deck.ts. */
  measure(): void {
    measure(this)
  }
  /** Strip pose write — see mentions-deck/deck.ts. */
  applyPoses(): void {
    applyPoses(this)
  }
  /** Dots/a11y refresh — see mentions-deck/deck.ts. */
  updateChrome(): void {
    updateChrome(this)
  }
  /** Navigate the strip to a deck index — see mentions-deck/interactions.ts. */
  goTo(idx: number): void {
    goTo(this, idx)
  }
  /** Dot-nav click. */
  onDotClick(idx: number): void {
    onDotClick(this, idx)
  }
  /** Card activation — side cards reposition, front card navigates. */
  onCardClick(item: MentionItem, idx: number): void {
    onCardClick(this, item, idx)
  }
  /** Delegated keydown — arrows step the strip. */
  onKeyDown(e: Event): void {
    onKeyDown(this, e)
  }
  /** Card/index resolution for the click path — see interactions.ts. */
  cardIdxFromEvent(e: Event): { el: Element; idx: number } | null {
    return cardIdxFromEvent(e)
  }
  /** Pointer-down drag arm — see mentions-deck/gestures.ts. */
  onPointerDown(e: Event): void {
    onPointerDown(this, e)
  }
  /** Pointer-move drag tracking — see mentions-deck/gestures.ts. */
  onPointerMove(e: Event): void {
    onPointerMove(this, e)
  }
  /** Pointer-up/cancel settle — see mentions-deck/gestures.ts. */
  onPointerEnd(e: Event): void {
    onPointerEnd(this, e)
  }
  /** Starts the autoplay RAF cycle (gated by visibility + reduced-motion). */
  _startAutoplay(): void {
    startAutoplay(this)
  }
  /** Stops the autoplay RAF cycle. */
  _stopAutoplay(): void {
    stopAutoplay(this)
  }
  /** Freezes the dwell clock (hover, committed drag). */
  _pauseAutoplay(): void {
    pauseAutoplay(this)
  }
  /** Re-arms the dwell clock after a pause. */
  _resumeAutoplay(): void {
    resumeAutoplay(this)
  }
  /** One autoplay frame — advances when dwell elapsed, then self-schedules. */
  _tickAutoplay(): void {
    tickAutoplay(this)
  }
  /** Creates the IntersectionObserver driving isEnteredViewport/isFullyVisible. */
  _setupObserver(): void {
    setupObserver(this)
  }
  /** Resize handler — remeasures card geometry and re-poses. */
  _onResize(): void {
    onResize(this)
  }

  /** JSX template (delegate — ./mentions-deck/render.tsx). */

  override render() {
    return renderMentionsDeck(this)
  }
}

// Registration guard: define() throws on duplicate tag — `get` check keeps
// module re-evaluation (HMR, coverage re-imports) safe.
if (!customElements.get(COMPONENT_TAGS.MENTIONS_DECK)) {
  customElements.define(COMPONENT_TAGS.MENTIONS_DECK, MentionsDeck)
}
