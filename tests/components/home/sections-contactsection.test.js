/**
 * @file sections-contactsection.test.js
 * @description Split from sections.test.js — covers the "ContactSection"
 * describe: skeleton state, title/subtitle, the mailto channel, the
 * secondary link pills with captions, and the embedded <mentions-deck>.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { ContactSection } from '@website/components/home/ContactSection.js'
import { mount, TEST_TEXT } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { CONTACT_CLASSES } from '@core/tokens/classes/contact.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'

// ─────────────────────────────────────────────────────────────────────────────
// ContactSection
// ─────────────────────────────────────────────────────────────────────────────
describe('ContactSection', () => {
  let contactEl
  let cleanup

  beforeEach(() => {
    contactEl = new ContactSection()
    cleanup = mount(contactEl)
  })

  afterEach(() => cleanup())

  test('creates shadow root on construction', () => {
    expect(contactEl.shadowRoot).not.toBeNull()
  })

  test('renders skeleton state when store has no contact translations', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})
    contactEl._updateDom()
    const skelTitle = contactEl.shadowRoot.querySelector(`.${SKELETON_CLASSES.SKELETON_TITLE_SM}`)
    expect(skelTitle).not.toBeNull()
    const skelLinks = contactEl.shadowRoot.querySelectorAll(
      `.${SKELETON_CLASSES.SKELETON_FOOTER_LINK}`
    )
    expect(skelLinks.length).toBe(4)
    expect(contactEl.shadowRoot.querySelector(COMPONENT_TAGS.MENTIONS_DECK)).toBeNull()
  })

  test('renders title + subtitle when translations are populated', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: {
        title: NAV_TEXT.GET_IN_TOUCH,
        subtitle: TEST_TEXT.SECOND,
        line1: [{ description: 'Email', link: 'mailto:test@example.com' }],
      },
    })
    contactEl._updateDom()

    const titleEl = contactEl.shadowRoot.querySelector(`.${CONTACT_CLASSES.CONTACT_TITLE}`)
    expect(titleEl.textContent).toContain(NAV_TEXT.GET_IN_TOUCH)

    const subtitle = contactEl.shadowRoot.querySelector(`.${CONTACT_CLASSES.CONTACT_SUBTITLE}`)
    expect(subtitle.textContent).toBe(TEST_TEXT.SECOND)
  })

  test('mail channel becomes the primary mail block with the stripped address', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: {
        title: NAV_TEXT.GET_IN_TOUCH,
        line1: [
          { description: 'Email', link: 'mailto:test@example.com' },
          { description: 'GitHub', link: 'https://github.com/luiskr' },
        ],
      },
    })
    contactEl._updateDom()

    const mail = contactEl.shadowRoot.querySelector(`a.${CONTACT_CLASSES.CONTACT_MAIL}`)
    expect(mail).not.toBeNull()
    expect(mail.getAttribute(LINK_ATTRS.HREF)).toBe('mailto:test@example.com')
    expect(mail.getAttribute(LINK_ATTRS.TARGET)).toBe(DOM_STRINGS.BLANK)
    expect(mail.getAttribute(LINK_ATTRS.REL)).toBe(DOM_STRINGS.NOOPENER)

    const addr = mail.querySelector(`.${CONTACT_CLASSES.CONTACT_MAIL_ADDR}`)
    expect(addr.textContent).toBe('test@example.com')

    const links = contactEl.shadowRoot.querySelectorAll(`a.${CONTACT_CLASSES.CONTACT_LINKS_LINK}`)
    expect(links.length).toBe(1)
    expect(links[0].getAttribute(LINK_ATTRS.HREF)).toBe('https://github.com/luiskr')
  })

  test('renders captions under secondary links when the CMS row ships one', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: {
        title: NAV_TEXT.GET_IN_TOUCH,
        line1: [
          { description: 'Phone', link: 'tel:+5551999999', caption: TEST_TEXT.BODY },
          { description: 'LinkedIn', link: 'https://linkedin.com/in/luiskr' },
        ],
      },
    })
    contactEl._updateDom()

    const captions = contactEl.shadowRoot.querySelectorAll(
      `.${CONTACT_CLASSES.CONTACT_LINKS_CAPTION}`
    )
    expect(captions.length).toBe(1)
    expect(captions[0].textContent).toBe(TEST_TEXT.BODY)

    const arrows = contactEl.shadowRoot.querySelectorAll(`.${CONTACT_CLASSES.CONTACT_LINKS_ARROW}`)
    expect(arrows.length).toBe(2)

    const items = contactEl.shadowRoot.querySelectorAll(
      `.${CONTACT_CLASSES.CONTACT_LINKS_ITEM} h4.${A11Y_CLASSES.SR_ONLY}`
    )
    expect(items.length).toBe(2)
  })

  test('mounts <mentions-deck> and forwards the store mentions slice', async () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: { title: NAV_TEXT.GET_IN_TOUCH, line1: [] },
    })
    contactEl._updateDom()
    await new Promise((r) => setTimeout(r, 30))

    const deck = contactEl.shadowRoot.querySelector(COMPONENT_TAGS.MENTIONS_DECK)
    expect(deck).not.toBeNull()
    expect(deck.classList.contains(CONTACT_CLASSES.CONTACT_MENTIONS)).toBe(true)
    expect(Array.isArray(deck.items)).toBe(true)
    expect(typeof deck.title).toBe('string')
  })

  test('mentionsTranslations setter forwards into the deck', async () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: { title: NAV_TEXT.GET_IN_TOUCH, line1: [] },
    })
    contactEl._updateDom()
    await new Promise((r) => setTimeout(r, 30))

    contactEl.mentionsTranslations = { deckHint: TEST_TEXT.HEADING }

    const deck = contactEl.shadowRoot.querySelector(COMPONENT_TAGS.MENTIONS_DECK)
    expect(deck.translations).toEqual({ deckHint: TEST_TEXT.HEADING })
    expect(contactEl.mentionsTranslations).toEqual({ deckHint: TEST_TEXT.HEADING })
  })

  test('covers pre-mount mentionsTranslations, stale Contact title fallback, and bare channel rows', () => {
    const unmounted = new ContactSection()
    unmounted.mentionsTranslations = { deckHint: TEST_TEXT.BODY }
    expect(unmounted.mentionsTranslations).toEqual({ deckHint: TEST_TEXT.BODY })

    // _syncMentionsDeck when no <mentions-deck> exists (skeleton state)
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})
    contactEl._updateDom()
    contactEl._syncMentionsDeck()

    const prevMentions = store.state.lang.mentions
    store.state.lang.mentions = { title: '', items: null }

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: {
        title: NAV_TEXT.CONTACT,
        subtitle: '',
        line1: [{ link: 'mailto:bare@example.com' }, { link: 'https://github.com/LuisKrotz' }],
      },
    })
    const prevFallbackSub = store.state.lang.components.contact
    store.state.lang.components = {
      contact: {
        ...prevFallbackSub,
        subtitle: '',
      },
    }
    contactEl._updateDom()
    contactEl._syncMentionsDeck()

    const captions = contactEl.shadowRoot.querySelectorAll(
      `.${CONTACT_CLASSES.CONTACT_LINKS_CAPTION}`
    )
    expect(captions.length).toBe(0)

    store.state.lang.mentions = prevMentions
  })
})
