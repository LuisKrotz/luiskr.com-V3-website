/**
 * @file views-viewanimations.test.js
 * @description ViewAnimations suite — the animations-reference route view:
 * chrome skeletons, title/description from pages.animations, the record
 * definition list from components.animations, deep-link ids, locale reload
 * and footer composition.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { ViewAnimations } from '@website/views/animations/Animations.js'
import { ROUTE_NAMES } from '@core/constants.js'
import { SCSS, mount } from '@tests/fixtures/test-constants.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { ANIMATIONS_CLASSES } from '@core/tokens/classes/animations.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
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

  test('lists every animations record as a deep-linkable dt/dd row', () => {
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
    expect(list.tagName.toLowerCase()).toBe('dl')

    const records = list.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_RECORD}`)
    expect(records.length).toBe(2)
    expect(records[0].getAttribute('id')).toBe('burger-button')

    const terms = list.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_TERM}`)
    const descs = list.querySelectorAll(`.${ANIMATIONS_CLASSES.ANIMATIONS_DESC}`)
    expect(terms[0].textContent).toBe('Burger morph')
    expect(descs[0].textContent).toBe('Long burger description.')
  })

  test('falls back to the record id when alt is missing', () => {
    el.translations = { title: ROUTE_NAMES.ANIMATIONS }
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      [CMS_KEYS.ANIMATIONS]: { 'note-dot': {} },
    })
    el._updateDom()

    const term = el.shadowRoot.querySelector(`.${ANIMATIONS_CLASSES.ANIMATIONS_TERM}`)
    expect(term.textContent).toBe('note-dot')
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
