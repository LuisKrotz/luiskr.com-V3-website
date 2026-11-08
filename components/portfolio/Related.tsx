/**
 * @file portfolio/Related.js
 * @description <portfolio-related> — "related projects" conveyor at the
 * bottom of project pages: a vertical accordion list of sibling items
 * (media + title + description) that keeps three rows unfolded and cycles
 * the rest through a fold/unfold bellows — the infinite wrap returns to
 * the first item through the same expand-from-collapsed motion.
 *
 * Facade — types/matcher/fetch/JSX live in ./related/.
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { KEYS } from '@core/tokens/primitives.js'
import { RELATED_LAYOUT, RELATED_TIMING } from '@core/tokens/motion/related.js'
import { h } from '@core/jsx.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { buildProjectsList } from './related/match.js'
import { fetchData, storedTranslations } from './related/data.js'
import { renderRelated } from './related/render.js'
import { onMediaManifest } from '@core/utils/media/manifest.js'
import { mountRingSheen } from '@core/utils/gpu/ring-sheen.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import type { RingSheenSession } from '@core/utils/gpu/ring-sheen.js'
import type { HomeItem, RelatedCard, RelatedTranslations } from './related/types.js'
import internalStyles from '@core/sass/components/internals/internals.scss?inline'
import '@website/components/media/DrawText.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'

/**
 * The PortfolioRelated — related class.
 */
export class PortfolioRelated extends BaseComponent {
  translations: RelatedTranslations = {}

  homePortfolio: HomeItem[] = []

  _unsubRouter: (() => void) | null = null

  _unsubManifest: (() => void) | null = null // media-manifest arrival — re-renders cards with proven webp rungs

  _ringSession: RingSheenSession | null = null // live ring-sheen overlay on the card strip

  _ringEl: Element | null = null // the .related-list node the ring session mounted on

  _loadedCovers = new Map<string, string>() // cover key → highest confirmed painted tier — re-renders re-emit it loaded

  _listEl: Element | null = null // the .related-list node the keydown handler is bound to

  _listReorderTimer: ReturnType<typeof setTimeout> | null = null // pending collapsed-node move watchdog

  _listReorderNode: Element | null = null // folded row waiting to join the list tail

  _listReorderContainer: Element | null = null // the list that owned _listReorderNode

  constructor() {
    super(internalStyles)
  }

  /**
   * Arrow-key steps while focus sits inside the conveyor — ↓ advances,
   * ↑ rewinds. preventDefault stops the key from scrolling the page
   * under the user's hand.
   */
  _onListKeydown = (e: Event): void => {
    const key = (e as KeyboardEvent).key

    if (key === KEYS.ARROW_DOWN) {
      e.preventDefault()
      this._stepList(1)
    } else if (key === KEYS.ARROW_UP) {
      e.preventDefault()
      this._stepList(-1)
    }
  }

  /** CDN base URL for project media. */

  get storage() {
    return store.getters.getStorage() || CDN_URLS.CDN_BASE
  }

  /**
   * Maps the DB `related.projects` rows into display-ready cards — see
   * related/match.ts for the fuzzy link/image/title join against the
   * home portfoliolist.
   */
  get projectsList(): RelatedCard[] {
    return buildProjectsList(this.translations, this.homePortfolio, this.storage)
  }

  /**
   * One conveyor step: the first unfolded row folds (1fr→0fr + inert), the
   * first folded row after the window unfolds. The DOM invariant is
   * [unfolded window][folded tail…] — kept by appending each folded node
   * to the tail once its collapse lands (zero height ⇒ invisible), so the
   * wrap back to the first item lands through the same
   * expand-from-collapsed accordion motion as every other step.
   */
  _advanceList(): void {
    const list = this.$(`.${RELATED_CLASSES.RELATED_LIST}`)

    if (!list) return

    const items = list.children

    let firstOpen = -1
    let lastOpen = -1

    for (let i = 0; i < items.length; i++) {
      const el = items[i]

      if (!el.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM)) continue
      if (el.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)) continue

