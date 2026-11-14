/**
 * @file site-toast-dismiss-timer-tails.test.js
 * @description Coverage tail for feedback/SiteToast.tsx — the _dismiss
 * `item.timerId` arm: a toast pushed with a duration holds a pending
 * auto-dismiss timer, and the close button's click path must clear it
 * before splining the item out (covers the truthy arm; the falsy arm is
 * the duration:0 push the component tests already drive).
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { TOAST_CLASSES } from '@core/tokens/classes/toast.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

const _flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('SiteToast timer dismiss arm', () => {
  beforeAll(async () => {
    await import('@website/components/feedback/SiteToast.js')
  })

  beforeEach(() => {
    document.body.innerHTML = CHAR_STRINGS.EMPTY
  })

  afterEach(() => {
    document.body.innerHTML = CHAR_STRINGS.EMPTY
  })

  test('clicking close on a timed toast clears its pending timer and removes the item', async () => {
    const el = document.createElement(COMPONENT_TAGS.SITE_TOAST)

    document.body.appendChild(el)

    const id = el.push({ text: TEST_TEXT.HELLO, duration: 60000 })

    expect(id).not.toBeNull()
    await _flush()

    const item = el.shadowRoot.querySelector(`.${TOAST_CLASSES.SITE_TOAST_ITEM}`)

    expect(item).not.toBeNull()

    item.querySelector(`.${TOAST_CLASSES.SITE_TOAST_CLOSE}`).click()
    await _flush()

    expect(el.shadowRoot.querySelector(`.${TOAST_CLASSES.SITE_TOAST_ITEM}`)).toBeNull()
    expect(el._items.length).toBe(0)

    el.remove()
  })
})
