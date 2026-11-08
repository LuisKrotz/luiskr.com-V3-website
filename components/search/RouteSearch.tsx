/**
 * @file RouteSearch.js
 * @description <route-search> — the 404 route autocomplete: a search
 * field that predicts every public website route and lists each match
 * with a preview of what's inside (title, one-line description, path).
 *
 * Styling contract (the reference images):
 *   - img2 — the field and the numbered per-row index pills share the
 *     glowing accent ring; the active row's pill lights up.
 *   - img3 — each row's circular go button carries a conic ring that
 *     sweeps full on hover/focus. The SVG stroke-dashoffset version is
 *     the authoritative renderer; rust/ring-fill draws the same sweep
 *     as one instanced overlay when the WebGPU widget layer is enabled
 *     (`?debug=webgpuWidgets:active`).
 *
 * Scoring runs through the wasm-pool ROUTE_SEARCH action (one batched
 * dispatch per keystroke); `scoreRoutesJs` is the identical main-thread
 * fallback. The input node is never re-rendered after mount — results
 * patch into a persistent list element so typing can't drop focus.
 */
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { RS_CSS_PROPS } from '@core/tokens/css/route-search.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import {
  FORM_EVENTS,
  FOCUS_EVENTS,
  KEYBOARD_EVENTS,
  MOUSE_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { KEYS } from '@core/tokens/primitives.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { BaseComponent } from '@core/Component.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { isPlainClick } from '@core/utils/dom.js'
import { scoreRoutesJs, searchRoutes } from '@core/utils/wasm/wasm-search.js'
import { cancelExpandSpring, springExpandTo } from '@core/utils/motion/expand-spring.js'
import { mountRingFill } from '@core/utils/gpu/ring-fill.js'
import type { RingFillSession } from '@core/utils/gpu/ring-fill.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { routeSlugs } from '@core/locale/ui-text.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ROUTE_SEARCH_LIMITS } from '@core/tokens/routes/search.js'
import { devError } from '@core/devlog.js'
import {
  loadCatalog,
  loadCopy,
  orderByKind,
  searchStrings,
  staticEntries,
} from './route-search/data.js'
import { renderItems, renderShell } from './route-search/render.js'
import type { RouteEntry, SearchStrings } from './route-search/data.js'
import routeSearchStyles from '@core/sass/components/search/route-search.scss?inline'

/** Debounce window per keystroke — one scoring dispatch per pause. */
const QUERY_DEBOUNCE_MS = 150

/** Fallback breathing room (px) when the stylesheet's --rs-list-gap
 *  custom property can't be parsed — the SCSS token is authoritative. */
const LIST_VIEWPORT_GAP = 16

/**
 * The RouteSearch — not-found autocomplete class.
 */
export class RouteSearch extends BaseComponent {
  /** Full route catalog (static pages + portfolio projects). */
  _catalog: RouteEntry[] = []

  /** Currently rendered hits — the active page slice of `_ranked`. */
  _hits: RouteEntry[] = []

  /** All ranked hits for the current query, partitioned into kind
   *  buckets ordered by each bucket's best hit — the pager slices it. */
  private _ranked: RouteEntry[] = []

  /** Current results page — indexes `_ranked` in MAX_HITS slices. */
  private _page = 0

  /** Keyboard/hover active row index (-1 = none). */
  _active = -1

  /** Localized copy node — seeded from the English fallback at render. */
  _strings: SearchStrings = searchStrings(null)

  /** Pending input debounce timer. */
  _debounce: ReturnType<typeof setTimeout> | null = null

  /** Live WebGPU ring-fill session (null = SVG rings render). */
  _ring: RingFillSession | null = null

  /** Monotonic query id — stale worker replies can't overwrite newer hits. */
  _seq = 0

  /** Whether the listbox is logically open — the spring may still be
   *  animating the collapse after this flips false. */
  private _listOpen = false

  /** Query the rendered hits were ranked for — a re-rank of the same
   *  query (worker reply, catalog merge) keeps the active row. */
  private _rankedQuery: string = CHAR_STRINGS.EMPTY

  /** Keyboard owns the active row until the pointer actually moves —
   *  rows scrolling under a resting cursor fire pointerover too. */
  private _keyNav = false

