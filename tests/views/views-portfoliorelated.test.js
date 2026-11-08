/**
 * @file views-portfoliorelated.test.js
 * @description Split from views.test.js — covers the "PortfolioRelated" describe.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { PortfolioRelated } from '@website/components/portfolio/Related.js'
import { LegalFooter } from '@website/components/legal/Footer.js'
import { LOCALES } from '@core/constants.js'
import { mount, TEST_PROJECTS, TEST_TEXT } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { ROUTER_CLASSES } from '@core/tokens/classes/router.js'
import { KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { KEYS } from '@core/tokens/primitives.js'
import { RELATED_LAYOUT, RELATED_TIMING } from '@core/tokens/motion/related.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'

// ─── Local selector helpers (derived from TAGS/CLASSES) ───────────────────────
const _S = {
  DRAW_TEXT: COMPONENT_TAGS.DRAW_TEXT,
  MEDIA_FIGURE: COMPONENT_TAGS.MEDIA_FIGURE,
  PORTFOLIO_RELATED: COMPONENT_TAGS.PORTFOLIO_RELATED,
  HOME_MOSAIC_ITEM: `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM}`,
  HOME_MOSAIC_TITLE: `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_TITLE}`,
}

// ─────────────────────────────────────────────────────────────────────────────
// PortfolioRelated
// ─────────────────────────────────────────────────────────────────────────────
describe('PortfolioRelated', () => {
  let relatedEl
  let cleanup

  beforeEach(() => {
    relatedEl = new PortfolioRelated()
    cleanup = mount(relatedEl)
  })

  afterEach(() => cleanup())

  test('creates shadow root on construction', () => {
    expect(relatedEl.shadowRoot).not.toBeNull()
  })

  test('projectsList returns empty array when translations has no projects', () => {
    relatedEl.translations = {}
    expect(relatedEl.projectsList).toEqual([])
  })

  test('maps projects with clean links and resolves home portfolio images', () => {
    store.state.portfoliolist = [
      { link: 'art-direction', image: 'art-dir-thumb.webp', label: 'Art Direction' },
    ]
    relatedEl.translations = {
      path: ROUTE_PATHS.PORTFOLIO,
      projects: [{ link: '/portfolio/art-direction', page: 'Art Direction' }],
    }
    const projects = relatedEl.projectsList
    expect(projects.length).toBe(1)
    expect(projects[0].link).toBe('art-direction')
    expect(projects[0].imageSrc).toContain('art-dir-thumb.webp')
  })

  test('renders related section with title when translations are present', () => {
    relatedEl.translations = {
      title: 'More Projects',
      path: ROUTE_PATHS.PORTFOLIO,
      projects: [
        { link: '/portfolio/project-one', page: 'Project One' },
        { link: '/portfolio/project-two', page: 'Project Two' },
      ],
    }
    relatedEl._updateDom()
    expect(relatedEl.shadowRoot.textContent).toContain('More Projects')
    const mosaic = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)
    const links = mosaic.querySelectorAll(HTML_TAGS.A)
    expect(links.length).toBe(2)
  })

  test('clicking item link pushes route to router', () => {
    let routed = null
    const origPush = router.push
    router.push = (path) => {
      routed = path
    }

    relatedEl.translations = {
      title: 'More Projects',
      path: ROUTE_PATHS.PORTFOLIO,
      projects: [{ link: '/portfolio/design-system', page: 'Design System' }],
    }
    relatedEl._updateDom()
    const link = relatedEl.shadowRoot.querySelector('a')
    expect(link).not.toBeNull()
    link.click()
    expect(routed).toContain('design-system')
    router.push = origPush
  })

  test('item without fullPath/imageSrc takes the skip-push and skeleton arms', () => {
    let routed = null
    const origPush = router.push
    router.push = (path) => {
      routed = path
    }

    // projectsList always derives non-empty fullPath/imageSrc in production;
    // the render guards still need a falsy projection — inject one directly.
    Object.defineProperty(relatedEl, 'projectsList', {
      configurable: true,
      get: () => [
        {
          link: CHAR_STRINGS.EMPTY,
          page: 'Ghost',
          fullPath: CHAR_STRINGS.EMPTY,
          imageSrc: CHAR_STRINGS.EMPTY,
          description: CHAR_STRINGS.EMPTY,
        },
      ],
    })
    relatedEl.translations = { title: 'More Projects', path: ROUTE_PATHS.PORTFOLIO }
    relatedEl._updateDom()

    const link = relatedEl.shadowRoot.querySelector('a')
    expect(link).not.toBeNull()
    expect(link.querySelector(`.${SKELETON_CLASSES.SKELETON_MEDIA}`)).not.toBeNull()

    link.click()
    expect(routed).toBeNull()

    delete relatedEl.projectsList
    router.push = origPush
  })

  test('footer home link routes back to the localized home path', () => {
    // The home link lives in the shared <legal-footer> socials row now —
    // the related strip no longer renders footer chrome.
    const footerEl = new LegalFooter()
    const footerCleanup = mount(footerEl)

    footerEl._updateDom()

    let routed = null
    const origPush = router.push
    router.push = (path) => {
      routed = path
    }

    const home = footerEl.shadowRoot.querySelector(
      `.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_HOME}`
    )

    expect(home).not.toBeNull()

    home.click()
    expect(routed).toBe(home.getAttribute(LINK_ATTRS.HREF))

    router.push = origPush
    footerCleanup()
  })

  test('projectsList covers object maps, fallbacks and all match strategies', () => {
    const prevList = store.state.portfoliolist

    store.state.portfoliolist = null
    relatedEl.homePortfolio = [
      null,
      { title: 'Project Beta', description: 'home-desc' },
      { image: 'x-alpha' },
      { label: 'No Match' },
    ]
    relatedEl.translations = {
      // no `path` → PORTFOLIO_SLASH default; object map → Object.values arm
      projects: {
        a: { link: '/projects/x-alpha', page: 'Alpha', featured: true, description: 'own-desc' },
        b: { title: 'Beta' },
        c: { link: '/portfolio/gamma/' },
        d: { link: 'delta', image: 'delta-img' },
      },
    }

    const list = relatedEl.projectsList

    expect(list).toHaveLength(4)
    expect(list[0].featured).toBe(true)
    expect(list[2].link).toBe('gamma')

    store.state.portfoliolist = prevList
  })

  test('projectsList binds prefix-collision slugs to their own home card', () => {
    const prevList = store.state.portfoliolist

    // minimelissa is a superstring of melissa — the loose substring rules
    // must not let it inherit the earlier melissa row's cover.
    store.state.portfoliolist = [
      {
        link: TEST_PROJECTS.MELISSA,
        image: `${TEST_PROJECTS.MELISSA}-cover`,
        width: ['1230'],
        height: ['769'],
      },
      { link: TEST_PROJECTS.MINI_MELISSA, image: `${TEST_PROJECTS.SLUG_MINIMELISSA}-cropped` },
    ]
    relatedEl.translations = {
      path: ROUTE_PATHS.PORTFOLIO,
      projects: [
        {
          link: `${ROUTE_PATHS.PORTFOLIO_SLASH}${TEST_PROJECTS.SLUG_MINIMELISSA}`,
          page: TEST_TEXT.HELLO,
        },
        { link: `${ROUTE_PATHS.PORTFOLIO_SLASH}${TEST_PROJECTS.MELISSA}`, page: TEST_TEXT.SECOND },
      ],
    }

    const list = relatedEl.projectsList

    expect(list[0].imageSrc).toContain(`${TEST_PROJECTS.SLUG_MINIMELISSA}-cropped`)
    expect(list[1].imageSrc).toContain(`${TEST_PROJECTS.MELISSA}-cover`)
    expect(list[1].imageW).toBe(1230)
    expect(list[1].imageH).toBe(769)

    store.state.portfoliolist = prevList
  })

  test('non-EN locale, relative basePath and storage fallback', () => {
    const prevLocale = store.state.lang.locale
    const prevStorage = store.state.storage
    const prevList = store.state.portfoliolist

    store.state.lang.locale = LOCALES.BR
    store.state.storage = null
    store.state.portfoliolist = null

    relatedEl.translations = {
      title: 'More',
      path: ROUTE_PATHS.PORTFOLIO_SEGMENT,
      projects: [{ link: '/portfolio/p1', page: 'p1' }],
    }

    const list = relatedEl.projectsList

    expect(list[0].fullPath).toContain('/br/portfolio/p1')
    expect(relatedEl.storage).toContain('http')

    relatedEl._updateDom()

    store.state.lang.locale = prevLocale
    store.state.storage = prevStorage
    store.state.portfoliolist = prevList
  })

  test('keyed-object socials from Firebase normalize instead of crashing render', () => {
    // The socials row renders inside the shared <legal-footer> now —
    // its components/related dictionary carries the same keyed-object
    // shape Firebase writes.
    const prev = store.getters.getlang()?.components
    const payload = {
      related: {
        note: TEST_TEXT.LONG_NOTE,
        socials: {
          first: { network: 'gh', link: 'https://x.example' },
          second: { network: 'mail', link: 'mailto:x@example.com' },
        },
      },
    }

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, payload)

    const footerEl = new LegalFooter()
    const footerCleanup = mount(footerEl)

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, payload)

    expect(() => footerEl._updateDom()).not.toThrow()

    const links = footerEl.shadowRoot.querySelectorAll(
      `.${INTERNAL_CLASSES.INTERNAL_FOOTER_SOCIALS} .${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_LINK}`
    )

    // home link + the two keyed socials
    expect(links.length).toBe(3)
    expect(links[0].classList.contains(INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_HOME)).toBe(true)

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, prev)
    footerCleanup()
  })

  test('disclaimer note renders its full text — no clamp, no show-more', () => {
    // The disclaimer lives in the shared <legal-footer>: always a plain
    // paragraph carrying the whole note, never a toggle.
    const prev = store.getters.getlang()?.components
    const payload = { related: { note: TEST_TEXT.LONG_NOTE } }

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, payload)

    const footerEl = new LegalFooter()
    const footerCleanup = mount(footerEl)

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, payload)
    footerEl._updateDom()

    const note = footerEl.shadowRoot.querySelector(
      `.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE}`
    )
    const noteText = footerEl.shadowRoot.querySelector(
      `.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_TEXT}`
    )

    expect(note).not.toBeNull()
    expect(note.tagName).toBe(HTML_TAGS.P.toUpperCase())
    expect(note.getAttribute(ARIA_ATTRS.ARIA_EXPANDED)).toBeNull()
    expect(noteText.innerHTML).toBe(TEST_TEXT.LONG_NOTE)

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, prev)
    footerCleanup()
  })

  test('isCurrent arms: link match, page match and non-match', () => {
    const prevLocation = window.location

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/portfolio/omega' },
    })

    relatedEl.translations = {
      title: 'T',
      projects: [
        { link: 'omega', page: 'x' },
        { link: 'zzz', page: 'omega' },
        { link: 'other', page: 'other' },
      ],
    }
    relatedEl._updateDom()

    const active = relatedEl.shadowRoot.querySelectorAll(`.${ROUTER_CLASSES.ROUTER_LINK_ACTIVE}`)

    expect(active.length).toBe(2)

    Object.defineProperty(window, 'location', { configurable: true, value: prevLocation })
  })

  test('window-less render arm and destroy guards', () => {
    const prevWindow = globalThis.window

    delete globalThis.window

    relatedEl.translations = { title: 'T', projects: [{ link: 'x', page: 'y' }] }
    relatedEl.render()

    globalThis.window = prevWindow

    // onDestroy without onMounted → the unsub guard else arm
    const fresh = new PortfolioRelated()

    fresh.onDestroy()

    // onMounted with a title already present → the translations guard else arm
    const titled = new PortfolioRelated()

    titled.translations = { title: 'preset' }
    document.body.appendChild(titled)
    titled.remove()
  })

  test('fetchData covers missing snapshots and object portfoliolist', async () => {
    const lang = store.getters.getlang()
    const prevDb = lang.database
    const prevLocale = lang.locale
    const origFetch = globalThis.fetch

    // network returns null → both snapshots exists()===false → else arms
    globalThis.fetch = async () => ({ ok: true, json: async () => null })

    lang.database = 'nodb/'
    lang.locale = CHAR_STRINGS.EMPTY

    relatedEl.fetchData()

    await new Promise((r) => setTimeout(r, 80))

    // new database path → skips the db.js in-flight cache — network returns
    // a portfoliolist OBJECT → Object.values arm
    lang.database = 'nodb2/'

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ portfoliolist: { a: { link: 'x', image: 'y' } } }),
    })

    relatedEl.fetchData()

    await new Promise((r) => setTimeout(r, 80))

    expect(relatedEl.homePortfolio.length).toBe(1)

    globalThis.fetch = origFetch
    lang.database = prevDb
    lang.locale = prevLocale
  })

  test('router notify and title-present store update arms', async () => {
    // beforeEach mounted the element → the router subscriber is already live
    relatedEl.translations = { title: 'kept' }

    relatedEl.onStoreUpdate()

    router.notify({ path: '/x', name: 'x' }, { path: '/', name: 'home' })

    relatedEl.onDestroy()
  })

  test('module re-eval sees the tag already registered', async () => {
    jest.resetModules()

    await import('@website/components/portfolio/Related.js')
  })

  // ─── Accordion conveyor ────────────────────────────────────────────────────

  const fiveProjects = () => ({
    title: 'More',
    path: ROUTE_PATHS.PORTFOLIO,
    projects: [1, 2, 3, 4, 5].map((n) => ({
      link: `/portfolio/p${n}`,
      page: `P${n}`,
      description: `Desc ${n}`,
    })),
  })

  const listItems = () => [
    ...relatedEl.shadowRoot.querySelectorAll(`.${RELATED_CLASSES.RELATED_LIST_ITEM}`),
  ]

  test('renders the window open and folds the tail into inert closed slots', () => {
    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    const items = listItems()
    const closed = items.filter((el) =>
      el.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)
    )

    expect(items.length).toBe(5)
    expect(closed.length).toBe(5 - RELATED_LAYOUT.VISIBLE_COUNT)

    closed.forEach((el) => {
      expect(el.hasAttribute(COMMON_ATTRS.INERT)).toBe(true)
      expect(el.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    })

    // open rows carry media + title + always-visible description
    const first = items[0]

    expect(first.querySelector(`.${RELATED_CLASSES.RELATED_LIST_MEDIA}`)).not.toBeNull()
    expect(first.querySelector(`.${RELATED_CLASSES.RELATED_LIST_TITLE}`)).not.toBeNull()
    expect(first.querySelector(`.${RELATED_CLASSES.RELATED_LIST_DESC}`)).not.toBeNull()
  })

  test('reduced motion pins every row open — no closed slots', () => {
    const rmSpy = jest.spyOn(store.getters, 'getReducedMotion').mockReturnValue(true)

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    expect(
      relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED}`)
    ).toBeNull()

    rmSpy.mockRestore()
  })

  test('a forward step folds the top row, unfolds the next, and wraps back to the first', () => {
    jest.useFakeTimers()

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    const list = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)
    const first = listItems()[0]

    relatedEl._stepList(1)

    expect(first.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)).toBe(true)
    expect(first.hasAttribute(COMMON_ATTRS.INERT)).toBe(true)
    expect(
      list.children[RELATED_LAYOUT.VISIBLE_COUNT].classList.contains(
        RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED
      )
    ).toBe(false)

    // the folded node joins the tail only after the collapse watchdog
    jest.advanceTimersByTime(RELATED_TIMING.REORDER_DELAY)
    expect(list.children[list.children.length - 1]).toBe(first)

    // keep stepping — the wrap returns the first item through the same
    // expand-from-collapsed motion
    for (let i = 0; i < 4; i++) {
      relatedEl._advanceList()

      jest.advanceTimersByTime(RELATED_TIMING.REORDER_DELAY)
    }

    expect(first.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)).toBe(false)

    jest.useRealTimers()
  })

  test('advance guards: missing list, all-open window, all-closed rows', () => {
    // skeleton list (no projects): rows exist but none are closed → no
    // folded slot after the window → the entering guard returns
    relatedEl.translations = {}
    relatedEl._updateDom()
    relatedEl._advanceList()

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    const list = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)
    const items = listItems()

    // a non-item node right after the window (anim-desc sr-only, the
    // ring-sheen canvas) is skipped — the folded row after it unfolds
    const stray = document.createElement(HTML_TAGS.DIV)

    list.insertBefore(stray, items[RELATED_LAYOUT.VISIBLE_COUNT])
    relatedEl._advanceList()

    expect(relatedEl._listReorderNode).not.toBeNull()

    stray.remove()
    relatedEl._flushListReorder()

    // every row closed → firstOpen < 0 arm
    items.forEach((el) => el.classList.add(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED))
    relatedEl._advanceList()

    // remove the list node → the missing-list arm (+ _syncList's !list arm)
    list.remove()
    relatedEl._advanceList()
    relatedEl._syncList()

    expect(relatedEl._listEl).toBeNull()
  })

  test('reorder flush arms: early flush on second schedule and detached skip', () => {
    jest.useFakeTimers()

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    const list = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)

    relatedEl._advanceList()

    // a second step lands before the watchdog → the pending move flushes now
    relatedEl._advanceList()
    const kids = [...list.children].filter((el) =>
      el.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM)
    )

    expect(kids[kids.length - 1].classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)).toBe(
      true
    )

    // detached skip: re-render replaces the list before the watchdog fires
    relatedEl._advanceList()
    relatedEl._updateDom()
    jest.advanceTimersByTime(RELATED_TIMING.REORDER_DELAY)

    expect(relatedEl._listReorderNode).toBeNull()

    jest.useRealTimers()
  })

  test('_syncList arms: same-node early return + no keydown on a fits-window list', () => {
    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    // same-node early return — the listener is bound once per list node
    relatedEl._syncList()

    // a list that fits its window gets no key handler — arrows pass through
    const three = fiveProjects()
    three.projects = three.projects.slice(0, RELATED_LAYOUT.VISIBLE_COUNT)
    relatedEl.translations = three
    relatedEl._updateDom()

    const fitted = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)
    const kd = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_DOWN,
      cancelable: true,
    })

    fitted.dispatchEvent(kd)
    expect(kd.defaultPrevented).toBe(false)
  })

  test('manual steps: prev/next buttons and arrow keys fold the bellows', () => {
    jest.useFakeTimers()

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    const list = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)

    // step buttons render only while the conveyor can fold
    const prev = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST_BTN_PREV}`)
    const next = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST_BTN_NEXT}`)

    expect(prev).not.toBeNull()
    expect(next).not.toBeNull()

    const first = listItems()[0]

    // next → forward fold
    next.click()
    expect(first.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)).toBe(true)

    // prev → the tail's folded row returns to the top slot
    prev.click()
    expect(first.classList.contains(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED)).toBe(false)
    expect(listItems()[0]).toBe(first)

    // step forward again, let the fold land, then prev rewinds it back
    next.click()
    jest.advanceTimersByTime(RELATED_TIMING.REORDER_DELAY)

    const top = listItems()[0]

    prev.click()
    expect(listItems()[0]).not.toBe(top)
    expect(listItems()[0]).toBe(first)

    // arrow keys drive the same step path (and consume the key)
    const kd = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, {
      key: KEYS.ARROW_DOWN,
      cancelable: true,
    })
    list.dispatchEvent(kd)
    expect(kd.defaultPrevented).toBe(true)

    const ku = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ARROW_UP, cancelable: true })
    list.dispatchEvent(ku)
    expect(ku.defaultPrevented).toBe(true)

    // unrelated keys are ignored
    const ki = new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ENTER, cancelable: true })
    list.dispatchEvent(ki)
    expect(ki.defaultPrevented).toBe(false)

    jest.useRealTimers()
  })

  test('retreat guards: no folded tail and no open rows', () => {
    // skeleton list: nothing folded → the !tailEnd arm returns
    relatedEl.translations = {}
    relatedEl._updateDom()
    relatedEl._retreatList()

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    const list = relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST}`)

    // missing list arm
    list.remove()
    relatedEl._retreatList()

    relatedEl._updateDom()

    // every row folded → lastOpen < 0 arm
    listItems().forEach((el) => el.classList.add(RELATED_CLASSES.RELATED_LIST_ITEM_CLOSED))
    relatedEl._retreatList()
  })

  test('step buttons are absent for a list that fits its window', () => {
    const three = fiveProjects()
    three.projects = three.projects.slice(0, RELATED_LAYOUT.VISIBLE_COUNT)
    relatedEl.translations = three
    relatedEl._updateDom()

    expect(
      relatedEl.shadowRoot.querySelector(`.${RELATED_CLASSES.RELATED_LIST_CONTROLS}`)
    ).toBeNull()
  })

  test('onDestroy drains the conveyor state', () => {
    jest.useFakeTimers()

    relatedEl.translations = fiveProjects()
    relatedEl._updateDom()

    relatedEl._advanceList()

    relatedEl.onDestroy()

    expect(relatedEl._listEl).toBeNull()
    expect(relatedEl._listReorderNode).toBeNull()

    jest.useRealTimers()
  })
})
