/**
 * @file route-search/render.tsx — JSX builders for <route-search>.
 * The shell renders once (input must keep focus across keystrokes, so
 * result rows are patched imperatively into the persistent list node
 * rather than re-rendered through setState). `renderItems` is the only
 * per-keystroke builder.
 */
/** @jsx h */
import { ROUTE_SEARCH_CLASSES as C } from '@core/tokens/classes/route-search.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { h } from '@core/jsx.js'
import { groupLabel } from './data.js'
import type { RouteEntry, SearchStrings } from './data.js'

/**
 * `renderShell` — the one-time skeleton: field pill + input combobox,
 * an empty results listbox, and the no-match row. Per-render state
 * (placeholder/labels) is applied imperatively by the facade so the
 * input never loses focus.
 * @param strings Localized copy node.
 * @returns The shell root element.
 */
export function renderShell(strings: SearchStrings): HTMLElement {
  return (
    <div className={C.ROUTE_SEARCH}>
      <div className={C.ROUTE_SEARCH_HEAD}>
        <label className={C.ROUTE_SEARCH_LABEL} htmlFor={APP_IDS.ROUTE_SEARCH_INPUT}>
          {strings.label}
        </label>
        <span
          className={C.ROUTE_SEARCH_FOUND}
          role={ARIA_ATTRS.ROLE_STATUS}
          aria-live={ARIA_ATTRS.POLITE}
        >
          <span className={C.ROUTE_SEARCH_FOUND_TEXT} />
          <span className={C.ROUTE_SEARCH_FOUND_DOTS} aria-hidden={ATTR_VALUES.TRUE}>
            <i />
            <i />
            <i />
          </span>
        </span>
      </div>
      <div className={C.ROUTE_SEARCH_COMBO}>
        <div className={C.ROUTE_SEARCH_FIELD}>
          <input
            id={APP_IDS.ROUTE_SEARCH_INPUT}
            className={C.ROUTE_SEARCH_INPUT}
            type={FORM_ATTRS.TEXT}
            name={FORM_ATTRS.SEARCH}
            placeholder={strings.placeholder}
            autocomplete={ATTR_VALUES.OFF}
            role={ARIA_ATTRS.ROLE_COMBOBOX}
            aria-label={strings.label}
            aria-expanded={ATTR_VALUES.FALSE}
            aria-controls={APP_IDS.ROUTE_SEARCH_LIST}
            aria-autocomplete={ARIA_ATTRS.AUTOCOMPLETE_LIST}
            aria-haspopup={ARIA_ATTRS.ROLE_LISTBOX}
          />
          <button
            className={C.ROUTE_SEARCH_SUBMIT}
            type={FORM_ATTRS.TYPE_BUTTON}
            aria-label={strings.go}
          >
            <svg
              className={C.ROUTE_SEARCH_SUBMIT_ICON}
              viewBox="0 0 40 40"
              aria-hidden={ATTR_VALUES.TRUE}
            >
              <circle cx="17" cy="17" r="8" />
              <path d="M23 23 L30 30" />
            </svg>
          </button>
        </div>
        <div className={C.ROUTE_SEARCH_PANEL}>
          <ul
            className={C.ROUTE_SEARCH_LIST}
            id={APP_IDS.ROUTE_SEARCH_LIST}
            role={ARIA_ATTRS.ROLE_LISTBOX}
            aria-label={strings.results}
            hidden={true}
          />
          <div
            className={C.ROUTE_SEARCH_PAGER}
            role={ARIA_ATTRS.ROLE_GROUP}
            aria-label={strings.pager}
            hidden={true}
          >
            <button
              className={C.ROUTE_SEARCH_PAGER_PREV}
              type={FORM_ATTRS.TYPE_BUTTON}
              aria-label={strings.prev}
            >
              <svg
                className={C.ROUTE_SEARCH_ARROW_ICON}
                viewBox="0 0 40 40"
                aria-hidden={ATTR_VALUES.TRUE}
              >
                <path d="M24 12 L14 20 L24 28" />
              </svg>
            </button>
            <span
              className={C.ROUTE_SEARCH_PAGER_STATUS}
              role={ARIA_ATTRS.ROLE_STATUS}
              aria-live={ARIA_ATTRS.POLITE}
            />
            <button
              className={C.ROUTE_SEARCH_PAGER_NEXT}
              type={FORM_ATTRS.TYPE_BUTTON}
              aria-label={strings.next}
            >
              <svg
                className={C.ROUTE_SEARCH_ARROW_ICON}
                viewBox="0 0 40 40"
                aria-hidden={ATTR_VALUES.TRUE}
              >
                <path d="M16 12 L26 20 L16 28" />
              </svg>
            </button>
          </div>
          <div className={C.ROUTE_SEARCH_EMPTY} hidden={true}>
            {strings.empty}
          </div>
        </div>
      </div>
      <div className={C.ROUTE_SEARCH_HINT} hidden={true}>
        {strings.hint}
      </div>
    </div>
  ) as HTMLElement
}

