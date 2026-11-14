/**
 * @file media-expanded-webm-gate-tails.test.js
 * @description Covers the media-manifest gate on MediaExpanded.sourceWebm:
 * once the manifest is loaded, a webm sibling that isn't manifest-proven
 * collapses to the empty string so the <video> never issues a doomed
 * request — the same gate the figure's resolveMediaSources applies.
 * Kept in its own file because the manifest is a module-level singleton —
 * loading it mid-file would flip sourceWebm for unrelated suites.
 */
import { describe, test, expect, jest } from '@jest/globals'

import '@website/components/media/MediaExpanded.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

afterEach(() => {
  document.body.innerHTML = CHAR_STRINGS.EMPTY
})

describe('MediaExpanded sourceWebm manifest gate', () => {
  test('a manifest-unproven webm sibling resolves to the empty string', async () => {
    const realFetch = globalThis.fetch

    // Manifest carries an unrelated cover only — the element's webm
    // sibling is NOT bucket-proven, so the gate clamps it to ''.
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [],
    }))

    const { initMediaManifest, mediaManifestReady } = await import('@core/utils/media/manifest.js')

    await initMediaManifest()

    expect(mediaManifestReady()).toBe(true)

    const el = document.createElement(COMPONENT_TAGS.MEDIA_EXPANDED)

    el.setAttribute(MEDIA_ATTRS.SOURCE, TEST_URLS.VIDEO)
    el.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    el.setAttribute(MEDIA_ATTRS.THUMB, TEST_URLS.IMG)
    document.body.appendChild(el)

    expect(el.sourceWebm).toBe(ATTR_VALUES.EMPTY)

    // The unproven thumb on a video collapses to '' — an mp4 can't be an
    // <img> src, so withholding the layer beats a doomed 404.
    expect(el.thumb).toBe(ATTR_VALUES.EMPTY)

    el.remove()
    globalThis.fetch = realFetch
  })
})
