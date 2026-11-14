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
import { descriptionTracks, longdescUrl } from '@core/utils/media/accessibility.js'
import { mediaKeyExists } from '@core/utils/media/manifest.js'
import store from '@core/store.js'
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
import type { GenieSheet } from './expanded/genie-texture.js'
import modalStyles from '@core/sass/components/internals/modal.scss?tiers'
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
  _closeTimer: ReturnType<typeof setTimeout> | null = null // pending fallback teardown — cleared on destroy so a removed element can't scrollTo/commit post-mortem
  /**
   * Baked warp sheet reused across this modal's open→close pair — keyed
   * on (content, dpr, viewport, theme): any of those changing rebakes.
   * Invalidated when the media item's pixels or box change after the
   * bake (full-res swap, figure-loaded flip). The sheet's restamp
   * sources are live element refs, so a <video> sheet stays current
   * frame-by-frame without a rebake.
   */
  _genieSheet: {
    content: HTMLElement
    dpr: number
    vw: number
    vh: number
    dark: boolean
    sheet: GenieSheet
  } | null = null

  static get observedAttributes(): string[] {
    return [
      MEDIA_ATTRS.SOURCE,
      MEDIA_ATTRS.THUMB,
      MEDIA_ATTRS.ALT,
      MEDIA_ATTRS.WIDTH,
      MEDIA_ATTRS.HEIGHT,
      MEDIA_ATTRS.IS_VIDEO,
      MEDIA_ATTRS.STEM,
    ]
  }

  constructor() {
    super(modalStyles)
  }

  /** Full-res media URL (from the source attribute). */

  get source() {
    return this.getAttribute(MEDIA_ATTRS.SOURCE) || ATTR_VALUES.EMPTY
  }

  /** Webm sibling of an .mp4 source — first <source> when the manifest
      proves it ('' otherwise — an unproven sibling is a doomed request,
      same gate as the figure's resolveMediaSources). */

  get sourceWebm() {
    const webm = webmSibling(this.source)

    return mediaKeyExists(webm) ? webm : ATTR_VALUES.EMPTY
  }

  /** Low-res thumbnail URL shown while the full asset loads.
      The stamped variant is offered only when the manifest proves it —
      an unproven layer would 404 into a transparent img (flat letterbox
      bands — the "missing blur" bug). Images fall back to the full
      source — always present, invisible under cover+blur; videos
      withhold the layer entirely since an mp4 can't be an <img> src. */

  get thumb() {
    const t = this.getAttribute(MEDIA_ATTRS.THUMB) || ATTR_VALUES.EMPTY

    if (!t || mediaKeyExists(t)) return t

    return this.isVideo ? ATTR_VALUES.EMPTY : this.source
  }

  /** Alt text for the media. */

  get alt() {
    return this.getAttribute(MEDIA_ATTRS.ALT) || ATTR_VALUES.EMPTY
  }

  /** Extensionless CDN stem the a11y siblings (.vtt / _longdesc.txt)
      derive from — stamped by the modal openers alongside `source`. */

  get stem() {
    return this.getAttribute(MEDIA_ATTRS.STEM) || ATTR_VALUES.EMPTY
  }

  /** Manifest-gated description tracks for the expanded video — same
      16-locale set the owning <media-figure> emits. */

  get a11yTracks() {
    return descriptionTracks(this.stem, store.getters.getLang())
  }

  /** Localized longdesc URL for the expanded image ('' when ungenerated). */

  get longdesc() {
    return longdescUrl(this.stem, store.getters.getLang())
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

    if (this._closeTimer) {
      clearTimeout(this._closeTimer)

      this._closeTimer = null
    }

    this._genieSheet = null

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
