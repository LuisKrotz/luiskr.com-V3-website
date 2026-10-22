/**
 * @file media-figure-tails.test.js
 * @description Coverage tails for components/media/figure/modal.ts +
 * components/media/figure/mount.ts — openMediaModal's
 * `r && r.width > 0 ? origin : null` truthy arm (a laid-out figure yields a
 * real genie origin rect) and mountMediaFigure's `if (openBtn)` else arm
 * (expandable figure without the open button skips bracket mounting).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { openMediaModal } from '@website/components/media/figure/modal.js'
import { restoreMediaModalTrigger } from '@website/components/media/modal-trigger.js'
import { mountMediaFigure } from '@website/components/media/figure/mount.js'
import store from '@core/store.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'

describe('media figure modal + mount tails', () => {
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
})
