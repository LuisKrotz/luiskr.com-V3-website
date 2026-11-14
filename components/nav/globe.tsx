/**
 * @file nav-globe.tsx
 * @description The language glyph for <app-nav>'s language chip — a silver
 * globe (outline, meridian, equator and two parallels) with a speech
 * bubble carrying three dots at its upper right, matching the reference
 * rest state. Replaces the flag on the strip; flags stay in the language
 * dialog. Colors come from the nav metal tokens; glow and motion live in
 * nav-icons.scss. Isolated component — registers its own tag.
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

// ── Globe geometry (48×48 viewBox units) ─────────────────────────────
const GLOBE_CX = 24
const GLOBE_CY = 25
const GLOBE_R = 14
const MERIDIAN_RX = 6
const PARALLEL_Y = [GLOBE_CY - 7, GLOBE_CY + 7]
const PARALLEL_HALF = 12
const BUBBLE = { x: 30, y: 3, w: 15, h: 10, r: 3.5 }
const BUBBLE_DOTS = [34, 37.5, 41]

/** `stop` bound to a --nav-metal-* CSS prop — presentation attributes can't
 * resolve custom properties, so the value rides inline style. */
const stop = (offset: number, prop: string) => (
  <stop offset={offset} style={`stop-color: var(${prop})`} />
)

/** `url(#id)` helper for gradient references. */
const ref = (id: string) => `url(#${id})`

/**
 * The <nav-globe-icon> element — silver globe with a speech bubble. The
 * stroke gradient runs teal to green so the sphere reads as a single lit
 * wire frame, the bubble sharing the same ramp.
 */
export class NavGlobeIcon extends BaseComponent {
  protected override _componentStyles = iconStyles

  override render() {
    return (
      <svg
        className={NAV_CLASSES.NAV_GLOBE_SVG}
        viewBox="0 0 48 48"
        aria-hidden={ATTR_VALUES.TRUE}
        focusable={ATTR_VALUES.FALSE}
      >
        <defs>
          <linearGradient
            id={NAV_SEARCH_IDS.GLOBE}
            gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
            x1="10"
            y1="11"
            x2="38"
            y2="39"
          >
            {stop(0, NAV_SEARCH_CSS_PROPS.METAL_SILVER)}
            {stop(1, NAV_SEARCH_CSS_PROPS.METAL_STEEL)}
          </linearGradient>
        </defs>

        <circle
          cx={GLOBE_CX}
          cy={GLOBE_CY}
          r={GLOBE_R}
          fill={ATTR_VALUES.NONE}
          stroke={ref(NAV_SEARCH_IDS.GLOBE)}
          stroke-width="1.8"
        />
        <ellipse
          cx={GLOBE_CX}
          cy={GLOBE_CY}
          rx={MERIDIAN_RX}
          ry={GLOBE_R}
          fill={ATTR_VALUES.NONE}
          stroke={ref(NAV_SEARCH_IDS.GLOBE)}
          stroke-width="1.8"
        />
        <line
          x1={GLOBE_CX - GLOBE_R}
          y1={GLOBE_CY}
          x2={GLOBE_CX + GLOBE_R}
          y2={GLOBE_CY}
          stroke={ref(NAV_SEARCH_IDS.GLOBE)}
          stroke-width="1.8"
        />
        {PARALLEL_Y.map((y) => (
          <line
            x1={GLOBE_CX - PARALLEL_HALF}
            y1={y}
            x2={GLOBE_CX + PARALLEL_HALF}
            y2={y}
            stroke={ref(NAV_SEARCH_IDS.GLOBE)}
            stroke-width="1.4"
          />
        ))}

        <rect
          x={BUBBLE.x}
          y={BUBBLE.y}
          width={BUBBLE.w}
          height={BUBBLE.h}
          rx={BUBBLE.r}
          fill={ATTR_VALUES.NONE}
          stroke={ref(NAV_SEARCH_IDS.GLOBE)}
          stroke-width="1.6"
        />
        {BUBBLE_DOTS.map((x) => (
          <circle cx={x} cy={BUBBLE.y + BUBBLE.h / 2} r="1.1" fill={ref(NAV_SEARCH_IDS.GLOBE)} />
        ))}
      </svg>
    )
  }
}

// Registration guard — customElements.define throws on a duplicate tag;
// the `get` check keeps module re-evaluation (HMR, coverage) safe.
if (!customElements.get(COMPONENT_TAGS.NAV_GLOBE_ICON)) {
  customElements.define(COMPONENT_TAGS.NAV_GLOBE_ICON, NavGlobeIcon)
}
