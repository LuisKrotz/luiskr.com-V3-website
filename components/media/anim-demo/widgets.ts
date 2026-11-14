/**
 * @file anim-demo/widgets.ts — live-widget demo drivers. Each mount
 * instantiates the REAL widget class the production surfaces use, on the
 * demo stage's canvas, then replays its interactive states on a cycle
 * (the widget's own public hooks — setOpen/setHover/toggle —
 * so the demo shows exactly what a pointer would drive). Widgets keep
 * their own fallbacks: no WebGL / wasm mount failure / reduced motion
 * all degrade the same way production does.
 */

import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { THEME } from '@core/tokens/theme/theme.js'
import { SWITCH_TYPES } from '@core/tokens/theme/switches.js'
import { LANG_OPTIONS } from '@core/i18n.js'
import { BurgerButtonWebGL } from '@core/utils/canvas/widgets/burger-button-webgl.js'
import { MenuBackgroundWebGL } from '@core/utils/canvas/loaders/menu-background-webgl.js'
import { FlagWebGL } from '@core/utils/canvas/widgets/flag-webgl.js'
import { SwitchWebGL } from '@core/utils/canvas/widgets/switch-slider.js'
import { ThemeSliderWebGL } from '@core/utils/canvas/widgets/theme-slider.js'
import { CloseButtonWebGL } from '@core/utils/canvas/widgets/close-button.js'
import { webglPool } from '@core/utils/canvas/webgl-pool.js'
import { cycle, DEMO_BEAT_MS, DEMO_BEAT_LONG_MS } from './cycle.js'
import type { DemoContext } from './types.js'

/** Theme stops the demo walks — the production order (dark → system → light). */
const _THEME_STOPS: readonly string[] = [THEME.DARK, THEME.SYSTEM, THEME.LIGHT]

/**
 * Finds the stage's widget canvas — the stages render exactly one per
 * widget demo (the flag row queries its own NodeList instead).
 * @param stage The demo stage root.
 * @returns The canvas element, or null.
 */
const stageCanvas = (stage: HTMLElement): HTMLCanvasElement | null =>
  stage.querySelector<HTMLCanvasElement>(HTML_TAGS.CANVAS)

/**
 * Detaches a demo widget's canvas from the shared WebGL context pool.
 * Production registers every widget canvas so offscreen surfaces can be
 * purged — but purge deliberately destroys the context and the
 * re-entry restore can land on a canvas whose re-probe resolves after
 * the async `webglcontextrestored` event, stranding the widget on its
 * CSS fallback forever. On the /animations route the showcase IS the
 * consumer: the stage's own IntersectionObserver already mounts the
 * widget only inside a 100px viewport band, so the pool reclaim buys
 * nothing here — and a demo that can be scrolled away mid-purge must
 * never come back blank. The widgets still degrade normally at mount
 * (no WebGL → their own is-fallback contract paints the CSS art);
 * unpool only removes the mid-life purge/restore cycle.
 * @param canvas The stage's widget canvas.
 */
const unpool = (canvas: HTMLCanvasElement): void => {
  webglPool.unregister(canvas)
}

/**
 * Arms a demo canvas for the print adapter's capture handshake: on
 * `printcapture` the widget repaints one frame into its GL buffer so the
 * synchronous toDataURL read that follows has real pixels (the widgets
 * render with preserveDrawingBuffer:false, so without the repaint the
 * still would be a transparent blank).
 * @param canvas Stage demo canvas.
 * @param repaint Zero-arg frame repaint the armed canvas calls per capture —
 *   returning false declines the still (unpainted async mount).
 */
