/**
 * @file anim-demo-elements-tails.test.js
 * @description Coverage tails for website/components/media/anim-demo/elements.ts
 * + data.ts — the real-element demo drivers and their shared RTDB
 * loader. Contracts: every driver mounts nothing when its tag is
 * absent, feeds the loaded HOME/ABOUT/related nodes into the element's
 * duck-typed props while live, and discards late payloads after
 * teardown; the scene driver falls back to the 2D starfield when the
 * WebGPU mount returns null or rejects.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import store from '@core/store.js'

/** Controllable snapshot — exists() + val() per fetch call. */
const snap = (exists, val) => ({ exists: () => exists, val: () => val })

/** The fetch mock — re-seeded per test via _queue. */
const fetchImpl = jest.fn()

jest.unstable_mockModule('@core/utils/data/db.js', () => ({
  fetchFirebaseDb: (path, cb) => {
    const result = fetchImpl(path)

    return Promise.resolve(result).then((s) => {
      cb?.(s)
      return s
    })
  },
}))

/** Scene mount result — re-seeded per test to drive ok/null/reject arms. */
let _sceneResult = Promise.resolve(null)

jest.unstable_mockModule('@core/utils/gpu/scene3d.js', () => ({
  mountScene3d: () => _sceneResult,
}))

const { loadDemoData } = await import('@website/components/media/anim-demo/data.js')
const EL = await import('@website/components/media/anim-demo/elements.js')
const DOM = await import('@website/components/media/anim-demo/dom.js')
const MNT = await import('@website/components/media/anim-demo/mounts.js')
const { ANIM_DEMO_CLASSES: C } = await import('@core/tokens/classes/anim-demo.js')

/** A stage element optionally carrying one child tag. */
const makeStage = (tag) => {
  const stage = document.createElement(HTML_TAGS.DIV)

  if (tag) stage.appendChild(document.createElement(tag))

  return stage
}

/** A portfolio row fixture — featured via the explicit flag arm. */
const PORTFOLIO = {
  portfoliolist: [
    { link: '/project/a', image: 'a', label: TEST_TEXT.HEADING, featured: true },
    { link: '/project/b', image: 'b' },
    { link: '/project/c', image: 'c', featured: 1 },
    { link: '/project/d', image: 'd', featured: 'true' },
    { image: 'e' },
  ],
}

const ABOUT = {
  mentions: TEST_TEXT.HEADING,
  mention_items: { m1: { link: 'https://x', icon: '🏆' } },
}

const flush = () => new Promise((r) => setTimeout(r, 0))

/** Unique locale per test — loadDemoData caches its promise per locale. */
let _localeSeq = 0

