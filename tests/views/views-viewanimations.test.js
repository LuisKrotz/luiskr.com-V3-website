/**
 * @file views-viewanimations.test.js
 * @description ViewAnimations suite — the animations-reference route view:
 * chrome skeletons, title/description from pages.animations, the record
 * definition list from components.animations, deep-link ids, locale reload
 * and footer composition.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ViewAnimations } from '@website/views/animations/Animations.js'
import { ROUTE_NAMES } from '@core/constants.js'
import { SCSS, mount } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ANIMATIONS_CLASSES } from '@core/tokens/classes/animations.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { ANIMATION_DOCS } from '@core/tokens/data/animation-ids.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import router from '@core/router/router.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import store from '@core/store.js'

// ─────────────────────────────────────────────────────────────────────────────
// ViewAnimations
// ─────────────────────────────────────────────────────────────────────────────
describe('ViewAnimations', () => {
  let el
  let cleanup

  beforeEach(() => {
    el = new ViewAnimations()
    cleanup = mount(el)
  })

  afterEach(() => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})
    cleanup()
  })

  test('creates shadow root on construction', () => {
    expect(el.shadowRoot).not.toBeNull()
  })

  test('renders article and div#main with the animations class', () => {
    const article = el.shadowRoot.querySelector('article')
    expect(article).not.toBeNull()
    const main = el.shadowRoot.querySelector(`div#main.${ANIMATIONS_CLASSES.ANIMATIONS}`)
    expect(main).not.toBeNull()
  })

  test('renders the title skeleton slot when translations is null', () => {
    el.translations = null
    el._updateDom()
    const titleSkel = el.shadowRoot.querySelector(`.${SKELETON_CLASSES.SKELETON_TITLE_SM}`)
    expect(titleSkel).not.toBeNull()
  })

  test('renders title + description when translations arrive', () => {
    el.translations = {
      title: ROUTE_NAMES.ANIMATIONS,
      description: 'Every animation described.',
    }
    el._updateDom()

    const title = el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_TITLE}`)
    const titleDraw = title.querySelector(COMPONENT_TAGS.DRAW_TEXT)
    expect(titleDraw).not.toBeNull()
    expect(titleDraw.getAttribute(FORM_ATTRS.TEXT)).toBe(ROUTE_NAMES.ANIMATIONS)

    const intro = el.shadowRoot.querySelectorAll(`p.${INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT}`)
    expect([...intro].some((p) => p.textContent === 'Every animation described.')).toBe(true)
  })

  test('lists every animations record as a deep-linkable heading/desc row', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: {
        'burger-button': { alt: 'Burger morph', longdesc: 'Long burger description.' },
        'nav-menu': { alt: 'Menu rise', longdesc: 'Long menu description.' },
      },
    })
    el._updateDom()

    const list = el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_LIST}`)
    expect(list).not.toBeNull()
    // dl/dt/dd was replaced with div + h2/p — the docs anchor beside the
    // terms broke the legal dl>div group (axe definition-list/dlitem).
    expect(list.tagName.toLowerCase()).toBe('div')

    const records = list.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_RECORD}`)
    expect(records.length).toBe(2)
    expect(records[0].getAttribute('id')).toBe('burger-button')

    const terms = list.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_TERM}`)
    const descs = list.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_DESC}`)
    expect(terms[0].textContent).toBe('Burger morph')
    expect(descs[0].textContent).toBe('Long burger description.')
  })

  test('renders one <anim-demo> preview per record keyed by its id', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: {
        'burger-button': { alt: 'Burger morph', longdesc: 'Long burger description.' },
        'nav-menu': { alt: 'Menu rise', longdesc: 'Long menu description.' },
      },
    })
    el._updateDom()

    const demos = el.shadowRoot.querySelectorAll(COMPONENT_TAGS.ANIM_DEMO)
    expect(demos.length).toBe(2)

    const record = el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_RECORD}`)
    const demo = record.querySelector(COMPONENT_TAGS.ANIM_DEMO)
    expect(demo).not.toBeNull()
    expect(demo.getAttribute(COMMON_ATTRS.ANIMATION)).toBe('burger-button')
  })

  test('links every record into its in-depth docs page', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: {
        [ANIMATION_IDS.BURGER_BUTTON]: {
          alt: 'Burger morph',
          longdesc: 'Long burger description.',
        },
        [ANIMATION_IDS.NAV_MENU]: { alt: 'Menu rise', longdesc: 'Long menu description.' },
      },
    })
    el._updateDom()

    const links = el.shadowRoot.querySelectorAll(`a.${ANIMATIONS_CLASSES.ANIMATIONS_DOCS}`)
    expect(links.length).toBe(2)
    expect(links[0].textContent).toBe(DOCS_STRINGS.TITLE)
    expect(links[0].getAttribute('href')).toBe(
      `${ROUTE_PATHS.DOCS}/${ANIMATION_DOCS[ANIMATION_IDS.BURGER_BUTTON]}`
    )
    expect(links[1].getAttribute('href')).toBe(
      `${ROUTE_PATHS.DOCS}/${ANIMATION_DOCS[ANIMATION_IDS.NAV_MENU]}`
    )
  })

  test('skips CMS records whose id has no docs entry (retired surfaces)', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: {
        [ANIMATION_IDS.BURGER_BUTTON]: {
          alt: 'Burger morph',
          longdesc: 'Long burger description.',
        },
        'extra-cms-record': { alt: 'Extra', longdesc: 'Long extra description.' },
      },
    })
    el._updateDom()

    const records = el.shadowRoot.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_RECORD}`)
    expect(records.length).toBe(1)
    expect(records[0].getAttribute('id')).toBe(ANIMATION_IDS.BURGER_BUTTON)
  })

  test('routes internal link clicks through the SPA router', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: {
        [ANIMATION_IDS.BURGER_BUTTON]: {
          alt: 'Burger morph',
          longdesc: 'Long burger description.',
        },
      },
    })
    el._updateDom()

    const push = jest.spyOn(router, 'push').mockImplementation(() => {})

    const link = el.shadowRoot.querySelector(`a.${ANIMATIONS_CLASSES.ANIMATIONS_DOCS}`)
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(push).toHaveBeenCalledWith(link.getAttribute('href'))

    // Non-anchor clicks inside the list do nothing.
    push.mockClear()
    el.shadowRoot
      .querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_TERM}`)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(push).not.toHaveBeenCalled()

    // Modified clicks keep native new-tab semantics — no SPA takeover.
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    expect(push).not.toHaveBeenCalled()

    // External hrefs inside the list bubble through untouched.
    const external = document.createElement('a')
    external.setAttribute('href', 'https://example.com')
    el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_LIST}`).appendChild(external)
    external.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(push).not.toHaveBeenCalled()

    push.mockRestore()
  })

  test('falls back to the record id when alt is missing', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: { [ANIMATION_IDS.BODY_GLOW]: {} },
    })
    el._updateDom()

    const term = el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_TERM}`)
    expect(term.textContent).toBe(ANIMATION_IDS.BODY_GLOW)
    const desc = el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_DESC}`)
    expect(desc.textContent).toBe('')
  })

  test('renders skeleton rows when no records resolve', () => {
    el.translations = null
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, { [CMS_KEYS.ANIMATIONS]: {} })
    el._updateDom()

    expect(el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_LIST}`)).toBeNull()
    const skel = el.shadowRoot.querySelectorAll(
      `.${INTERNAL_CLASSES.INTERNAL_DESCRIPTION}.${SKELETON_CLASSES.SKELETON_SHIMMER}, .${INTERNAL_CLASSES.INTERNAL_DESCRIPTION}`
    )
    expect(skel.length).toBeGreaterThanOrEqual(3)
  })

  test('renders legal-footer component at the bottom', () => {
    const footer = el.shadowRoot.querySelector(COMPONENT_TAGS.LEGAL_FOOTER)
    expect(footer).not.toBeNull()
  })

  test('onStoreUpdate reloads only on a real locale change', () => {
    el._lastLocale = null
    el.onStoreUpdate()

    el._lastLocale = 'zz-nope'
    el.onStoreUpdate()
    expect(el._lastLocale).toBe(store.getters.getLang())
  })

  test('animations.scss defines the record list styling', () => {
    expect(SCSS.animations).toMatch(/\$_B_ANIM/)
    expect(SCSS.animations).toMatch(/-list/)
    expect(SCSS.animations).toMatch(/-record/)
    expect(SCSS.animations).toMatch(/-term/)
  })
})
