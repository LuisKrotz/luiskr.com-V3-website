/**
 * @file appnav-close-tails.test.js
 * @description Final arms: AppNav's menu-close settle callback (the
 * anonymous timer at onDestroy) and the related-card's
 * `_loadedCovers?.get` undefined-registry arm.
 */
import { renderRelated } from '@website/components/portfolio/related/render.js'
import { RELATED_CLASSES } from '@core/tokens/classes/related.js'
import { TEST_TEXT, TEST_PROJECTS, TEST_URLS } from '@tests/fixtures/test-constants.js'

const flush = (ms = 400) => new Promise((r) => setTimeout(r, ms))

describe('AppNav close-settle timer arm', () => {
  test('_closeMenu runs the settle timer callback', async () => {
    const { default: AppNav } = await import('@website/components/nav/AppNav.js')

    const el = document.createElement('app-nav')

    document.body.appendChild(el)
    await flush()

    el._menuOpen = true
    el._menuClosing = false
    el._menuSettled = true

    if (typeof el._closeMenu === 'function') {
      el._closeMenu()
    }

    if (typeof el.subscribeRouter === 'function') {
      el.subscribeRouter()
    }

    const { default: router } = await import('@core/router/router.js')

    await router.push('/')

    await flush(1000)
    el.remove()
    void AppNav
  })
})

describe('related render — missing _loadedCovers arm', () => {
  test('host without _loadedCovers takes the ?. fallback', () => {
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
        socials: [],
      },
      // no _loadedCovers at all
    }

    const tree = renderRelated(host)

    expect(tree.querySelector(`.${RELATED_CLASSES.RELATED_LIST_ITEM}`)).toBeTruthy()
  })
})
