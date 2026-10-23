/**
 * @file hud-and-project-viewproject.test.js
 * @description Split from hud-and-project.test.js — covers the "ViewProject" describe.
 */
import store from '@core/store.js'
import router from '@core/router/router.js'
import '@website/components/feedback/StatsHud.js'
import '@website/views/project/Project.js'
import { TEST_PROJECTS, TEST_TEXT } from '@tests/fixtures/test-constants.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

// ─── ViewProject ─────────────────────────────────────────────────────────────
describe('ViewProject', () => {
  const makeView = () => {
    const el = document.createElement(VIEW_TAGS.VIEW_PROJECT)

    document.body.appendChild(el)

    return el
  }

  test('updateRobotsMeta toggles the robots meta tag', () => {
    const el = makeView()

    el.updateRobotsMeta(true)

    let meta = document.querySelector(QUERY_STRINGS.META_ROBOTS)

    expect(meta).toBeTruthy()

    el.updateRobotsMeta(false)

    el.remove()
  })

  test('initProject resolves the slug from the router or URL', () => {
    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    const el = makeView()

    el.initProject()

    expect(el.projectSlug).toBe(TEST_PROJECTS.CICB)

    el.remove()
  })

  test('loadData is a no-op without a slug', () => {
    window.history.replaceState({}, '', ROUTE_PATHS.ABOUT)

    const el = makeView()

    el.projectSlug = CHAR_STRINGS.EMPTY
    el.loadData()

    el.remove()
  })

  test('textDelay/textOffset compute stagger timings', () => {
    const el = makeView()

    const items = [{}, {}, {}]

    expect(typeof el.textDelay?.(items)).toBe(TYPE_STRINGS.NUMBER)
    expect(typeof el.textOffset?.(items, 1)).toBe(TYPE_STRINGS.NUMBER)

    el.remove()
  })

  test('isLandscapeGroup detects landscape-oriented groups', () => {
    const el = makeView()

    expect(typeof el.isLandscapeGroup?.([{ size: [1600, 900] }])).toBe(TYPE_STRINGS.BOOLEAN)

    el.remove()
  })

  test('sectionItemHeight derives a per-section height', () => {
    const el = makeView()

    expect(el.sectionItemHeight?.([[{ size: [800, 450] }]])).toContain('calc')

    el.remove()
  })

  test('checkAutoOpenModal opens the project modal for flagged items', () => {
    const el = makeView()

    el.checkAutoOpenModal?.()

    el.remove()
  })

  test('render returns a project detail template', () => {
    const el = makeView()

    el.translations = {
      title: TEST_TEXT.HEADING,
      description: TEST_TEXT.BODY,
    }

    const node = el.render?.()

    expect(node !== null && node !== undefined).toBe(true)

    el.remove()
  })

  test('modal getter proxies the store modal descriptor', () => {
    const el = makeView()

    expect(el.modal).toBe(store.getters.getModal())

    el.remove()
  })

  test('onRouteParamChange reloads when the slug differs', () => {
    const el = makeView()

    el.projectSlug = TEST_PROJECTS.CICB
    el.translations = { title: TEST_TEXT.HEADING }

    el.onRouteParamChange({ params: { projectSlug: TEST_PROJECTS.CICB } })

    expect(el.translations.title).toBe(TEST_TEXT.HEADING)

    el.onRouteParamChange({ params: { projectSlug: TEST_PROJECTS.SAGE } })

    expect(el.projectSlug).toBe(TEST_PROJECTS.SAGE)
    expect(el.translations).toBeNull()

    el.onRouteParamChange(null)

    el.remove()
  })

  test('onStoreUpdate reloads on locale change, syncs modal otherwise', () => {
    const el = makeView()

    el.projectSlug = TEST_PROJECTS.CICB
    el._lastLocale = 'xx-never'
    el.onStoreUpdate()

    expect(el._lastLocale).toBe(store.getters.getLang())

    const calls = []

    el._updateModalDOM = () => calls.push(1)
    el._lastLocale = store.getters.getLang()
    el.onStoreUpdate()

    expect(calls.length).toBe(1)

    el.remove()
  })

  test('sectionItemHeight falls back to skeleton without media size', () => {
    const el = makeView()

    expect(el.sectionItemHeight?.([[TEST_TEXT.BODY]])).not.toContain('calc')
    expect(el.sectionItemHeight?.([[]])).not.toContain('calc')
    expect(el.sectionItemHeight?.([[{ size: [0, 0] }]])).not.toContain('calc')

    el.remove()
  })

  test('checkAutoOpenModal commits the modal for a matching media slug', () => {
    const el = makeView()

    // Early returns: no slug, then no translations.
    router.currentRoute = { params: {} }
    el.checkAutoOpenModal()

    el.translations = null
    router.currentRoute = { params: { slug: 'sample-heading' } }
    el.checkAutoOpenModal()

    el.translations = {
      folder: TEST_PROJECTS.CICB,
      sections: [
        [[TEST_TEXT.SECOND]],
        [[{ label: TEST_TEXT.HEADING, src: TEST_TEXT.SECOND, isVideo: false, size: [800, 450] }]],
      ],
    }

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    const prevRoute = router.currentRoute

    router.currentRoute = { params: { slug: 'sample-heading' } }
    el.checkAutoOpenModal()

    expect(store.getters.getModal()?.open).toBe(true)

    router.currentRoute = { params: { slug: 'no-match-here' } }
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
    el.checkAutoOpenModal()

    expect(store.getters.getModal()?.open).toBe(false)

    // Video item takes the isVideo source/thumb branch.
    router.currentRoute = { params: { slug: 'sample-heading' } }

    el.translations = {
      folder: TEST_PROJECTS.CICB,
      sections: [
        [[{ label: TEST_TEXT.HEADING, src: TEST_TEXT.SECOND, isVideo: true, size: [800, 450] }]],
      ],
    }

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
    el.checkAutoOpenModal()

    expect(store.getters.getModal()?.media?.isVideo).toBe(true)

    router.currentRoute = { params: {} }
    el.checkAutoOpenModal()

    router.currentRoute = prevRoute

    el.remove()
  })

  test('checkAutoOpenModal resolves capped canonical + legacy raw media slugs', () => {
    const el = makeView()

    const longLabel =
      'Vibra – a empresa mais inovadora do segmento no Brasil | Production and Distribution Business | Full page'

    const cappedSlug = 'vibra-a-empresa-mais-inovadora-do-segmento-no-brasil-production-and'

    const legacySlug =
      'vibra-a-empresa-mais-inovadora-do-segmento-no-brasil-production-and-distribution-business-full-page'

    el.translations = {
      folder: 'vibra',
      sections: [
        [[{ label: longLabel, src: TEST_TEXT.SECOND, isVideo: false, size: [800, 450] }]],
        [[{ src: TEST_TEXT.SECOND, size: [800, 450] }]],
        [[{ label: TEST_TEXT.BODY, src: '', size: [800, 450] }]],
      ],
    }

    const prevRoute = router.currentRoute

    // The build/sitemap emit the MEDIA_SLUG_MAX_LENGTH-capped slug — a
    // deep link with it must auto-open the modal.
    router.currentRoute = { params: { slug: cappedSlug } }
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
    el.checkAutoOpenModal()

    expect(store.getters.getModal()?.open).toBe(true)
    expect(store.getters.getModal()?.media?.alt).toBe(longLabel)

    // Older modal opens wrote the raw uncapped slugify — shared links
    // still resolve through the legacy pass, and the address bar
    // canonicalizes to the emitted slug.
    window.history.replaceState({}, '', `/portfolio/vibra/${legacySlug}`)

    router.currentRoute = { params: { slug: legacySlug } }
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
    el.checkAutoOpenModal()

    expect(store.getters.getModal()?.open).toBe(true)
    expect(store.getters.getModal()?.media?.alt).toBe(longLabel)
    expect(window.location.pathname).toBe(`/portfolio/vibra/${cappedSlug}`)

    // Ordinals disambiguate duplicate labels in document order — the
    // second item's `-2` slug opens the second item, not the first.
    el.translations = {
      folder: 'vibra',
      sections: [
        [[{ label: TEST_TEXT.HEADING, src: 'first-dup', isVideo: false, size: [800, 450] }]],
        [[{ label: TEST_TEXT.HEADING, src: 'second-dup', isVideo: false, size: [800, 450] }]],
      ],
    }

    router.currentRoute = { params: { slug: 'sample-heading-2' } }
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
    el.checkAutoOpenModal()

    expect(store.getters.getModal()?.open).toBe(true)
    expect(store.getters.getModal()?.media?.source).toContain('second-dup')

    router.currentRoute = prevRoute

    el.remove()
  })

  test('loadData walks the URL fallback then resolves via SWR', async () => {
    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    const el = makeView()

    el.projectSlug = CHAR_STRINGS.EMPTY
    el.loadData()

    await Promise.resolve()
    await Promise.resolve()

    el.loadData(true)

    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 30))

    el.remove()
  })
})