export const armPrintCapture = (canvas: HTMLCanvasElement, repaint: () => void | boolean): void => {
  canvas.addEventListener(PRINT_EVENTS.CAPTURE, (e) => {
    // A canvas that fell back after arming (GL lost late) or whose
    // surface never initialized (async wasm/GL mount still in flight
    // when a menu-print capture lands) has no honest buffer — decline
    // the stamp so the adapter skips the still instead of serializing
    // transparency into a blank box. The stage's CSS fallback owns the
    // print paint in that slot.
    if (canvas.classList.contains(STATE_CLASSES.IS_FALLBACK) || repaint() === false) {
      ;(e as CustomEvent<{ skip?: boolean }>).detail.skip = true

      return
    }

    ;(e as CustomEvent<{ dataUrl?: string }>).detail.dataUrl = canvas.toDataURL(
      NET_STRINGS.IMAGE_PNG
    )
  })
}

/**
 * Nav burger → ✕ liquid morph — the real BurgerButtonWebGL, cycling
 * hover-pool → open morph → calm-X → close, the four beats the nav
 * drives with pointer + menu state.
 * @param ctx The demo context (stage owns the icon canvas).
 * @returns Teardown — stops the cycle and destroys the widget.
 */
export const mountBurger = ({ stage }: DemoContext): (() => void) => {
  const canvas = stageCanvas(stage) as HTMLCanvasElement

  const widget = new BurgerButtonWebGL(canvas)

  unpool(canvas)

  // GL acquisition is synchronous but the class isn't the whole story —
  // a widget mid async-init (wasm pending) can be unflagged yet
  // unpaintable; without a surface the still serializes transparency.
  armPrintCapture(canvas, () => {
    if (!widget.gl) return false

    widget._drawFrame(0)

    return true
  })

  const stop = cycle(DEMO_BEAT_MS, [
    () => widget._setHover(1),
    () => widget.setOpen(true),
    () => widget._setHover(0),
    () => widget.setOpen(false),
  ])

  return () => {
    stop()
    widget.destroy()
  }
}

/**
 * Nav menu backdrop — the real MenuBackgroundWebGL contour field:
 * start() reveals it exactly like menu-open; release() dissolves it.
 * The cycle alternates the two so the reveal ease replays forever.
 * @param ctx The demo context (stage owns the fullscreen canvas).
 * @returns Teardown — stops the cycle and destroys the widget.
 */
export const mountMenuBackground = ({ stage }: DemoContext): (() => void) => {
  const canvas = stageCanvas(stage) as HTMLCanvasElement

  const widget = new MenuBackgroundWebGL(canvas)

  // A menu that never opened has _revealTarget 0 — tickReveal would snap
  // the still's field back to invisible. The reference still depicts the
  // OPEN backdrop: settle the ease before the frame paints. No GL/wasm
  // surface → decline (async mount window is unflagged yet unpaintable).
  armPrintCapture(canvas, () => {
    if (!widget.gl && !widget._wasm) return false

    widget._sampleTheme()
    widget._revealTarget = 1
    widget._revealDur = 0
    widget._renderFrame(0)

    return true
  })

  // start() re-registers the canvas on every call (production: each
  // menu open) — every reveal must be followed by the same unpool.
  const start = () => {
    widget.start()
    unpool(canvas)
  }

  start()

  const stop = cycle(DEMO_BEAT_LONG_MS, [() => widget.release(), start])

  return () => {
    stop()
    widget.destroy()
  }
}

/**
 * Locale flag row — one real FlagWebGL per LANG_OPTIONS entry, so the
 * record lists every flag the widget serves instead of sampling one
 * locale at a time. The wave is the whole animation; no state cycle.
 * Each widget shares the pooled flag renderer (refcounted acquire), so
 * the row costs sixteen small 2D canvases and one shared GL surface.
 * The flags keep their pool registration: purge/restore is honest for
 * them — the canvas only ever binds '2d', so re-entry re-acquisition
 * can't strand on the async WebGL restore the quad widgets hit.
 * @param ctx The demo context (stage owns the flags row).
 * @returns Teardown — destroys every mounted flag widget.
 */
