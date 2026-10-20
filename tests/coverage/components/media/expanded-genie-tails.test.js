/**
 * @file expanded-genie-tails.test.js
 * @description Coverage for website/components/media/expanded/genie.ts +
 * genie-gpu.ts — the expand-modal liquid warp driver and its WebGPU/Rust
 * backend. Covers: the no-start guards (reduced motion, missing
 * shadow/content), rect resolution (stored/live/fallback origin, media
 * box/aspect-fit destination, slug-matched figure lookup), the spring
 * clock (settle, watchdog, detached element, dead renderer), session
 * cancel/teardown (rAF cancel, overlay sweep, veil restore), the async
 * backend attach (resolve/reject/late-cancel), and the GPU mount path
 * (rects/flags/tint pushes, media-texture upload, dispose sweep).
 * The widget bridge is mocked — happy-dom has no WebGPU — and rAF is
 * stepped manually so spring progress is deterministic.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import store from '@core/store.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MODAL_MUTATIONS, PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { GENIE_TIMING } from '@core/tokens/motion/genie.js'
import { VIDEO_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

/** Mutable flag — whether the WebGPU widget layer is opted-in. */
let gpuEnabled = false

/** Mutable bridge result — mountWebGpuWidget resolves with this. */
let bridgeResult = null

/** Mutable flag — mountWebGpuWidget rejects instead of resolving. */
let bridgeRejects = false

/** Deferred bridge gate — when set, mountWebGpuWidget awaits it first. */
let bridgeHold = null

/** The last widget the bridge handed out — setter calls recorded. */
let lastWidget = null

/** Mutable flag — the media cache resolves a falsy url (push early-return). */
let fetchNull = false

/** Recorded decodeMediaInSeparateThread calls (url, w, h). */
let decodeCalls = []

/** Mutable flag — the wasm decode pool rejects instead of resolving. */
let decodeRejects = false

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => true,
  webgpuWidgetsEnabled: () => gpuEnabled,
  warmWidgetArtifacts: () => undefined,
  getSharedGpuDevice: async () => null,
  mountWebGpuWidget: async () => {
    if (bridgeHold) await bridgeHold

    if (bridgeRejects) throw new Error('mount failed')

    if (!bridgeResult) return null

    return { widget: (lastWidget = makeWidget()), destroy: jest.fn() }
  },
}))

jest.unstable_mockModule('@core/utils/media/local-media-cache.js', () => ({
  localMediaCache: {
    fetchOrGetLocalMedia: (url) => {
      if (fetchNull) return Promise.resolve('')

      return url ? Promise.resolve(url) : Promise.reject(new Error('no url'))
    },
  },
}))

jest.unstable_mockModule('@core/utils/wasm/wasm-media-threads.js', () => ({
  wasmMediaThreads: {
    decodeMediaInSeparateThread: (url, w, h) => {
      decodeCalls.push([url, w, h])

      if (decodeRejects) return Promise.reject(new Error('decode failed'))

      return Promise.resolve(
        url === 'decode-null' ? null : { width: 4, height: 4, close: () => {} }
      )
    },
  },
}))

/** Fake wasm widget — records the crate setter calls for assertions. */
const makeWidget = () => ({
  calls: [],
  frameResult: true,
  set_rects(...a) {
    this.calls.push(['set_rects', ...a])
  },
  set_flags(...a) {
    this.calls.push(['set_flags', ...a])
  },
  set_tint(...a) {
    this.calls.push(['set_tint', ...a])
  },
  set_progress(...a) {
    this.calls.push(['set_progress', ...a])
  },
  upload_bitmap(...a) {
    this.calls.push(['upload_bitmap', ...a])
  },
  frame() {
    return this.frameResult
  },
})

/** A counting 2D-context stub — every method is a no-op, canvas backref. */
const mock2D = (canvas) => {
  const gradient = { addColorStop: () => {} }
  const calls = { drawImage: 0, fillRect: 0, clearRect: 0 }

  const ctx = new Proxy(
    { canvas },
    {
      get(target, prop) {
        if (prop === 'calls') return calls
        if (prop in target) return target[prop]

        return (..._args) => {
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
            return gradient
          }
          if (prop === 'measureText') return { width: 0 }
          if (typeof prop === 'string' && prop in calls) calls[prop]++

          return undefined
        }
      },
      set(target, prop, value) {
        target[prop] = value

        return true
      },
    }
  )

  return ctx
}

