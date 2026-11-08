/**
 * @file project-description-fit-tails.test.js
 * @description Coverage tails for views/project/layout.ts — the
 * fitDescriptionSizes pass that promotes single-paragraph description
 * blocks by measured line count: one rendered line → --xl (TTL_XL),
 * more → --md (TXT_LG), multiple paragraphs untouched. Covers the
 * ResizeObserver lifecycle, the font-ready refit, the zero-size
 * (content-visibility) skip, and the facade/destroy wiring on
 * ViewProject.
 */

import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { ViewProject } from '@website/views/project/Project.js'
import { fitDescriptionSizes } from '@website/views/project/layout.js'
import { mount, SCSS } from '@tests/fixtures/test-constants.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'

const ORIG_RO = globalThis.ResizeObserver
const ORIG_GCS = globalThis.getComputedStyle
const ORIG_FONTS = document.fonts

const DESC = INTERNAL_CLASSES.INTERNAL_DESCRIPTION
const TEXT = INTERNAL_CLASSES.INTERNAL_DESCRIPTION_TEXT
const XL = INTERNAL_CLASSES.INTERNAL_DESCRIPTION_XL
const MD = INTERNAL_CLASSES.INTERNAL_DESCRIPTION_MD

/**
 * Builds a detached description block holding `count` paragraphs.
 * @param count — number of .internal-description-text <p> children
 */
const descBlock = (count = 1) => {
  const block = document.createElement(HTML_TAGS.DIV)

  block.className = DESC

  for (let i = 0; i < count; i++) {
    const p = document.createElement(HTML_TAGS.P)

    p.className = TEXT
    block.appendChild(p)
  }

  return block
}

/** Stub view — fitDescriptionSizes only reads the fields below. */
const stubView = (blocks) => ({
  shadowRoot: { querySelectorAll: () => blocks },
  _descFitObserver: null,
  _descFontsWired: true,
})

/** Pins a paragraph's rendered height + computed line-height. */
const stubMeasure = (p, height, lineHeight = 21) => {
  Object.defineProperty(p, 'clientHeight', { configurable: true, value: height })

  globalThis.getComputedStyle = (el) =>
    el === p ? { lineHeight: `${lineHeight}px` } : ORIG_GCS(el)
}

afterEach(() => {
  globalThis.ResizeObserver = ORIG_RO
  globalThis.getComputedStyle = ORIG_GCS
  Object.defineProperty(document, 'fonts', { value: ORIG_FONTS, configurable: true })
})