export const mountFlag = ({ stage }: DemoContext): (() => void) => {
  const canvases = Array.from(stage.querySelectorAll<HTMLCanvasElement>(HTML_TAGS.CANVAS))

  const widgets = canvases.map((canvas, i) => {
    // Canvas count decides the list: a full row maps LANG_OPTIONS 1:1;
    // a hand-built stage with fewer canvases wraps the options.
    const widget = new FlagWebGL(canvas, LANG_OPTIONS[i % LANG_OPTIONS.length])

    // The wasm/shared-renderer mount resolves async — a flag that never
    // finished loading has no honest frame (renderStaticFlag's own
    // readiness guard), so the handshake declines and the stage's <img>
    // twin carries the print paint instead of a transparent still.
    armPrintCapture(canvas, () => {
      if (!widget.useWebGL || !widget.isLoaded) return false

      widget._renderStatic()

      return true
    })

    return widget
  })

  return () => {
    widgets.forEach((widget) => widget.destroy())
  }
}

/**
 * Preference switch — the real SwitchWebGL ('stats' context, the ECG
 * variant) toggling itself on the cycle the preferences panel's pointer
 * would.
 * @param ctx The demo context (stage owns the switch canvas).
 * @returns Teardown — stops the cycle and destroys the widget.
 */
export const mountSwitch = ({ stage }: DemoContext): (() => void) => {
  const canvas = stageCanvas(stage) as HTMLCanvasElement

  const widget = new SwitchWebGL(canvas, SWITCH_TYPES.STATS, false, null)

  unpool(canvas)

  // No GL/wasm surface → decline — the stage's CSS fallback owns the
  // print paint (the async mount window is unflagged yet unpaintable).
  armPrintCapture(canvas, () => {
    if (!widget.gl && !widget._wasm) return false

    widget._renderStatic()

    return true
  })

  const stop = cycle(DEMO_BEAT_LONG_MS, [() => widget.toggle()])

  return () => {
    stop()
    widget.destroy()
  }
}

/**
 * Theme slider — the real ThemeSliderWebGL walking the dark → system →
 * light stops via its own setTheme() spring. The onThemeChange callback
 * stays null: the demo animates the track without touching the site's
 * real theme preference.
 * @param ctx The demo context (stage owns the theme canvas).
 * @returns Teardown — stops the cycle and destroys the widget.
 */
export const mountTheme = ({ stage }: DemoContext): (() => void) => {
  const canvas = stageCanvas(stage) as HTMLCanvasElement

  const widget = new ThemeSliderWebGL(canvas, THEME.DARK, null)

  unpool(canvas)

  // The demo cycles dark → system → light; wherever the cycle sits at
  // capture time, paper needs the LIGHT stop (dark-state strokes read
  // as a blank on white). renderStatic snaps currentP to targetP, so
  // the drawn frame is the settled light pose. No GL/wasm surface →
  // decline — the async mount window is unflagged yet unpaintable.
  armPrintCapture(canvas, () => {
    if (!widget.gl && !widget._wasm) return false

    widget.setTheme(THEME.LIGHT)
    widget._renderStatic()

    return true
  })

  let stop = 0

  const stopCycle = cycle(DEMO_BEAT_LONG_MS, [
    () => {
      stop = (stop + 1) % _THEME_STOPS.length
      widget.setTheme(_THEME_STOPS[stop] as string)
    },
  ])

  return () => {
    stopCycle()
    widget.destroy()
  }
}

/**
 * Modal close ✕ — the real CloseButtonWebGL cycling hover-fill (+ the
 * occasional click shockwave) exactly like a pointer would.
 * @param ctx The demo context (stage owns the close canvas).
 * @returns Teardown — stops the cycle and destroys the widget.
 */
export const mountClose = ({ stage }: DemoContext): (() => void) => {
  const canvas = stageCanvas(stage) as HTMLCanvasElement

  const widget = new CloseButtonWebGL(canvas, null)

  unpool(canvas)

  armPrintCapture(canvas, () => {
    if (!widget.gl && !widget._wasm) return false

    widget._renderStatic()

    return true
  })

  let beat = 0

  const stop = cycle(DEMO_BEAT_MS, [
    () => {
      beat = (beat + 1) % 4
      widget.setHover(beat < 2)

      if (beat === 2) widget.triggerClick()
    },
  ])

  return () => {
    stop()
    widget.destroy()
  }
}
