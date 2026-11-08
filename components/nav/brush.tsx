/**
 * @file nav-brush.tsx
 * @description The neon paintbrush glyph for <app-nav>'s preferences chip —
 * a diagonal brush: violet-to-orange shaft, chrome ferrule, a magenta-to-
 * orange bristle tip, a looping paint swoosh that sweeps around the tip
 * (a second, fainter ring counter-rotates through it), and twinkling
 * sparkles plus droplets. Colors come from the nav neon tokens; motion
 * lives in nav-icons.scss so it runs inside this element's shadow root.
 * Isolated component — registers its own tag.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'
import { NAV_SEARCH_IDS } from '@core/tokens/ids/app.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SVG_STRINGS } from '@core/tokens/strings/svg.js'
import { BaseComponent } from '@core/Component.js'
import { h } from '@core/jsx.js'
import iconStyles from '@core/sass/components/nav/nav-icons.scss?tiers'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { mountNavGlyph, type NavGlyphSession } from '@core/utils/wasm/nav-glyph.js'

// ── Brush geometry (48×48 viewBox units) ─────────────────────────────
const SHAFT = { x1: 37, y1: 9, x2: 24, y2: 24 }
const FERRULE = { x1: 24, y1: 24, x2: 19, y2: 29 }
const TIP_PATH = 'M20 27 C16 30 12 35 9 41 C15 42 21 39 25 33 Z'
const SWOOSH_PATH = 'M4 35 C10 47 31 47 39 34 C45 24 41 13 30 11'
const SWOOSH_ALT_PATH = 'M9 21 C17 9 35 6 43 17'
const SPARKLES = [
  { x: 40, y: 34, r: 3 },
  { x: 7, y: 17, r: 2.4 },
  { x: 43, y: 8, r: 2.2 },
]
const DROPS = [
  { x: 33, y: 40 },
  { x: 13, y: 22 },
  { x: 44, y: 22 },
]

/** `stop` bound to a --nav-neon-* CSS prop — presentation attributes can't
 * resolve custom properties, so the value rides inline style. */
const stop = (offset: number, prop: string) => (
  <stop offset={offset} style={`stop-color: var(${prop})`} />
)

/** `url(#id)` helper for gradient references. */
const ref = (id: string) => `url(#${id})`

/**
 * Four-point sparkle star centered at (x, y) with arm radius r — quadratic
 * curves pinched through the center give the thin twinkle shape.
 * @param x center x in viewBox units
 * @param y center y in viewBox units
 * @param r arm radius in viewBox units
 * @returns SVG path data for the star
 */
const star = (x: number, y: number, r: number): string =>
  `M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`

/**
 * The <nav-brush-icon> element — the neon paintbrush. Shaft runs violet to
 * orange along its length; the bristle tip runs magenta to orange; the
 * swoosh carries the full violet-magenta-orange sweep the reference uses.
 */
export class NavBrushIcon extends BaseComponent {
  protected override _componentStyles = iconStyles

  /** Live wasm swoosh emitter — null until the module loads (CSS loops stay). */
  private _glyph: NavGlyphSession | null = null

  /** Starts the wasm swoosh emitter on the brush's canvas. */
  override onMounted() {
    void mountNavGlyph(this, NAV_GLYPH.KIND_SWOOSH, [
      NAV_SEARCH_CSS_PROPS.NEON_VIOLET,
      NAV_SEARCH_CSS_PROPS.NEON_ORANGE,
    ]).then((session) => {
      if (this.isConnected) this._glyph = session
      else session?.destroy()
    })
  }

  /** Releases the emitter's listeners, frame loop and wasm memory. */
  override onDestroy() {
    this._glyph?.destroy()
    this._glyph = null
  }

