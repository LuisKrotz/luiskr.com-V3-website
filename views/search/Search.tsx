/**
 * @file Search.js
 * @description <view-search> — the standalone /search page: the
 * route-search surface alone, centered on both axes over a full-viewport
 * first screen, with the shared legal footer below the fold (the page
 * scrolls to it). The page carries no heading of its own.
 */
/** @jsx h */
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ROUTE_SEARCH_CLASSES } from '@core/tokens/classes/route-search.js'
import { h } from '@core/jsx.js'
import { BaseComponent } from '@core/Component.js'
import searchStyles from './search.scss?tiers'
import '@website/components/search/RouteSearch.js'
import '@website/components/legal/Footer.js'

/**
 * The Search — route-search page class.
 */
export class ViewSearch extends BaseComponent {
  constructor() {
    super(searchStyles)
  }

  /** JSX template — the centered route-search surface + the footer. */
  override render() {
    const LegalFooter = COMPONENT_TAGS.LEGAL_FOOTER

    return (
      <article>
        <div id={APP_IDS.MAIN} className={ROUTE_SEARCH_CLASSES.SEARCH_VIEW}>
          <route-search className={ROUTE_SEARCH_CLASSES.ROUTE_SEARCH_HERO} />
        </div>
        <LegalFooter />
      </article>
    )
  }
}

if (!customElements.get(VIEW_TAGS.VIEW_SEARCH)) {
  customElements.define(VIEW_TAGS.VIEW_SEARCH, ViewSearch)
}
