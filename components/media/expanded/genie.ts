/**
 * @file media/genie.ts
 * @description Expand-modal genie transition — the macOS-style liquid
 * warp replacing the CSS zoom on <media-expanded> open/close. The
 * driver owns the session lifecycle (measure → overlay canvas →
 * backend pick → eased clock → settle/teardown); the draw work lives
 * in the backends: `genie-gpu.ts` (WebGPU/Rust widget when the opt-in
 * layer mounts) and `genie-canvas.ts` (the universal 2D strip-warp —
 * the default on every browser and on mobile).
 *
 * Sequencing: rects are measured before the veil so the warp's source
 * and destination are exact; the modal content keeps its layout under
 * `visibility: hidden` while the overlay paints the media warping
 * between the clicked figure's rect and the modal's media box; on
 * settle the overlay is dropped in the same frame the content unveils,
 * so the swap is seamless. Scroll stays locked by the existing
 * `html.modal-open` rules — the page pin preserves viewport coords,
 * which is what makes the stored origin rect stay valid.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { GENIE_TIMING } from '@core/tokens/motion/genie.js'
import { mediaSlugSeq, slugify } from '@core/utils/index.js'

import { webgpuWidgetsEnabled } from '@core/utils/gpu/webgpu-widget.js'
import store from '@core/store.js'
import { GenieCanvas2D } from './genie-canvas.js'
import { buildGenieSheet } from './genie-texture.js'
import type { GenieSheet } from './genie-texture.js'
import { mountGenieGpu } from './genie-gpu.js'
import { framePool } from '@core/utils/motion/frame.js'
import type { MediaExpanded } from '../MediaExpanded.js'

/** Viewport-space rect the genie field interpolates between. */
export interface GenieRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * One transition backend — `frame` draws the warp at eased funnel
 * progress `f` after `dt` seconds; false reports a dead surface so the
 * driver force-settles instead of latching.
 */
export interface GenieRenderer {
  /**
   * Draws one frame.
   * @param dt Frame delta seconds.
   * @param p Eased funnel progress 0..1 — 0 = the modal sheet, 1 = the
   *   figure funnel (the driver eases + flips it per direction).
   * @returns False on a dead surface.
   */
  frame(dt: number, p: number): boolean
  /** Releases every resource the backend owns (context refs, widget). */
  dispose(): void
}

/**
 * Live session record — stored on `el._genie` so close/destroy paths
 * can cancel mid-flight.
 */
export interface GenieSession {
  /** The pending rAF handle — cancel() stops the clock. */
  raf: number
  /** The veiled content element (visibility kept on bail-out). */
  content: HTMLElement
  /** The active renderer once the backend resolves (null while async-mounting). */
  renderer: GenieRenderer | null
  /** Eased funnel progress — 0 = modal sheet, 1 = figure funnel. */
  p: number
  /** rAF timestamp of the previous frame — dt source. */
  last: number
  /** Session start (ms) — the GENIE_TIMING.MAX_MS watchdog. */
  started: number
  /** Runs once on settle — open: none (unveil suffices); close: teardown. */
  done: () => void
  /** Set on cancel — the async backend pick short-circuits on it. */
  cancelled: boolean
  /** True while opening (origin → modal); false on the collapse. */
  opening: boolean
  /**
   * Set once the first tick ran the measure+mount phase — the backend
   * pick defers there so the rect reads land in a fresh task instead of
   * interleaving with the caller's mount-task writes (forced-reflow
   * governance).
   */
  measured: boolean
  /**
   * The rAF callback — allocated once per session and re-armed every
   * frame (a per-frame `() => tick(el, s)` closure would allocate at
   * 240Hz, violating the zero-allocation frame budget).
   */
  cb: () => void
  /**
   * Set once the converged terminal frame (media exactly on the
   * destination rect) has painted — the next tick tears down. One
   * composite cycle must elapse between the landing draw and the
   * overlay removal or the funnel's last mid-flight frame pops
   * straight to the page: the close-direction "blink".
   */
  landed: boolean
}

