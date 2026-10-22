/**
 * @file aboutsection-tails.test.js
 * @description Coverage tails for AboutSection's side-info column:
 * the extended bio renders as a plain always-visible block (no
 * collapsible control), col2 DrawText items flow through, and the
 * title/col2 empty-fallback arms resolve.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import '@website/components/home/AboutSection.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('AboutSection side-info tails', () => {
  test('side info renders as a plain block — no details/summary control', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', col1: ['a'], col2: ['b'] }
    await flush()

    const sideInfo = el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_SIDE_INFO}`)
    expect(sideInfo).not.toBeNull()
    expect(sideInfo.tagName).not.toBe('DETAILS')
    expect(el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_SIDE_INFO_SUMMARY}`)).toBeNull()

    el.remove()
  })

  test('translations without title/col2 hit the empty-fallback arms', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { col1: ['a'] }
    await flush()

    const title = el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_TITLE}`)
    expect(title).not.toBeNull()

    el.remove()
  })

  test('onUpdated skips applyAnimationDesc when the profile text node is absent', () => {
    // An unconnected element still owns an (empty) shadow root — `this.$`
    // resolves null, exercising the `if (text)` else arm.
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    el.onUpdated()

    el.remove()
  })

  test('empty paragraph text falls back to the localized ordinal heading', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', col1: [''], col2: ['<br/>'] }
    await flush()

    const heads = [...el.shadowRoot.querySelectorAll('h3')]

    expect(heads.length).toBe(2)
    expect(heads.every((h) => h.textContent.trim().length > 0)).toBe(true)

    el.remove()
  })

  test('gravatar getters tolerate an unset profile picture', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    el.profilePicture = null

    expect(typeof el.optimizedProfilePicture).toBe('string')
    expect(typeof el.profilePictureSrcset).toBe('string')

    el.remove()
  })
})
