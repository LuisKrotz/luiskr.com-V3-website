/**
 * @file views-viewsitemap.test.js
 * @description <view-sitemap> coverage — the SWR fetches (sitemap page
 * node, playground page nodes, all-locale projects maps, share
 * manifests), the collapsed-by-default media walls + chevron toggle,
 * packed card output (title-first order, figure vs plain-img media,
 * locale chips), SPA link routing, repack-on-resize lifecycle and the
 * fetch-failure fallback paths.
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { EARTH_SHARE, STAR_SHARE } from '@core/tokens/playground/share.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { LOCALES } from '@core/tokens/locales.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { SITEMAP_CLASSES } from '@core/tokens/classes/sitemap.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { LABEL_TEXT } from '@core/tokens/strings/text.js'
import { LANG_OPTIONS } from '@core/i18n.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { mount } from '@tests/fixtures/test-constants.js'

// ─── Controllable backend replies ───────────────────────────────────────────
/** Error the db mock throws — set to exercise the rejection arm. */
let dbThrow = null
/** Path→payload fn the db mock consults — tests reassign per fixture set. */
let dbReplies = () => undefined
/** Flag — the fetch mock throws when true (CDN-fail arm). */
let fetchThrow = false
/** URL→body map the fetch mock serves — CDN manifest replies. */
let fetchReplies = {}

jest.unstable_mockModule('@core/utils/data/db.js', () => ({
  fetchFirebaseDb: async (path) => {
    if (dbThrow) throw dbThrow

    const val = dbReplies(path)

    // 'nullsnap' — the SWR promise resolving a null snapshot (the
    // snapshot?.exists() short-circuit arm).
    if (val === 'nullsnap') return null

    // null — an existing node whose val() is null (the `|| {}` arm).
    return { exists: () => val !== undefined, val: () => val }
  },
}))

let ViewSitemap

beforeAll(async () => {
  const mod = await import('@website/views/sitemap/Sitemap.js')

  ViewSitemap = mod.ViewSitemap
})

/** Timer flush — drains the view's SWR/db queues between actions. */
const flush = () => new Promise((r) => setTimeout(r, 20))

/** Real fetch saved before mocks install — restored in afterAll. */
const realFetch = globalThis.fetch

/** Project fixture — nested section media rows the sitemap renders. */
const PROJECT = {
  title: 'Sage',
  folder: 'sage/',
  cover: { src: 'cover-main', label: 'Sage cover', size: [1600, 900], isVideo: true },
  sections: [
    [
      ['a text row — skipped'],
      [
        { src: 'media/one', label: 'Overview', size: [3840, 2160], canExpand: true },
        { src: 'media/tall', label: 'Full page', size: [1920, 5654] },
        { src: 'media/plain', label: 'No size' },
      ],
    ],
  ],
}

/** Page-level RTDB fixtures — title/intro + per-experiment shareCapture copy. */
const SITEMAP_PAGE = { title: 'Index', intro: 'Every link.' }
const EARTH_PAGE = { shareCapture: 'Earth render' }
const STAR_PAGE = { shareCapture: 'Star render' }
/** CDN manifest fixture — the sitemap lists these as share links. */
const EARTH_MANIFEST = {
  images: [`${CDN_URLS.CDN_BASE}experiments/earth-playground/share/e1.png`],
  videos: [`${CDN_URLS.CDN_BASE}experiments/earth-playground/share/clip.mp4`],
}

/** Routes the sitemap view's fetch surface to the test fixtures. */
const fullReplies = (path) => {
  if (path.endsWith(`${DB_PATHS.PAGES}${TRANSLATION_KEYS.SITEMAP}`)) return SITEMAP_PAGE
  if (path.endsWith(`${DB_PATHS.PAGES}${TRANSLATION_KEYS.EARTH_PLAYGROUND}`)) return EARTH_PAGE
  if (path.endsWith(`${DB_PATHS.PAGES}${TRANSLATION_KEYS.STAR_FIELD}`)) return STAR_PAGE

  if (path.endsWith(DB_PATHS.PROJECTS)) {
    return path.includes(`/${LOCALES.EN}`) ? { sage: PROJECT } : undefined
  }

  return undefined
}

/** Shadow-DOM query shorthands — assertions run inside the view's shadow root. */
const q = (el, sel) => el.shadowRoot.querySelector(sel)
const qa = (el, sel) => el.shadowRoot.querySelectorAll(sel)