/** The row's trailing arrow — affordance only; the ring-fill lives on the field. */
function rowArrow(): HTMLElement {
  return (
    <span className={C.ROUTE_SEARCH_ARROW} aria-hidden={ATTR_VALUES.TRUE}>
      <svg className={C.ROUTE_SEARCH_ARROW_ICON} viewBox="0 0 40 40" aria-hidden={ATTR_VALUES.TRUE}>
        <path d="M14 20 h10 m-4 -5 l5 5 -5 5" />
      </svg>
    </span>
  ) as HTMLElement
}

/**
 * `renderItems` — one `<li role=option>` per hit: numbered index pill,
 * title + preview + path body, circular ring-fill go button. The anchor
 * wraps the row so plain clicks navigate natively and modified clicks
 * keep new-tab semantics. Kind-ordered entries get a `role=group`
 * header row at each kind boundary — the first row of a page always
 * emits one so a mid-group page still names its bucket.
 * @param entries Ranked entries to render (one results page).
 * @param active Index of the keyboard/hover-active row (-1 none).
 * @param strings Resolved copy node — supplies the group labels.
 * @param offset Global rank of the page's first row (index pill base).
 * @returns Array of li elements for the listbox.
 */
export function renderItems(
  entries: RouteEntry[],
  active: number,
  strings: SearchStrings,
  offset = 0
): HTMLElement[] {
  const out: HTMLElement[] = []

  let lastKind: string | null = null

  return entries.reduce((items, e, i) => {
    if (e.kind !== lastKind) {
      lastKind = e.kind

      const label = groupLabel(strings, e.kind)

      items.push(
        (
          <li className={C.ROUTE_SEARCH_GROUP} role={ARIA_ATTRS.ROLE_GROUP} aria-label={label}>
            <span className={C.ROUTE_SEARCH_GROUP_LABEL}>{label}</span>
          </li>
        ) as HTMLElement
      )
    }

    const isActive = i === active
    const cls = isActive
      ? `${C.ROUTE_SEARCH_ITEM} ${C.ROUTE_SEARCH_ITEM_ACTIVE}`
      : C.ROUTE_SEARCH_ITEM

    items.push(
      (
        <li
          className={cls}
          id={`${APP_IDS.ROUTE_SEARCH_OPTION_PREFIX}${i}`}
          role={ARIA_ATTRS.ROLE_OPTION}
          aria-selected={isActive ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE}
        >
          <a
            className={C.ROUTE_SEARCH_LINK}
            href={e.path}
            {...{ [DATA_ATTRS.DATA_INDEX]: String(i) }}
          >
            <span className={C.ROUTE_SEARCH_INDEX} aria-hidden={ATTR_VALUES.TRUE}>
              {offset + i + 1}
            </span>
            <span className={C.ROUTE_SEARCH_BODY}>
              <span className={C.ROUTE_SEARCH_TITLE}>{e.title}</span>
              {e.preview ? <span className={C.ROUTE_SEARCH_PREVIEW}>{e.preview}</span> : null}
              <span className={C.ROUTE_SEARCH_PATH}>{e.path}</span>
            </span>
            {e.thumb ? (
              <img
                className={C.ROUTE_SEARCH_THUMB}
                src={e.thumb}
                // Decorative blur-up miniature — the row's title names the
                // option, so aria-hidden dedups it for AT while the alt
                // answers crawlers that report empty alt="".
                alt={e.title}
                aria-hidden={ATTR_VALUES.TRUE}
                loading={ATTR_VALUES.LAZY}
              />
            ) : null}
            {rowArrow()}
          </a>
        </li>
      ) as HTMLElement
    )

    return items
  }, out)
}
