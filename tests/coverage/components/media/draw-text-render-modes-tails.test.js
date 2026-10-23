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
  test('pending (viewport) mounts plain runs — one aria-hidden span per block', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [FORM_ATTRS.TEXT]: 'One Two Three',
    })

    // No word/char spans in pending — a paragraph is O(1) nodes.
    expect(el.shadowRoot.querySelectorAll(DRAW_TEXT_SELECTORS.DRAW_TEXT_WORD).length).toBe(0)
    expect(el.shadowRoot.querySelectorAll(DRAW_TEXT_SELECTORS.DRAW_TEXT_CHAR).length).toBe(0)

    const runs = el.shadowRoot.querySelectorAll(
      `span[${ARIA_ATTRS.ARIA_HIDDEN}="${ATTR_VALUES.TRUE}"]`
    )

    expect(runs.length).toBe(1)
    expect(runs[0].textContent).toBe('One Two Three')

    el.remove()
  })

  test('plain mode preserves <br> inside a run', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [FORM_ATTRS.TEXT]: 'Line 1<br>Line 2',
    })

    const wrapper = el.shadowRoot.querySelector(DRAW_TEXT_SELECTORS.DRAW_TEXT)

    expect(wrapper.textContent).toContain('Line 1')
    expect(wrapper.querySelectorAll('br').length).toBe(1)

    el.remove()
  })

  test('plain mode keeps tag markup with aria-hidden inner text', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [FORM_ATTRS.TEXT]: 'a <em>mid</em> z',
    })

    const em = el.shadowRoot.querySelector('em')

    expect(em).not.toBeNull()
    expect(em.textContent).toContain('mid')
    expect(em.querySelector(`[${ARIA_ATTRS.ARIA_HIDDEN}]`)).not.toBeNull()

    el.remove()
  })

  test('plain mode anchors carry the sr-only twin + hidden inner copy', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [FORM_ATTRS.TEXT]: 'see <a href="/x" aria-label="authored">Link</a> now',
    })

    const link = el.shadowRoot.querySelector('a')

    expect(link).not.toBeNull()
    // Authored aria-labels are stripped (label-in-name parity) and the
    // sr-only-alpha twin supplies the accessible name instead.
    expect(link.hasAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(false)
    expect(link.querySelector(`.${A11Y_CLASSES.SR_ONLY_ALPHA}`)).not.toBeNull()
    expect(link.querySelector(`[${ARIA_ATTRS.ARIA_HIDDEN}]`)).not.toBeNull()

    el.remove()
  })

  test('plain mode tag without a name and unknown tokens degrade safely', () => {
    const el = mount({ [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT })

    el._parseTokens = () => [
      { type: CSS_STRINGS.TOKEN_TAG, tag: '', attrStr: CHAR_STRINGS.EMPTY, chunks: [] },
      { type: 'mystery' },
    ]

    expect(() => el._updateDom()).not.toThrow()

    el._parseTokens = () => [
      {
        type: CSS_STRINGS.TOKEN_TAG,
        tag: 'em',
        attrStr: CHAR_STRINGS.EMPTY,
        inner: CHAR_STRINGS.EMPTY,
        chunks: [{ type: CSS_STRINGS.TOKEN_BR }, { type: 'mystery' }],
      },
    ]

    expect(() => el._updateDom()).not.toThrow()

    el.remove()
  })

  test('a leading tag flushes an empty run without emitting a stray span', () => {
    const el = mount({
      [COMMON_ATTRS.TRIGGER]: COMMON_ATTRS.TRIGGER_VIEWPORT,
      [FORM_ATTRS.TEXT]: '<em>lead</em> tail',
    })

    const runs = el.shadowRoot.querySelectorAll(
      `span[${ARIA_ATTRS.ARIA_HIDDEN}="${ATTR_VALUES.TRUE}"]`
    )

    // One run after the <em> (the tag's own hidden inner makes 2 total).
    expect(runs.length).toBe(2)

    el.remove()
  })

  test('fit hosts keep word spans in pending (fitText measures them)', () => {
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