  override render() {
    return (
      <span className={NAV_CLASSES.NAV_GLYPH_HOST}>
        <svg
          className={NAV_CLASSES.NAV_BRUSH_SVG}
          viewBox="0 0 48 48"
          aria-hidden={ATTR_VALUES.TRUE}
          focusable={ATTR_VALUES.FALSE}
        >
          <defs>
            <linearGradient
              id={NAV_SEARCH_IDS.SHAFT}
              gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
              x1={SHAFT.x1}
              y1={SHAFT.y1}
              x2={SHAFT.x2}
              y2={SHAFT.y2}
            >
              {stop(0, NAV_SEARCH_CSS_PROPS.NEON_ORANGE)}
              {stop(1, NAV_SEARCH_CSS_PROPS.NEON_VIOLET)}
            </linearGradient>
            <linearGradient
              id={NAV_SEARCH_IDS.FERRULE}
              gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
              x1={FERRULE.x1}
              y1={FERRULE.y1}
              x2={FERRULE.x2}
              y2={FERRULE.y2}
            >
              {stop(0, NAV_SEARCH_CSS_PROPS.NEON_CHROME)}
              {stop(1, NAV_SEARCH_CSS_PROPS.NEON_VIOLET)}
            </linearGradient>
            <linearGradient
              id={NAV_SEARCH_IDS.TIP}
              gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
              x1="9"
              y1="41"
              x2="25"
              y2="27"
            >
              {stop(0, NAV_SEARCH_CSS_PROPS.NEON_MAGENTA)}
              {stop(1, NAV_SEARCH_CSS_PROPS.NEON_ORANGE)}
            </linearGradient>
            <linearGradient
              id={NAV_SEARCH_IDS.SWOOSH}
              gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
              x1="4"
              y1="40"
              x2="41"
              y2="14"
            >
              {stop(0, NAV_SEARCH_CSS_PROPS.NEON_VIOLET)}
              {stop(0.5, NAV_SEARCH_CSS_PROPS.NEON_MAGENTA)}
              {stop(1, NAV_SEARCH_CSS_PROPS.NEON_ORANGE)}
            </linearGradient>
          </defs>

          <path
            className={NAV_CLASSES.NAV_ICON_SWOOSH_ALT}
            d={SWOOSH_ALT_PATH}
            fill={ATTR_VALUES.NONE}
            stroke={ref(NAV_SEARCH_IDS.SWOOSH)}
            stroke-width="1.4"
            stroke-linecap="round"
          />

          <path
            className={NAV_CLASSES.NAV_ICON_SWOOSH}
            d={SWOOSH_PATH}
            fill={ATTR_VALUES.NONE}
            stroke={ref(NAV_SEARCH_IDS.SWOOSH)}
            stroke-width="3.2"
            stroke-linecap="round"
          />

          <line
            x1={SHAFT.x1}
            y1={SHAFT.y1}
            x2={SHAFT.x2}
            y2={SHAFT.y2}
            stroke={ref(NAV_SEARCH_IDS.SHAFT)}
            stroke-width="5.5"
            stroke-linecap="round"
          />

          <line
            x1={FERRULE.x1}
            y1={FERRULE.y1}
            x2={FERRULE.x2}
            y2={FERRULE.y2}
            stroke={ref(NAV_SEARCH_IDS.FERRULE)}
            stroke-width="6.5"
            stroke-linecap="butt"
          />

          <path d={TIP_PATH} fill={ref(NAV_SEARCH_IDS.TIP)} />

          {SPARKLES.map((s) => (
            <path
              className={NAV_CLASSES.NAV_ICON_SPARK}
              d={star(s.x, s.y, s.r)}
              fill={ref(NAV_SEARCH_IDS.SWOOSH)}
            />
          ))}

          {DROPS.map((d) => (
            <circle
              className={NAV_CLASSES.NAV_ICON_DROP}
              cx={d.x}
              cy={d.y}
              r="1.1"
              fill={ref(NAV_SEARCH_IDS.TIP)}
            />
          ))}
        </svg>
        <canvas className={NAV_CLASSES.NAV_GLYPH_CANVAS} aria-hidden={ATTR_VALUES.TRUE} />
      </span>
    )
  }
}

// Registration guard — customElements.define throws on a duplicate tag;
// the `get` check keeps module re-evaluation (HMR, coverage) safe.
if (!customElements.get(COMPONENT_TAGS.NAV_BRUSH_ICON)) {
  customElements.define(COMPONENT_TAGS.NAV_BRUSH_ICON, NavBrushIcon)
}