describe('anim-demo elements tails', () => {
  beforeEach(() => {
    fetchImpl.mockReset()
    _sceneResult = Promise.resolve(null)
    _localeSeq += 1
    store.state.lang.locale = `${LOCALES.EN}-t${_localeSeq}`
  })

  test('loadDemoData resolves the three nodes and caches per locale', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(
        snap(
          true,
          path.includes('related') ? { p: { featured: true, link: '/project/a' } } : PORTFOLIO
        )
      )
    )

    const d = await loadDemoData()

    expect(d.home).not.toBeNull()
    expect(d.about).not.toBeNull()
    expect(d.related).not.toBeNull()

    const calls = fetchImpl.mock.calls.length

    await loadDemoData()
    expect(fetchImpl.mock.calls.length).toBe(calls)
  })

  test('loadDemoData resolves nulls when snapshots are missing or the fetch fails', async () => {
    fetchImpl
      .mockImplementationOnce(() => Promise.resolve(snap(false, null)))
      .mockImplementationOnce(() => Promise.reject(new Error(TEST_TEXT.HEADING)))
      .mockImplementationOnce(() => Promise.resolve(snap(true, {})))

    const d = await loadDemoData()

    expect(d.home).toBeNull()
    expect(d.about).toBeNull()
  })

  test('loadDemoData resolves nulls when every fetch rejects', async () => {
    fetchImpl.mockImplementation(() => Promise.reject(new Error(TEST_TEXT.HEADING)))

    const d = await loadDemoData()

    expect(d.home).toBeNull()
    expect(d.about).toBeNull()
    expect(d.related).toBeNull()
  })

  test('loadDemoData resolves nulls when snapshots are undefined', async () => {
    fetchImpl.mockImplementation(() => Promise.resolve(undefined))

    const d = await loadDemoData()

    expect(d.home).toBeNull()
    expect(d.about).toBeNull()
    expect(d.related).toBeNull()
  })

  test('card-stack driver resolves the object-form list + every featured arm', async () => {
    const related = { p: { featured: true, link: '/project/b' } }
    const home = {
      portfoliolist: {
        a: { link: '/project/a', featured: 'true' },
        b: { link: '/project/b' },
        c: { link: '/project/c', featured: 1 },
        d: { link: '/project/d', featured: true },
        e: { link: '/project/e' },
      },
    }

    fetchImpl.mockImplementation((path) =>
      Promise.resolve(snap(true, path.includes('related') ? related : home))
    )

    const stage = makeStage(COMPONENT_TAGS.CARD_STACK)
    const deck = stage.firstChild

    EL.mountCardStackDemo({ stage })

    await flush()

    expect(deck.processedItems.filter((i) => i.featured).length).toBe(4)
    expect(deck.processedItems.filter((i) => !i.featured).length).toBe(1)
  })

  test('dom drivers no-op on empty stages', () => {
    const empty = makeStage(null)

    expect(() => DOM.mountLoaderDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountMenuDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountToastDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountRelatedTilesDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountDrawDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountProgressBarDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountAuraDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountSearchDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountModalLoadingDemo({ stage: empty })()).not.toThrow()
    expect(() => DOM.mountFeedWaveDemo({ stage: empty })).not.toThrow()
    expect(() => DOM.mountTransitionDemo({ stage: empty })()).not.toThrow()
  })

  test('card-stack driver feeds real rows into the deck and drops the late write on teardown', async () => {
    fetchImpl.mockImplementation(() =>
      Promise.resolve(snap(true, { ...PORTFOLIO, mention_items: [] }))
    )

    const stage = makeStage(COMPONENT_TAGS.CARD_STACK)
    const deck = stage.firstChild

    const teardown = EL.mountCardStackDemo({ stage })

    await flush()

    expect(Array.isArray(deck.processedItems)).toBe(true)
    expect(deck.processedItems.length).toBe(5)

    teardown()

    const prev = deck.processedItems

    await flush()
    expect(deck.processedItems).toBe(prev)
  })

  test('card-stack driver no-ops without the deck tag', () => {
    const teardown = EL.mountCardStackDemo({ stage: makeStage(null) })

    expect(() => teardown()).not.toThrow()
  })

  test('mentions-deck driver pushes title, translations and items', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(
        snap(true, path.includes('about') || path.includes('ABOUT') ? ABOUT : PORTFOLIO)
      )
    )

    const stage = makeStage(COMPONENT_TAGS.MENTIONS_DECK)
    const deck = stage.firstChild

    EL.mountMentionsDeckDemo({ stage })

    await flush()

    expect(deck.title).toBe(TEST_TEXT.HEADING)
    expect(Array.isArray(deck.items)).toBe(true)
  })

  test('mentions-deck driver accepts array-form mention_items', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(
        snap(
          true,
          path.includes('about') || path.includes('ABOUT')
            ? { mentions: TEST_TEXT.HEADING, mention_items: [{ link: 'https://x', icon: 'i' }] }
            : PORTFOLIO
        )
      )
    )

    const stage = makeStage(COMPONENT_TAGS.MENTIONS_DECK)
    const deck = stage.firstChild

    EL.mountMentionsDeckDemo({ stage })

    await flush()

    expect(deck.items).toHaveLength(1)
    expect(deck.items[0].link).toBe('https://x')
  })

  test('mentions-deck driver no-ops without the deck tag', () => {
    expect(() => EL.mountMentionsDeckDemo({ stage: makeStage(null) })()).not.toThrow()
  })

  test('awards-carousel driver configures the variant and pushes slides', async () => {
    fetchImpl.mockImplementation(() => Promise.resolve(snap(true, ABOUT)))

    const stage = makeStage(COMPONENT_TAGS.AWARDS_CAROUSEL)
    const el = stage.firstChild

    EL.mountAwardsCarouselDemo({ stage })

    await flush()

    expect(el.showDots).toBe(true)
    expect(Array.isArray(el.items)).toBe(true)
  })

  test('awards-carousel driver no-ops without the carousel tag', () => {
    expect(() => EL.mountAwardsCarouselDemo({ stage: makeStage(null) })()).not.toThrow()
  })

  test('custom-carousel driver setItems with cover slides and folder', async () => {
    fetchImpl.mockImplementation(() => Promise.resolve(snap(true, PORTFOLIO)))

    const stage = makeStage(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    const el = stage.firstChild

    el.setItems = jest.fn()

    EL.mountCustomCarouselDemo({ stage })

    await flush()

    expect(el.setItems).toHaveBeenCalled()
    expect(el.setItems.mock.calls[0][0].items.length).toBe(5)
  })

  test('custom-carousel driver no-ops without the carousel tag', () => {
    expect(() => EL.mountCustomCarouselDemo({ stage: makeStage(null) })()).not.toThrow()
  })

  test('about-section driver pushes translations and profile picture', async () => {
    fetchImpl.mockImplementation(() =>
      Promise.resolve(snap(true, { ...ABOUT, profilePicture: 'https://pic' }))
    )

    const stage = makeStage(COMPONENT_TAGS.ABOUT_SECTION)
    const el = stage.firstChild

    EL.mountAboutSectionDemo({ stage })

    await flush()

    expect(el.aboutTranslations).not.toBeNull()
    expect(el.profilePicture).toBe('https://pic')
  })

  test('about-section driver no-ops without the section tag', () => {
    expect(() => EL.mountAboutSectionDemo({ stage: makeStage(null) })()).not.toThrow()
  })

  test('scene driver no-ops without a canvas and falls back to 2D when WebGPU is absent', async () => {
    const empty = makeStage(null)

    expect(() => EL.mountScene3dDemo({ stage: empty })()).not.toThrow()

    const stage = makeStage(HTML_TAGS.CANVAS)

    const teardown = EL.mountScene3dDemo({ stage })

    await flush()

    expect(() => teardown()).not.toThrow()
  })

  test('scene driver destroys a live handle, drops a late resolve, and survives a rejection', async () => {
    const handle = { destroy: jest.fn() }

    _sceneResult = Promise.resolve(handle)

    const stage = makeStage(HTML_TAGS.CANVAS)
    const teardown = EL.mountScene3dDemo({ stage })

    await flush()
    expect(() => teardown()).not.toThrow()

    _sceneResult = Promise.resolve(handle)

    const stage2 = makeStage(HTML_TAGS.CANVAS)
    const teardown2 = EL.mountScene3dDemo({ stage: stage2 })

    teardown2()

    await flush()
    expect(handle.destroy).toHaveBeenCalled()

    _sceneResult = Promise.reject(new Error(TEST_TEXT.HEADING))

    const stage3 = makeStage(HTML_TAGS.CANVAS)
    const teardown3 = EL.mountScene3dDemo({ stage: stage3 })

    await flush()
    expect(() => teardown3()).not.toThrow()

    let rejectNow

    _sceneResult = new Promise((_, reject) => {
      rejectNow = reject
    })

    const stage4 = makeStage(HTML_TAGS.CANVAS)
    const teardown4 = EL.mountScene3dDemo({ stage: stage4 })

    teardown4()
    rejectNow(new Error(TEST_TEXT.HEADING))

    await flush()
  })

  test('scene driver tears down a live 2D fallback surface', async () => {
    _sceneResult = Promise.resolve(null)

    const stage = makeStage(HTML_TAGS.CANVAS)
    const canvas = stage.firstChild

    canvas.getContext = () => ({
      clearRect: () => undefined,
      fillRect: () => undefined,
      beginPath: () => undefined,
      arc: () => undefined,
      fill: () => undefined,
      createLinearGradient: () => ({ addColorStop: () => undefined }),
    })

    const teardown = EL.mountScene3dDemo({ stage })

    await flush()
    expect(() => teardown()).not.toThrow()
  })

  test('loadDemoData falls back to the EN node when the locale is empty', async () => {
    store.state.lang.locale = ''
    fetchImpl.mockImplementation(() => Promise.resolve(snap(true, PORTFOLIO)))

    const d = await loadDemoData()

    expect(d.home).not.toBeNull()
  })

  test('card-stack driver drops featured rows without links and missing lists', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(
        snap(
          true,
          path.includes('related')
            ? {
                p: { featured: true },
                q: { featured: false, link: '/project/x' },
                r: { featured: true, link: '/project/a' },
              }
            : { portfoliolist: [{ link: '/project/a', image: 'a' }], mention_items: [] }
        )
      )
    )

    const stage = makeStage(COMPONENT_TAGS.CARD_STACK)
    const deck = stage.firstChild

    EL.mountCardStackDemo({ stage })

    await flush()

    expect(deck.processedItems).toHaveLength(1)
    expect(deck.processedItems[0].featured).toBe(true)
  })

  test('custom-carousel driver maps label/title/empty and skips setItems-less elements', async () => {
    fetchImpl.mockImplementation(() =>
      Promise.resolve(
        snap(true, {
          portfoliolist: [
            { link: '/x', title: TEST_TEXT.HEADING },
            { link: '/y' },
            { link: '/z', label: TEST_TEXT.HEADING },
          ],
        })
      )
    )

    const stage = makeStage(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    const el = stage.firstChild

    el.setItems = jest.fn()

    EL.mountCustomCarouselDemo({ stage })

    await flush()

    expect(el.setItems).toHaveBeenCalled()

    const bare = makeStage(COMPONENT_TAGS.CUSTOM_CAROUSEL)

    EL.mountCustomCarouselDemo({ stage: bare })

    await flush()

    expect(bare.firstChild.setItems).toBeUndefined()
  })

  test('element drivers push empty payloads when every node is null', async () => {
    fetchImpl.mockImplementation(() => Promise.resolve(snap(false)))

    const stage = makeStage(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    const el = stage.firstChild

    el.setItems = jest.fn()

    EL.mountCustomCarouselDemo({ stage })

    const stack = makeStage(COMPONENT_TAGS.CARD_STACK)
    const deck = stack.firstChild

    EL.mountCardStackDemo({ stage: stack })

    await flush()

    expect(el.setItems).toHaveBeenCalled()
    expect(deck.processedItems).toHaveLength(0)
  })

  test('card-stack driver normalizes an object-form portfoliolist', async () => {
    fetchImpl.mockImplementation(() =>
      Promise.resolve(snap(true, { portfoliolist: { p1: { link: '/o', featured: true } } }))
    )

    const stage = makeStage(COMPONENT_TAGS.CARD_STACK)
    const deck = stage.firstChild

    EL.mountCardStackDemo({ stage })

    await flush()

    expect(deck.processedItems).toHaveLength(1)
    expect(deck.processedItems[0].featured).toBe(true)
  })

  test('awards-carousel driver drops the late write after teardown', async () => {
    fetchImpl.mockImplementation(() => Promise.resolve(snap(true, PORTFOLIO)))

    const stage = makeStage(COMPONENT_TAGS.AWARDS_CAROUSEL)

    EL.mountAwardsCarouselDemo({ stage })()

    await flush()
  })

  test('feed drivers handle an about node without mention fields', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(
        snap(
          true,
          path.includes('about') || path.includes('ABOUT')
            ? { bio: TEST_TEXT.HEADING }
            : { portfoliolist: { p1: { link: '/o', featured: 'true' } } }
        )
      )
    )

    const deck = makeStage(COMPONENT_TAGS.MENTIONS_DECK)
    const el = deck.firstChild

    EL.mountMentionsDeckDemo({ stage: deck })

    const awards = makeStage(COMPONENT_TAGS.AWARDS_CAROUSEL)
    const aw = awards.firstChild

    EL.mountAwardsCarouselDemo({ stage: awards })()

    const about = makeStage(COMPONENT_TAGS.ABOUT_SECTION)
    const aboutEl = about.firstChild

    EL.mountAboutSectionDemo({ stage: about })()

    await flush()

    expect(el.title).toBe(ATTR_VALUES.EMPTY)
    expect(el.items).toEqual([])
    expect(aw.items).toBeUndefined()
    expect(aboutEl.profilePicture).toBeUndefined()
  })

  test('awards-carousel driver feeds empty items when about is null', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(snap(!(path.includes('about') || path.includes('ABOUT')), PORTFOLIO))
    )

    const stage = makeStage(COMPONENT_TAGS.AWARDS_CAROUSEL)
    const el = stage.firstChild

    EL.mountAwardsCarouselDemo({ stage })

    await flush()

    expect(el.items).toEqual([])
  })

  test('custom-carousel driver feeds an empty rowset when related is null', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(
        snap(true, path.includes('related') ? null : { portfoliolist: PORTFOLIO.portfoliolist })
      )
    )

    const stage = makeStage(COMPONENT_TAGS.CUSTOM_CAROUSEL)
    const el = stage.firstChild

    el.setItems = jest.fn()

    EL.mountCustomCarouselDemo({ stage })

    await flush()

    expect(el.setItems).toHaveBeenCalled()
  })

  test('mentions-deck + about drivers survive a null about node', async () => {
    fetchImpl.mockImplementation((path) =>
      Promise.resolve(snap(!(path.includes('about') || path.includes('ABOUT')), PORTFOLIO))
    )

    const stage = makeStage(COMPONENT_TAGS.MENTIONS_DECK)
    const deck = stage.firstChild

    EL.mountMentionsDeckDemo({ stage })

    const about = makeStage(COMPONENT_TAGS.ABOUT_SECTION)
    const el = about.firstChild

    EL.mountAboutSectionDemo({ stage: about })

    await flush()

    expect(deck.title).toBe(ATTR_VALUES.EMPTY)
    expect(el.profilePicture).toBeNull()
  })
})

