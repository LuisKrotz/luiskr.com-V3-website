/**
 * @file media-figure-mount-tails.test.js
 * @description Covers MediaFigure's keyboard listener independently of the
 * broader component suite, including ignored keys and play/pause activation.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { handleVideoError, mountMediaFigure } from '../../../../components/media/figure/mount.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { KEYBOARD_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { KEYS } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_EVENTS } from '@core/tokens/events/dom.js'
import { gpuAccel } from '@core/utils/gpu/gpu-accel.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

describe('MediaFigure mount keyboard tails', () => {
  test('ignores other keys and toggles playback on Space and Enter', async () => {
    const priorReduced = store.getters.getReducedMotion()
    const processVideoGPU = jest.spyOn(gpuAccel, 'processVideoGPU').mockImplementation(() => {})
    const video = document.createElement(HTML_TAGS.VIDEO)
    const listeners = []
    const rejectedPlay = Promise.reject(new Error(TEST_TEXT.STALE))
    let paused = true

    Object.defineProperty(video, 'paused', { get: () => paused, configurable: true })

    video.play = jest.fn(() => {
      paused = false

      return rejectedPlay
    })
    video.pause = jest.fn(() => {
      paused = true
    })

    const c = {
      subscribe: jest.fn(),
      classes: ATTR_VALUES.EMPTY,
      canExpand: false,
      isVideo: true,
      poster: [],
      $: jest.fn((selector) => (selector === HTML_TAGS.VIDEO ? video : null)),
      addScopedListener: jest.fn((target, event, callback) => {
        listeners.push([event, callback])
      }),
      classList: { add: jest.fn() },
      _ensureVideoSource: jest.fn(),
    }

    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    try {
      mountMediaFigure(c)

      const keydown = listeners.find(([event]) => event === KEYBOARD_EVENTS.KEYDOWN)?.[1]

      expect(typeof keydown).toBe(TYPE_STRINGS.FUNCTION)

      const otherKey = { key: TEST_TEXT.STALE, preventDefault: jest.fn() }

      keydown(otherKey)

      expect(otherKey.preventDefault).not.toHaveBeenCalled()

      const playKey = { key: KEYS.SPACE, preventDefault: jest.fn() }

      keydown(playKey)

      expect(playKey.preventDefault).toHaveBeenCalled()
      expect(c._ensureVideoSource).toHaveBeenCalledWith(video)
      expect(video.play).toHaveBeenCalledTimes(1)

      await rejectedPlay.catch(() => undefined)

      const pauseKey = { key: KEYS.ENTER, preventDefault: jest.fn() }

      keydown(pauseKey)

      expect(pauseKey.preventDefault).toHaveBeenCalled()
      expect(video.pause).toHaveBeenCalledTimes(1)

      const handleError = listeners.find(([event]) => event === WINDOW_EVENTS.ERROR)?.[1]
      const target = {
        hasAttribute: jest.fn(() => true),
        removeAttribute: jest.fn(),
      }

      handleError({ target: null })
      handleError({ target })
      handleVideoError(c, { target: null })
      handleVideoError(c, { target })

      expect(c.classList.add).toHaveBeenCalledWith(MEDIA_CLASSES.MEDIA_FIGURE_LOADED)
      expect(target.removeAttribute).toHaveBeenCalledWith(MEDIA_ATTRS.POSTER)

      const loadedData = listeners.find(([event]) => event === MEDIA_EVENTS.LOADEDDATA)?.[1]

      loadedData({ target: video })

      expect(processVideoGPU).toHaveBeenCalled()
    } finally {
      processVideoGPU.mockRestore()

      store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, priorReduced)
    }
  })
})
