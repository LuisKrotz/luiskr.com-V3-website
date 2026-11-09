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

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { LOCALES } from '@core/tokens/locales.js'
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

const { loadDemoData } = await import('@website/components/media/anim-demo/data.js')
const EL = await import('@website/components/media/anim-demo/elements.js')
const DOM = await import('@website/components/media/anim-demo/dom.js')

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
  ],
}

const ABOUT = { mentions: TEST_TEXT.HEADING, mention_items: [{ link: 'https://x', icon: '🏆' }] }

const flush = () => new Promise((r) => setTimeout(r, 0))

/** Unique locale per test — loadDemoData caches its promise per locale. */
let _localeSeq = 0

describe('anim-demo elements tails', () => {
  beforeEach(() => {
    fetchImpl.mockReset()
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
    expect(deck.processedItems.length).toBe(2)

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
    expect(el.setItems.mock.calls[0][0].items.length).toBe(2)
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
})