      if (firstOpen < 0) firstOpen = i

      lastOpen = i
    }

    if (firstOpen < 0) return

    // The row to unfold is the first folded ITEM after the window —
    // non-item children (anim-desc sr-only nodes, the ring-sheen canvas)
    // float between rows and must be skipped, never stall the conveyor.
    let entering: Element | null = null

    for (let i = lastOpen + 1; i < items.length; i++) {
      if (items[i].classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)) {
        entering = items[i]

        break
      }
    }

    if (!entering) return

    const leaving = items[firstOpen]

    leaving.classList.add(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)
    leaving.setAttribute(COMMON_ATTRS.INERT, ATTR_VALUES.EMPTY)
    leaving.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

    entering.classList.remove(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)
    entering.removeAttribute(COMMON_ATTRS.INERT)
    entering.removeAttribute(ARIA_ATTRS.ARIA_HIDDEN)

    this._scheduleListReorder(list, leaving)
  }

  /**
   * Moves a just-folded node to the list tail once its 0fr collapse has
   * finished (REORDER_DELAY is sized past the .6s fold). A second step
   * landing before the watchdog — possible through back-to-back manual
   * steps — flushes the pending move first, keeping the
   * [open][closed…] invariant intact.
   * @param container The .related-list node that owns the row.
   * @param node The folded row to append to the tail.
   */
  _scheduleListReorder(container: Element, node: Element): void {
    this._flushListReorder()

    this._listReorderContainer = container
    this._listReorderNode = node

    this._listReorderTimer = setTimeout(
      () => this._flushListReorder(),
      RELATED_TIMING.REORDER_DELAY
    )
  }

  /**
   * One manual conveyor step: +1 runs _advanceList (top row folds, next
   * unfolds); −1 runs _retreatList — the most recently folded row (the
   * tail's end) moves to the top and unfolds while the window's bottom
   * row folds in place — the bellows played backwards. A pending
   * forward reorder flushes first so the [open][closed…] scan reads
   * settled DOM. No tail-append is needed on rewind: the folding row
   * already sits exactly where folded rows live (first slot after the
   * window).
   * @param dir 1 advances, −1 rewinds.
   */
  _stepList(dir: number): void {
    if (dir > 0) {
      this._advanceList()
    } else {
      this._retreatList()
    }
  }

  /** The reverse fold — see _stepList. */
  _retreatList(): void {
    const list = this.$(`.${RELATED_CLASSES.RELATED_LIST}`)

    if (!list) return

    this._flushListReorder()

    const items = list.children

    let lastOpen = -1
    let tailEnd: Element | null = null

    for (let i = 0; i < items.length; i++) {
      const el = items[i]

      if (!el.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM)) continue

      if (el.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)) {
        tailEnd = el
      } else {
        lastOpen = i
      }
    }

    if (lastOpen < 0 || !tailEnd) return

    const leaving = items[lastOpen]

    leaving.classList.add(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)
    leaving.setAttribute(COMMON_ATTRS.INERT, ATTR_VALUES.EMPTY)
    leaving.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

    list.insertBefore(tailEnd, items[0])

    tailEnd.classList.remove(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)
    tailEnd.removeAttribute(COMMON_ATTRS.INERT)
    tailEnd.removeAttribute(ARIA_ATTRS.ARIA_HIDDEN)
  }

  /** Lands the pending collapsed-node move (watchdog or early flush). */
  _flushListReorder(): void {
    if (this._listReorderTimer) {
      clearTimeout(this._listReorderTimer)

      this._listReorderTimer = null
    }

    const node = this._listReorderNode
    const container = this._listReorderContainer

    this._listReorderNode = null
    this._listReorderContainer = null

    // A re-render may have detached the stale list — the move is skipped
    // then (the fresh render re-emits the window from scratch anyway).
    if (node && container && container.isConnected) {
      container.appendChild(node)
    }
  }

  /**
   * Rebinds the conveyor key handler whenever a render recreates the
   * list node — the plain bind dies with the detached node. A list that
   * fits its window has no folded rows to step through, so no listener
   * is bound there.
   */
  _syncList(): void {
    const list = this.$(`.${RELATED_CLASSES.RELATED_LIST}`)

    if (list === this._listEl) return

    this._listEl = list

    if (!list) return

    const items = this.$$(`.${RELATED_CLASSES.RELATED_LIST_ITEM}`)

    if (items.length <= RELATED_LAYOUT.VISIBLE_COUNT) return

    list.addEventListener(KEYBOARD_EVENTS.KEYDOWN, this._onListKeydown)
  }

  /**
   * Lifecycle: seeds translations from the store (they may already be
   * loaded by the view), kicks the SWR fetch for the two DB nodes it
   * needs, and subscribes to the router — navigating between projects
   * re-runs the fuzzy match against the new page's related list.
   */
  override onMounted() {
    this.subscribe(store)

    this._unsubRouter = router.subscribe(() => {
      this._updateDom()
    })

    // The covers manifest is boot-idle-deferred, so first render emits
    // originals-only <img>s; on arrival the cards rebuild with proven
    // thumb/webp rungs and the browser re-fetches the light variants.
    this._unsubManifest = onMediaManifest(() => {
      this._updateDom()
    })

    if (!this.translations?.title) {
      this.translations = storedTranslations()
    }

    this.fetchData()
  }

  /** Lifecycle: removes the router subscription + conveyor state. */
  override onDestroy() {
    this._ringSession?.destroy()

    this._ringSession = null
    this._ringEl = null

    if (typeof this._unsubRouter === TYPE_STRINGS.FUNCTION) {
      this._unsubRouter?.()

      this._unsubRouter = null
    }

    if (typeof this._unsubManifest === TYPE_STRINGS.FUNCTION) {
      this._unsubManifest?.()

      this._unsubManifest = null
    }

    this._listEl = null

    this._flushListReorder()
  }

  override onStoreUpdate() {
    if (!this.translations?.title) {
      this.translations = storedTranslations()
    }

    this._updateDom()
  }

  override onUpdated() {
    this._syncRingSheen()

    this._syncAnimDescs()

    this._syncList()
  }

  /**
   * Binds animation descriptions to the animated nodes the render just
   * produced — every related row's hover lift. Must run post-render
   * (never in the JSX): the desc node is injected per root, so applying
   * on detached nodes would spawn duplicate `lk-anim-desc-*` ids — a
   * WCAG failure. Re-rendered nodes are re-bound; idempotent on repeats.
   */
  _syncAnimDescs(): void {
    for (const tile of this.$$(`.${RELATED_CLASSES.RELATED_LIST_INNER}`)) {
      applyAnimationDesc(tile as Element, ANIMATION_IDS.RELATED_TILE)
    }
  }

  /**
   * Keeps the instanced ring-sheen overlay bound to the live
   * `.related-list` node — renders recreate the strip, so a session
   * mounted on a detached node is torn down and remounted. Without
   * WebGPU the mount is a no-op and the CSS pseudo rings stay.
   */
  _syncRingSheen(): void {
    const el = this.$(`.${RELATED_CLASSES.RELATED_LIST}`)

    if (el === this._ringEl) {
      this._ringSession?.refresh()

      return
    }

    this._ringSession?.destroy()

    this._ringSession = null
    this._ringEl = el

    if (el instanceof HTMLElement) {
      this._ringSession =
        mountRingSheen(
          el,
          `.${RELATED_CLASSES.RELATED_LIST_INNER}`,
          RELATED_CLASSES.RELATED_LIST_RING_CANVAS
        ) || null
    }
  }

  /**
   * Fires two SWR reads in parallel: the home page node (for the
   * portfoliolist join table) and the components/related node — see
   * related/data.ts.
   */
  fetchData(): void {
    fetchData(this)
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    return renderRelated(this)
  }
}

if (!customElements.get(COMPONENT_TAGS.PORTFOLIO_RELATED)) {
  customElements.define(COMPONENT_TAGS.PORTFOLIO_RELATED, PortfolioRelated)
}
