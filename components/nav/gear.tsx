/**
 * @file nav-gear.tsx
 * @description The settings gear glyph for <app-nav> — a parametric
 * 9-tooth machine gear rendered as layered SVG: a trapezoidal-tooth
 * outline generated from polar math, a radial face ramp + directional
 * rim stroke faking a top-left light, five drilled lightening holes, a
 * raised hub with center bore and stud circle, and a fixed specular
 * glint that stays put while the rotor group spins (the light source
 * never moves — the cheap 3D trick). Every gradient is declared in
 * userSpaceOnUse so the shading is anchored to the viewBox, not the
 * rotating shape. Extracted from render.tsx.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GEAR_CSS_PROPS } from '@core/tokens/css/nav.js'
import { NAV_GEAR_IDS } from '@core/tokens/ids/app.js'
import { SVG_STRINGS } from '@core/tokens/strings/svg.js'
import { h } from '@core/jsx.js'

// ── Gear geometry (48×48 viewBox units) ──────────────────────────────
const CX = 24
const CY = 24
const TEETH = 9
const TIP_R = 21.2 // tooth tip radius — outermost silhouette
const ROOT_R = 16.4 // valley radius between teeth
const GROOVE_R = 15.2 // machined groove ring on the web face
const BOLT_R = 10.8 // bolt circle the lightening holes orbit on
const HOLES = 5
const HOLE_R = 3.4
const HUB_R = 6.4 // raised center cylinder
const BORE_R = 2.0 // center shaft bore
const STUDS = 4
const STUD_ORBIT = 4.2 // radius the hub studs sit on
const STUD_R = 1.0
const GLINT_R = 20.6 // specular arc radius — just inside the tooth tips
const GLINT_START = 198 // degrees — top-left quadrant
const GLINT_END = 252

/**
 * Polar → "x y" pair in the viewBox space (y grows downward, so positive
 * angles sweep clockwise on screen — matching the arc sweep flag below).
 * @param r Radius from center.
 * @param a Angle in radians.
 * @returns Comma-free "x y" coordinate pair for path data.
 */
const pt = (r: number, a: number): string =>
  `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`

/**
 * Builds the closed toothed-ring outline: per tooth a straight rising
 * flank → tip arc → straight falling flank → valley arc, repeated around
 * the circle. Tip half-angle (17% of pitch) is narrower than the root
 * half-angle (31%), which is what makes the teeth trapezoidal like a
 * real spur gear instead of rounded bumps.
 * @returns SVG path `d` for the gear silhouette.
 */
const gearOutlineD = (): string => {
  const pitch = (Math.PI * 2) / TEETH
  const tipHalf = pitch * 0.17
  const rootHalf = pitch * 0.31

  let d = `M ${pt(ROOT_R, -rootHalf)}`

  for (let i = 0; i < TEETH; i++) {
    const a = i * pitch

    d += ` L ${pt(TIP_R, a - tipHalf)}`
    d += ` A ${TIP_R} ${TIP_R} 0 0 1 ${pt(TIP_R, a + tipHalf)}`
    d += ` L ${pt(ROOT_R, a + rootHalf)}`
    d += ` A ${ROOT_R} ${ROOT_R} 0 0 1 ${pt(ROOT_R, a + pitch - rootHalf)}`
  }

  return `${d} Z`
}

/**
 * Positions evenly spaced on a circle — used for the five lightening
 * holes (phase -90° puts a hole at top dead center) and the four hub
 * studs (phase -45° parks them on the diagonals).
 * @param count Items on the ring.
 * @param radius Orbit radius.
 * @param phase Start angle in radians.
 * @returns [x, y] centers in viewBox units.
 */
const ringPositions = (count: number, radius: number, phase: number): [number, number][] =>
  Array.from({ length: count }, (_v, i) => {
    const a = phase + (i * Math.PI * 2) / count

    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)] as [number, number]
  })

/** `url(#…)` paint-server ref — declared once so the wrapper string is never repeated. */
const urlRef = (id: string): string => `url(#${id})`

/**
 * One gradient stop bound to a paint token — var() must ride in `style`
 * (presentation attributes can't resolve custom properties), and this
 * helper keeps the `stop-color:` prelude declared exactly once.
 * @param offset Stop position 0–1.
 * @param prop `NAV_GEAR_CSS_PROPS` member.
 * @returns The <stop> element.
 */
const gearStop = (offset: number, prop: string) => (
  <stop offset={offset} style={`stop-color: var(${prop})`} />
)

const GEAR_D = gearOutlineD()

/**
 * The specular glint — a short arc hugging the top-left rim (the
 * brightest catch-light on turned steel). It lives OUTSIDE the rotor
 * group: the gear spins under a fixed light.
 */
const GLINT_D = `M ${pt(GLINT_R, (GLINT_START * Math.PI) / 180)} A ${GLINT_R} ${GLINT_R} 0 0 1 ${pt(GLINT_R, (GLINT_END * Math.PI) / 180)}`