describe('project description fit tails', () => {
  test('one rendered line promotes the block to --xl', () => {
    const block = descBlock()

    stubMeasure(block.firstElementChild, 21)
    fitDescriptionSizes(stubView([block]))

    expect(block.classList.contains(XL)).toBe(true)
    expect(block.classList.contains(MD)).toBe(false)
  })

  test('a wrapped single paragraph promotes to --md', () => {
    const block = descBlock()

    stubMeasure(block.firstElementChild, 42)
    fitDescriptionSizes(stubView([block]))

    expect(block.classList.contains(MD)).toBe(true)
    expect(block.classList.contains(XL)).toBe(false)
  })

  test('a wrong previous promotion is re-measured at base size', () => {
    const block = descBlock()

    block.classList.add(XL)
    stubMeasure(block.firstElementChild, 63)
    fitDescriptionSizes(stubView([block]))

    // 63px ÷ 21px lh = 3 lines at base → demoted from --xl to --md.
    expect(block.classList.contains(MD)).toBe(true)
    expect(block.classList.contains(XL)).toBe(false)
  })

  test('multi-paragraph blocks keep the base size — modifiers stripped', () => {
    const block = descBlock(2)

    block.classList.add(MD)
    fitDescriptionSizes(stubView([block]))

    expect(block.classList.contains(MD)).toBe(false)
    expect(block.classList.contains(XL)).toBe(false)
  })

  test('zero-height blocks skip classification until they reveal', () => {
    const block = descBlock()

    fitDescriptionSizes(stubView([block]))

    expect(block.classList.contains(XL)).toBe(false)
    expect(block.classList.contains(MD)).toBe(false)
  })

  test('an unresolvable line-height leaves the block unclassified', () => {
    const block = descBlock()
    const p = block.firstElementChild

    Object.defineProperty(p, 'clientHeight', { configurable: true, value: 21 })
    globalThis.getComputedStyle = () => ({ lineHeight: 'normal' })

    fitDescriptionSizes(stubView([block]))

    expect(block.classList.contains(XL)).toBe(false)
    expect(block.classList.contains(MD)).toBe(false)
  })

  test('a missing shadow root short-circuits the pass', () => {
    expect(() =>
      fitDescriptionSizes({ _descFitObserver: null, _descFontsWired: true })
    ).not.toThrow()
  })

  test('installs a ResizeObserver on each block and refits via its callback', () => {
    let roCb = null

    const observed = []

    globalThis.ResizeObserver = class {
      constructor(cb) {
        roCb = cb
      }
      observe(el) {
        observed.push(el)
      }
      disconnect() {}
    }

    const block = descBlock()
    const view = stubView([block])

    fitDescriptionSizes(view)

    expect(view._descFitObserver).not.toBeNull()
    expect(observed).toContain(block)

    // The RO entry path re-measures the same block — height arrives on reveal.
    stubMeasure(block.firstElementChild, 21)
    roCb([{ target: block }])

    expect(block.classList.contains(XL)).toBe(true)
  })

  test('a second pass reuses the installed observer', () => {
    const view = stubView([descBlock()])

    fitDescriptionSizes(view)

    const seen = view._descFitObserver

    fitDescriptionSizes(view)

    expect(view._descFitObserver).toBe(seen)
  })

  test('no ResizeObserver → measures once, keeps _descFitObserver null', () => {
    delete globalThis.ResizeObserver

    const block = descBlock()
    const view = stubView([block])

    stubMeasure(block.firstElementChild, 21)
    fitDescriptionSizes(view)

    expect(view._descFitObserver).toBeNull()
    expect(block.classList.contains(XL)).toBe(true)
  })

  test('document.fonts.ready arms the post-load refit once', async () => {
    let resolveReady

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise((res) => (resolveReady = res)) },
    })

    const block = descBlock()
    const view = stubView([block])

    view._descFontsWired = false
    fitDescriptionSizes(view)

    expect(view._descFontsWired).toBe(true)

    // Font metrics shift the verdict after load — the ready refit re-runs.
    stubMeasure(block.firstElementChild, 21)
    resolveReady()
    await Promise.resolve()
    await Promise.resolve()

    expect(block.classList.contains(XL)).toBe(true)

    // A second call must not re-arm the ready hook.
    const wired = view._descFitObserver

    fitDescriptionSizes(view)

    expect(view._descFitObserver).toBe(wired)
  })

  test('no document → the fonts-ready arm is skipped', () => {
    const block = descBlock()
    const savedDoc = globalThis.document

    globalThis.document = undefined

    try {
      const view = stubView([block])

      view._descFontsWired = false
      fitDescriptionSizes(view)

      expect(view._descFontsWired).toBe(false)
    } finally {
      globalThis.document = savedDoc
    }
  })

  test('onDestroy disconnects and drops the observer', () => {
    const el = new ViewProject()
    const cleanup = mount(el)
    const disconnect = jest.fn()

    el._descFitObserver = { disconnect }
    el.onDestroy()

    expect(disconnect).toHaveBeenCalled()
    expect(el._descFitObserver).toBeNull()

    cleanup()
  })

  test('window resize re-runs the description fit', async () => {
    const el = new ViewProject()
    const cleanup = mount(el)
    const spy = jest.spyOn(el, '_fitDescriptionSizes')

    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(spy).toHaveBeenCalled()

    cleanup()
  })

  test('internals.scss promotes the single-paragraph modifiers', () => {
    expect(SCSS.internals).toMatch(/&--xl &-text[\s\S]*?%TTL_XL/)
    expect(SCSS.internals).toMatch(/&--md &-text[\s\S]*?%TXT_LG/)
  })
})