  /** Whether a scoring round-trip is in flight — mirrors the
   *  --loading root modifier so the status line can swap to dots. */
  private _busy = false

  /** Total ranked matches for the current query (not the rendered cap)
   *  — feeds the "N results found" status line. */
  private _total = 0

  constructor() {
    super(routeSearchStyles)
  }

  /** The results listbox element (persistent — never re-rendered). */
  get listEl(): HTMLElement | null {
    return this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LIST}`)
  }

  /** The combobox input. */
  get inputEl(): HTMLInputElement | null {
    return this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT}`)
  }

  /** Lifecycle: loads copy + catalog, wires events, mounts the ring. */
  override onMounted() {
    this.subscribe(store)
    this._bindEvents()
    this._mountRing()
    this.loadData()
  }

  /** Loads the copy node + catalog for the current locale via SWR. */
  loadData(): void {
    const lang = store.getters.getlang()
    const locale = lang.locale || LOCALES.EN
    // Localized copy resolves through the same `done`-callback contract
    // `loadCatalog` uses — the node is null when the locale lacks it.
    loadCopy(locale, (node) => {
      if (node) {
        this._strings = searchStrings(node)
        this._applyStrings()
      }
    })

    // Static routes are in-module — the catalog seeds synchronously so
    // the first keystroke scores immediately; the network merge fills
    // in the ~1100 project/doc entries when the fetch lands.
    this._catalog = staticEntries(locale)

    // `?q=` deep link — seeds the field now instead of waiting on the
    // catalog fetch (it re-scores with the full set in the callback).
    if (this.inputEl && !this.inputEl.value) {
      const q = this._queryParam()

      if (q) {
        this.inputEl.value = q

        // `?p=` deep link — seed the pager page too; marking the query as
        // already-ranked lets the first _showHits clamp it (instead of a
        // new-query reset to page 1).
        this._page = this._pageParam()
        this._rankedQuery = q
      }
    }

    loadCatalog(locale, (entries) => {
      this._catalog = entries

      // Any pending query re-scores against the full catalog — the
      // static set already answered; this fills in the rest.
      if (this.inputEl?.value.trim()) this._score()
    })
  }

  /** The `?q=` parameter of the current URL ('' when absent). */
  private _queryParam(): string {
    if (typeof window === TYPE_STRINGS.UNDEFINED) return CHAR_STRINGS.EMPTY

    return new URLSearchParams(window.location.search).get('q') || CHAR_STRINGS.EMPTY
  }

  /** The `?p=` results-page parameter as a 0-based index (0 absent/bad). */
  private _pageParam(): number {
    if (typeof window === TYPE_STRINGS.UNDEFINED) return 0

    const p = parseInt(
      new URLSearchParams(window.location.search).get('p') || CHAR_STRINGS.EMPTY,
      10
    )

    return Number.isFinite(p) && p > 0 ? p - 1 : 0
  }

  /** Writes the query back to `?q=` — the param belongs to the search
   *  page, so a live query also retargets the URL at the localized
   *  /search route (a reload lands on the real surface, not a modal
   *  ghosting the host page). Clearing keeps whatever path is live. */
  private _syncQueryParam(q: string): void {
    if (typeof window === TYPE_STRINGS.UNDEFINED || typeof history === TYPE_STRINGS.UNDEFINED)
      return

    const url = new URL(window.location.href)

    if (q) {
      const lang = store.getters.getLang() as { locale?: string } | undefined

      const locale = lang?.locale || LOCALES.EN

      const prefix = locale === LOCALES.EN ? CHAR_STRINGS.EMPTY : `${ROUTE_PATHS.ROOT}${locale}`

      url.pathname = `${prefix}${ROUTE_PATHS.ROOT}${routeSlugs(locale).search}`
      url.searchParams.set('q', q)

      // Page 1 is implicit — `p` only ships past it, and only while it
      // still describes the ranked query (a new query re-arms _page at
      // 0 in _showHits after this sync runs).
      if (q === this._rankedQuery && this._page > 0)
        url.searchParams.set('p', String(this._page + 1))
      else url.searchParams.delete('p')
    } else {
      url.searchParams.delete('q')
      url.searchParams.delete('p')
    }

    history.replaceState(history.state, '', url.pathname + url.search)
  }

  /** Store change → locale flips rebuild catalog + copy node. */
  override onStoreUpdate() {
    this.loadData()
  }

  /** Pushes the resolved copy onto the live shell nodes. */
  private _applyStrings(): void {
    const s = this._strings
    const input = this.inputEl

    if (input) {
      input.setAttribute(FORM_ATTRS.PLACEHOLDER, s.placeholder)
      input.setAttribute(ARIA_ATTRS.ARIA_LABEL, s.label)
    }

    const list = this.listEl

    if (list) list.setAttribute(ARIA_ATTRS.ARIA_LABEL, s.results)

    const empty = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_EMPTY}`)

    if (empty) empty.textContent = s.empty

    const hint = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_HINT}`)

    if (hint) {
      hint.textContent = s.hint
      ;(hint as HTMLElement).hidden = !s.hint
    }

    const pager = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER}`)

    if (pager) pager.setAttribute(ARIA_ATTRS.ARIA_LABEL, s.pager)

    const prev = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_PREV}`)

    if (prev) prev.setAttribute(ARIA_ATTRS.ARIA_LABEL, s.prev)

    const next = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_NEXT}`)

    if (next) next.setAttribute(ARIA_ATTRS.ARIA_LABEL, s.next)

    // Locale flip re-templates a live "N results found" status too.
    this._syncFound()
    this._syncPager()
  }

  /**
   * Delegated listeners bound on the shadow root — inside the shadow
   * tree `e.target` is the real node (host-bound listeners would see
   * retargeted events), and the root survives every list re-patch.
   */
  private _bindEvents(): void {
    const root = this.shadowRoot

    this.addScopedListener(root, FORM_EVENTS.INPUT, (e) => this._onInput(e))
    this.addScopedListener(root, KEYBOARD_EVENTS.KEYDOWN, (e) => this._onKeydown(e))
    this.addScopedListener(root, FOCUS_EVENTS.FOCUSIN, () => {
      this._ringTarget(1)
      this._openList()
    })
    this.addScopedListener(root, FOCUS_EVENTS.FOCUSOUT, (e) => this._onFocusOut(e))
    this.addScopedListener(root, MOUSE_EVENTS.CLICK, (e) => this._onClick(e))
    this.addScopedListener(root, POINTER_EVENTS.POINTEROVER, (e) => this._onPointerOver(e))
    this.addScopedListener(
      root,
      POINTER_EVENTS.POINTERMOVE,
      () => {
        this._keyNav = false
      },
      { passive: true }
    )

    // A viewport resize while the list is open re-measures the space
    // below the panel — the cap shrinks/grows with the window.
    this.addScopedListener(
      window,
      WINDOW_EVENTS.RESIZE,
      () => {
        if (this._listOpen) this._fitListToViewport()
      },
      { passive: true }
    )
  }

  /**
   * Measures the space left under the dropdown panel and writes it to
   * `--rs-list-avail` — the stylesheet min()es it against the host's
   * design cap, so on short windows the list just shows fewer rows and
   * scrolls the rest instead of clipping past the screen edge. The
   * panel's top edge (field bottom + dropdown gap) is the anchor, so
   * the result is identical in the absolute (404) and in-flow (modal)
   * panel layouts. One rect read per open/resize — never per frame.
   */
  private _fitListToViewport(): void {
    if (typeof window === TYPE_STRINGS.UNDEFINED) return

    const list = this.listEl

    if (!list) return

    const panel = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PANEL}`) as HTMLElement | null

    const top = (panel || list).getBoundingClientRect().top

    // The authored breathing room lives in the stylesheet token — read it
    // back so design-space changes never desync from this measurement.
    const cssGap = parseFloat(getComputedStyle(list).getPropertyValue(RS_CSS_PROPS.RS_LIST_GAP))

    const avail = Math.floor(
      window.innerHeight - top - (Number.isNaN(cssGap) ? LIST_VIEWPORT_GAP : cssGap)
    )

    list.style.setProperty(RS_CSS_PROPS.RS_LIST_AVAIL, `${Math.max(0, avail)}px`)
  }

  /** Mounts the instanced ring-fill overlay on the results list. */
  private _mountRing(): void {
    const root = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH}`)

    if (!root) return

    this._ring = mountRingFill(
      root as HTMLElement,
      `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_FIELD}`,
      ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_CANVAS
    )
  }

  /** Focus/hover on the field sweeps its ring open; leaving eases it shut. */
  private _ringTarget(t: number): void {
    this._ring?.setProgress(0, t)
  }

  /** Moves focus into the search input — hosts (search modal) call it on open. */
  focusInput(): void {
    this.inputEl?.focus()
  }

  /** Keystroke → debounced scoring dispatch → patched results. */
  private _onInput(e: Event): void {
    const t = e.target as HTMLElement | null

    if (!t?.classList?.contains(ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_INPUT)) return

    if (this._debounce) clearTimeout(this._debounce)

    this._debounce = setTimeout(() => this._score(), QUERY_DEBOUNCE_MS)

    this._syncQueryParam((this.inputEl?.value || CHAR_STRINGS.EMPTY).trim())
  }

  /** One scoring pass — worker reply wins; JS fallback is identical. */
  private _score(): void {
    const seq = ++this._seq
    const q = this.inputEl?.value || CHAR_STRINGS.EMPTY

    // Blank input returns nothing — no worker round-trip, no rows.
    if (!q.trim()) {
      this._setLoading(false)
      this._showHits([], q)
      return
    }

    // Non-empty query arms the loader until its reply lands.
    this._setLoading(true)

    const items = this._catalog.map((c) => ({
      title: c.title,
      path: c.path,
      preview: c.preview,
      keywords: c.keywords,
    }))

    // Instant paint — the in-module scorer runs the identical formula on
    // the main thread, so the first hits render immediately while the
    // worker round-trip (cold boot ≈ wasm download + instantiate) is
    // still in flight; the reply upgrades the ordering on land.
    this._showHits(
      scoreRoutesJs(items, q).map((h) => this._catalog[h.index]),
      q
    )

    void searchRoutes(items, q)
      .then((hits) => {
        if (seq !== this._seq) return

        this._setLoading(false)
        this._showHits(
          hits.map((h) => this._catalog[h.index]),
          q
        )
      })
      .catch((err) => {
        this._setLoading(false)
        devError(err)
      })
  }

  /**
   * Toggles the in-flight query state — the submit glyph spins while a
   * scoring dispatch is pending (catalog fetch + worker latency).
   * @param v Whether a scoring round-trip is in flight.
   */
  private _setLoading(v: boolean): void {
    this._busy = v
    this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH}`)?.classList.toggle(
      ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_LOADING,
      v
    )

    this._syncFound()
  }

  /**
   * Paints the status line opposite the label: the animated dots while
   * a scoring dispatch is in flight (the --loading root modifier shows
   * the dot trio and hides the text), otherwise the localized
   * "N results found" template with the total match count — blank while
   * the field is empty. `aria-live` on the span announces the update.
   */
  private _syncFound(): void {
    const text = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_FOUND_TEXT}`)

    if (!text) return

    const hasQuery = !!(this.inputEl?.value || CHAR_STRINGS.EMPTY).trim()

    text.textContent =
      hasQuery && !this._busy
        ? this._strings.found.replace('{n}', String(this._total))
        : CHAR_STRINGS.EMPTY
  }

  /**
   * Patches the listbox with ranked entries and opens it. Hits first
   * partition into kind buckets ordered by each bucket's best hit
   * (a strong project title match outranks a weak page keyword hit),
   * then the current page slice renders. A new query resets page + active row to the top
   * hit; a re-rank of the same query (instant JS paint → worker reply,
   * catalog merge) keeps the row the user arrowed to, so a late reply
   * can't snap the selection back.
   * @param entries Ranked entries for `q`.
   * @param q The query the entries were ranked for.
   */
  private _showHits(entries: RouteEntry[], q: string): void {
    const sameQuery = q === this._rankedQuery
    const prevPath = sameQuery && this._active > 0 ? this._hits[this._active]?.path : undefined

    this._ranked = orderByKind(entries)
    this._rankedQuery = q
    this._total = this._ranked.length
    this._page = sameQuery ? Math.min(this._page, this._lastPage()) : 0

    this._hits = this._ranked.slice(
      this._page * ROUTE_SEARCH_LIMITS.MAX_HITS,
      (this._page + 1) * ROUTE_SEARCH_LIMITS.MAX_HITS
    )

    const kept = prevPath ? this._hits.findIndex((h) => h.path === prevPath) : -1

    this._setActive(kept >= 0 ? kept : this._hits.length ? 0 : -1)
    this._renderList()
    this._syncFound()

    if (kept > 0) this._revealRow(kept)
    this._openList()
  }

  /** Last page index into `_ranked` (0 when nothing is ranked). */
  private _lastPage(): number {
    return Math.max(0, Math.ceil(this._ranked.length / ROUTE_SEARCH_LIMITS.MAX_HITS) - 1)
  }

  /**
   * Turns the results page — slices the new MAX_HITS window out of
   * `_ranked`, scrolls the listbox back to its top edge, and seeds the
   * active row (first row forward, last row backward) so keyboard users
   * land on a real option, not a dead selection. Out-of-range turns
   * are no-ops.
   * @param delta Page direction (+1 next, -1 previous).
   * @param toEnd Seed the last row instead of the first.
   */
  private _turnPage(delta: number, toEnd = false): void {
    const next = this._page + delta

    if (next < 0 || next > this._lastPage()) return

    this._page = next
    this._hits = this._ranked.slice(
      next * ROUTE_SEARCH_LIMITS.MAX_HITS,
      (next + 1) * ROUTE_SEARCH_LIMITS.MAX_HITS
    )

    this._setActive(this._hits.length ? (toEnd ? this._hits.length - 1 : 0) : -1)

    const list = this.listEl

    if (list) list.scrollTop = 0

    this._renderList()

    // The pager page rides the URL with the query — `?q=x&p=N` is a
    // shareable deep link into the middle of the result set.
    this._syncQueryParam((this.inputEl?.value || CHAR_STRINGS.EMPTY).trim())
  }

  /** The option rows rendered in the listbox (group headers excluded). */
  private _rows(): HTMLElement[] {
    const list = this.listEl

    return list
      ? Array.from(list.querySelectorAll(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM}`))
      : []
  }

  /**
   * Paints the pager row under the listbox: hidden while the hit list
   * fits on one page, otherwise the "Page x of y" status with prev/next
   * buttons disabled at the range ends. Called on every re-render so a
   * locale flip re-templates the status text too.
   */
  private _syncPager(): void {
    const pager = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER}`) as HTMLElement | null

    if (!pager) return

    const pages = this._lastPage() + 1

    pager.hidden = pages <= 1 || !this._hits.length

    const status = pager.querySelector(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_STATUS}`)

    if (status) {
      status.textContent = this._strings.page
        .replace('{a}', String(this._page + 1))
        .replace('{b}', String(pages))
    }

    const prev = pager.querySelector(
      `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_PREV}`
    ) as HTMLButtonElement | null

    if (prev) prev.disabled = this._page === 0

    const next = pager.querySelector(
      `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_NEXT}`
    ) as HTMLButtonElement | null

    if (next) next.disabled = this._page >= this._lastPage()
  }

  /** Rebuilds the option rows inside the persistent list element. */
  private _renderList(): void {
    const list = this.listEl

    if (!list) return

    list.replaceChildren(
      ...renderItems(
        this._hits,
        this._active,
        this._strings,
        this._page * ROUTE_SEARCH_LIMITS.MAX_HITS
      )
    )

    // Open list: retarget the reveal spring at the new content height —
    // mid-flight retargets keep velocity, so rapid typing grows and
    // shrinks the clip organically instead of snapping per keystroke.
    if (this._listOpen) {
      this._springReveal(list, list.offsetHeight)
    }

    const empty = this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_EMPTY}`) as HTMLElement | null

    // The "no match" row only shows on a query — blank keeps it hidden too.
    if (empty) {
      empty.hidden = this._hits.length > 0 || !(this.inputEl?.value || '').trim()
    }

    this._syncPager()
    this._ring?.refresh()
  }

  /** Sets the active row: class, aria-activedescendant, ring progress. */
  private _setActive(index: number): void {
    const prev = this._active

    this._active = index

    const items = this._rows()

    items.forEach((li, i) => {
      li.classList.toggle(ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM_ACTIVE, i === index)
      li.setAttribute('aria-selected', i === index ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE)
    })

    const input = this.inputEl

    if (input) {
      if (index >= 0) {
        input.setAttribute(
          ARIA_ATTRS.ARIA_ACTIVEDESCENDANT,
          `${APP_IDS.ROUTE_SEARCH_OPTION_PREFIX}${index}`
        )
      } else {
        input.removeAttribute(ARIA_ATTRS.ARIA_ACTIVEDESCENDANT)
      }
    }

    // The ring-fill lives on the field (single tile 0), not per row —
    // active-row changes never touch its progress.
    void prev
  }

  /**
   * Scrolls the listbox (only — never the page) so the row at `index`
   * sits fully inside its visible box: rows above the top edge align to
   * the top, rows below the bottom edge align to the bottom, visible
   * rows leave scrollTop untouched. One rect read per key press.
   * @param index Row index to bring into view.
   */
  private _revealRow(index: number): void {
    const list = this.listEl
    const row = this._rows()[index] as HTMLElement | undefined

    if (!list || !row) return

    const box = list.getBoundingClientRect()
    const r = row.getBoundingClientRect()

    if (r.top < box.top) list.scrollTop -= box.top - r.top
    else if (r.bottom > box.bottom) list.scrollTop += r.bottom - box.bottom
  }

  /**
   * Keyboard row move — marks keyboard as the active-row owner, sets
   * the row, and scrolls it into the list's visible box.
   * @param index Target row index.
   */
  private _moveActive(index: number): void {
    this._keyNav = true
    this._setActive(index)
    this._revealRow(index)
  }

  /** Opens the listbox — only once the input carries a query (list on typing). */
  private _openList(): void {
    const list = this.listEl
    const input = this.inputEl

    if (!list) return

    const has = this._hits.length > 0 && !!(input && input.value.trim())

    if (!has) {
      this._closeList()

      return
    }

    const wasHidden = list.hidden

    list.hidden = false
    this._listOpen = true

    this._fitListToViewport()

    this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH}`)?.classList.add(
      ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_OPEN
    )
    input?.setAttribute(ARIA_ATTRS.ARIA_EXPANDED, ATTR_VALUES.TRUE)

    this._springReveal(list, list.offsetHeight, wasHidden ? 0 : undefined)
  }

  /**
   * Drives the clip reveal — the spring chases px in `0 → offsetHeight`
   * space but writes `clip-path` (bottom inset shrinks as the chase
   * grows), so the expansion runs entirely on the compositor: zero
   * layout, zero reflow per frame, unlike animating `height` itself.
   * The target is the VISIBLE box (max-height capped), never
   * scrollHeight — chasing the full scroll content kept the visible box
   * fully clipped until the final frames, so the reveal read as a snap.
   * @param list The persistent listbox element.
   * @param natural Target px — the visible box height to reveal toward.
   * @param from Chase origin — 0 on a fresh open (element was
   *   display:none so its rect already reads natural); undefined lets
   *   the live state keep its position on retargets.
   */
  private _springReveal(list: HTMLElement, natural: number, from?: number): void {
    const clipWrite = (el: HTMLElement, v: number) => {
      el.style.clipPath = `inset(0 0 ${natural - v}px 0)`
    }

    if (from === 0) clipWrite(list, 0)

    springExpandTo(
      list,
      natural,
      () => {
        list.style.clipPath = CHAR_STRINGS.EMPTY
      },
      store.getters.getReducedMotion(),
      clipWrite,
      from
    )
  }

  /** Closes the listbox — springs the reveal to 0, then commits `hidden`. */
  private _closeList(): void {
    const list = this.listEl

    if (!list) return

    this._listOpen = false

    this.$(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH}`)?.classList.remove(
      ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_OPEN
    )
    this.inputEl?.setAttribute(ARIA_ATTRS.ARIA_EXPANDED, ATTR_VALUES.FALSE)
    this._setActive(-1)

    const natural = list.offsetHeight
    const clipWrite = (el: HTMLElement, v: number) => {
      el.style.clipPath = `inset(0 0 ${natural - v}px 0)`
    }

    springExpandTo(
      list,
      0,
      // `hidden` lands once the collapse settles — the attribute (not
      // the animation) owns the steady closed state.
      () => {
        list.hidden = true
        list.style.clipPath = CHAR_STRINGS.EMPTY
      },
      store.getters.getReducedMotion(),
      clipWrite,
      natural
    )
  }

  /** Keyboard contract: arrows move, Enter opens, Escape closes. */
  private _onKeydown(e: Event): void {
    const ke = e as KeyboardEvent

    if (!this._hits.length && ke.key !== KEYS.ESCAPE) return

    if (ke.key === KEYS.ARROW_DOWN) {
      ke.preventDefault()

      // Last row of a page rolls into the next page's first row —
      // past the final page the turn is a no-op and the row stays.
      if (this._hits.length && this._active >= this._hits.length - 1) {
        this._turnPage(1)
      } else {
        this._moveActive(Math.min(this._active + 1, this._hits.length - 1))
      }
    } else if (ke.key === KEYS.ARROW_UP) {
      ke.preventDefault()

      // First row of a page rolls back into the previous page's last row.
      if (this._active <= 0) {
        this._turnPage(-1, true)
      } else {
        this._moveActive(this._active - 1)
      }
    } else if (ke.key === KEYS.ENTER) {
      const i = this._active >= 0 ? this._active : 0

      if (this._hits[i]) {
        ke.preventDefault()
        this._navigate(this._hits[i])
      }
    } else if (ke.key === KEYS.ESCAPE) {
      this._closeList()
    }
  }

  /** Row click → SPA navigation (modified clicks keep anchor semantics). */
  private _onClick(e: Event): void {
    const el = e.target as HTMLElement | null

    // Pager buttons turn the page instead of navigating.
    if (el?.closest?.(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_PREV}`)) {
      this._turnPage(-1)

      return
    }

    if (el?.closest?.(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_PAGER_NEXT}`)) {
      this._turnPage(1)

      return
    }

    // The glued submit button opens the top hit.
    if (el?.closest?.(`.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_SUBMIT}`)) {
      const top = this._hits[this._active >= 0 ? this._active : 0]

      if (top) this._navigate(top)

      return
    }

    const a = el?.closest?.(`a[${DATA_ATTRS.DATA_INDEX}]`) as HTMLAnchorElement | null

    if (!a || !this.shadowRoot?.contains(a)) return

    const i = Number(a.getAttribute(DATA_ATTRS.DATA_INDEX))
    const entry = this._hits[i]

    if (!entry) return

    const me = e as MouseEvent

    if (!isPlainClick(me)) return

    e.preventDefault()
    this._navigate(entry)
  }

  /** Hovering a row makes it the active prediction (ring fill + pill). */
  private _onPointerOver(e: Event): void {
    if (this._keyNav) return

    const li = (e.target as HTMLElement)?.closest?.(
      `.${ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_ITEM}`
    ) as HTMLElement | null

    if (!li || !this.shadowRoot?.contains(li)) return

    const a = li.querySelector(`a[${DATA_ATTRS.DATA_INDEX}]`)
    const i = a ? Number(a.getAttribute(DATA_ATTRS.DATA_INDEX)) : -1

    if (i >= 0) this._setActive(i)
  }

  /** Focus leaving the whole component closes the listbox. */
  private _onFocusOut(e: Event): void {
    const next = (e as FocusEvent).relatedTarget as Node | null

    if (next && this.shadowRoot?.contains(next)) return

    this._ringTarget(0)
    this._closeList()
  }

  /** Navigates to a catalog entry and dismisses the list. */
  private _navigate(entry: RouteEntry): void {
    this._closeList()

    void router.push(entry.path).catch(devError)
  }

  /** Lifecycle teardown — debounce + ring session + height spring. */
  override onDestroy() {
    if (this._debounce) clearTimeout(this._debounce)

    this._debounce = null

    this._ring?.destroy()
    this._ring = null

    const list = this.listEl

    if (list) cancelExpandSpring(list)
  }

  /** JSX template — the persistent shell (rendered once per mount). */
  override render() {
    return renderShell(this._strings)
  }
}

if (!customElements.get(COMPONENT_TAGS.ROUTE_SEARCH)) {
  customElements.define(COMPONENT_TAGS.ROUTE_SEARCH, RouteSearch)
}