/**
 * Overlay device-pixel cap — a fullscreen transition canvas at raw
 * devicePixelRatio triples fill cost on dpr-3 phones; 2 keeps the warp
 * crisp without exceeding the frame budget.
 */
const GENIE_DPR_CAP = 2

/** Fallback origin when no figure resolves — a bottom-center dock sliver. */
const fallbackOrigin = (): GenieRect => ({
  x: window.innerWidth / 2 - 60,
  y: window.innerHeight - 24,
  w: 120,
  h: 8,
})

/**
 * Resolves the origin figure's element for deep-link opens: walks
 * the page's `media-figure` elements in document order applying the
 * same `mediaSlugSeq` numbering the build/deep-link used, and matches
 * the slug trailing the URL. Returns null when no figure matches —
 * the caller then falls back to the stored snapshot or the dock point.
 * @param el The <media-expanded> element (its root scopes the query).
 * @returns The matching <media-figure> element, or null.
 */
const figureForUrl = (el: MediaExpanded): Element | null => {
  const root = el.getRootNode() as ShadowRoot | Document | null

  if (!root || typeof root.querySelectorAll !== TYPE_STRINGS.FUNCTION) return null

  const slug = window.location.pathname.split(CHAR_STRINGS.SLASH).filter(Boolean).pop()

  if (!slug) return null

  const seen = new Map<string, number>()

  const figs = Array.from(root.querySelectorAll(COMPONENT_TAGS.MEDIA_FIGURE))

  for (const fig of figs) {
    const label = fig.getAttribute(FORM_ATTRS.LABEL) || ATTR_VALUES.EMPTY

    if (!label) continue

    if (mediaSlugSeq(seen, label) === slug) return fig
  }

  // Legacy raw-slugify URLs (written before the canonical capped +
  // ordinaled convention) — deferred pass so a raw slug can't shadow a
  // later figure's canonical slug.
  for (const fig of figs) {
    const label = fig.getAttribute(FORM_ATTRS.LABEL) || ATTR_VALUES.EMPTY

    if (label && slugify(label) === slug) return fig
  }

  return null
}

/**
 * The origin figure's live rect — the element resolved by
 * `figureForUrl`, measured in viewport CSS px.
 * @param el The <media-expanded> element.
 * @returns The figure's viewport rect, or null.
 */
const figureRectForUrl = (el: MediaExpanded): GenieRect | null => {
  const fig = figureForUrl(el)

  if (!fig) return null

  const r = fig.getBoundingClientRect()

  return r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
}

/**
 * Resolves the sheet rect — the bounded modal card the warp's texture
 * covers. The `.expand-modal-media-figure` element is the window:
 * reference-faithful, the funnel carries the opaque card (media +
 * frame) while the fullscreen glass veil and viewport chrome fade
 * instead of warping — warping a fullscreen translucent slab read as
 * a flat "mono block". Missing/zero-sized → the media item, then the
 * content root, then a centered aspect-fitted rect so the field still
 * has a valid target.
 * @param el The <media-expanded> element.
 * @param content The modal content root (already resolved upstream).
 * @returns The sheet rect in viewport CSS px.
 */
