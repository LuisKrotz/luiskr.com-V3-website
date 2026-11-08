/**
 * @file sitemap-feed-links.test.js
 * @description Footer link additions — the shared feed/sitemap href
 * builders, the <legal-footer> sitemap item, the <awards-mentions>
 * (home) sitemap + RSS feed items, and the /sitemap route descriptor.
 */
import { jest } from '@jest/globals'
import { LOCALES } from '@core/constants.js'
import router from '@core/router/router.js'
import { appText } from '@core/locale/ui-text.js'
import {
  animationsHrefFor,
  feedHrefFor,
  feedGlyph,
  sitemapHrefFor,
} from '@core/utils/data/footer-links.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { LANG_SLUGS } from '@core/i18n.js'
import '@website/components/home/AwardsMentions.js'
import '@website/components/legal/Footer.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('shared footer link helpers', () => {
  test('sitemapHrefFor maps locales to their localized sitemap slug', () => {
    const S = CHAR_STRINGS.SLASH

    expect(sitemapHrefFor(LOCALES.EN)).toBe(`${S}${LANG_SLUGS.en.sitemap}`)
    expect(sitemapHrefFor(LOCALES.FR)).toBe(`${S}${LOCALES.FR}${S}${LANG_SLUGS.fr.sitemap}`)
  })

  test('feedHrefFor keeps the root/locale feed contract', () => {
    const S = CHAR_STRINGS.SLASH

    expect(feedHrefFor(LOCALES.EN)).toBe(`${S}${ROUTE_PATHS.FEED_FILE}`)
    expect(feedHrefFor(LOCALES.DE)).toBe(`${S}${LOCALES.DE}${S}${ROUTE_PATHS.FEED_FILE}`)
  })

  test('animationsHrefFor maps locales to their localized animations slug', () => {
    const S = CHAR_STRINGS.SLASH

    expect(animationsHrefFor(LOCALES.EN)).toBe(`${S}${LANG_SLUGS.en.animations}`)
    expect(animationsHrefFor(LOCALES.DE)).toBe(`${S}${LOCALES.DE}${S}${LANG_SLUGS.de.animations}`)
  })

  test('feedGlyph paints the decorative icon + two wave arcs on the given classes', () => {
    const icon = feedGlyph(
      AWARDS_CLASSES.AWARDS_FOOTER_FEED_ICON,
      AWARDS_CLASSES.AWARDS_FOOTER_FEED_WAVE
    )

    expect(icon.classList.contains(AWARDS_CLASSES.AWARDS_FOOTER_FEED_ICON)).toBe(true)
    expect(icon.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    expect(icon.querySelectorAll(`.${AWARDS_CLASSES.AWARDS_FOOTER_FEED_WAVE}`)).toHaveLength(2)
  })
})

describe('sitemap route resolution', () => {
  test('English + localized slugs resolve to view-sitemap with canonical meta', () => {
    const en = router.parsePath(`/${LANG_SLUGS.en.sitemap}`)

    expect(en.view).toBe(VIEW_TAGS.VIEW_SITEMAP)
    expect(en.name).toBe(ROUTE_NAMES.SITEMAP)
    expect(en.meta.translation).toBe(TRANSLATION_KEYS.SITEMAP)
    expect(en.meta.canonical).toBe(`${CHAR_STRINGS.SLASH}${LANG_SLUGS.en.sitemap}`)

    const fr = router.parsePath(`/${LOCALES.FR}/${LANG_SLUGS.fr.sitemap}`)

    expect(fr.view).toBe(VIEW_TAGS.VIEW_SITEMAP)
    expect(fr.lang).toBe(LOCALES.FR)
    expect(fr.meta.canonical).toBe(
      `${CHAR_STRINGS.SLASH}${LOCALES.FR}${CHAR_STRINGS.SLASH}${LANG_SLUGS.fr.sitemap}`
    )

    // English-segment alias under a locale canonicalizes onto its slug.
    const alias = router.parsePath(`/${LOCALES.FR}/${ROUTE_PATHS.SITEMAP_SEGMENT}`)

    expect(alias.view).toBe(VIEW_TAGS.VIEW_SITEMAP)
    expect(alias.meta.canonical).toBe(fr.meta.canonical)
  })
})

describe('<legal-footer> sitemap item', () => {
  test('renders a localized sitemap link inside the legal nav', async () => {
    const el = document.createElement(COMPONENT_TAGS.LEGAL_FOOTER)

    document.body.appendChild(el)
    await flush()

    const nav = el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_LEGAL}`)

    const anchors = [...nav.querySelectorAll('a')]

    const sitemap = anchors.find(
      (a) => a.getAttribute(LINK_ATTRS.HREF) === sitemapHrefFor(LOCALES.EN)
    )

    const animations = anchors.find(
      (a) => a.getAttribute(LINK_ATTRS.HREF) === animationsHrefFor(LOCALES.EN)
    )

    expect(sitemap).not.toBeUndefined()
    expect(sitemap.textContent.trim()).toBe(String(appText(SECTION_UI_KEYS.SITEMAP)))

    expect(animations).not.toBeUndefined()

    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

    sitemap.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(pushSpy).toHaveBeenCalledWith(sitemapHrefFor(LOCALES.EN))

    animations.dispatchEvent(
      new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })
    )

    expect(pushSpy).toHaveBeenCalledWith(animationsHrefFor(LOCALES.EN))

    pushSpy.mockRestore()
    el.remove()
  })
})

describe('<awards-mentions> home footer additions', () => {
  test('renders sitemap + RSS feed items after the legal links', async () => {
    const el = document.createElement(COMPONENT_TAGS.AWARDS_MENTIONS)

    document.body.appendChild(el)
    await flush()

    const nav = el.shadowRoot.querySelector(`.${AWARDS_CLASSES.AWARDS_FOOTER_LINKS}`)

    const anchors = [...nav.querySelectorAll('a')]

    const sitemap = anchors.find(
      (a) => a.getAttribute(LINK_ATTRS.HREF) === sitemapHrefFor(LOCALES.EN)
    )

    const animations = anchors.find(
      (a) => a.getAttribute(LINK_ATTRS.HREF) === animationsHrefFor(LOCALES.EN)
    )

    const feed = anchors.find((a) => a.classList.contains(AWARDS_CLASSES.AWARDS_FOOTER_FEED))

    expect(sitemap).not.toBeUndefined()

    expect(animations).not.toBeUndefined()

    expect(feed).not.toBeUndefined()
    expect(feed.getAttribute(LINK_ATTRS.HREF)).toBe(feedHrefFor(LOCALES.EN))
    expect(feed.getAttribute(FORM_ATTRS.TYPE)).toBe(NET_STRINGS.MIME_RSS)
    expect(feed.textContent.trim()).toBe(String(appText(SECTION_UI_KEYS.RSS_FEED)))
    expect(feed.querySelector(`.${AWARDS_CLASSES.AWARDS_FOOTER_FEED_ICON}`)).not.toBeNull()

    // Feed clicks stay native (no SPA routing); sitemap clicks route.
    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

    const feedClick = new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true })

    feed.dispatchEvent(feedClick)

    expect(pushSpy).not.toHaveBeenCalled()
    expect(feedClick.defaultPrevented).toBe(false)

    sitemap.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true }))

    expect(pushSpy).toHaveBeenCalledWith(sitemapHrefFor(LOCALES.EN))

    pushSpy.mockRestore()
    el.remove()
  })
})