/** Manual rAF queue — the spring clock steps only when tests pump it. */
let rafQueue = []
let rafSeq = 1
let nowMs = 0

const pump = (frames = 1, dt = 16.7) => {
  for (let i = 0; i < frames; i++) {
    nowMs += dt
    const q = rafQueue
    rafQueue = []
    q.forEach((cb) => cb())
  }
}

/** Flush pending microtasks — the reject path crosses extra awaits. */
const flushAsync = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

const RECT = { x: 10, y: 20, w: 200, h: 100 }

const rectOf = (r) => ({
  left: r.x,
  top: r.y,
  right: r.x + r.w,
  bottom: r.y + r.h,
  width: r.w,
  height: r.h,
  x: r.x,
  y: r.y,
  toJSON: () => ({}),
})

describe('expanded genie tails', () => {
  let startGenieOpen
  let startGenieClose
  let cancelGenie
  let mountGenieGpu
  let origRaf
  let origCaf
  let origNow
  let origGetContext

  const fakeEl = ({ content = true, item = true, attach = true } = {}) => {
    const el = document.createElement(HTML_TAGS.DIV)

    el.attachShadow({ mode: 'open' })

    if (content) {
      const c = document.createElement(HTML_TAGS.DIV)

      c.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT
      // The sheet composer needs a real content box — the fullscreen
      // modal surface is the warp's texture extent.
      c.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 800, h: 600 })
      el.shadowRoot.appendChild(c)

      if (item) {
        const mediaItem = document.createElement(HTML_TAGS.IMG)

        mediaItem.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM
        mediaItem.getBoundingClientRect = () => rectOf({ x: 300, y: 40, w: 400, h: 225 })
        c.appendChild(mediaItem)
      }
    }

    el.mediaWidth = 800
    el.mediaHeight = 450
    el.thumb = TEST_URLS.IMG
    el.source = TEST_URLS.IMG
    el._genie = null
    el.$ = (sel) => el.shadowRoot.querySelector(sel)

    if (attach) document.body.appendChild(el)

    return el
  }

  const contentOf = (el) =>
    el.shadowRoot.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT}`)

  const canvasesOf = (el) =>
    el.shadowRoot.querySelectorAll(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS}`)

  beforeEach(async () => {
    ;({ startGenieOpen, startGenieClose, cancelGenie } =
      await import('@website/components/media/expanded/genie.js'))
    ;({ mountGenieGpu } = await import('@website/components/media/expanded/genie-gpu.js'))

    gpuEnabled = false
    bridgeResult = null
    bridgeRejects = false
    bridgeHold = null
    lastWidget = null
    fetchNull = false
    decodeCalls = []
    decodeRejects = false
    rafQueue = []
    rafSeq = 1
    nowMs = 0

    origRaf = globalThis.requestAnimationFrame
    origCaf = globalThis.cancelAnimationFrame
    origNow = performance.now

    globalThis.requestAnimationFrame = (cb) => {
      const h = rafSeq++
      rafQueue.push(cb)
      return h
    }

    globalThis.cancelAnimationFrame = () => {}
    performance.now = () => nowMs

    origGetContext = document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext

    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = function (type) {
      return String(type) === WEBGL_STRINGS.CONTEXT_2D ? mock2D(this) : null
    }

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf
    globalThis.cancelAnimationFrame = origCaf
    performance.now = origNow
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = origGetContext
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  // ── start guards ──────────────────────────────────────────────────────

  test('returns false without a shadow root', () => {
    expect(startGenieOpen(document.createElement(HTML_TAGS.DIV), () => {})).toBe(false)
  })

  test('returns false under reduced motion', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    expect(startGenieOpen(fakeEl(), () => {})).toBe(false)
  })

  test('returns false when the content element is missing', () => {
    expect(startGenieOpen(fakeEl({ content: false }), () => {})).toBe(false)
  })

  test('returns false when document is undefined', () => {
    const el = fakeEl()
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'document')

    try {
      Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true })

      expect(startGenieOpen(el, () => {})).toBe(false)
    } finally {
      if (desc) {
        Object.defineProperty(globalThis, 'document', desc)
      } else {
        delete globalThis.document
      }
    }
  })

  // ── open lifecycle (2D backend) ───────────────────────────────────────

  test('open veils the content, mounts the overlay canvas, settles, unveils + done', () => {
    const el = fakeEl()
    let done = 0

    expect(startGenieOpen(el, () => done++)).toBe(true)

    // The veil lands synchronously; the measure+mount phase defers to
    // the first frame (post-mount layout reads live in the rAF task).
    expect(contentOf(el).classList.contains(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)).toBe(
      true
    )

    pump(1)

    expect(canvasesOf(el).length).toBe(1)
    expect(el._genie).not.toBeNull()

    pump(200)

    expect(contentOf(el).classList.contains(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)).toBe(
      false
    )
    expect(canvasesOf(el).length).toBe(0)
    expect(el._genie).toBeNull()
    expect(done).toBe(1)
  })

  test('close runs the done teardown after settle', () => {
    const el = fakeEl()
    let done = 0

    expect(startGenieClose(el, () => done++)).toBe(true)

    pump(200)

    expect(done).toBe(1)
    expect(el._genie).toBeNull()
  })

  test('watchdog force-settles a session past MAX_MS', () => {
    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    // First frame runs the measure+attach — the eased clock anchors at
    // the first drawable frame.
    pump(1)

    // A frame far past GENIE_TIMING.MAX_MS (1400) draws the terminal
    // landing pose; the settle teardown follows one composite later.
    pump(1, 2000)
    pump(1)

    expect(done).toBe(1)
    expect(canvasesOf(el).length).toBe(0)
  })

  test('detached element settles on the next tick', () => {
    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    el.remove()

    pump(1)

    expect(done).toBe(1)
    expect(el._genie).toBeNull()
  })

  test('dead renderer frame() forces settle', () => {
    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    const dead = { frame: () => false, dispose: jest.fn() }

    el._genie.renderer.dispose()
    el._genie.renderer = dead

    pump(1)

    expect(el._genie).toBeNull()
    expect(dead.dispose).toHaveBeenCalled()
  })

  // ── cancel ────────────────────────────────────────────────────────────

  test('cancelGenie drops the overlay, unveils and does not run done', () => {
    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)
    cancelGenie(el)

    expect(el._genie).toBeNull()
    expect(canvasesOf(el).length).toBe(0)
    expect(contentOf(el).classList.contains(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)).toBe(
      false
    )
    expect(done).toBe(0)
  })

  test('cancelGenie is a no-op without a session', () => {
    expect(() => cancelGenie(fakeEl())).not.toThrow()
  })

  test('a second start cancels the first session', () => {
    const el = fakeEl()

    startGenieOpen(el, () => {})

    const first = el._genie

    startGenieOpen(el, () => {})

    expect(first.cancelled).toBe(true)
    expect(el._genie).not.toBe(first)
  })

  // ── canvas backend failure ────────────────────────────────────────────

  test('canvas refusing 2d resolves instantly to done', () => {
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = () => null

    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    pump(1)

    expect(done).toBe(1)
    expect(el._genie).toBeNull()
    expect(canvasesOf(el).length).toBe(0)
  })

  // ── async GPU attach ─────────────────────────────────────────────────

  test('gpu-enabled mount attaches the resolved renderer', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)
    await flushAsync()

    expect(el._genie.renderer).toBeTruthy()
  })

  test('gpu mount resolving null falls back to the 2D canvas', async () => {
    gpuEnabled = true
    bridgeResult = null

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)
    await flushAsync()

    expect(el._genie.renderer).not.toBeNull()
    expect(canvasesOf(el).length).toBe(1)
  })

  test('gpu mount rejecting falls back to the 2D canvas', async () => {
    gpuEnabled = true
    bridgeRejects = true

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)
    await flushAsync()

    expect(el._genie.renderer).not.toBeNull()
  })

  test('gpu mount + dead 2d context resolves to done', async () => {
    gpuEnabled = true
    bridgeRejects = true

    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = () => null

    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    pump(1)
    await flushAsync()

    expect(done).toBe(1)
    expect(el._genie).toBeNull()
  })

  test('attach after cancel disposes the late renderer', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    cancelGenie(el)

    await flushAsync()

    expect(el._genie).toBeNull()
  })

  test('attach after detach disposes the late renderer', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    el.remove()

    await flushAsync()

    expect(el._genie).toBeNull()
  })

  test('slow gpu mount loses the race — the MOUNT_MS timer attaches 2D first', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    let release
    bridgeHold = new Promise((r) => (release = r))

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    // The bridge is still pending past MOUNT_MS — the watchdog timer must
    // attach the universal 2D backend so the warp never stalls on wasm.
    await new Promise((r) => setTimeout(r, GENIE_TIMING.MOUNT_MS + 30))

    expect(el._genie.renderer).toBeTruthy()

    // Now the GPU mount resolves — session.renderer is already owned by
    // 2D, so the late renderer is disposed rather than swapped mid-warp.
    release()

    await flushAsync()

    expect(el._genie.renderer).toBeTruthy()
  })

  test('gpu reject after the 2D takeover keeps the 2D session (catch else arm)', async () => {
    gpuEnabled = true
    bridgeRejects = true

    let release
    bridgeHold = new Promise((r) => (release = r))

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    // 2D attaches via the MOUNT_MS watchdog while the bridge is pending.
    await new Promise((r) => setTimeout(r, GENIE_TIMING.MOUNT_MS + 30))

    const owned = el._genie.renderer

    expect(owned).toBeTruthy()

    // The rejection lands after 2D owns the session — `!session.renderer`
    // is false so the catch must not re-attach.
    release()

    await flushAsync()

    expect(el._genie.renderer).toBe(owned)
  })

  test('fast gpu settle makes the MOUNT_MS timer a no-op (both guards false)', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)
    await flushAsync()

    const owned = el._genie.renderer

    // Past the mount window: the timer fires but `!gpuSettled` is false —
    // nothing re-attaches over the GPU renderer.
    await new Promise((r) => setTimeout(r, GENIE_TIMING.MOUNT_MS + 30))

    expect(el._genie.renderer).toBe(owned)
  })

  // ── origin/dest rect resolution ───────────────────────────────────────

  test('stored modal origin wins on open', () => {
    store.commit(MODAL_MUTATIONS.SET_MODAL, {
      open: true,
      origin: { x: 5, y: 6, w: 30, h: 40 },
    })

    const el = fakeEl()

    startGenieOpen(el, () => {})

    expect(el._genie).not.toBeNull()
    // p starts at 0 — the session exists; the rect math ran through
    // originRect picking the stored snapshot over the (absent) live figure.
    pump(1)
    expect(el._genie).not.toBeNull()
  })

  test('live figure rect resolves by slug on deep-link open', () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(FORM_ATTRS.LABEL, 'Deep Link Cover')
    fig.getBoundingClientRect = () => rectOf(RECT)
    document.body.appendChild(fig)

    const origPath = window.location.pathname

    window.history.replaceState({}, ATTR_VALUES.EMPTY, '/portfolio/p/deep-link-cover')

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    expect(el._genie).not.toBeNull()

    window.history.replaceState({}, ATTR_VALUES.EMPTY, origPath)
    fig.remove()
  })

  test('figure lookup skips unlabeled and zero-width figures', () => {
    const bare = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)
    const zero = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    bare.setAttribute(FORM_ATTRS.LABEL, '   ')
    zero.setAttribute(FORM_ATTRS.LABEL, 'Zero Size')
    zero.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 10 })
    document.body.appendChild(bare)
    document.body.appendChild(zero)

    const origPath = window.location.pathname

    window.history.replaceState({}, ATTR_VALUES.EMPTY, '/portfolio/p/zero-size')

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    expect(el._genie).not.toBeNull()

    window.history.replaceState({}, ATTR_VALUES.EMPTY, origPath)
    bare.remove()
    zero.remove()
  })

  test('non-element root short-circuits the figure lookup', () => {
    const el = fakeEl()

    el.getRootNode = () => ({})

    expect(startGenieOpen(el, () => {})).toBe(true)

    pump(1)

    expect(el._genie).not.toBeNull()
  })

  test('media figure element supplies the sheet rect when content and item are unmeasured', () => {
    const el = fakeEl({ item: false })
    const content = contentOf(el)

    content.getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    const fig = document.createElement(HTML_TAGS.FIGURE)

    fig.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE
    fig.getBoundingClientRect = () => rectOf(RECT)
    content.appendChild(fig)

    expect(startGenieOpen(el, () => {})).toBe(true)
    pump(1)
    expect(el._genie).not.toBeNull()
  })

  test('aspect-fit fallback supplies the sheet rect with no media elements', () => {
    const el = fakeEl({ item: false })

    contentOf(el).getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    expect(startGenieOpen(el, () => {})).toBe(true)
    pump(1)
    expect(el._genie).not.toBeNull()
  })

  test('the media item supplies the sheet rect when the content box is zero', () => {
    const el = fakeEl()

    contentOf(el).getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    expect(startGenieOpen(el, () => {})).toBe(true)
    pump(1)
    expect(el._genie).not.toBeNull()
  })

  test('figure loop skips label-less figures and falls through to null', () => {
    // No label attribute at all → the `|| EMPTY` + `!label` arms run.
    const unlabeled = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)
    const labeled = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    labeled.setAttribute(FORM_ATTRS.LABEL, 'Other Media')
    document.body.appendChild(unlabeled)
    document.body.appendChild(labeled)

    const origPath = window.location.pathname

    window.history.replaceState({}, ATTR_VALUES.EMPTY, '/portfolio/p/no-such-slug')

    const el = fakeEl()

    expect(startGenieOpen(el, () => {})).toBe(true)

    pump(1)

    expect(el._genie).not.toBeNull()

    window.history.replaceState({}, ATTR_VALUES.EMPTY, origPath)
    unlabeled.remove()
    labeled.remove()
  })

  test('aspect ratio falls back to 1 when mediaHeight is 0', () => {
    const el = fakeEl({ item: false })

    el.mediaHeight = 0
    contentOf(el).getBoundingClientRect = () => rectOf({ x: 0, y: 0, w: 0, h: 0 })

    expect(startGenieOpen(el, () => {})).toBe(true)
    pump(1)
    expect(el._genie).not.toBeNull()
  })

  test('dpr falls back to 1 when devicePixelRatio is 0', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')

    try {
      Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })

      const el = fakeEl()

      expect(startGenieOpen(el, () => {})).toBe(true)

      pump(1)

      expect(el._genie).not.toBeNull()
    } finally {
      if (desc) Object.defineProperty(window, 'devicePixelRatio', desc)
    }
  })

  test('settle skips the _genie clear when another session owns the slot', () => {
    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    el._genie = {}

    // First pump runs measure+attach (the stale-session guard disposes
    // the fresh renderer); the settle lands its terminal frame then
    // tears down one composite later.
    pump(1, 2000)
    pump(1)

    expect(done).toBe(1)
  })

  test('dead-end attach tears down even when _genie was reassigned', async () => {
    gpuEnabled = true
    bridgeResult = null

    // Both backends dead → attach(null) with _genie already reassigned
    // covers the `el._genie === session` false arm: the run must still
    // unveil and run done instead of latching.
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = () => null

    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    pump(1)

    el._genie = {}

    await flushAsync()

    expect(done).toBe(1)
    expect(contentOf(el).classList.contains(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)).toBe(
      false
    )
  })

  test('cancelGenie skips the raf cancel when no frame is armed', () => {
    const el = fakeEl()

    el._genie = { raf: 0, cancelled: false, content: contentOf(el), renderer: null }

    cancelGenie(el)

    expect(el._genie).toBeNull()
  })

  // ── buildGenieSheet — the composited modal-surface texture ────────────

  test('a slug-matched figure supplies the origin while the sheet carries the modal item', () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(FORM_ATTRS.LABEL, 'Deep Link Cover')
    fig.attachShadow({ mode: 'open' })

    const hi = document.createElement(HTML_TAGS.IMG)
    hi.className = MEDIA_CLASSES.RENDER_MEDIA_HIGH
    fig.shadowRoot.appendChild(hi)

    fig.getBoundingClientRect = () => rectOf(RECT)
    document.body.appendChild(fig)

    const origPath = window.location.pathname

    window.history.replaceState({}, ATTR_VALUES.EMPTY, '/portfolio/p/deep-link-cover')

    const el = fakeEl()

    startGenieOpen(el, () => {})

    pump(1)

    const sheet = el._genie.renderer.sheet

    // The baked texture is the composited modal surface; the img item
    // has no dims in happy-dom so it keeps the live-restamp slot.
    expect(sheet).toBeTruthy()
    expect(sheet.media).toBe(
      contentOf(el).querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)
    )

    window.history.replaceState({}, ATTR_VALUES.EMPTY, origPath)
    fig.remove()
  })

  test('a video item keeps the live slot and primes its poster as standby', () => {
    const el = fakeEl()
    const content = contentOf(el)

    const item = content.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

    // Swap the img item for a video carrying a poster.
    const vid = document.createElement(HTML_TAGS.VIDEO)

    vid.className = `${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM} ${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM_VIDEO}`
    vid.setAttribute(MEDIA_ATTRS.POSTER, TEST_URLS.IMG)
    vid.getBoundingClientRect = () => rectOf({ x: 300, y: 40, w: 400, h: 225 })
    content.replaceChild(vid, item)

    startGenieClose(el, () => {})

    pump(1)

    const sheet = el._genie.renderer.sheet

    expect(sheet.media).toBe(vid)
    // the modal video's poster primed an off-DOM Image as the standby.
    expect(sheet.back.src).toBe(TEST_URLS.IMG)
  })

  test('renderer construction throwing resolves to done — never a latched veil', () => {
    document.createElement(HTML_TAGS.CANVAS).constructor.prototype.getContext = function (type) {
      if (String(type) !== WEBGL_STRINGS.CONTEXT_2D) return null

      const ctx = mock2D(this)

      ctx.setTransform = () => {
        throw new Error('dead surface')
      }

      return ctx
    }

    const el = fakeEl()
    let done = 0

    startGenieOpen(el, () => done++)

    pump(1)

    expect(done).toBe(1)
    expect(el._genie).toBeNull()
    expect(canvasesOf(el).length).toBe(0)
  })

  // ── genie-gpu.ts ─────────────────────────────────────────────────────

  test('mountGenieGpu returns null and sweeps overlays on bridge failure', async () => {
    gpuEnabled = true
    bridgeResult = null

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const dead = document.createElement(HTML_TAGS.CANVAS)

    dead.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(dead)

    const r = await mountGenieGpu(canvas, el, RECT, RECT, true)

    expect(r).toBeNull()
    expect(canvasesOf(el).length).toBe(0)
  })

  test('mountGenieGpu pushes rects/flags/tint, uploads media, frames and disposes', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const from = { x: 10, y: 400, w: 100, h: 50 }
    const to = { x: 100, y: 50, w: 400, h: 200 }

    const r = await mountGenieGpu(canvas, el, from, to, true)

    expect(r).not.toBeNull()

    const names = lastWidget.calls.map((c) => c[0])

    expect(names).toContain('set_rects')
    expect(names).toContain('set_flags')

    // nearBottom = from.cy (425) > to.cy (150) → 1
    const flags = lastWidget.calls.find((c) => c[0] === 'set_flags')

    expect(flags[1]).toBe(1)
    expect(flags[2]).toBe(1)

    await flushAsync()

    expect(lastWidget.calls.map((c) => c[0])).toContain('upload_bitmap')

    expect(r.frame(0.016, 0.5)).toBe(true)

    const prog = lastWidget.calls.find((c) => c[0] === 'set_progress')

    expect(prog[1]).toBe(0.5)

    lastWidget.frameResult = false

    expect(r.frame(0.016, 0.6)).toBe(false)

    r.dispose()

    expect(canvasesOf(el).length).toBe(0)
  })

  test('mountGenieGpu on close flips flags and skips tint when no accent resolves', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const from = { x: 10, y: 10, w: 100, h: 50 }
    const to = { x: 100, y: 400, w: 400, h: 200 }

    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => ({ getPropertyValue: () => ATTR_VALUES.EMPTY })

    const r = await mountGenieGpu(canvas, el, from, to, false)

    globalThis.getComputedStyle = origGCS

    const flags = lastWidget.calls.find((c) => c[0] === 'set_flags')

    // nearBottom is direction-free — figure.cy (500) > modal.cy (35) → 1.
    expect(flags[1]).toBe(0)
    expect(flags[2]).toBe(1)
    expect(lastWidget.calls.map((c) => c[0])).not.toContain('set_tint')
    expect(r).not.toBeNull()
  })

  test('upload skips empty thumb and tolerates decode-null bitmaps', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    // 'decode-null' resolves through the cache but decodes to null —
    // covers the `if (bitmap)` guard's skip arm.
    el.thumb = 'decode-null'
    el.source = 'decode-null'

    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    await mountGenieGpu(canvas, el, RECT, RECT, true)
    await flushAsync()

    expect(decodeCalls.length).toBeGreaterThan(0)
    expect(lastWidget.calls.map((c) => c[0])).not.toContain('upload_bitmap')
  })

  test('empty media url short-circuits the fetch', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    el.thumb = ATTR_VALUES.EMPTY
    el.source = ATTR_VALUES.EMPTY

    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    await mountGenieGpu(canvas, el, RECT, RECT, true)
    await flushAsync()

    expect(decodeCalls).toHaveLength(0)
  })

  test('a falsy local url early-returns inside push', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }
    fetchNull = true

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    await mountGenieGpu(canvas, el, RECT, RECT, true)
    await flushAsync()

    expect(decodeCalls).toHaveLength(0)
  })

  test('media dims fall back to the VIDEO_DIMENSIONS defaults when 0', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()

    el.mediaWidth = 0
    el.mediaHeight = 0

    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    await mountGenieGpu(canvas, el, RECT, RECT, true)
    await flushAsync()

    expect(decodeCalls[0][1]).toBe(VIDEO_DIMENSIONS.VIDEO_DEFAULT_WIDTH)
    expect(decodeCalls[0][2]).toBe(VIDEO_DIMENSIONS.VIDEO_DEFAULT_HEIGHT)
  })

  test('a decode rejection is swallowed — no upload, no throw', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }
    decodeRejects = true

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    await mountGenieGpu(canvas, el, RECT, RECT, true)
    await flushAsync()

    expect(lastWidget.calls.map((c) => c[0])).not.toContain('upload_bitmap')
  })

  test('resolved accent pushes set_tint onto the widget', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const origGCS = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => ({ getPropertyValue: () => 'rgb(255, 0, 0)' })

    await mountGenieGpu(canvas, el, RECT, RECT, true)

    globalThis.getComputedStyle = origGCS

    const tint = lastWidget.calls.find((c) => c[0] === 'set_tint')

    expect(tint).toBeTruthy()
    expect(tint[1]).toBe(1)
    expect(tint[4]).toBe(1)
  })

  test('dispose sweeps the worker-route clone siblings too', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const r = await mountGenieGpu(canvas, el, RECT, RECT, true)

    const clone = document.createElement(HTML_TAGS.CANVAS)

    clone.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(clone)

    expect(canvasesOf(el).length).toBe(2)

    r.dispose()

    expect(canvasesOf(el).length).toBe(0)
  })

  // ── uploadSheetTexture — the composited sheet on the GPU path ─────────

  test('a sheet uploads its baked canvas via createImageBitmap', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const tex = document.createElement(HTML_TAGS.CANVAS)
    const bitmap = { width: 1600, height: 1200, close: () => {} }
    const origCIB = globalThis.createImageBitmap

    globalThis.createImageBitmap = () => Promise.resolve(bitmap)

    const sheet = {
      tex,
      ctx: null,
      media: null,
      back: null,
      mediaBox: { x: 0, y: 0, w: 0, h: 0 },
      clipBox: { x: 0, y: 0, w: 0, h: 0 },
      clipRadius: 0,
    }

    await mountGenieGpu(canvas, el, RECT, RECT, true, sheet)
    await flushAsync()

    globalThis.createImageBitmap = origCIB

    const upload = lastWidget.calls.find((c) => c[0] === 'upload_bitmap')

    expect(upload).toBeTruthy()
    expect(upload[1]).toBe(bitmap)
    // The media-file decode path stays cold — the sheet texture won.
    expect(decodeCalls).toHaveLength(0)
  })

  test('a rejected createImageBitmap falls back to the media upload', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    const tex = document.createElement(HTML_TAGS.CANVAS)
    const origCIB = globalThis.createImageBitmap

    globalThis.createImageBitmap = () => Promise.reject(new Error('dead raster'))

    const sheet = {
      tex,
      ctx: null,
      media: null,
      back: null,
      mediaBox: { x: 0, y: 0, w: 0, h: 0 },
      clipBox: { x: 0, y: 0, w: 0, h: 0 },
      clipRadius: 0,
    }

    await mountGenieGpu(canvas, el, RECT, RECT, true, sheet)
    await flushAsync()

    globalThis.createImageBitmap = origCIB

    // The raster died → the media-file decode path took over.
    expect(decodeCalls.length).toBeGreaterThan(0)
  })

  test('a sheet without a texture falls back to the media upload', async () => {
    gpuEnabled = true
    bridgeResult = { ok: true }

    const el = fakeEl()
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    el.shadowRoot.appendChild(canvas)

    await mountGenieGpu(canvas, el, RECT, RECT, true, { tex: null })
    await flushAsync()

    expect(decodeCalls.length).toBeGreaterThan(0)
  })
})
