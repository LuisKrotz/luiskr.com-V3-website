/**
 * @file draw-text-render-tails.test.js
 * @description Split from coverage-tails-7.test.js — covers the "draw-text render tails" describe.
 */
import { jest } from '@jest/globals'

import '@core/constants.js'

import '@cms/about/CmsAboutEditor.js'
import '@cms/portfolio/CmsPortfolioList.js'
import '@cms/projects/CmsProjectsList.js'
import '@cms/playground-editor/CmsPlaygroundEditor.js'
import '@cms/footer/CmsFooterEditor.js'
import '@cms/deploy-info/CmsDeployInfo.js'

import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import {
  parseTokens,
  renderContent,
  renderWordHtml,
  tokenToHtml,
} from '@website/components/media/draw-text/render.js'

globalThis.alert = jest.fn()

describe('draw-text render tails', () => {
  test('renderContent empty + plain-word + capped-delay arms', () => {
    expect(renderContent('', 0, 0)).toBe('')
    expect(renderContent('a b', 10, 0, false)).not.toContain('--i:')
    expect(renderContent('a', 9000, 0)).toBeTruthy()
    expect(renderContent('x<br>y', 10, 5)).toBeTruthy()
    expect(renderContent('<b class="z">bold</b> tail', 10, 0)).toBeTruthy()
  })

  test('parseTokens tag/attr/empty-inner arms', () => {
    const toks = parseTokens('<i></i> a <br> b')

    expect(toks.length).toBeGreaterThan(1)
  })

  test('tokenToHtml unknown-token + malformed-tag arms', () => {
    const renderWord = () => ''

    expect(tokenToHtml({ type: 'unknown' }, renderWord)).toBe('')

    // Tag token with no tag name/chunks/attrStr — emits children unwrapped.
    expect(tokenToHtml({ type: 'tag', inner: 'x' }, renderWord)).toBe('')

    // Tag token whose inner chunk is itself an unknown type.
    expect(
      tokenToHtml({ type: 'tag', tag: 'b', chunks: [{ type: 'unknown' }] }, renderWord)
    ).toBe('<b ></b>')

    // Anchor without attrs/inner → sr-only twin of the (empty) drawn text;
    // no aria-label is emitted since the twin is the accessible name. The
    // opacity variant is used — clip-path-hidden nodes are hidden-from-AT
    // to IBM's name-from-content walk inside shadow DOM.
    const bareAnchor = tokenToHtml({ type: 'tag', tag: 'a', chunks: [] }, renderWord)

    expect(bareAnchor).toContain(A11Y_CLASSES.SR_ONLY_ALPHA)
    expect(bareAnchor).not.toContain('aria-label')

    // An authored aria-label is dropped — the sr-only twin keeps the
    // accessible name identical to the drawn text for label-in-name checks.
    const labelledAnchor = tokenToHtml(
      { type: 'tag', tag: 'a', attrStr: 'aria-label="x"', inner: 'x', chunks: [] },
      renderWord
    )

    expect(labelledAnchor).not.toContain('aria-label')
    expect(labelledAnchor).toContain('>x<')
  })

  test('renderWordHtml default-chars arm', () => {
    expect(renderWordHtml(undefined, 0, 0, 0, true)).toBeTruthy()
  })
})
