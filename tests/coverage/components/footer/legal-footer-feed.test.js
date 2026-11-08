/**
 * @file legal-footer-feed.test.js
 * @description <legal-footer> RSS feed link — locale feed URL builder, the
 * rendered anchor (href, RSS type hint, localized label, decorative glyph)
 * and the delegated click handler leaving the XML link to the browser.
 */
import { jest } from '@jest/globals'
import { LOCALES } from '@core/constants.js'
import router from '@core/router/router.js'
import { appText } from '@core/locale/ui-text.js'
import { feedHrefFor } from '@website/components/legal/Footer.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('legal Footer RSS feed link', () => {
  test('feedHrefFor maps English to the root feed and other locales to their prefix', () => {
    const S = CHAR_STRINGS.SLASH

    expect(feedHrefFor(LOCALES.EN)).toBe(`${S}${ROUTE_PATHS.FEED_FILE}`)
    expect(feedHrefFor(LOCALES.BR)).toBe(`${S}${LOCALES.BR}${S}${ROUTE_PATHS.FEED_FILE}`)
  })

  test('renders the localized feed anchor with the RSS glyph and leaves clicks native', async () => {
    const el = document.createElement(COMPONENT_TAGS.LEGAL_FOOTER)

    document.body.appendChild(el)
    await flush()

    const row = el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED}`)
    const link = row.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_LINK}`)
    const icon = link.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_ICON}`)

    expect(link.getAttribute(LINK_ATTRS.HREF)).toBe(feedHrefFor(LOCALES.EN))
    expect(link.getAttribute(FORM_ATTRS.TYPE)).toBe(NET_STRINGS.MIME_RSS)
    expect(link.textContent.trim()).toBe(String(appText(SECTION_UI_KEYS.RSS_FEED)))
    expect(link.textContent.trim()).not.toBe(CHAR_STRINGS.EMPTY)
    expect(icon.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    expect(
      icon.querySelectorAll(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_FEED_WAVE}`)
    ).toHaveLength(2)

    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => {})
    const click = new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })

    link.dispatchEvent(click)

    expect(pushSpy).not.toHaveBeenCalled()
    expect(click.defaultPrevented).toBe(false)

    pushSpy.mockRestore()
    el.remove()
  })
})
