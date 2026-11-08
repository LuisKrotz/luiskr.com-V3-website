/**
 * @file sections-awardsmentions.test.js
 * @description Split from sections.test.js — covers the "AwardsMentions"
 * describe: the legal-footer band (legal nav + source-code pill + docs
 * entry + divider + credit/rights) and the delegated SPA click routing.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { AwardsMentions } from '@website/components/home/AwardsMentions.js'
import { CMS_KEYS, LOCALES, ROUTE_NAMES, ROUTE_PREFIXES } from '@core/constants.js'
import { mount } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { FOOTER_CLASSES } from '@core/tokens/classes/footer.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'

// ─────────────────────────────────────────────────────────────────────────────
// AwardsMentions — the legal footer band
// ─────────────────────────────────────────────────────────────────────────────
describe('AwardsMentions', () => {
  let awardsEl
  let cleanup

  beforeEach(() => {
    awardsEl = new AwardsMentions()
    cleanup = mount(awardsEl)
  })

  afterEach(() => cleanup())

  test('creates shadow root on construction', () => {
    expect(awardsEl.shadowRoot).not.toBeNull()
  })

  test('renders the footer landmark heading and no carousel', () => {
    const h2 = awardsEl.shadowRoot.querySelector(`h2.${A11Y_CLASSES.SR_ONLY}`)
    expect(h2).not.toBeNull()
    expect(awardsEl.shadowRoot.querySelector(COMPONENT_TAGS.AWARDS_CAROUSEL)).toBeNull()
    expect(awardsEl.shadowRoot.querySelector(`.${AWARDS_CLASSES.AWARDS_FOOTER_TITLE}`)).toBeNull()
    expect(awardsEl.shadowRoot.querySelector(`.${SKELETON_CLASSES.SKELETON_BADGE}`)).toBeNull()
  })

  test('filters out single root language slugs from legal links', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.LEGAL_FOOTER]: {
        links: [
          { page: ROUTE_NAMES.HOME, link: `/${LOCALES.EN}` },
          { page: ROUTE_PREFIXES.PRIVACY, link: ROUTE_PATHS.PRIVACY_POLICY },
          { page: ROUTE_PREFIXES.TERMS, link: ROUTE_PATHS.TERMS_OF_USE },
        ],
      },
    })
    const links = awardsEl.legalLinks
    expect(links.find((l) => l.link === `/${LOCALES.EN}`)).toBeUndefined()
    expect(links.find((l) => l.link === ROUTE_PATHS.PRIVACY_POLICY)).toBeDefined()
  })

  test('renders legal navigation links inside the top row', () => {
    const top = awardsEl.shadowRoot.querySelector(`.${AWARDS_CLASSES.AWARDS_FOOTER_TOP}`)
    expect(top).not.toBeNull()

    const nav = top.querySelector(`nav.${AWARDS_CLASSES.AWARDS_FOOTER_LINKS}`)
    expect(nav).not.toBeNull()
    expect(nav.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBeTruthy()

    const links = awardsEl.shadowRoot.querySelectorAll(`.${AWARDS_CLASSES.AWARDS_FOOTER_ITEM}`)
    const seps = awardsEl.shadowRoot.querySelectorAll(`.${AWARDS_CLASSES.AWARDS_FOOTER_SEP}`)
    expect(seps.length).toBe(Math.max(0, links.length - 1))
  })

  test('renders the source-code pill linking the repository', () => {
    const pill = awardsEl.shadowRoot.querySelector(`.${FOOTER_CLASSES.FOOTER_SOURCE}`)
    expect(pill).not.toBeNull()

    const link = pill.querySelector(`a.${FOOTER_CLASSES.FOOTER_SOURCE_LINK}`)
    expect(link).not.toBeNull()
    expect(link.getAttribute(LINK_ATTRS.HREF)).toContain('github.com')
    expect(link.getAttribute(LINK_ATTRS.TARGET)).toBe('_blank')
  })

  test('renders the docs-portal entry with description + arrow', () => {
    const link = awardsEl.shadowRoot.querySelector(`.${FOOTER_CLASSES.FOOTER_DOCS_LINK}`)
    expect(link).not.toBeNull()
    expect(link.getAttribute(LINK_ATTRS.HREF)).toBe(ROUTE_PATHS.DOCS)
    expect(link.textContent).toContain(DOCS_STRINGS.TITLE)
    expect(link.querySelector(`.${FOOTER_CLASSES.FOOTER_DOCS_ARROW}`)).not.toBeNull()

    const desc = awardsEl.shadowRoot.querySelector(`.${FOOTER_CLASSES.FOOTER_DOCS_DESC}`)
    expect(desc).not.toBeNull()
    expect(desc.textContent.length).toBeGreaterThan(0)
  })

  test('renders divider, credit and rights lines', () => {
    expect(awardsEl.shadowRoot.querySelector(`hr.${FOOTER_CLASSES.FOOTER_DIVIDER}`)).not.toBeNull()

    const credit = awardsEl.shadowRoot.querySelector(`.${FOOTER_CLASSES.FOOTER_CREDIT}`)
    expect(credit.textContent.length).toBeGreaterThan(0)

    const rights = awardsEl.shadowRoot.querySelector(`.${FOOTER_CLASSES.FOOTER_RIGHTS}`)
    expect(rights.textContent).toContain('©')
  })

  test('re-renders when the store locale changes', async () => {
    const prev = store.getters.getLang()

    awardsEl._lastLocale = 'zz'

    awardsEl.onStoreUpdate()
    await new Promise((r) => setTimeout(r, 20))

    expect(awardsEl._lastLocale).toBe(prev)

    const before = awardsEl._dividerTeardowns.length
    awardsEl.onUpdated()
    expect(awardsEl._dividerTeardowns.length).toBeGreaterThanOrEqual(before - 1)
  })
})