describe('ViewSitemap', () => {
  let el
  let cleanup

  beforeEach(() => {
    dbThrow = null
    dbReplies = () => undefined
    fetchThrow = false
    fetchReplies = {}

    globalThis.fetch = async (url) => {
      if (fetchThrow) throw new Error('net')

      const data = fetchReplies[url]

      return { ok: data !== undefined, json: async () => data }
    }
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    if (cleanup) cleanup()
    cleanup = null
    el = null
  })

  const spawn = async () => {
    el = new ViewSitemap()
    cleanup = mount(el)
    await flush()
  }

  test('renders the page chrome + non-media groups before any data lands', async () => {
    await spawn()

    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_TITLE}`)).not.toBeNull()
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_INDEX}`)).not.toBeNull()
    expect(q(el, COMPONENT_TAGS.LEGAL_FOOTER)).not.toBeNull()

    // No projects fetched → no media groups → no toggles, no walls.
    expect(qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`).length).toBe(0)
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_WALL}`)).toBeNull()

    // Stacked groups still render page links + locale chips.
    expect(qa(el, `.${SITEMAP_CLASSES.SITEMAP_PAGE_LINK}`).length).toBeGreaterThan(0)
    expect(qa(el, `.${SITEMAP_CLASSES.SITEMAP_LOCALE}`).length).toBeGreaterThan(0)
  })

  test('the locale legend decodes every chip abbreviation', async () => {
    await spawn()

    const legend = q(el, `.${SITEMAP_CLASSES.SITEMAP_LANGS}`)
    expect(legend).not.toBeNull()
    expect(legend.tagName).toBe('FIELDSET')

    // The <legend> caption names the decoder block.
    expect(legend.querySelector('legend').textContent).toBe(LABEL_TEXT.LEGEND)

    const rows = legend.querySelectorAll(`.${SITEMAP_CLASSES.SITEMAP_LANG}`)
    // One legend row per registered locale, in LANG_OPTIONS order —
    // each "CODE — Name".
    expect(rows.length).toBe(LANG_OPTIONS.length)

    for (let i = 0; i < LANG_OPTIONS.length; i++) {
      const row = rows[i]
      expect(row.querySelector(`.${SITEMAP_CLASSES.SITEMAP_LANG_CODE}`).textContent).toBe(
        LANG_OPTIONS[i].code.toUpperCase()
      )
      expect(row.querySelector(`.${SITEMAP_CLASSES.SITEMAP_LANG_NAME}`).textContent).toBe(
        LANG_OPTIONS[i].label
      )
      expect(row.textContent).toContain(CHAR_STRINGS.EM_DASH)
    }
  })

  test('hydrates page title/intro and both collapsed media groups', async () => {
    dbReplies = fullReplies
    fetchReplies = { [EARTH_SHARE.MANIFEST_URL]: EARTH_MANIFEST }
    await spawn()

    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_TITLE}`).textContent).toBe(SITEMAP_PAGE.title)
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_INTRO}`).textContent).toBe(SITEMAP_PAGE.intro)

    const mosaicGroups = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_MOSAIC}`)
    // media + playgroundMedia — both present, both collapsed.
    expect(mosaicGroups.length).toBe(2)

    // The portfolio group spans the full index grid (wide modifier) —
    // exactly one wide section, carrying the project's page row.
    const wideGroups = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_WIDE}`)
    expect(wideGroups.length).toBe(1)
    expect(wideGroups[0].querySelector(`.${SITEMAP_CLASSES.SITEMAP_PAGE_LINK}`)).not.toBeNull()

    const toggles = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)
    expect(toggles.length).toBe(2)
    for (const t of toggles) {
      expect(t.getAttribute(ARIA_ATTRS.ARIA_EXPANDED)).toBe(ATTR_VALUES.FALSE)
      // Chevron is an inline SVG icon at the row's right edge — a
      // stroked path, not a text glyph.
      const chevron = t.querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON}`)
      expect(chevron).not.toBeNull()
      expect(chevron.tagName.toLowerCase()).toBe('svg')
      expect(chevron.querySelector('path')).not.toBeNull()
      expect(chevron.getAttribute('aria-hidden')).toBe(ATTR_VALUES.TRUE)
    }
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_WALL}`)).toBeNull()
  })

  test('opening the media group mounts the packed wall of figure cards', async () => {
    dbReplies = fullReplies
    await spawn()

    // First mosaic group = the media wall (precedes playgroundMedia).
    const mediaSection = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_MOSAIC}`)[0]
    const toggle = mediaSection.querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)

    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    // _updateDom re-renders the nav — re-query (the old nodes detached).
    const fresh = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_MOSAIC}`)[0]
    expect(
      fresh
        .querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)
        .getAttribute(ARIA_ATTRS.ARIA_EXPANDED)
    ).toBe(ATTR_VALUES.TRUE)

    // The toggled group's newborn chevron stamps the one-shot
    // spin-open class (fresh nodes can't transition — the keyframe
    // replays the rotation as a mount animation).
    const chevron = fresh.querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON}`)
    expect(chevron.classList.contains(SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON_SPIN_OPEN)).toBe(true)
    expect(chevron.classList.contains(SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON_SPIN_CLOSE)).toBe(false)

    const wall = fresh.querySelector(`.${SITEMAP_CLASSES.SITEMAP_WALL}`)
    expect(wall).not.toBeNull()
    expect(wall.style.height.endsWith('px')).toBe(true)

    const cards = wall.querySelectorAll(`.${SITEMAP_CLASSES.SITEMAP_CARD}`)
    // cover + 3 section items = 4 cards.
    expect(cards.length).toBe(4)

    const figure = cards[0].querySelector(COMPONENT_TAGS.MEDIA_FIGURE)
    expect(figure).not.toBeNull()
    // Cover is the video row → is-video + auto-play for viewport playback.
    expect(figure.getAttribute('is-video')).toBe(ATTR_VALUES.TRUE)
    expect(figure.getAttribute('auto-play')).toBe(ATTR_VALUES.TRUE)

    // The sizeless item falls back to the generic media box dims.
    const sizeless = cards[3].querySelector(COMPONENT_TAGS.MEDIA_FIGURE)
    expect(sizeless.getAttribute('width')).toBe(String(GENERIC_DIMENSIONS.DEFAULT_WIDTH))
    expect(sizeless.getAttribute('height')).toBe(String(GENERIC_DIMENSIONS.DEFAULT_HEIGHT))

    // Toggling again unmounts the wall — the re-rendered chevron now
    // carries the spin-close class (direction flipped) instead.
    fresh
      .querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const reclosed = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_MOSAIC}`)[0]

    expect(reclosed.querySelector(`.${SITEMAP_CLASSES.SITEMAP_WALL}`)).toBeNull()
    expect(
      reclosed
        .querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON}`)
        .classList.contains(SITEMAP_CLASSES.SITEMAP_GROUP_CHEVRON_SPIN_CLOSE)
    ).toBe(true)
  })

  test('card DOM order — title link before media, chips last', async () => {
    dbReplies = fullReplies
    await spawn()

    const toggle = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)[0]
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const card = q(el, `.${SITEMAP_CLASSES.SITEMAP_CARD}`)
    const title = card.querySelector(`.${SITEMAP_CLASSES.SITEMAP_CARD_TITLE}`)
    const figure = card.querySelector(COMPONENT_TAGS.MEDIA_FIGURE)
    const locales = card.querySelector(`.${SITEMAP_CLASSES.SITEMAP_CARD_LOCALES}`)

    expect(title).not.toBeNull()
    expect(title.tagName).toBe('A')
    expect(title.getAttribute('href').startsWith('/')).toBe(true)
    // DOM order: title → figure → chips (the visual caption order).
    expect(title.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(figure.compareDocumentPosition(locales) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Locale chips deep-link; hreflang + tip ride through when present.
    const chips = locales.querySelectorAll(`.${SITEMAP_CLASSES.SITEMAP_LOCALE}`)
    expect(chips.length).toBeGreaterThan(1)
    expect(chips[0].getAttribute('hreflang')).not.toBeNull()
  })

  test('playground-media wall — img kind for captures, figure stem for clips', async () => {
    fetchReplies = {
      [EARTH_SHARE.MANIFEST_URL]: EARTH_MANIFEST,
      [STAR_SHARE.MANIFEST_URL]: {
        images: [`${CDN_URLS.CDN_BASE}experiments/star-field/share/s1.png`],
      },
    }
    dbReplies = fullReplies
    await spawn()

    // Last toggle = the playgroundMedia group (media precedes it).
    const toggles = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)
    const pgToggle = toggles[toggles.length - 1]

    pgToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    // Re-query — _updateDom detached the pre-click nodes.
    const pgGroup = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_MOSAIC}`)[1]
    const pgWall = pgGroup.querySelector(`.${SITEMAP_CLASSES.SITEMAP_WALL}`)
    expect(pgWall).not.toBeNull()
    const cards = pgWall.querySelectorAll(`.${SITEMAP_CLASSES.SITEMAP_CARD}`)

    // 1 earth image + 1 earth video + 1 star image = 3 cards.
    expect(cards.length).toBe(3)

    // Image capture — plain <img> at the absolute URL, no ladder.
    const imgCard = cards[0].querySelector(`.${SITEMAP_CLASSES.SITEMAP_CARD_IMG}`)
    expect(imgCard).not.toBeNull()
    expect(imgCard.getAttribute('src')).toBe(EARTH_MANIFEST.images[0])
    expect(cards[0].querySelector(COMPONENT_TAGS.MEDIA_FIGURE)).toBeNull()

    // Video capture — media-figure on the stripped CDN stem.
    const clipFigure = [...cards]
      .map((c) => c.querySelector(COMPONENT_TAGS.MEDIA_FIGURE))
      .find(Boolean)
    expect(clipFigure).not.toBeNull()
    expect(clipFigure.getAttribute('src')).toBe('experiments/earth-playground/share/clip')
    expect(clipFigure.getAttribute('is-video')).toBe(ATTR_VALUES.TRUE)

    // Capture labels come from the playground page node.
    expect(cards[0].querySelector(`.${SITEMAP_CLASSES.SITEMAP_CARD_TITLE}`).textContent).toContain(
      EARTH_PAGE.shareCapture
    )
  })

  test('linkClick SPA-routes plain clicks and ignores the rest', async () => {
    dbReplies = fullReplies
    await spawn()

    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => {})
    const nav = q(el, `.${SITEMAP_CLASSES.SITEMAP_INDEX}`)
    const anchor = nav.querySelector(`.${SITEMAP_CLASSES.SITEMAP_PAGE_LINK}`)

    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(pushSpy).toHaveBeenCalledWith(anchor.getAttribute('href'))

    // Modified click → browser default.
    pushSpy.mockClear()
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, metaKey: true }))
    expect(pushSpy).not.toHaveBeenCalled()

    // Non-anchor target → early return.
    nav
      .querySelector(`.${SITEMAP_CLASSES.SITEMAP_GROUP}`)
      .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(pushSpy).not.toHaveBeenCalled()

    // External href → early return.
    const ext = document.createElement('a')
    ext.setAttribute('href', CDN_URLS.CDN_BASE)
    nav.appendChild(ext)
    ext.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(pushSpy).not.toHaveBeenCalled()
    nav.removeChild(ext)

    // Anchor without href → !href arm.
    const bare = document.createElement('a')
    nav.appendChild(bare)
    bare.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(pushSpy).not.toHaveBeenCalled()
    nav.removeChild(bare)

    pushSpy.mockRestore()
  })

  test('_packGroup memoizes, caps tall sources and caches null packs', async () => {
    await spawn()

    const group = {
      key: 'media',
      children: [
        { media: { src: 'a', size: [1920, 5654] }, label: 'tall', href: '/x', children: [] },
        { media: { src: 'b' }, label: 'no-size', href: '/y', children: [] },
        { media: { src: 'c', size: [800] }, label: 'w-only', href: '/z', children: [] },
        { media: { src: 'd', size: [1600, 900] }, label: 'fit', href: '/f', children: [] },
        { media: { src: 'w', size: [6852, 2475] }, label: 'wide', href: '/w', children: [] },
        { label: 'no-media', href: '/n', children: [] },
      ],
    }

    const packed = el._packGroup(group)

    // Tall source: treated as 2560 high → 853px tile at the ÷3 rung,
    // not the ~1884px sliver the real aspect would pack.
    expect(packed.tiles[0].tile.height).toBe('853px')

    // Ultrawide source: treated as 2560 wide → a 640×619 card at the
    // ÷4 rung, not the full-800px banner strip the real width packs.
    expect(packed.tiles[4].tile.width).toBe('640px')
    expect(packed.tiles[4].tile.height).toBe('619px')

    // Cache hit — identical call returns the memoized object.
    expect(el._packGroup(group)).toBe(packed)

    // Empty children → null pack, and the null is memoized too.
    const empty = { key: 'empty', children: [] }
    expect(el._packGroup(empty)).toBeNull()
    expect(el._packGroup(empty)).toBeNull()

    // Measured wall width feeds the pack instead of the default.
    el._wallW = 1200
    const wide = el._packGroup(group)
    expect(wide).not.toBe(packed)
  })

  test('_measureWall repacks on real width change only', async () => {
    dbReplies = fullReplies
    await spawn()

    const nav = q(el, `.${SITEMAP_CLASSES.SITEMAP_INDEX}`)

    Object.defineProperty(nav, 'clientWidth', { value: 1200, configurable: true })
    el._measureWall()
    expect(el._wallW).toBe(1200)

    // Below the epsilon — no repack.
    const cacheSize = el._packedCache.size
    el._measureWall()
    expect(el._packedCache.size).toBe(cacheSize)

    // Open a group, then a real width change repacks + re-renders —
    // the wall's fresh pack lands keyed at the new width.
    el._openGroups.add('media')
    Object.defineProperty(nav, 'clientWidth', { value: 900, configurable: true })
    el._measureWall()
    expect(el._wallW).toBe(900)
    expect([...el._packedCache.keys()].every((k) => k.includes('900'))).toBe(true)

    // Unmeasured host — zero width is ignored.
    const orphan = new ViewSitemap()
    orphan._measureWall()
    expect(orphan._wallW).toBe(0)
  })

  test('_mediaCard emits the no-media + tip arms', async () => {
    await spawn()

    const card = el._mediaCard(
      {
        label: 'Loose',
        href: '/x',
        children: [
          { label: 'BR', href: '/br/x', locale: 'br', tip: 'tooltip' },
          { label: 'EN', href: '/en/x', locale: 'en' },
        ],
      },
      {}
    )

    // No media → neither figure nor img mounts; the title is a link.
    expect(card.querySelector(`a.${SITEMAP_CLASSES.SITEMAP_CARD_TITLE}`)).not.toBeNull()
    expect(card.querySelector(COMPONENT_TAGS.MEDIA_FIGURE)).toBeNull()
    expect(card.querySelector(`.${SITEMAP_CLASSES.SITEMAP_CARD_IMG}`)).toBeNull()

    const chips = card.querySelectorAll(`.${SITEMAP_CLASSES.SITEMAP_LOCALE}`)
    expect(chips[0].getAttribute('hreflang')).toBe('br')
    expect(chips[0].getAttribute('title')).toBe('tooltip')
    expect(chips[1].getAttribute('hreflang')).toBe('en')
    expect(chips[1].getAttribute('title')).toBeNull()
  })

  test('locale switch refetches; same locale is a no-op', async () => {
    dbReplies = fullReplies
    await spawn()

    // Same locale → early return (no refetch).
    el._lastLocale = 'en'
    el.onStoreUpdate()
    expect(el._lastLocale).toBe('en')

    // Different locale → _ensureData runs again (both getters: the
    // locale code for the diff check, the lang object for the refetch).
    const codeSpy = jest.spyOn(store.getters, 'getLang').mockReturnValue('br')
    const langSpy = jest.spyOn(store.getters, 'getlang').mockReturnValue({ locale: 'br' })
    el.onStoreUpdate()
    codeSpy.mockRestore()
    langSpy.mockRestore()
    await flush()

    expect(el._lastLocale).toBe('br')
  })

  test('fetch failures fall through to devError + fallback chrome', async () => {
    dbThrow = new Error('db')
    fetchThrow = true
    await spawn()

    // Nothing crashed; the fallback page node still renders.
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_INDEX}`)).not.toBeNull()
    expect(el._page).toBeNull()
    expect(el._shareManifests.earth).toBeUndefined()
  })

  test('ResizeObserver wiring — observes on mount, disconnects on destroy', async () => {
    const observed = []
    const disconnect = jest.fn()

    class RO {
      constructor(cb) {
        this.cb = cb
      }
      observe(elm) {
        observed.push(elm)
      }
      disconnect() {
        disconnect()
      }
    }

    const real = globalThis.ResizeObserver
    globalThis.ResizeObserver = RO

    el = new ViewSitemap()
    cleanup = mount(el)

    expect(observed).toContain(el)
    expect(el._ro).not.toBeNull()

    // The RO callback routes into _measureWall.
    el._ro.cb()
    expect(el._wallW).toBe(0)

    el.onDestroy()
    expect(disconnect).toHaveBeenCalled()
    expect(el._ro).toBeNull()

    globalThis.ResizeObserver = real
    await flush()
  })

  test('missing share manifests leave the playground-media group out', async () => {
    dbReplies = fullReplies
    await spawn()

    // Manifest fetches all !ok → data null → group filtered out.
    expect(el._shareManifests.earth).toBeUndefined()

    const toggles = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)
    expect(toggles.length).toBe(1)
  })

  test('null snapshots + null vals ride the fallback arms', async () => {
    dbReplies = (path) => {
      if (path.endsWith(`${DB_PATHS.PAGES}${TRANSLATION_KEYS.SITEMAP}`)) return 'nullsnap'
      if (path.endsWith(DB_PATHS.PROJECTS)) return null // exists but null val
      return undefined
    }
    await spawn()

    // Null sitemap snapshot → _page stays null; null project vals → {}.
    expect(el._page).toBeNull()
    expect(el._projects[LOCALES.EN]).toEqual({})
  })

  test('missing lang object + falsy locale code ride the default arms', async () => {
    const langSpy = jest.spyOn(store.getters, 'getlang').mockReturnValue(undefined)
    const codeSpy = jest.spyOn(store.getters, 'getLang').mockReturnValue('')
    try {
      await spawn()

      // Same resolved locale (''||EN → 'en') → the store-update guard
      // short-circuits without a refetch.
      el.onStoreUpdate()
      expect(el._lastLocale).toBe('en')
    } finally {
      langSpy.mockRestore()
      codeSpy.mockRestore()
    }

    // No lang object → EN defaults everywhere.
    expect(el._lastLocale).toBe('en')
  })

  test('manifest without its playground page rides the label-less share arm', async () => {
    fetchReplies = { [EARTH_SHARE.MANIFEST_URL]: EARTH_MANIFEST }
    dbReplies = (path) =>
      path.endsWith(`${DB_PATHS.PAGES}${TRANSLATION_KEYS.STAR_FIELD}`) ? STAR_PAGE : undefined
    await spawn()

    // playPages.earth missing → shareCapture undefined → title-fallback label.
    expect(el._shares().earth.label).toBeUndefined()
  })

  test('a cached null pack renders the empty-wall arm', async () => {
    dbReplies = fullReplies
    await spawn()

    // Poison the pack cache for the media group (key = key|wallW|count).
    el._packedCache.set(`media|0|4`, null)

    const toggle = qa(el, `.${SITEMAP_CLASSES.SITEMAP_GROUP_TOGGLE}`)[0]
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    const wall = q(el, `.${SITEMAP_CLASSES.SITEMAP_WALL}`)
    expect(wall).not.toBeNull()
    expect(wall.style.height).toBe('0px')
    expect(wall.querySelectorAll(`.${SITEMAP_CLASSES.SITEMAP_CARD}`).length).toBe(0)
  })

  test('onDestroy with no observer rides the optional-chain arm', async () => {
    const orphan = new ViewSitemap()
    orphan.onDestroy()
    expect(orphan._ro).toBeNull()

    // _lastLocale still null → the store-update guard short-circuits.
    orphan.onStoreUpdate()
    expect(orphan._lastLocale).toBeNull()

    await spawn()
  })

  test('bundled fallback page node paints when no fetch lands', async () => {
    const fallback = { title: 'Bundled map', intro: 'Snapshot intro.' }

    FALLBACK_PAGES[TRANSLATION_KEYS.SITEMAP] = fallback

    try {
      await spawn()
    } finally {
      delete FALLBACK_PAGES[TRANSLATION_KEYS.SITEMAP]
    }

    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_TITLE}`).textContent).toBe(fallback.title)
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_INTRO}`).textContent).toBe(fallback.intro)
  })

  test('a deliberate empty APP string rides the String(appText||EMPTY) arm', async () => {
    const prev = store.state.lang.app
    store.state.lang.app = { [SECTION_UI_KEYS.SITEMAP]: '' }

    try {
      await spawn()
    } finally {
      store.state.lang.app = prev
    }

    // appText('sitemap') resolved '' → the EMPTY arm — title/aria-label
    // are empty but the chrome still renders.
    expect(q(el, `.${SITEMAP_CLASSES.SITEMAP_TITLE}`)).not.toBeNull()
  })

  test('module re-eval sees the tag already registered', async () => {
    expect(customElements.get(VIEW_TAGS.VIEW_SITEMAP)).toBeTruthy()
    jest.resetModules()
    await import('@website/views/sitemap/Sitemap.js')
  })
})