const sheetRect = (el: MediaExpanded, content: HTMLElement): GenieRect => {
  const item = el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

  const r = [
    el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`)?.getBoundingClientRect(),
    item?.getBoundingClientRect(),
    content.getBoundingClientRect(),
  ].find((c) => c && c.width > 0 && c.height > 0)

  if (r) return { x: r.x, y: r.y, w: r.width, h: r.height }

  // Last resort: center the media's declared aspect inside the viewport.
  const ar = el.mediaHeight > 0 ? el.mediaWidth / el.mediaHeight : 1

  const h = Math.min(window.innerHeight, window.innerWidth / ar)

  return { x: (window.innerWidth - h * ar) / 2, y: (window.innerHeight - h) / 2, w: h * ar, h }
}

/**
 * Resolves the origin rect — stored click snapshot first (it survives
 * the page pin), then the live figure for deep-link opens, then the
 * bottom-center dock point.
 * @param el The <media-expanded> element.
 * @param preferLive True on close — re-measure so a resize while the
 *   modal was open doesn't collapse into stale geometry.
 * @returns The origin rect in viewport CSS px.
 */
const originRect = (el: MediaExpanded, preferLive: boolean): GenieRect => {
  const stored = store.getters.getModal().origin

  // The live figure walk (querySelectorAll + slug sequencing over every
  // media-figure on the page) only runs when its half of the pair is
  // actually needed — a stored click rect answers opens without it.
  const r = preferLive ? figureRectForUrl(el) || stored : stored || figureRectForUrl(el)

  return r && r.w > 0 ? r : fallbackOrigin()
}

/**
 * Removes the overlay + unveils the content — the settle/cancel
 * teardown shared by every exit path. The renderer's dispose() removes
 * its own canvas; the class sweep catches the dead clone the worker
 * route can leave in the DOM slot after a failed transfer.
 * @param s The session.
 * @param el The <media-expanded> element — shadow scope for the sweep.
 */
const teardownOverlay = (s: GenieSession, el: MediaExpanded): void => {
  s.renderer?.dispose()

  s.renderer = null

  el.shadowRoot
    ?.querySelectorAll(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS}`)
    .forEach((c) => c.remove())

  s.content.classList.remove(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)
}

/**
 * The funnel clock — `raw = elapsed/duration` mapped linearly:
 * `p = opening ? 1−raw : raw`. No global easing — the reference is
 * linear-time by design; the motion character lives entirely in the
 * per-row staggered eases (x rows ease-in-out, y rows ease-in so the
 * collapse accelerates into the card — the dock suck). The open runs
 * the identical field in time-reverse so both directions share one
 * liquid surface. dt is clamped to 50ms so a suspended tab resumes
 * with a finite step instead of a lurch; MAX_MS force-settles
 * so a wedged rAF can never latch the overlay. On settle the overlay
 * drops and the content unveils in the same task, then `done` runs
 * (open: no-op; close: the modal teardown).
 * @param el The <media-expanded> element.
 * @param s The session.
 */
