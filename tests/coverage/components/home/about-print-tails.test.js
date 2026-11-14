/**
 * @file about-print-tails.test.js
 * @description Coverage tail for home/about/print.ts — the printable bio:
 * preparePrint seats hidden .print-fill spans inside each draw-text
 * paragraph (contextual-fragment parsing keeps CMS markup real), and
 * restorePrint removes them. Both arms cover the prepare/restore paths
 * print.ts's enter and exit passes call.
 */

import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import '@website/components/home/AboutSection.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { preparePrint, restorePrint } from '@website/components/home/about/print.js'

const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('about/print printable form', () => {
  test('preparePrint seats one print-fill per bio paragraph in DOM order', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = {
      title: 't',
      frame: 'Intro <br>statement',
      col1: ['Intro <br>statement', 'Body <q>one</q>'],
      col2: ['Body two'],
    }
    await flush()

    preparePrint(el)

    const fills = el.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.FILL}`)

    expect(fills.length).toBeGreaterThan(0)
    fills.forEach((f) => {
      expect(f.textContent.length).toBeGreaterThan(0)
    })
    // First fill holds the intro copy — the markup parsed into nodes.
    expect(fills[0].textContent).toContain('Intro')

    el.remove()
  })

  test('restorePrint removes every seated fill and re-prepare stays clean', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    el.aboutTranslations = { title: 't', col1: ['one', 'two'] }
    await flush()

    preparePrint(el)
    const count = el.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.FILL}`).length
    expect(count).toBeGreaterThan(0)

    // Idempotent re-arm — a second prepare must not double the fills.
    preparePrint(el)
    expect(el.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.FILL}`).length).toBe(count)

    restorePrint(el)
    expect(el.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.FILL}`).length).toBe(0)

    // Restore on an empty host is a no-op.
    restorePrint(el)

    el.remove()
  })

  test('preparePrint on a skeleton host (no translations) is a no-op', async () => {
    const el = document.createElement(COMPONENT_TAGS.ABOUT_SECTION)
    document.body.appendChild(el)
    await flush()

    preparePrint(el)

    expect(el.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.FILL}`).length).toBe(0)

    el.remove()
  })
})
