/**
 * @file media-figure-tails.test.js
 * @description Coverage tails for components/media/figure/modal.ts +
 * components/media/figure/mount.ts — openMediaModal's
 * `r && r.width > 0 ? origin : null` truthy arm (a laid-out figure yields a
 * real genie origin rect), mountMediaFigure's `if (openBtn)` else arm
 * (expandable figure without the open button skips bracket mounting), and
 * figureSeqSlug's root/label/match arms (the deep-link slug written into
 * the address bar must be the canonical mediaSlugSeq form).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { openMediaModal } from '@website/components/media/figure/modal.js'
import { restoreMediaModalTrigger } from '@website/components/media/modal-trigger.js'
import { mountMediaFigure } from '@website/components/media/figure/mount.js'
import store from '@core/store.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { TEST_PROJECTS, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { slugify } from '@core/utils/index.js'

describe('media figure modal + mount tails', () => {
  test('openMediaModal returns early when the figure cannot expand', () => {
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    openMediaModal({ canExpand: false })

    expect(store.getters.getModal()?.open).toBe(false)
  })

  test('openMediaModal captures the genie origin when the figure has a real rect', () => {
    const fig = {
      getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 50 }),
    }
    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      slugify: () => TEST_TEXT.HEADING,
      $: jest.fn((sel) => (sel === HTML_TAGS.FIGURE ? fig : null)),
    }

    openMediaModal(c)

    const modal = store.getters.getModal?.()

    // The origin arm must carry the figure's rect — null would make the
    // genie warp start from the viewport center instead of the thumbnail.
    if (modal && typeof modal === 'object') {
      expect(modal.origin).toEqual({ x: 10, y: 20, w: 100, h: 50 })
    }

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('mountMediaFigure without an open button skips bracket mounting', () => {
    const fig = document.createElement(HTML_TAGS.FIGURE)
    const c = {
      subscribe: jest.fn(),
      classes: '',
      canExpand: true,
      isVideo: false,
      $: jest.fn((sel) => (sel === HTML_TAGS.FIGURE ? fig : null)),
      addScopedListener: jest.fn(),
      openModal: jest.fn(),
      loadHighRes: jest.fn(),
      isLoaded: false,
      imgObserver: null,
    }

    mountMediaFigure(c)

    // The click binding still lands on the figure; only the brackets
    // mount is skipped (openBtn resolved null).
    expect(c.addScopedListener).toHaveBeenCalled()
    expect(c._expandBrackets).toBeUndefined()
  })

  test('modal close restores focus to the trigger figure open button', () => {
    const openBtn = { isConnected: true, focus: jest.fn() }

    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      slugify: () => TEST_TEXT.HEADING,
      $: jest.fn((sel) =>
        typeof sel === 'string' && sel.includes(EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_1)
          ? openBtn
          : null
      ),
    }

    openMediaModal(c)

    restoreMediaModalTrigger()

    expect(openBtn.focus).toHaveBeenCalled()

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('modal focus restore tolerates a missing expand button', () => {
    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      getRootNode: () => null,
      $: jest.fn(() => null),
    }

    openMediaModal(c)
    restoreMediaModalTrigger()

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('openMediaModal deep-links the canonical mediaSlugSeq slug', () => {
    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    const prior = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    prior.setAttribute(FORM_ATTRS.LABEL, TEST_TEXT.HEADING)

    const unlabelled = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    const c = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      getAttribute: (name) => (name === FORM_ATTRS.LABEL ? TEST_TEXT.HEADING : null),
      getRootNode: () => ({
        querySelectorAll: () => [prior, unlabelled, c],
      }),
      $: jest.fn(() => null),
    }

    openMediaModal(c)

    // The prior same-label figure consumes the first sequence slot, so
    // this figure's canonical slug gains the `-2` ordinal — matching the
    // build emit, sitemap, checkAutoOpenModal, and figureForUrl.
    expect(window.location.pathname).toBe(
      `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}${ROUTE_PATHS.ROOT}${slugify(TEST_TEXT.HEADING)}-2`
    )

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('figureSeqSlug returns empty when the root is not queryable or the figure is absent', () => {
    window.history.replaceState({}, '', `${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    const base = {
      canExpand: true,
      isVideo: false,
      mediaSrc: TEST_URLS.IMG,
      label: TEST_TEXT.HEADING,
      mediaWidth: 800,
      mediaHeight: 450,
      getAttribute: (name) => (name === FORM_ATTRS.LABEL ? TEST_TEXT.HEADING : null),
      $: jest.fn(() => null),
    }

    // getRootNode() → null root.
    openMediaModal({ ...base, getRootNode: () => null })

    // A non-ParentNode root (no querySelectorAll).
    openMediaModal({ ...base, getRootNode: () => ({}) })

    // The figure is absent from its own tree — no slot resolves.
    openMediaModal({
      ...base,
      getRootNode: () => ({
        querySelectorAll: () => [document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)],
      }),
    })

    // No resolvable slug → the address bar stays on the bare project path.
    expect(window.location.pathname).toBe(`${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`)

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })
})
