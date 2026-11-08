/**
 * @file draw-text-render-modes-tails.test.js
 * @description Coverage tails for the draw-text render modes — the 'plain'
 * pending/done render (per-run aria-hidden spans, real tag markup,
 * anchor sr-only twins), the 'words' fit fallback, and the mode dispatch
 * through updateDom/_renderContent.
 */
import { describe, test, expect } from '@jest/globals'
import '@website/components/media/DrawText.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { DRAW_TEXT_CLASSES } from '@core/tokens/classes/draw-text.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { CSS_STRINGS } from '@core/tokens/strings/css.js'
import { DRAW_TEXT_SELECTORS } from '@core/tokens/selectors/draw-text.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import {
  parseTokens,
  plainTokensToHtml,
  renderContent,
  RENDER_MODES,
} from '@website/components/media/draw-text/render.js'

/** Mounts plain-mode HTML into a scratch container for assertions. */
function plainDom(text) {
  const div = document.createElement('div')

  div.innerHTML = renderContent(text, 0, 0, RENDER_MODES.PLAIN)

  return div
}

/**
 * Mounts a <draw-text> with the given attributes and returns the host.
 * @param attrs Attribute map to set before connecting.
 */
function mount(attrs = {}) {
  const el = document.createElement(COMPONENT_TAGS.DRAW_TEXT)

  Object.entries({ [FORM_ATTRS.TEXT]: TEST_TEXT.HELLO_WORLD, ...attrs }).forEach(([k, v]) =>
    el.setAttribute(k, v)
  )

  document.body.appendChild(el)

  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('draw-text render modes', () => {
  test('pending (viewport) mounts word spans — same wrap authority as the animated state', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [FORM_ATTRS.TEXT]: 'One Two Three',
    })

    // Word spans in pending: pending → animating → done share the nowrap
    // word-box geometry — a plain run would re-break at hyphens/dashes.
    expect(el.shadowRoot.querySelectorAll(DRAW_TEXT_SELECTORS.DRAW_TEXT_WORD).length).toBe(3)
    expect(el.shadowRoot.querySelectorAll(DRAW_TEXT_SELECTORS.DRAW_TEXT_CHAR).length).toBe(0)

    el.remove()
  })

  test('plain mode preserves <br> inside a run', () => {
    const div = plainDom('Line 1<br>Line 2')

    expect(div.textContent).toContain('Line 1')
    expect(div.querySelectorAll('br').length).toBe(1)
  })

  test('plain mode keeps tag markup with aria-hidden inner text', () => {
    const div = plainDom('a <em>mid</em> z')
    const em = div.querySelector('em')

    expect(em).not.toBeNull()
    expect(em.textContent).toContain('mid')
    expect(em.querySelector(`[${ARIA_ATTRS.ARIA_HIDDEN}]`)).not.toBeNull()
  })

  test('plain mode anchors carry the sr-only twin + hidden inner copy', () => {
    const div = plainDom('see <a href="/x" aria-label="authored">Link</a> now')
    const link = div.querySelector('a')

    expect(link).not.toBeNull()
    // Authored aria-labels are stripped (label-in-name parity) and the
    // sr-only-alpha twin supplies the accessible name instead.
    expect(link.hasAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(false)
    expect(link.querySelector(`.${A11Y_CLASSES.SR_ONLY_ALPHA}`)).not.toBeNull()
    expect(link.querySelector(`[${ARIA_ATTRS.ARIA_HIDDEN}]`)).not.toBeNull()
  })

  test('plain mode tag without a name and unknown tokens degrade safely', () => {
    const html = plainTokensToHtml([
      { type: CSS_STRINGS.TOKEN_TAG, tag: '', attrStr: CHAR_STRINGS.EMPTY, chunks: [] },
      { type: 'mystery' },
    ])

    expect(typeof html).toBe('string')

    const inner = plainTokensToHtml([
      {
        type: CSS_STRINGS.TOKEN_TAG,
        tag: 'em',
        attrStr: CHAR_STRINGS.EMPTY,
        inner: CHAR_STRINGS.EMPTY,
        chunks: [{ type: CSS_STRINGS.TOKEN_BR }, { type: 'mystery' }],
      },
    ])

    expect(inner).toContain('<em')
  })

  test('a leading tag flushes an empty run without emitting a stray span', () => {
    const div = plainDom('<em>lead</em> tail')
    const runs = div.querySelectorAll(`span[${ARIA_ATTRS.ARIA_HIDDEN}="${ATTR_VALUES.TRUE}"]`)

    // One run after the <em> (the tag's own hidden inner makes 2 total).
    expect(runs.length).toBe(2)
  })

  test('parseTokens keeps punctuation tokens inside their word', () => {
    const tokens = parseTokens('e-mail — dash…')

    // Hyphen/ellipsis/dash chars stay inside word tokens — the word span
    // keeps UAX#14 break points identical across every render mode.
    expect(tokens.filter((t) => t.type === CSS_STRINGS.TOKEN_WORD).length).toBe(3)
  })

  test('non-fit hosts keep word spans in pending too (uniform geometry)', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [COMMON_ATTRS.FIT]: ATTR_VALUES.EMPTY,
    })

    expect(el.shadowRoot.querySelectorAll(DRAW_TEXT_SELECTORS.DRAW_TEXT_WORD).length).toBe(2)

    el.remove()
  })

  test('_renderContent(false) emits the words mode', () => {
    const el = mount()

    expect(el._renderContent(false)).toContain(DRAW_TEXT_CLASSES.DRAW_TEXT_WORD)

    el.remove()
  })
})
