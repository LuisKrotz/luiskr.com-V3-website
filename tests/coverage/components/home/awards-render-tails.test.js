/**
 * @file awards-render-tails.test.js
 * @description Coverage tails for components/home/awards/render.tsx +
 * components/home/AwardsMentions.tsx — the `!isPlainClick` early returns on
 * the legal-link anchors, the docs-portal link, and the delegated
 * shadowRoot click handler: modified clicks must keep native <a href>
 * semantics (no preventDefault, no router push).
 */
import { describe, test, expect, jest } from '@jest/globals'
import '@website/components/home/AwardsMentions.js'
import { renderAwards } from '@website/components/home/awards/render.js'
import router from '@core/router/router.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { FOOTER_CLASSES } from '@core/tokens/classes/footer.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

/** Extra-generous flush — awards render + delegated listeners settle late. */
const flush = (ms = 150) => new Promise((r) => setTimeout(r, ms))

/** Ctrl+click event — delegated link handlers bail out on modifier clicks. */
const ctrlClick = () =>
  new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true, ctrlKey: true })

describe('awards render + delegated click tails', () => {
  test('legal-link, docs-link and delegated handlers bail on modified clicks', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    const pushSpy = jest.spyOn(router, 'push')

    // Inline onClick guard on a legal-item anchor — also passes through
    // the delegated shadowRoot listener in AwardsMentions.tsx, which must
    // bail at the same isPlainClick check.
    const itemLink = el.shadowRoot.querySelector(`.${AWARDS_CLASSES.AWARDS_FOOTER_ITEM}`)
    const docsLink = el.shadowRoot.querySelector(`.${FOOTER_CLASSES.FOOTER_DOCS_LINK}`)

    expect(itemLink).toBeTruthy()
    expect(docsLink).toBeTruthy()

    for (const anchor of [itemLink, docsLink]) {
      const ev = ctrlClick()

      anchor.dispatchEvent(ev)

      expect(ev.defaultPrevented).toBe(false)
    }

    expect(pushSpy).not.toHaveBeenCalled()

    // Plain clicks route through router.push and preventDefault.
    const plainItemEv = new MouseEvent(MOUSE_EVENTS.CLICK, {
      bubbles: true,
      cancelable: true,
    })

    itemLink.dispatchEvent(plainItemEv)

    expect(plainItemEv.defaultPrevented).toBe(true)
    expect(pushSpy).toHaveBeenCalled()

    const plainDocsEv = new MouseEvent(MOUSE_EVENTS.CLICK, {
      bubbles: true,
      cancelable: true,
    })

    docsLink.dispatchEvent(plainDocsEv)

    expect(plainDocsEv.defaultPrevented).toBe(true)

    // Delegated click edge cases: non-Element target (Text node) and
    // anchor without href attribute.
    const textNode = itemLink.firstChild

    if (textNode) {
      textNode.dispatchEvent(
        new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
      )
    }

    const bareAnchor = document.createElement('a')

    bareAnchor.className = AWARDS_CLASSES.AWARDS_FOOTER_ITEM
    el.shadowRoot.appendChild(bareAnchor)
    bareAnchor.dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
    )
    bareAnchor.remove()

    pushSpy.mockRestore()
    el.remove()
  })

  test('inline link handlers route plain clicks through router.push', () => {
    const tree = renderAwards({
      title: TEST_TEXT.HEADING,
      items: [],
      legalLinks: [
        { link: ROUTE_PATHS.PRIVACY_POLICY, page: TEST_TEXT.HEADING },
        { link: ROUTE_PATHS.TERMS_OF_USE, page: TEST_TEXT.BODY },
      ],
    })
    const pushSpy = jest.spyOn(router, 'push')

    // First legal anchor (i===0), second legal anchor (pair arm), and the
    // animations ref — each inline onClick arm runs isPlainClick → push.
    const anchors = tree.querySelectorAll(`.${AWARDS_CLASSES.AWARDS_FOOTER_ITEM}`)

    expect(anchors.length).toBeGreaterThan(2)

    for (const a of [anchors[0], anchors[1], anchors[2], anchors[3]]) {
      const ev = new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })

      a.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(true)
    }

    expect(pushSpy).toHaveBeenCalled()

    // Modified clicks bail before preventDefault on the same inline arms.
    for (const a of [anchors[0], anchors[1], anchors[2], anchors[3]]) {
      const ev = ctrlClick()

      a.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(false)
    }

    pushSpy.mockRestore()
  })

  test('docs description falls back when the components node is absent', () => {
    const saved = store.state.lang.components

    // An explicit empty description — '' is a deliberate live value that
    // beats the internal fallback, so render's `||` arm engages.
    store.state.lang.components = { [DOCS_STRINGS.CMS_COMPONENT]: { description: '' } }

    const tree = renderAwards({ title: TEST_TEXT.HEADING, items: [], legalLinks: [] })
    const desc = tree.querySelector(`.${FOOTER_CLASSES.FOOTER_DOCS_DESC}`)

    expect(desc.textContent).toBe(DOCS_STRINGS.DESC_FALLBACK)

    store.state.lang.components = saved
  })

  test('legal links without page copy render no empty heading', () => {
    // The h3 jump target is conditional — a link row with no copy must
    // still render its anchor but never an empty heading (axe rule).
    const tree = renderAwards({
      title: TEST_TEXT.HEADING,
      items: [],
      legalLinks: [
        { link: ROUTE_PATHS.PRIVACY_POLICY, page: '' },
        { link: ROUTE_PATHS.TERMS_OF_USE, page: TEST_TEXT.BODY },
      ],
    })
    const linksNav = tree.querySelector(`nav.${AWARDS_CLASSES.AWARDS_FOOTER_LINKS}`)

    // One fixture h3 (the copy-less row stays heading-free) + one per
    // static entry — animations ref, sitemap, feed.
    expect(linksNav.querySelectorAll('h3').length).toBe(4)
    // The two fixture items + the same three statics as anchors.
    expect(linksNav.querySelectorAll(`.${AWARDS_CLASSES.AWARDS_FOOTER_ITEM}`).length).toBe(5)
  })
})
