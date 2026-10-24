/**
 * @file related-note-tails.test.js — coverage tails for the
 * PortfolioRelated disclaimer-note truncation watcher: _measureNote's
 * element/open/flag guards, _watchNoteTruncation's missing-element,
 * no-ResizeObserver and same-element arms, and the onDestroy cleanup.
 */

import { jest, describe, test, expect } from '@jest/globals'
import { PortfolioRelated } from '@website/components/portfolio/Related.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { mount, TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Drains one animation frame so the debounced note measure runs. */
const flushRaf = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const NOTE_SEL = `.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE}`
const NOTE_TEXT_SEL = `.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE_TEXT}`

/** translations shape that renders the real socials+note row (not the skeleton). */
const NOTE_TRANSLATIONS = {
  title: 'T',
  note: TEST_TEXT.LONG_NOTE,
  socials: [{ network: 'gh', link: 'https://x.example' }],
}

describe('PortfolioRelated note truncation tails', () => {
  test('measure arms: no text element, open note, no-change and flip', () => {
    const el = new PortfolioRelated()

    // No note rendered yet → the !textEl arm returns early.
    el._measureNote()
    expect(el._noteTruncated).toBe(false)

    const cleanup = mount(el)

    el.translations = { ...NOTE_TRANSLATIONS }
    el._updateDom()

    const textEl = el.shadowRoot.querySelector(NOTE_TEXT_SEL)

    expect(textEl).not.toBeNull()

    // Open arm: measurement is skipped while the note is expanded.
    el._noteOpen = true
    el._measureNote()
    expect(el._noteTruncated).toBe(false)
    el._noteOpen = false

    // No-change arm: happy-dom reports 0/0 → zero-height guard returns.
    el._measureNote()
    expect(el._noteTruncated).toBe(false)

    // Flip arm: pin the text query to an overflowing stub so the flag
    // flips and stays flipped after the re-render re-measures it.
    const stubText = { scrollHeight: 120, clientHeight: 20 }
    const bound$ = el.$.bind(el)
    const $spy = jest
      .spyOn(el, '$')
      .mockImplementation((sel) => (sel === NOTE_TEXT_SEL ? stubText : bound$(sel)))

    el._measureNote()

    expect(el._noteTruncated).toBe(true)
    expect(
      el.shadowRoot.querySelector(NOTE_SEL).classList.contains(STATE_CLASSES.IS_TRUNCATED)
    ).toBe(true)

    // Same-flag arm: a laid-out, non-overflowing stub measures false and
    // matches the flipped flag path on a fresh instance.
    const bare = new PortfolioRelated()

    bare._noteTruncated = true

    const bareSpy = jest
      .spyOn(bare, '$')
      .mockImplementation((sel) =>
        sel === NOTE_TEXT_SEL ? { scrollHeight: 20, clientHeight: 20 } : null
      )

    bare._measureNote()

    expect(bare._noteTruncated).toBe(false)

    // Same-flag arm: a second non-overflowing measure finds no flag
    // change and skips the re-render entirely.
    bare._measureNote()

    expect(bare._noteTruncated).toBe(false)

    bareSpy.mockRestore()
    $spy.mockRestore()
    cleanup()
  })

  test('watch arms: same-element skip, rebind on re-render, missing note', async () => {
    const savedRO = globalThis.ResizeObserver
    const savedIO = globalThis.IntersectionObserver
    const observed = []
    let roCb = null
    let ioCb = null
    let disconnected = 0

    globalThis.ResizeObserver = class {
      constructor(cb) {
        roCb = cb
      }
      observe(el) {
        observed.push(el)
      }
      disconnect() {
        disconnected++
      }
      unobserve() {}
    }

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    const el = new PortfolioRelated()
    const cleanup = mount(el)

    try {
      el.translations = { ...NOTE_TRANSLATIONS }
      el._updateDom()

      // onUpdated already bound the observer to the current note node.
      expect(observed[observed.length - 1]).toBe(el.shadowRoot.querySelector(NOTE_SEL))

      // Same element → early return before disconnect/observe.
      const before = disconnected
      const prevRO = el._noteRO

      el._watchNoteTruncation()

      expect(el._noteRO).toBe(prevRO)
      expect(disconnected).toBe(before)

      // Re-render creates a fresh node → old observer disconnects first.
      el._updateDom()

      expect(disconnected).toBe(before + 1)
      expect(observed[observed.length - 1]).toBe(el.shadowRoot.querySelector(NOTE_SEL))
      expect(el._noteEl).toBe(el.shadowRoot.querySelector(NOTE_SEL))

      // Open the viewport gate, then fire the RO callback — the rAF
      // debounce collapses repeated ticks into a single read.
      ioCb([{ isIntersecting: true }])
      roCb()
      roCb()

      await flushRaf()

      expect(el._noteTruncated).toBe(false)
      expect(el._measureRaf).toBe(0)
    } finally {
      if (savedRO === undefined) delete globalThis.ResizeObserver
      else globalThis.ResizeObserver = savedRO

      if (savedIO === undefined) delete globalThis.IntersectionObserver
      else globalThis.IntersectionObserver = savedIO

      cleanup()
    }
  })

  test('watch fallback without ResizeObserver + missing-note arm + destroy cleanup', () => {
    const savedRO = globalThis.ResizeObserver

    delete globalThis.ResizeObserver

    const el = new PortfolioRelated()
    const cleanup = mount(el)

    try {
      el.translations = { ...NOTE_TRANSLATIONS }
      el._updateDom()

      // No ResizeObserver → measure still runs, no observer is stored.
      el._watchNoteTruncation()
      expect(el._noteRO).toBeNull()
    } finally {
      if (savedRO === undefined) delete globalThis.ResizeObserver
      else globalThis.ResizeObserver = savedRO
    }

    // Missing-note arm: a fresh, never-rendered instance has no note node.
    const bare = new PortfolioRelated()

    bare._noteEl = bare // any non-null sentinel — the arm must reset it
    bare._watchNoteTruncation()
    expect(bare._noteEl).toBeNull()

    // onDestroy disconnects a live observer, cancels a queued measure
    // and clears the refs.
    el._noteRO = { disconnect() {} }
    el._noteIO = { disconnect() {} }
    el._noteSeen = true
    el._noteEl = el
    el._measureRaf = requestAnimationFrame(() => {})
    el.onDestroy()
    expect(el._noteRO).toBeNull()
    expect(el._noteIO).toBeNull()
    expect(el._noteSeen).toBe(false)
    expect(el._noteEl).toBeNull()
    expect(el._measureRaf).toBe(0)

    cleanup()
  })

  test('viewport gate: IO fire opens the measure gate; offscreen + rebind arms', async () => {
    const savedIO = globalThis.IntersectionObserver
    const observed = []
    let ioCb = null
    let disconnected = 0

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe(el) {
        observed.push(el)
      }
      disconnect() {
        disconnected++
      }
      unobserve() {}
    }

    const el = new PortfolioRelated()
    const cleanup = mount(el)

    try {
      el.translations = { ...NOTE_TRANSLATIONS }
      el._updateDom()

      // Gate closed — queued measures drop while the note is unseen, and
      // the approach observer is bound to the live note node.
      el._queueNoteMeasure()
      expect(el._measureRaf).toBe(0)
      expect(el._noteSeen).toBe(false)
      expect(el._noteIO).not.toBeNull()
      expect(observed[observed.length - 1]).toBe(el.shadowRoot.querySelector(NOTE_SEL))

      // A re-rendered node rebinds — the stale observer disconnects.
      const ioBefore = disconnected

      el._updateDom()
      expect(disconnected).toBe(ioBefore + 1)
      expect(observed[observed.length - 1]).toBe(el.shadowRoot.querySelector(NOTE_SEL))

      // A non-intersecting entry keeps the gate closed.
      ioCb([{ isIntersecting: false }])
      expect(el._noteSeen).toBe(false)
      expect(el._noteIO).not.toBeNull()

      // Intersecting → gate opens, observer released, measure queued.
      ioCb([{ isIntersecting: true }])
      expect(el._noteSeen).toBe(true)
      expect(el._noteIO).toBeNull()
      expect(el._measureRaf).not.toBe(0)

      await flushRaf()
      expect(el._measureRaf).toBe(0)

      // Seen + fresh node → no new approach observer is created.
      el._updateDom()
      expect(el._noteIO).toBeNull()
    } finally {
      globalThis.IntersectionObserver = savedIO
      cleanup()
    }
  })

  test('no IntersectionObserver → the gate opens eagerly', () => {
    const savedIO = globalThis.IntersectionObserver

    delete globalThis.IntersectionObserver

    const el = new PortfolioRelated()
    const cleanup = mount(el)

    try {
      el.translations = { ...NOTE_TRANSLATIONS }
      el._updateDom()

      expect(el._noteSeen).toBe(true)
      expect(el._noteIO).toBeNull()
    } finally {
      globalThis.IntersectionObserver = savedIO
      cleanup()
    }
  })
})