const tick = (el: MediaExpanded, s: GenieSession): void => {
  const now = performance.now()

  const dt = Math.min(GENIE_TIMING.DT_MAX_S, Math.max(0, (now - s.last) / 1000))

  s.last = now

  // The queued id is consumed — clearing it keeps cancelGenie honest:
  // a same-task cancel targets nothing, and a mid-tick throw leaves the
  // field at 0 so startGenie's cancelGenie resolves cleanly instead of
  // carrying a dead id into the new session.
  s.raf = 0

  // First frame: the measure+mount phase runs here — inside a rAF task
  // the rect reads are the task's first reads (never interleaved with
  // the mount task's writes), and the overlay canvas' append feeds the
  // backends directly. A dead/late backend resolves the session inline.
  if (!s.measured) {
    s.measured = true

    try {
      measureAttach(el, s)
    } catch {
      // A throw mid-measure (rect reads, canvas build, backend pick)
      // would otherwise latch the veil + overlay forever — resolve the
      // run through the same path as attach's dead backend: unveil,
      // drop the overlay, settle.
      s.cancelled = true

      if (el._genie === s) el._genie = null

      teardownOverlay(s, el)

      s.done()

      return
    }

    // attach() may have resolved the run already (cancelled session or
    // no backend) — its dead path flags the session cancelled; nothing
    // more to schedule. A merely-reassigned `_genie` keeps ticking so
    // the settle path still unveils and runs `done`.
    if (s.cancelled) return
  }

  const raw = Math.min(
    1,
    Math.max(0, (now - s.started) / (s.opening ? GENIE_TIMING.OPEN_MS : GENIE_TIMING.CLOSE_MS))
  )

  s.p = s.opening ? 1 - raw : raw

  const settled = raw >= 1 || now - s.started > GENIE_TIMING.MAX_MS || !el.isConnected

  // A renderer that returns false is dead by contract; one that THROWS
  // (a wasm boundary call escaping before its false path — device loss
  // mid-frame) is dead the same way. Without the catch the exception
  // would escape the pooled tick and latch veil + overlay permanently.
  let alive: boolean

  try {
    alive = s.renderer?.frame(dt, s.p) !== false
  } catch {
    alive = false
  }

  // Terminal landing frame — when the clock crosses 1, the frame just
  // drawn is the converged pose (the media exactly on the destination
  // rect). It must composite once before the overlay drops: settling in
  // the same tick used to remove the canvas without ever painting p=1,
  // so the last visible frame was a mid-flight funnel snapping straight
  // to the page — the close blink. The landed flag tears down on the
  // next tick, one composite later, over the identical real surface.
  if (settled && !s.landed && alive && el.isConnected) {
    s.landed = true

    s.raf = framePool.request(s.cb)

    return
  }

  if (settled || !alive) {
    if (el._genie === s) el._genie = null

    teardownOverlay(s, el)

    s.done()

    return
  }

  s.raf = framePool.request(s.cb)
}

/**
 * Starts a genie run: veils the content and arms the eased clock.
 * Rect measurement, canvas creation and the backend pick (WebGPU
 * widget when the opt-in layer is enabled and mounts, otherwise the
 * universal 2D warp) all run inside the first `tick` frame — deferred
 * so the transition's layout reads land in a fresh task instead of
 * interleaving with the caller's mount-task writes (write → read →
 * write → read is the forced-reflow pattern the governance gate
 * forbids); it also means the warp always measures the modal in its
 * fully-styled post-mount state.
 *
 * Contract: returns false only when the transition cannot start at
 * all (reduced motion, missing shadow/content) — the caller then runs
 * its instant/CSS fallback. Once true is returned the session owns the
 * outcome: a backend that dies before the first frame resolves to
 * `done` (open: instant unveil; close: instant teardown) rather than
 * latching.
 * @param el The <media-expanded> element.
 * @param opening True for open (origin → modal), false for close.
 * @param done Settle callback — open: no-op; close: modal teardown.
 * @returns False when the transition cannot start — caller falls back.
 */
