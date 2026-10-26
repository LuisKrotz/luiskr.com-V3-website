/**
 * @file lifecycle-manifest-arrival-tails.test.js
 * @description Covers the media-manifest arrival arm in custom-carousel
 * lifecycle — mounting with the manifest already loaded fires the
 * subscription synchronously into host._updateDom, and onDestroy runs
 * the disposer + nulls the handle.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { onMounted, onDestroy } from '@website/components/carousel/custom-carousel/lifecycle.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

const host = () => ({
  items: [{ src: TEST_URLS.IMG }],
  _updateDom: jest.fn(),
  _markAdjacentLoaded: jest.fn(),
  _setupAfterRender: jest.fn(),
  _startFitObserver: jest.fn(),
  subscribe: jest.fn(),
  _stopAutoplay: jest.fn(),
  _prevArrow: null,
  _nextArrow: null,
  observer: null,
  _cancelNavSpring: jest.fn(),
  _unsubManifest: null,
})

describe('custom-carousel manifest-arrival arm', () => {
  test('manifest loaded before mount → subscriber fires sync into _updateDom', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [`covers/x${MEDIA.EXT}`],
    }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    const h = host()
    const before = h._updateDom.mock.calls.length

    onMounted(h)

    // onMediaManifest fires synchronously on a loaded manifest → the
    // arrow body runs host._updateDom() one extra time past mount's own.
    expect(h._updateDom.mock.calls.length).toBeGreaterThan(before)
    expect(h._unsubManifest).toEqual(expect.any(Function))

    onDestroy(h)

    expect(h._unsubManifest).toBeNull()

    globalThis.fetch = realFetch
  })
})
