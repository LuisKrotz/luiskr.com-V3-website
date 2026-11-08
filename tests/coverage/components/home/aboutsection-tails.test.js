/**
 * @file aboutsection-tails.test.js
 * @description Coverage tails for AboutSection: the intro/empty-fallback
 * arms of aboutDrawData, the contact-line1 link extraction arms
 * (missing/undescribed rows), the links-row empty arm, the title
 * aria-label fallback, and the unconnected onUpdated path.
 */

import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import '@website/components/home/AboutSection.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { cycleHud, disarmHud, hudLines, syncHud } from '@website/components/home/about/hud.js'
import store from '@core/store.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

const TEST_PIC = 'https://www.gravatar.com/avatar/test?d=mp'
const TEST_LOCS = [
  { name: 'Place One', latitude: '10° S', longitude: '20° W', altitude: '100 m' },
  { name: 'Place Two', latitude: '30° S', longitude: '40° W' },
]

describe('AboutSection coverage tails', () => {
  test('empty bio renders the title only — no intro, no paragraph draw-texts', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't' }
    await flush()

    const drawTexts = el.shadowRoot.querySelectorAll(COMPONENT_TAGS.DRAW_TEXT)
    expect(drawTexts.length).toBe(1)
    expect(el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_INTRO}`)).toBeNull()

    el.remove()
  })

  test('frame intro with an empty col1 flows col2 straight into the body', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', frame: 'Frame statement', col2: ['Body line'] }
    await flush()

    const data = el.aboutDrawData
    expect(data.intro.text).toBe('Frame statement')
    expect(data.items.length).toBe(1)
    expect(data.items[0].text).toBe('Body line')

    el.remove()
  })

  test('translations without title hit the fallback aria-label arm', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { col1: ['a'] }
    await flush()

    const title = el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_TITLE}`)
    expect(title).not.toBeNull()
    expect(title.getAttribute(ARIA_ATTRS.ARIA_LABEL).length).toBeGreaterThan(0)

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

    el.aboutTranslations = { title: 't', col1: ['x', ''], col2: ['<br/>'] }
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

  test('hudLines formats full, fallback and empty locations', () => {
    const full = hudLines(TEST_LOCS[0])
    expect(full.name).toBe(TEST_LOCS[0].name)
    expect(full.detail).toBe(`${NAV_TEXT.ALTITUDE} ${TEST_LOCS[0].altitude}`)
    expect(full.lat).toBe(`${NAV_TEXT.LATITUDE} ${TEST_LOCS[0].latitude}`)
    expect(full.lon).toBe(`${NAV_TEXT.LONGITUDE} ${TEST_LOCS[0].longitude}`)

    // No altitude → the detail line falls back to the latitude readout.
    expect(hudLines(TEST_LOCS[1]).detail).toBe(TEST_LOCS[1].latitude)

    const empty = hudLines(undefined)
    expect(empty.name).toBe(CHAR_STRINGS.EMPTY)
    expect(empty.detail).toBe(CHAR_STRINGS.EMPTY)
  })

  test('attachHud seeds a static session when a single location exists', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', locations: [TEST_LOCS[0]] }
    el.profilePicture = TEST_PIC
    await flush()

    expect(el._hud).not.toBeNull()
    expect(el._hud.timer).toBeNull()

    el.remove()
  })

  test('attachHud arms the cycle for multiple locations; cycleHud advances it', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', locations: TEST_LOCS }
    el.profilePicture = TEST_PIC
    await flush()

    expect(el._hud.timer).not.toBeNull()

    const hud = el.shadowRoot.querySelector(`.${ABOUT_CLASSES.ABOUT_PROFILE_HUD}`)

    cycleHud(el)
    expect(hud.classList.contains(ABOUT_CLASSES.ABOUT_HUD_OUT)).toBe(true)

    await flush(600)

    expect(el._hud.index).toBe(1)
    expect(hud.classList.contains(ABOUT_CLASSES.ABOUT_HUD_OUT)).toBe(false)
    expect(hud.textContent).toContain(TEST_LOCS[1].name)

    // A re-render after the advance reads the live session index.
    el._updateDom()
    expect(el.shadowRoot.textContent).toContain(TEST_LOCS[1].name)

    el.remove()
  })

  test('cycleHud on a HUD-less host still advances the index at the trough', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    // Locations but no profile picture → the HUD node is never rendered;
    // both `if (hud)`/`if (live)` guards take the false arm.
    el.aboutTranslations = { title: 't', locations: TEST_LOCS }
    await flush()

    cycleHud(el)
    expect(el._hud.pending).not.toBeNull()

    await flush(600)

    expect(el._hud.index).toBe(1)
    expect(el._hud.pending).toBeNull()

    el.remove()
  })

  test('syncHud early-returns without a session, locations, or HUD node', async () => {
    const bare = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    // No session — first guard arm.
    syncHud(bare)

    // Session but no locations — second guard arm.
    bare._hud = { index: 0, timer: null, pending: null }
    syncHud(bare)

    // Session + locations but no rendered HUD — shadow guard arm.
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', locations: TEST_LOCS }
    await flush()

    syncHud(el)

    el.remove()
    bare.remove()
  })

  test('attachHud skips the interval under reduced motion', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', locations: TEST_LOCS }
    el.profilePicture = TEST_PIC
    await flush()

    expect(el._hud).not.toBeNull()
    expect(el._hud.timer).toBeNull()

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    el.remove()
  })

  test('cycleHud bails without a session or a second location', () => {
    const bare = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    cycleHud(bare)

    bare._hud = { index: 0, timer: null, pending: null }
    bare.aboutTranslations = { title: 't', locations: [TEST_LOCS[0]] }

    cycleHud(bare)
    expect(bare._hud.pending).toBeNull()

    bare.remove()
  })

  test('disarmHud clears timers and is safe without a session', async () => {
    const bare = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)

    disarmHud(bare)

    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', locations: TEST_LOCS }
    el.profilePicture = TEST_PIC
    await flush()

    cycleHud(el)
    disarmHud(el)

    expect(el._hud.timer).toBeNull()
    expect(el._hud.pending).toBeNull()

    el.remove()
    bare.remove()
  })
})
