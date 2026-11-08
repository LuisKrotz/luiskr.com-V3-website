/**
 * @file anim-demo/widgets.ts — live-widget demo drivers. Each mount
 * instantiates the REAL widget class the production surfaces use, on the
 * demo stage's canvas, then replays its interactive states on a cycle
 * (the widget's own public hooks — setOpen/setHover/toggle/setTheme —
 * so the demo shows exactly what a pointer would drive). Widgets keep
 * their own fallbacks: no WebGL / wasm mount failure / reduced motion
 * all degrade the same way production does.
 */

import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { THEME } from '@core/tokens/theme/theme.js'
import { SWITCH_TYPES } from '@core/tokens/theme/switches.js'
import { LANG_OPTIONS } from '@core/i18n.js'
import { BurgerButtonWebGL } from '@core/utils/canvas/widgets/burger-button-webgl.js'
import { MenuBackgroundWebGL } from '@core/utils/canvas/loaders/menu-background-webgl.js'
import { FlagWebGL } from '@core/utils/canvas/widgets/flag-webgl.js'
import { SwitchWebGL } from '@core/utils/canvas/widgets/switch-slider.js'
import { ThemeSliderWebGL } from '@core/utils/canvas/widgets/theme-slider.js'
import { CloseButtonWebGL } from '@core/utils/canvas/widgets/close-button.js'
import { cycle, DEMO_BEAT_MS, DEMO_BEAT_LONG_MS } from './cycle.js'
import type { DemoContext } from './types.js'

/** Theme stops the slider demo walks (dark → system → light, production order). */
const _THEME_STOPS: readonly string[] = [THEME.DARK, THEME.SYSTEM, THEME.LIGHT]

/**
 * Finds the stage's widget canvas — the stages render exactly one.
 * @param stage The demo stage root.
 * @returns The canvas element, or null.
 */
const stageCanvas = (stage: HTMLElement): HTMLCanvasElement | null =>
  stage.querySelector<HTMLCanvasElement>(HTML_TAGS.CANVAS)

/**
 * Nav burger → ✕ liquid morph — the real BurgerButtonWebGL, cycling
 * hover-pool → open morph → calm-X → close, the four beats the nav
 * drives with pointer + menu state.
 * @param ctx The demo context (stage owns the icon canvas).
 * @returns Teardown — stops the cycle and destroys the widget.
 */
export const mountBurger = ({ stage }: DemoContext): (() => void) => {
  const widget = new BurgerButtonWebGL(stageCanvas(stage) as HTMLCanvasElement)

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
  const widget = new MenuBackgroundWebGL(stageCanvas(stage) as HTMLCanvasElement)

  widget.start()

  const stop = cycle(DEMO_BEAT_LONG_MS, [() => widget.release(), () => widget.start()])

  return () => {
    stop()
    widget.destroy()
  }
}

/**
 * Locale flag — the real FlagWebGL waving the first LANG_OPTIONS entry.
 * The wave is the whole animation; no state cycle needed.
 * @param ctx The demo context (stage owns the flag canvas).
 * @returns Teardown — destroys the widget.
 */
export const mountFlag = ({ stage }: DemoContext): (() => void) => {
  const canvas = stageCanvas(stage) as HTMLCanvasElement

  let index = 0

  let widget = new FlagWebGL(canvas, LANG_OPTIONS[index])

  // The flag contract is per-widget (option binds at construction), so
  // the locale walk destroys + rebuilds — the canvas persists, the pool
  // bookkeeping follows the same element, and each flag's pop-in plays
  // on the rebuild just like the nav's locale-swap remount.
  const stop = cycle(
    DEMO_BEAT_LONG_MS,
    [
      () => {
        index = (index + 1) % LANG_OPTIONS.length
        widget.destroy()
        widget = new FlagWebGL(canvas, LANG_OPTIONS[index])
      },
    ],
    false
  )

  return () => {
    stop()
    widget.destroy()
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
  const widget = new SwitchWebGL(
    stageCanvas(stage) as HTMLCanvasElement,
    SWITCH_TYPES.STATS,
    false,
    null
  )

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
  const widget = new ThemeSliderWebGL(stageCanvas(stage) as HTMLCanvasElement, THEME.DARK, null)

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
  const widget = new CloseButtonWebGL(stageCanvas(stage) as HTMLCanvasElement, null)

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
