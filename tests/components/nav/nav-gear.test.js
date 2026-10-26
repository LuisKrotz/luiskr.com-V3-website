/**
 * @file nav-gear.test.js
 * @description Coverage tail for nav/gear.tsx — renderNavGear builds the
 * parametric 9-tooth SVG (outline path, gradient defs, drilled holes,
 * hub studs, fixed glint arc) via polar math; the assertions run on the
 * serialized markup so happy-dom's attribute casing can't skew them.
 */

import { renderNavGear } from '@website/components/nav/gear.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'

describe('renderNavGear — machined-gear SVG', () => {
  test('returns an svg root carrying the gear class + viewBox', () => {
    const svg = renderNavGear()

    expect(svg.tagName.toLowerCase()).toBe('svg')

    const html = svg.outerHTML

    expect(html).toContain(NAV_CLASSES.NAV_GEAR_SVG)

    expect(html).toContain('0 0 48 48')

    expect(html).toContain('aria-hidden')
  })

  test('declares paint gradients + steel-var stops the rotor references', () => {
    const html = renderNavGear().outerHTML

    const grads = html.match(/radialgradient|lineargradient/gi) || []

    expect(grads.length).toBeGreaterThanOrEqual(8)

    expect(html).toContain('--nav-gear-')
  })

  test('emits the toothed silhouette, drilled holes and glint arc', () => {
    const html = renderNavGear().outerHTML

    const paths = html.match(/<path/g) || []

    expect(paths.length).toBeGreaterThanOrEqual(2)

    expect(html).toContain('M ')

    expect((html.match(/A [0-9.]+ [0-9.]+ 0 0 1/g) || []).length).toBeGreaterThanOrEqual(9)
  })
})
