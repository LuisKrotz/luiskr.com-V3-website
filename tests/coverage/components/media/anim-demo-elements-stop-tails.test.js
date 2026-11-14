/**
 * @file anim-demo-elements-stop-tails.test.js
 * @description Mock-free coverage tails for the element demo drivers —
 * the sibling elements-tails suite runs under unstable_mockModule where
 * istanbul's counters inside nested teardown closures don't register;
 * this file exercises the same `el`-absent fallback arms through the
 * real module instances so the merged report records them.
 */
import { describe, test, expect } from '@jest/globals'

import {
  mountCardStackDemo,
  mountMentionsDeckDemo,
  mountAwardsCarouselDemo,
  mountCustomCarouselDemo,
  mountAboutSectionDemo,
  mountScene3dDemo,
} from '@website/components/media/anim-demo/elements.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

/** Bare stage with no demo element — every mount takes its fallback arm. */
const makeStage = () => {
  const stage = document.createElement(HTML_TAGS.DIV)

  document.body.appendChild(stage)

  return stage
}

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('anim-demo element mounts — element-absent arms', () => {
  const mounts = [
    ['mountCardStackDemo', mountCardStackDemo],
    ['mountMentionsDeckDemo', mountMentionsDeckDemo],
    ['mountAwardsCarouselDemo', mountAwardsCarouselDemo],
    ['mountCustomCarouselDemo', mountCustomCarouselDemo],
    ['mountAboutSectionDemo', mountAboutSectionDemo],
    ['mountScene3dDemo', mountScene3dDemo],
  ]

  for (const [name, mount] of mounts) {
    test(`${name} returns a teardown that clears its alive flag when the element is absent`, () => {
      const stage = makeStage()

      const teardown = mount({ stage })

      expect(typeof teardown).toBe('function')
      expect(() => teardown()).not.toThrow()

      stage.remove()
    })
  }
})
