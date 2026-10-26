/**
 * @file media/media-render.tsx
 * @description JSX for MediaFigure — layered placeholder/thumb/high-res crossfade stack (or the muted looping video path) plus the expand affordance buttons.
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { h, Fragment } from '@core/jsx.js'
import { ASSET_PATHS } from '@core/tokens/routes/paths.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { LANG_STRINGS } from '@core/tokens/strings/langs.js'
import { componentText } from '@core/locale/ui-text.js'
import store from '@core/store.js'
import { prefersScaledVideo, videoAutoplayAllowed } from '@core/utils/media/policy.js'
import type { MediaFigure } from '../MediaFigure.js'
import { MEDIA_COMPONENT_KEYS } from '@core/tokens/data/component-keys.js'

/**
 * Renders media figure.
 * @param c — the component
 */
export function renderMediaFigure(c: MediaFigure) {
  const mediaW = c.displayWidth

  const mediaH = c.displayHeight

  const action = store.getters.getClickOrTap()

  const compLang =
    (store.getters.getlang().components as Record<string, Record<string, string>> | undefined)
      ?.media || {}

  const toOpen = compLang.toOpen || (componentText(MEDIA_COMPONENT_KEYS.MEDIA_TO_OPEN) as string)

  const isHeroItem = c.classes.includes(INTERNAL_CLASSES.INTERNAL_MAIN_ITEM)

  // A 'low' connection budget (saveData/≤2g) downgrades autoplay videos
  // to poster-only: preload stays 'none' and the autoplay attribute is
  // withheld so the browser can never start the stream — the IO/play
  // path enforces the same policy at the other end.
  const autoplayAllowed = videoAutoplayAllowed()

  const shouldPreloadVideo = (c.autoPlay || isHeroItem) && autoplayAllowed

  // Tier selection — the browser walks <source> top-down and commits to
  // the first one that resolves, so on a box the scaled (-2x) tier
  // already over-resolves, the scaled pair must lead: otherwise a phone
  // always pulls the 4K/1080p stream and the scaled transcodes never
  // fire. The same check picks the matching half-size poster.
  // The clientWidth read is a layout query — re-deriving it on every
  // render forces a reflow per publish wave, and the poster tier never
  // legitimately flips mid-session, so the first computed answer is
  // memoized on the figure.
  if (c.isVideo && c._scaledVideo === undefined) {
    c._scaledVideo = prefersScaledVideo(c.mediaWidth, c.clientWidth)
  }

  const scaledVideo = c.isVideo && c._scaledVideo === true

  const posterSrc = c.isVideo ? c.poster[scaledVideo ? 1 : 0] || c.poster[0] : ATTR_VALUES.EMPTY

  return (
    <figure
      className={c.canExpand ? INTERNAL_CLASSES.INTERNAL_EXPAND : ATTR_VALUES.EMPTY}
      title={c.label}
      // The media's declared intrinsic size, published as custom props so
      // the SCSS sizing chain can clamp every box (placeholder, slide,
      // cover) at natural dimensions — the painted file may never render
      // larger than its source, no matter how tall the strip or wide the
      // container is.
      style={{
        '--mf-natural-w': `${mediaW}${COMMON_ATTRS.PX}`,
        '--mf-natural-h': `${mediaH}${COMMON_ATTRS.PX}`,
      }}
    >
      <img
        decoding={MEDIA_ATTRS.DECODING_ASYNC}
        className={MEDIA_CLASSES.RENDER_PLACEHOLDER}
        src={c.placeholder(mediaW, mediaH)}
        width={mediaW}
        height={mediaH}
        alt={ATTR_VALUES.EMPTY}
        aria-hidden={ATTR_VALUES.TRUE}
      />

      {!c.isVideo ? (
        <Fragment>
          <img
            decoding={MEDIA_ATTRS.DECODING_ASYNC}
            loading={isHeroItem ? MEDIA_ATTRS.LOADING_EAGER : MEDIA_ATTRS.LOADING_LAZY}
            fetchpriority={
              isHeroItem ? MEDIA_ATTRS.FETCH_PRIORITY_HIGH : MEDIA_ATTRS.FETCH_PRIORITY_LOW
            }
            className={`${MEDIA_CLASSES.RENDER_MEDIA} ${MEDIA_CLASSES.RENDER_MEDIA_THUMB} ${c.classes}`}
            width={mediaW}
            height={mediaH}
            alt={c.label}
            src={c.thumbSrc}
          />

          <img
            decoding={MEDIA_ATTRS.DECODING_ASYNC}
            className={`${MEDIA_CLASSES.RENDER_MEDIA} ${MEDIA_CLASSES.RENDER_MEDIA_HIGH} ${c.classes} ${c.isLoaded ? MEDIA_CLASSES.RENDER_MEDIA_LOADED : ATTR_VALUES.EMPTY}`}
            width={mediaW}
            height={mediaH}
            alt={c.label}
            src={c.highResSrc || undefined}
          />
        </Fragment>
      ) : (
        <Fragment>
          <video
            className={`${MEDIA_CLASSES.RENDER_MEDIA} ${c.classes}`}
            poster={posterSrc || ATTR_VALUES.EMPTY}
            width={mediaW}
            height={mediaH}
            preload={shouldPreloadVideo ? MEDIA_ATTRS.METADATA : ATTR_VALUES.NONE}
            fetchpriority={isHeroItem ? MEDIA_ATTRS.FETCH_PRIORITY_HIGH : undefined}
            playsInline
            loop
            muted
            controlsList={MEDIA_ATTRS.NO_DOWNLOAD}
            disablePictureInPicture
            autoPlay={c.autoPlay && autoplayAllowed}
            controls={store.getters.getReducedMotion()}
            // Ambient loops ship without native controls, so the element
            // itself is the control: tabbable + named, Space/Enter toggles
            // playback in mount.ts (media_keyboard_controllable). <video>
            // allows only the application widget role (button is rejected
            // by aria-allowed-role); playback state rides aria-description
            // since aria-pressed is button-only too.
            role={ARIA_ATTRS.ROLE_APPLICATION}
            aria-description={STATE_STRINGS.PAUSED}
            tabIndex={ATTR_VALUES.TABINDEX_ZERO}
            aria-label={c.label || undefined}
            title={c.label || undefined}
          >
            {/* Muted ambient loops have no meaningful audio — the track
                exists so the caption contract is explicit (empty vtt),
                not an unverifiable absence. */}
            <track
              kind={MEDIA_ATTRS.CAPTIONS}
              src={ASSET_PATHS.EMPTY_CAPTIONS}
              srcLang={LANG_STRINGS.EN}
              label={DOM_STRINGS.NO_AUDIO_LABEL}
              default
            />

            {/* <source> children are deliberately absent — emitting them
                eagerly would let autoPlay+metadata start the stream
                before the IntersectionObserver gate, downloading
                megabytes of video the viewer may never scroll to. The
                sources attach lazily through _ensureVideoSource (IO ≥15%
                intersect, hover, or keyboard play), which walks the same
                scaled-first ordering. */}
          </video>
        </Fragment>
      )}

      {c.canExpand && (
        <Fragment>
          <button
            className={EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_1}
            data-no-snippet
            type={FORM_ATTRS.BUTTON}
          >
            {action} {toOpen}
          </button>

          <button
            className={EXPAND_MODAL_CLASSES.EXPAND_MODAL_OPEN_2}
            aria-label={`${action} ${toOpen}`}
            aria-hidden={ATTR_VALUES.TRUE}
            tabIndex={-1}
            data-no-snippet
            type={FORM_ATTRS.BUTTON}
          />
        </Fragment>
      )}
    </figure>
  )
}
