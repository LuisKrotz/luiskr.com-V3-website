/**
 * @file MediaExpanded.js
 * @description <media-expanded> — full-screen media viewer inside the
 * expand modal: renders the full-res image or autoplay video at natural
 * aspect, with the circular WebGL close button and genie-style zoom-out
 * on dismiss. Behavior lives in expanded-{mount,close,render} modules —
 * this facade keeps attribute accessors and the lifecycle surface.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { webmSibling } from '@core/utils/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { BaseComponent } from '@core/Component.js'
import { svgPlaceholder } from '@core/utils/dom.js'
import { mountMediaExpanded } from './expanded/mount.js'
import { startExpandedClose } from './expanded/close.js'
import { cancelGenie } from './expanded/genie.js'
import { renderMediaExpanded } from './expanded/render.js'
import type { GenieSession } from './expanded/genie.js'
import modalStyles from '@core/sass/components/internals/modal.scss?inline'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'

/**
 * The MediaExpanded — expanded class.
 */
export class MediaExpanded extends BaseComponent {
  isClosing = false // zoom-out in flight — one-shot guard
  currentSrc: string = ATTR_VALUES.EMPTY // active img src: thumb → full-res swap
  _closeBtn: { destroy(): void } | null = null // CloseButtonWebGL on the header ✕
  _brackets: (() => void) | null = null // teardown for the close-button corner-brackets WebGPU widgets
  _genie: GenieSession | null = null // live genie-warp session (open/close transition)

  static get observedAttributes(): string[] {
    return [
      MEDIA_ATTRS.SOURCE,
      MEDIA_ATTRS.THUMB,
      MEDIA_ATTRS.ALT,
      MEDIA_ATTRS.WIDTH,
      MEDIA_ATTRS.HEIGHT,
      MEDIA_ATTRS.IS_VIDEO,
    ]
  }

  constructor() {
    super(modalStyles)
  }

  /** Full-res media URL (from the source attribute). */

  get source() {
    return this.getAttribute(MEDIA_ATTRS.SOURCE) || ATTR_VALUES.EMPTY
  }

  /** Webm sibling of an .mp4 source — first <source> when it exists. */

  get sourceWebm() {
    return webmSibling(this.source)
  }

  /** Low-res thumbnail URL shown while the full asset loads. */

  get thumb() {
    return this.getAttribute(MEDIA_ATTRS.THUMB) || ATTR_VALUES.EMPTY
  }

  /** Alt text for the media. */

  get alt() {
    return this.getAttribute(MEDIA_ATTRS.ALT) || ATTR_VALUES.EMPTY
  }

  /** Natural media width attribute. */

  get mediaWidth() {
    return parseInt(
      this.getAttribute(MEDIA_ATTRS.WIDTH) || String(GENERIC_DIMENSIONS.DEFAULT_WIDTH),
      10
    )
  }

  /** Natural media height attribute. */

  get mediaHeight() {
    return parseInt(
      this.getAttribute(MEDIA_ATTRS.HEIGHT) || String(GENERIC_DIMENSIONS.DEFAULT_HEIGHT),
      10
    )
  }

  /** Whether the source is a video. */

  get isVideo() {
    return (
      this.hasAttribute(MEDIA_ATTRS.IS_VIDEO) &&
      this.getAttribute(MEDIA_ATTRS.IS_VIDEO) !== ATTR_VALUES.FALSE
    )
  }

  override onInit() {
    this.currentSrc = this.thumb
  }

  override onMounted() {
    mountMediaExpanded(this)
  }

  /** Placeholder box style while the full asset loads. */

  placeholder(width: number, height: number): string {
    return svgPlaceholder(width, height)
  }

  /** Dismissal sequence — CSS zoom-out, then URL/dialog/scroll teardown (see expanded-close.ts). */

  startClose(): void {
    startExpandedClose(this)
  }

  override onDestroy() {
    cancelGenie(this)

    // A detached <video> keeps decoding+playing — the element leaves the
    // DOM on close but the media pipeline doesn't stop itself. Pause so
    // the teardown actually frees the decoder.
    this.$<HTMLVideoElement>(HTML_TAGS.VIDEO)?.pause()

    if (this._closeBtn) {
      this._closeBtn.destroy()

      this._closeBtn = null
    }

    if (this._brackets) {
      this._brackets()

      this._brackets = null
    }
  }

  /** JSX template (see expanded-render.tsx). */

  override render() {
    return renderMediaExpanded(this)
  }
}

if (!customElements.get(COMPONENT_TAGS.MEDIA_EXPANDED)) {
  customElements.define(COMPONENT_TAGS.MEDIA_EXPANDED, MediaExpanded)
}
