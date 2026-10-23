/**
 * @file draw-text-nested-tags.test.js — regression coverage for the recursive
 * markup handling in website/components/media/draw-text/render.ts: CMS content
 * like `<a href="/"><span>label</span></a>` must tokenize its inner markup
 * (not leak raw `<`/`>` into innerHTML), text chars must be entity-escaped,
 * and anchor sr-only twins must be escaped too. These tests mount the
 * emitted HTML into a real DOM so the assertions observe the *rendered* text
 * — the exact surface where the `>luiskr` leak was visible.
 */

import { parseTokens, renderContent } from '@website/components/media/draw-text/render.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { CSS_STRINGS } from '@core/tokens/strings/css.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'

/** Mounts rendered draw-text HTML and returns the host for DOM assertions. */
const mountHtml = (html) => {
  const host = document.createElement('div')

  host.innerHTML = html

  return host
}

describe('draw-text nested markup', () => {
  test('nested <a><span> renders real markup — no leaked tag text', () => {
    // The exact CMS shape that produced the visible `>luiskr` fragment.
    const host = mountHtml(
      renderContent("<a target='_blank' href='/'><span >luiskr</span></a>", 10, 0)
    )

    const anchor = host.querySelector(DOM_STRINGS.A_TAG)

    expect(anchor).toBeTruthy()
    expect(anchor.getAttribute(DOM_STRINGS.HREF)).toBe('/')
    expect(anchor.querySelector(HTML_TAGS.SPAN)).toBeTruthy()

    // Rendered text is the sr-only twin + the drawn label — a stray '>' or
    // '<span' here is the old leak where nested markup was emitted as
    // literal text.
    expect(host.textContent).toBe('luiskrluiskr')
  })

  test('nested tag tokens parse recursively — chunks contain the inner tag', () => {
    const toks = parseTokens("<a href='/'><b>x</b> tail</a>")
    const anchor = toks.find((t) => t.type === CSS_STRINGS.TOKEN_TAG)

    expect(anchor.tag).toBe(DOM_STRINGS.A_TAG)
    expect(anchor.chunks.some((c) => c.type === CSS_STRINGS.TOKEN_TAG && c.tag === 'b')).toBe(true)
  })

  test('text chars are entity-escaped in both render modes', () => {
    const expected = '2 < 3 & "4" \'5\''
    const animated = mountHtml(renderContent('2 < 3 & "4" \'5\'', 10, 0))
    const plain = mountHtml(renderContent('2 < 3 & "4" \'5\'', 10, 0, false))

    // innerHTML assignment un-escapes entities — textContent must round-trip
    // the source (top-level spaces render as natural literal-space text
    // nodes — shared geometry across modes), proving nothing was emitted
    // as raw markup.
    expect(animated.textContent).toBe(expected)
    expect(plain.textContent).toBe(expected)
    expect(animated.querySelector('b, i, a')).toBeNull()
    expect(plain.querySelector('b, i, a')).toBeNull()
  })

  test('sr-only twin strips nested markup and escapes quotes', () => {
    const html = renderContent('<a href="/">say "hi" <b>there</b></a>', 10, 0)

    // Twin text is NBSP-joined and the quote char must arrive as &quot; —
    // a raw " inside the span would still be safe markup, but the escaping
    // keeps the twin byte-identical to the old attribute contract.
    expect(html).toContain(`>say${CHAR_STRINGS.NBSP}&quot;hi&quot;${CHAR_STRINGS.NBSP}there<`)
  })

  test('authored aria-label is dropped in favor of the sr-only twin', () => {
    // label_name_visible requires the accessible name to match the
    // visible text — an authored label that drifts from the rendered
    // chars (case/whitespace) is a violation, and IBM joins per-char
    // text nodes with spaces, so the name must come from the in-anchor
    // sr-only copy of the drawn text instead of any attribute. The twin
    // uses the opacity variant — inside shadow DOM innerText is "" and
    // clip-path-hidden nodes don't feed name-from-content.
    const html = renderContent('<a href="/" aria-label="custom">x</a>', 10, 0)

    expect(html).not.toContain('aria-label')
    expect(html).toContain(A11Y_CLASSES.SR_ONLY_ALPHA)
    expect(html).toContain('>x<')
  })

  test('<br>, nested <br>, empty tag, and stray angle brackets render safely', () => {
    const host = mountHtml(renderContent('a<br>b <i></i> c <b>d<br>e</b>', 10, 0))

    expect(host.querySelectorAll(CSS_STRINGS.TOKEN_BR)).toHaveLength(2)
    expect(host.querySelector('i')).toBeTruthy()
    // Top-level spaces are literal text nodes; the nbsp contract only
    // survives INSIDE tags (a link's words stay one visual unit).
    expect(host.textContent).toBe('ab  c de')
  })
})
