/**
 * @file related-render-tails.test.js
 * @description Coverage tails for components/portfolio/related/render.tsx —
 * the `!isPlainClick` early returns on the related-card anchors and the
 * footer's back-home link: modified clicks must keep native <a href>
 * semantics (no preventDefault, no router push).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { renderRelated } from '@website/components/portfolio/related/render.js'
import router from '@core/router/router.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { TEST_PROJECTS, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'

const ctrlClick = () =>
  new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, cancelable: true, ctrlKey: true })

describe('related render non-plain click tails', () => {
  test('card and home-link anchors keep native semantics on modified clicks', () => {
    const host = {
      projectsList: [
        {
          fullPath: `/portfolio/${TEST_PROJECTS.SLUG_MINIMELISSA}`,
          imageSrc: TEST_URLS.IMG,
          page: TEST_TEXT.HEADING,
          description: TEST_TEXT.SECOND,
          link: TEST_PROJECTS.SLUG_MINIMELISSA,
        },
      ],
      translations: {
        title: TEST_TEXT.HEADING,
        note: TEST_TEXT.SECOND,
        socials: [{ link: TEST_URLS.GITHUB, network: TEST_TEXT.HEADING }],
      },
      _noteOpen: false,
      _noteTruncated: false,
      _toggleNote: jest.fn(),
    }

    const tree = renderRelated(host)
    const pushSpy = jest.spyOn(router, 'push')

    const card = tree.querySelector(`.${RELATED_CLASSES.RELATED_MOSAIC_ITEM}`)
    const homeLink = tree.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_HOME}`)

    expect(card).toBeTruthy()
    expect(homeLink).toBeTruthy()

    for (const anchor of [card, homeLink]) {
      const ev = ctrlClick()

      anchor.dispatchEvent(ev)

      expect(ev.defaultPrevented).toBe(false)
    }

    expect(pushSpy).not.toHaveBeenCalled()

    pushSpy.mockRestore()
  })
})
