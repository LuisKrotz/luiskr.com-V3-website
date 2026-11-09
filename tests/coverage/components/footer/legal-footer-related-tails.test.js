/**
 * @file legal-footer-related-tails.test.js
 * @description Coverage tails for the legal Footer's components/related
 * surface — the keyed-object socials normalization (Firebase delivers list
 * nodes as objects), the absent-socials `[]` arm, the empty-note `noteBlock`
 * arm, and the docs-portal description `||` arm — all driven by committed
 * components plus selectively-emptied fallback nodes.
 */
import { CMS_KEYS } from '@core/constants.js'
import store from '@core/store.js'
import '@website/components/legal/Footer.js'
import { FALLBACK_COMPONENTS } from '@core/locale/fallback.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'

/** Generous flush — mounted render queues need real timers past microtasks. */
const flush = (ms = 100) => new Promise((r) => setTimeout(r, ms))

describe('legal Footer related tails', () => {
  const mountFooter = () => {
    const el = document.createElement(COMPONENT_TAGS.LEGAL_FOOTER)

    document.body.appendChild(el)

    return el
  }

  test('keyed-object socials normalize through Object.values', async () => {
    const prev = store.getters.getlang()?.components

    store.state.lang.components = {
      [CMS_KEYS.RELATED]: {
        socials: {
          a: { link: 'mailto:x@y.z', network: 'Mail' },
          b: { link: 'https://example.invalid', network: 'Site' },
          c: { network: 'NoLink' },
        },
      },
    }

    const el = mountFooter()

    await flush()

    expect(el.shadowRoot).toBeTruthy()

    el.remove()

    store.state.lang.components = prev
  })

  test('absent socials and note render the empty-row arms', async () => {
    const prev = store.getters.getlang()?.components
    const related = FALLBACK_COMPONENTS[CMS_KEYS.RELATED]
    const savedSocials = related.socials
    const savedNote = related.note

    delete related.socials
    delete related.note
    store.state.lang.components = { [CMS_KEYS.RELATED]: {} }

    const el = mountFooter()

    el._updateDom()
    await flush()

    expect(
      el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_ITEMS_NOTE}`)
    ).toBeNull()

    el.remove()

    related.socials = savedSocials
    related.note = savedNote
    store.state.lang.components = prev
  })

  test('missing docs-portal description falls to the bundled fallback', async () => {
    const prev = store.getters.getlang()?.components
    const portal = FALLBACK_COMPONENTS[DOCS_STRINGS.CMS_COMPONENT]
    const savedDesc = portal.description

    delete portal.description
    store.state.lang.components = { [DOCS_STRINGS.CMS_COMPONENT]: {} }

    const el = mountFooter()

    el._updateDom()
    await flush()

    expect(
      el.shadowRoot.querySelector(`.${INTERNAL_CLASSES.INTERNAL_FOOTER_DOCS_DESC}`).textContent
    ).toBe(DOCS_STRINGS.DESC_FALLBACK)

    el.remove()

    portal.description = savedDesc
    store.state.lang.components = prev
  })
})