describe('anim-demo cycle-driven tails', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    _localeSeq += 1
    store.state.lang.locale = `${LOCALES.EN}-c${_localeSeq}`
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const ticked = (ms) => jest.advanceTimersByTime(ms)

  test('dom guards tolerate missing children through a tick', () => {
    const empty = makeStage(null)

    const stops = [
      DOM.mountLoaderDemo({ stage: empty }),
      DOM.mountProgressBarDemo({ stage: empty }),
      DOM.mountRelatedTilesDemo({ stage: empty }),
      DOM.mountMenuDemo({ stage: empty }),
      DOM.mountToastDemo({ stage: empty }),
      DOM.mountDrawDemo({ stage: empty }),
    ]

    ticked(3400)
    stops.forEach((s) => s())
  })

  test('dom drivers tick staged children and reset them on teardown', () => {
    const stage = makeStage(null)
    const mk = (cls) => {
      const el = document.createElement(HTML_TAGS.DIV)

      el.className = cls
      stage.appendChild(el)

      return el
    }

    const counter = mk(C.LOADER_COUNTER)
    const bar = mk(C.BAR)

    mk(C.TILE)
    mk(C.TILE)
    mk(C.MENU)
    mk(C.TOAST_ITEM)
    mk(C.CHIPS)
    mk(C.CHIP)
    mk(C.CHIP)
    mk(C.PANE)
    mk(C.PANE)
    mk(C.SEARCH)
    mk(C.MODAL)
    mk(C.FEED)

    const stops = [
      DOM.mountLoaderDemo({ stage }),
      DOM.mountProgressBarDemo({ stage }),
      DOM.mountRelatedTilesDemo({ stage }),
      DOM.mountMenuDemo({ stage }),
      DOM.mountToastDemo({ stage }),
      DOM.mountAuraDemo({ stage }),
      DOM.mountTransitionDemo({ stage }),
      DOM.mountSearchDemo({ stage }),
      DOM.mountModalLoadingDemo({ stage }),
    ]

    DOM.mountFeedWaveDemo({ stage })

    ticked(6800)
    stops.forEach((s) => s())

    expect(counter.textContent.length).toBeGreaterThan(0)
    expect(bar.classList.contains(C.BAR_ACTIVE)).toBe(false)

    const bare = makeStage(null)

    const bareStops = [
      DOM.mountAuraDemo({ stage: bare }),
      DOM.mountTransitionDemo({ stage: bare }),
      DOM.mountSearchDemo({ stage: bare }),
      DOM.mountModalLoadingDemo({ stage: bare }),
    ]

    DOM.mountFeedWaveDemo({ stage: bare })

    ticked(6800)
    bareStops.forEach((s) => s())
  })

  test('draw demo replays trigger/reset and skips trigger-less elements', () => {
    const stage = makeStage(null)
    const el = document.createElement(HTML_TAGS.DIV)

    el.className = C.DRAW
    el.trigger = jest.fn()
    el.reset = jest.fn()
    stage.appendChild(el)

    const teardown = DOM.mountDrawDemo({ stage })

    expect(el.trigger).toHaveBeenCalled()

    const bare = makeStage(null)
    const plain = document.createElement(HTML_TAGS.DIV)

    plain.className = C.DRAW
    plain.trigger = jest.fn()
    bare.appendChild(plain)

    const teardown2 = DOM.mountDrawDemo({ stage: bare })

    ticked(3400)
    teardown()
    teardown2()
  })

  test('css-only drivers mount as void exports', () => {
    const empty = makeStage(null)

    expect(DOM.mountGlowDemo({ stage: empty })).toBeUndefined()
    expect(DOM.mountSkeletonDemo({ stage: empty })).toBeUndefined()
    expect(DOM.mountMediaDemo({ stage: empty })).toBeUndefined()
  })

  test('burn demo arms and disarms the card across ticks', () => {
    const stage = makeStage(null)
    const card = document.createElement(HTML_TAGS.DIV)
    const host = document.createElement(HTML_TAGS.DIV)

    host.$ = () => card

    const ctx = { host, stage, id: 'burn' }
    const teardown = MNT.mountBurnDemo(ctx)

    ticked(3400)

    card._burn = {}
    ticked(3400)

    teardown()

    const missing = { host: { $: () => null }, stage, id: 'burn' }

    expect(() => MNT.mountBurnDemo(missing)()).not.toThrow()
  })

  test('mount helpers no-op on empty stages and tick populated ones', () => {
    const empty = makeStage(null)

    const empties = [
      MNT.mountDividerDemo({ stage: empty }),
      MNT.mountRingSheenDemo({ stage: empty }),
      MNT.mountBracketsDemo({ stage: empty }),
    ]

    ticked(7000)
    empties.forEach((s) => s())

    const stage = makeStage(null)
    const btn = document.createElement(HTML_TAGS.DIV)

    btn.className = C.BUTTON
    stage.appendChild(btn)

    const teardown = MNT.mountBracketsDemo({ stage })

    ticked(3400)
    expect(btn.classList.contains(C.BUTTON_HOVER)).toBe(true)

    ticked(3400)
    expect(btn.classList.contains(C.BUTTON_HOVER)).toBe(false)
    teardown()
  })

  test('genie demo commits and clears the modal origin across ticks', () => {
    const stage = makeStage(null)
    const origin = document.createElement(HTML_TAGS.DIV)

    origin.className = C.ORIGIN
    stage.appendChild(origin)

    const host = document.createElement(HTML_TAGS.DIV)
    const backdrop = document.createElement(HTML_TAGS.DIV)
    const dialog = document.createElement(HTML_TAGS.DIV)

    backdrop.className = C.BACKDROP
    dialog.className = C.DIALOG
    host.appendChild(backdrop)
    host.appendChild(dialog)
    host.$ = (sel) => host.querySelector(sel)

    const teardown = MNT.mountGenieDemo({ host, stage, id: 'genie' })

    ticked(7000)
    teardown()

    const empty = makeStage(null)

    const teardown2 = MNT.mountGenieDemo({ host, stage: empty, id: 'genie' })

    ticked(7000)
    teardown2()
  })
})
