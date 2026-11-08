/**
 * @file nav-grid.tsx
 * @description The menu glyph for <app-nav>'s menu button — four neon
 * rounded squares on a 2×2 grid, teal to violet, matching the reference
 * rest state. Colors come from the nav neon tokens; glow and motion live
 * in nav-icons.scss so they run inside this element's shadow root.
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
import iconStyles from '@core/sass/components/nav/nav-icons.scss?inline'

// ── Grid geometry (48×48 viewBox units) ──────────────────────────────
const CELL = 11
const CELL_RADIUS = 3
const CELLS = [
  { x: 11, y: 11 },
  { x: 26, y: 11 },
  { x: 11, y: 26 },
  { x: 26, y: 26 },
]

/** `stop` bound to a --nav-neon-* CSS prop — presentation attributes can't
 * resolve custom properties, so the value rides inline style. */
const stop = (offset: number, prop: string) => (
  <stop offset={offset} style={`stop-color: var(${prop})`} />
)

/** `url(#id)` helper for gradient references. */
const ref = (id: string) => `url(#${id})`

/**
 * The <nav-grid-icon> element — four rounded neon squares. The stroke
 * gradient runs teal at the top-left to violet at the bottom-right so the
 * grid reads as one lit outline.
 */
export class NavGridIcon extends BaseComponent {
  protected override _componentStyles = iconStyles

  override render() {
    return (
      <svg
        className={NAV_CLASSES.NAV_GRID_SVG}
        viewBox="0 0 48 48"
        aria-hidden={ATTR_VALUES.TRUE}
        focusable={ATTR_VALUES.FALSE}
      >
        <defs>
          <linearGradient
            id={NAV_SEARCH_IDS.GRID}
            gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
            x1="11"
            y1="11"
            x2="37"
            y2="37"
          >
            {stop(0, NAV_SEARCH_CSS_PROPS.NEON_TEAL)}
            {stop(1, NAV_SEARCH_CSS_PROPS.NEON_VIOLET)}
          </linearGradient>
        </defs>

        {CELLS.map((c) => (
          <rect
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            rx={CELL_RADIUS}
            fill={ATTR_VALUES.NONE}
            stroke={ref(NAV_SEARCH_IDS.GRID)}
            stroke-width="2.2"
          />
        ))}
      </svg>
    )
  }
}

// Registration guard — customElements.define throws on a duplicate tag;
// the `get` check keeps module re-evaluation (HMR, coverage) safe.
if (!customElements.get(COMPONENT_TAGS.NAV_GRID_ICON)) {
  customElements.define(COMPONENT_TAGS.NAV_GRID_ICON, NavGridIcon)
}
