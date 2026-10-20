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
import router from '@core/router/router.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { FOOTER_CLASSES } from '@core/tokens/classes/footer.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'

const flush = (ms = 150) => new Promise((r) => setTimeout(r, ms))

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

    pushSpy.mockRestore()
    el.remove()
  })
})
