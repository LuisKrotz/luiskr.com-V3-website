/**
 * @file notfound-tails.test.js
 * @description Split from coverage-tails-4.test.js — covers the "NotFound tails" describe.
 */
import '@website/components/feedback/CookieBanner.js'
import '@website/components/home/ContactSection.js'
import '@website/views/not-found/NotFound.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { NOT_FOUND_CLASSES } from '@core/tokens/classes/legal.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('NotFound tails', () => {
  test('mounts and binds the home link through the router', async () => {
    const el = document.createElement(VIEW_TAGS.VIEW_NOT_FOUND)

    document.body.appendChild(el)
    await flush(150)

    const link = el.shadowRoot.querySelector('a')

    link?.dispatchEvent(new Event(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    el.onUpdated?.()
    el.remove()
  })

  test('modified clicks on the home link keep native anchor semantics', async () => {
    const el = document.createElement(VIEW_TAGS.VIEW_NOT_FOUND)

    document.body.appendChild(el)

    // The link node exists only once translations are populated — seed them
    // directly instead of depending on the async locale fetch timing.
    el.translations = { title: TEST_TEXT.HEADING, link: TEST_TEXT.SECOND }
    el._updateDom()
    el._bindLinks()

    const link = el.shadowRoot.querySelector(`.${NOT_FOUND_CLASSES.NOT_FOUND_LINK}`)

    expect(link).not.toBeNull()

    const ev = new MouseEvent(MOUSE_EVENTS.CLICK, {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    })

    link.dispatchEvent(ev)

    // !isPlainClick → early return before preventDefault — the browser
    // must keep the href as a real navigation (new tab).
    expect(ev.defaultPrevented).toBe(false)

    el.remove()
  })
})