const startGenie = (el: MediaExpanded, opening: boolean, done: () => void): boolean => {
  if (
    !el.shadowRoot ||
    store.getters.getReducedMotion() ||
    typeof document === TYPE_STRINGS.UNDEFINED
  ) {
    return false
  }

  const content = el.$(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_CONTENT}`)

  if (!content) return false

  cancelGenie(el)

  const now = performance.now()

  const session: GenieSession = {
    raf: 0,
    content,
    renderer: null,
    p: opening ? 1 : 0,
    last: now,
    started: now,
    done,
    cancelled: false,
    opening,
    measured: false,
    cb: () => tick(el, session),
    landed: false,
  }

  el._genie = session

  // Open: the veil lands synchronously — mount + veil run in the same
  // task, so the unwarped surface never paints (the veil and the
  // canvas's first frame present together). Close: the veil defers to
  // the backend attach — the modal keeps painting until the warp can
  // replace it in the same task, so a late backend (async GPU mount,
  // delayed rAF under load) shows the still-open modal instead of a
  // blank gap that reads as a blink.
  if (opening) {
    content.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)
  }

  session.raf = framePool.request(session.cb)

  return true
}

/**
 * The first-frame measure+mount phase — runs inside `tick`'s rAF task
 * where the transition's rect/dpr/viewport reads are the task's first
 * reads. Measures the field, creates the overlay canvas, picks the
 * backend and attaches it to the session.
 * @param el The <media-expanded> element.
 * @param s The live session (opening flag carried on it).
 */
const measureAttach = (el: MediaExpanded, session: GenieSession): void => {
  const from = session.opening ? originRect(el, false) : sheetRect(el, session.content)

  const to = session.opening ? sheetRect(el, session.content) : originRect(el, true)

  const dpr = Math.min(GENIE_DPR_CAP, window.devicePixelRatio || 1)

  const vw = window.innerWidth

  const vh = window.innerHeight

  const dark = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

  // The composited modal surface — one bake shared by every backend
  // and reused across the modal's open→close pair (the close run is
  // geometrically identical to the open's, so rebaking would pay the
  // same layout reads for an identical texture). The key is
  // (content, dpr, viewport, theme): a re-render, zoom, resize or
  // theme flip all miss and rebake; media-swap/loaded-state paths
  // invalidate el._genieSheet explicitly. A failed bake is never
  // cached — the next session retries.
  let sheet: GenieSheet | null = null

  const cached = el._genieSheet

  if (
    cached &&
    cached.content === session.content &&
    cached.dpr === dpr &&
    cached.vw === vw &&
    cached.vh === vh &&
    cached.dark === dark
  ) {
    sheet = cached.sheet
  } else {
    try {
      sheet = buildGenieSheet(session.content, dpr)
    } catch {
      sheet = null
    }

    if (sheet) el._genieSheet = { content: session.content, dpr, vw, vh, dark, sheet }
  }

  /**
   * Attaches a resolved backend mid-flight — the spring has already
   * progressed, so the warp picks up seamlessly. A dead/null backend
   * resolves the run to `done` (instant unveil/teardown) rather than
   * latching the overlay. Each backend owns its canvas and removes it
   * inside dispose().
   * @param renderer The backend, or null when none could initialize.
   */
  const attach = (renderer: GenieRenderer | null): void => {
    if (session.cancelled) {
      renderer?.dispose()

      return
    }

    // Stale real-renderer guard — an async GPU mount can resolve after
    // the session already settled or was replaced. Attaching there
    // would veil the content under a dead session and leak the canvas,
    // so the renderer is disposed and attach bails. A null resolution
    // still falls through to the dead-end teardown below: the run must
    // unveil and run `done` even when `_genie` was reassigned.
    if (renderer && el._genie !== session) {
      renderer.dispose()

      return
    }

    // Dead backend or a host that detached while the async mount was
    // resolving — resolve the run the same way: drop the pending frame,
    // unveil, drop the overlay, then `done`. Skipping this would latch
    // the session until the (still-armed) tick noticed, and `done`
    // would fire a frame late.
    if (!el.isConnected || !renderer) {
      renderer?.dispose()

      // Flag cancelled so the arming tick bails — the run is resolved
      // even when another session already owns `el._genie`.
      session.cancelled = true

      if (el._genie === session) el._genie = null

      framePool.cancel(session.raf)

      teardownOverlay(session, el)

      session.done()

      return
    }

    // Close-direction veil — deferred from startGenie so the modal
    // stays painted until the warp is drawable; the class write lands
    // in the same task as the renderer attach, so the swap into the
    // first drawn frame is atomic.
    if (!session.opening) {
      session.content.classList.add(EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_VEIL)
    }

    // The eased clock anchors at attach — the first drawable frame.
    // `started` was stamped at startGenie, but the rAF loop can run
    // late under main-thread load (or while an async GPU mount
    // resolves); leaving it there would jump the first painted frame
    // to mid-progress — the "blink" the field reports under heavy
    // animation load.
    session.started = performance.now()

    session.renderer = renderer
  }

  /**
   * The overlay canvas factory — fullscreen, device-px capped. The
   * `attach` flag controls the shadow append: the GPU/worker route
   * needs the canvas in the DOM before transferToOffscreen, while the
   * 2D route builds its renderer detached so the ctor's style reads
   * can't force a layout against the just-appended canvas — the
   * append lands after every read, keeping the task to one flush.
   * @param attach Whether to append the canvas to the host shadow.
   */
  const makeCanvas = (attach: boolean): HTMLCanvasElement => {
    const c = document.createElement(HTML_TAGS.CANVAS)

    c.className = EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS
    c.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
    c.width = Math.max(1, Math.round(vw * dpr))
    c.height = Math.max(1, Math.round(vh * dpr))

    if (attach) el.shadowRoot?.appendChild(c)

    return c
  }

  /**
   * The universal 2D backend — acquires the context and wraps the
   * strip-warp renderer. The canvas stays detached through context
   * acquisition and renderer construction so the ctor's
   * getComputedStyle reads don't force layout against a just-appended
   * node; the append lands last (no reads after it, so no flush).
   * Null when the canvas refuses a 2D context or the renderer
   * construction throws — a hard throw here must never latch the
   * veil, so construction is wrapped; on failure the session
   * resolves to `done` via attach(null).
   */
  const canvas2d = (): GenieRenderer | null => {
    const canvas = makeCanvas(false)

    try {
      const ctx = canvas.getContext(WEBGL_STRINGS.CONTEXT_2D, { desynchronized: true })

      if (!ctx) return null

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const renderer = new GenieCanvas2D(canvas, ctx, sheet, from, to, session.opening, el)

      el.shadowRoot?.appendChild(canvas)

      return renderer
    } catch {
      return null
    }
  }

  if (webgpuWidgetsEnabled()) {
    // Race the async GPU mount against the universal 2D backend. A
    // wasm/shader compile under main-thread throttle can outlast the
    // whole transition — waiting for it stalls the warp into the
    // watchdog's instant-settle (the reported "blink"). The 2D path
    // runs the identical field and attaches instantly, so it owns the
    // session when the mount exceeds MOUNT_MS; a late-resolving GPU
    // renderer is disposed rather than swapped mid-flight.
    let gpuSettled = false

    mountGenieGpu(makeCanvas(true), el, from, to, session.opening, sheet)
      .then((renderer) => {
        gpuSettled = true

        if (session.renderer) {
          renderer?.dispose()

          return
        }

        attach(renderer || canvas2d())
      })
      .catch(() => {
        gpuSettled = true

        if (!session.renderer) attach(canvas2d())
      })

    setTimeout(() => {
      if (!gpuSettled && !session.renderer) attach(canvas2d())
    }, GENIE_TIMING.MOUNT_MS)
  } else {
    attach(canvas2d())
  }
}

/**
 * Open transition — warps the media from the clicked figure's rect
 * into the modal's media box.
 * @param el The <media-expanded> element.
 * @param done Settle callback (the unveil already happened internally).
 * @returns False when the transition cannot start — caller falls back.
 */
export const startGenieOpen = (el: MediaExpanded, done: () => void): boolean =>
  startGenie(el, true, done)

/**
 * Close transition — collapses the media from the modal box back into
 * the origin figure.
 * @param el The <media-expanded> element.
 * @param done Settle callback — the modal teardown (URL/dialog/scroll).
 * @returns False when the transition cannot start — caller falls back.
 */
export const startGenieClose = (el: MediaExpanded, done: () => void): boolean =>
  startGenie(el, false, done)

/**
 * Cancels a live session — the overlay drops and the content unveils
 * immediately; `done` does NOT run (the caller keeps control).
 * @param el The <media-expanded> element.
 */
export const cancelGenie = (el: MediaExpanded): void => {
  const s = el._genie

  if (!s) return

  s.cancelled = true

  el._genie = null

  if (s.raf) framePool.cancel(s.raf)

  teardownOverlay(s, el)
}