/**
 * Renders the machined-steel gear: defs publish the four light ramps,
 * the rotor group carries the silhouette + machined details that spin,
 * and the glint arc stays fixed against them.
 * @returns The gear <svg> for the preferences chip.
 */
export function renderNavGear() {
  return (
    <svg
      className={NAV_CLASSES.NAV_GEAR_SVG}
      viewBox="0 0 48 48"
      aria-hidden={ATTR_VALUES.TRUE}
      focusable={ATTR_VALUES.FALSE}
    >
      <defs>
        {/* Face: radial ramp offset toward the top-left light. */}
        <radialGradient
          id={NAV_GEAR_IDS.FACE}
          gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
          cx="16"
          cy="13"
          r="38"
        >
          {gearStop(0, NAV_GEAR_CSS_PROPS.GEAR_HI)}
          {gearStop(0.5, NAV_GEAR_CSS_PROPS.GEAR_MID)}
          {gearStop(1, NAV_GEAR_CSS_PROPS.GEAR_LO)}
        </radialGradient>
        {/* Rim: top edge catches light, underside falls to shadow — the
            chamfer stroke that gives the teeth their bevel. */}
        <linearGradient
          id={NAV_GEAR_IDS.RIM}
          gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
          x1={CX}
          y1="2"
          x2={CX}
          y2="46"
        >
          {gearStop(0, NAV_GEAR_CSS_PROPS.GEAR_EDGE_HI)}
          {gearStop(0.55, NAV_GEAR_CSS_PROPS.GEAR_MID)}
          {gearStop(1, NAV_GEAR_CSS_PROPS.GEAR_EDGE_LO)}
        </linearGradient>
        {/* Hub: the raised cylinder gets its own tighter radial ramp. */}
        <radialGradient
          id={NAV_GEAR_IDS.HUB}
          gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
          cx="19"
          cy="16"
          r="16"
        >
          {gearStop(0, NAV_GEAR_CSS_PROPS.GEAR_HI)}
          {gearStop(0.7, NAV_GEAR_CSS_PROPS.GEAR_MID)}
          {gearStop(1, NAV_GEAR_CSS_PROPS.GEAR_LO)}
        </radialGradient>
        {/* Hole cavity: unlit core up top, the far inner wall catching a
            lit rim at the bottom — a drilled-hole read at any size. */}
        <linearGradient
          id={NAV_GEAR_IDS.HOLE}
          gradientUnits={SVG_STRINGS.GRADIENT_USER_SPACE}
          x1={CX}
          y1="0"
          x2={CX}
          y2="48"
        >
          {gearStop(0, NAV_GEAR_CSS_PROPS.GEAR_HOLE_LO)}
          {gearStop(0.55, NAV_GEAR_CSS_PROPS.GEAR_HOLE)}
          {gearStop(1, NAV_GEAR_CSS_PROPS.GEAR_HOLE_HI)}
        </linearGradient>
      </defs>
      <g className={NAV_CLASSES.NAV_GEAR_ROTOR}>
        {/* Tooth ring: face fill + chamfered rim stroke. */}
        <path
          d={GEAR_D}
          fill={urlRef(NAV_GEAR_IDS.FACE)}
          stroke={urlRef(NAV_GEAR_IDS.RIM)}
          stroke-width="1.1"
        />
        {/* Machined groove — the turned-ring line on the web face. */}
        <circle
          cx={CX}
          cy={CY}
          r={GROOVE_R}
          fill={ATTR_VALUES.NONE}
          stroke={urlRef(NAV_GEAR_IDS.RIM)}
          stroke-width="0.7"
        />
        {/* Lightening holes — drilled cavities on the bolt circle. */}
        {ringPositions(HOLES, BOLT_R, -Math.PI / 2).map(([x, y]) => (
          <circle
            cx={x}
            cy={y}
            r={HOLE_R}
            fill={urlRef(NAV_GEAR_IDS.HOLE)}
            stroke={urlRef(NAV_GEAR_IDS.RIM)}
            stroke-width="0.5"
          />
        ))}
        {/* Hub studs — the bolt heads on the raised cylinder. */}
        {ringPositions(STUDS, STUD_ORBIT, -Math.PI / 4).map(([x, y]) => (
          <circle cx={x} cy={y} r={STUD_R} fill={urlRef(NAV_GEAR_IDS.HOLE)} />
        ))}
        {/* Raised hub + center shaft bore. */}
        <circle
          cx={CX}
          cy={CY}
          r={HUB_R}
          fill={urlRef(NAV_GEAR_IDS.HUB)}
          stroke={urlRef(NAV_GEAR_IDS.RIM)}
          stroke-width="0.9"
        />
        <circle
          cx={CX}
          cy={CY}
          r={BORE_R}
          fill={urlRef(NAV_GEAR_IDS.HOLE)}
          stroke={urlRef(NAV_GEAR_IDS.RIM)}
          stroke-width="0.6"
        />
      </g>
      {/* Fixed catch-light — never spins with the rotor. */}
      <path
        className={NAV_CLASSES.NAV_GEAR_GLINT}
        d={GLINT_D}
        fill={ATTR_VALUES.NONE}
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  )
}
