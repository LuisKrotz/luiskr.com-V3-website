/**
 * @file nav-search.tsx
 * @description The silver terminal glyph for <app-nav>'s search chip — a
 * `>_` prompt in silver-to-steel metal: a bright chevron with an echoed
 * ghost chevron behind it (the motion afterimage), an underscore bar,
 * horizontal speed streaks trailing off the left, and twinkling sparks.
 * Colors come from the nav metal tokens; motion lives in nav-icons.scss
 * so it runs inside this element's own shadow root. Isolated component.
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

// ── Prompt geometry (48×48 viewBox units) ────────────────────────────
const CHEV_POINTS = '14,12 28,24 14,36'
const GHOST_POINTS = '22,12 36,24 22,36'
const BAR_X0 = 26
const BAR_X1 = 40
const BAR_Y = 37
const STREAK_ROWS = [
  { y: 15, x0: 2, x1: 10 },
  { y: 24, x0: 0, x1: 8 },
  { y: 33, x0: 3, x1: 11 },
]
const SPARKS = [
  { x: 42, y: 12 },
  { x: 44, y: 26 },
  { x: 38, y: 38 },
]

/** `stop` bound to a --nav-metal-* CSS prop — presentation attributes can't
 * resolve custom properties, so the value rides inline style. */
const stop = (offset: number, prop: string) => (
  <stop offset={offset} style={`stop-color: var(${prop})`} />
)

/** `url(#id)` helper for gradient references. */
const ref = (id: string) => `url(#${id})`

/**
 * The <nav-search-icon> element — the silver `>_` prompt. The chevron
 * gradient runs green (tip) to teal (tail); the streak gradient fades
 * teal into green so each speed line reads as light leaving the prompt.
 */
export class NavSearchIcon extends BaseComponent {
  protected override _componentStyles = iconStyles

  /** Live wasm streak emitter — null until the module loads (CSS loops stay). */
  private _glyph: NavGlyphSession | null = null

  /** Starts the wasm streak emitter on the prompt's canvas. */
  override onMounted() {
    void mountNavGlyph(this, NAV_GLYPH.KIND_STREAK, [
      NAV_SEARCH_CSS_PROPS.METAL_SILVER,
      NAV_SEARCH_CSS_PROPS.METAL_STEEL,
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
          className={NAV_CLASSES.NAV_SEARCH_SVG}
          viewBox="0 0 48 48"
          aria-hidden={ATTR_VALUES.TRUE}
          focusable={ATTR_VALUES.FALSE}
        >
          <defs>
            <linearGradient
              id={NAV_SEARCH_IDS.CHEV}
              gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
              x1="14"
              y1="12"
              x2="28"
              y2="36"
            >
              {stop(0, NAV_SEARCH_CSS_PROPS.METAL_STEEL)}
              {stop(1, NAV_SEARCH_CSS_PROPS.METAL_SILVER)}
            </linearGradient>
            <linearGradient
              id={NAV_SEARCH_IDS.STREAK}
              gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
              x1="0"
              y1="0"
              x2="11"
              y2="0"
            >
              {stop(0, NAV_SEARCH_CSS_PROPS.METAL_SILVER)}
              {stop(1, NAV_SEARCH_CSS_PROPS.METAL_STEEL)}
            </linearGradient>
          </defs>

          {STREAK_ROWS.map((row) => (
            <line
              className={NAV_CLASSES.NAV_ICON_STREAK}
              x1={row.x0}
              y1={row.y}
              x2={row.x1}
              y2={row.y}
              stroke={ref(NAV_SEARCH_IDS.STREAK)}
              stroke-width="1.6"
              stroke-linecap="round"
            />
          ))}

          <polyline
            className={NAV_CLASSES.NAV_ICON_GHOST}
            points={GHOST_POINTS}
            fill={ATTR_VALUES.NONE}
            stroke={ref(NAV_SEARCH_IDS.CHEV)}
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <polyline
            className={NAV_CLASSES.NAV_ICON_PROMPT}
            points={CHEV_POINTS}
            fill={ATTR_VALUES.NONE}
            stroke={ref(NAV_SEARCH_IDS.CHEV)}
            stroke-width="5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <line
            className={NAV_CLASSES.NAV_ICON_PROMPT}
            x1={BAR_X0}
            y1={BAR_Y}
            x2={BAR_X1}
            y2={BAR_Y}
            stroke={ref(NAV_SEARCH_IDS.CHEV)}
            stroke-width="5"
            stroke-linecap="round"
          />

          {SPARKS.map((s) => (
            <circle
              className={NAV_CLASSES.NAV_ICON_SPARK}
              cx={s.x}
              cy={s.y}
              r="1.4"
              fill={ref(NAV_SEARCH_IDS.STREAK)}
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
if (!customElements.get(COMPONENT_TAGS.NAV_SEARCH_ICON)) {
  customElements.define(COMPONENT_TAGS.NAV_SEARCH_ICON, NavSearchIcon)
}
