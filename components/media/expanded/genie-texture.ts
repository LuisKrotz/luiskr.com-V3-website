/**
 * @file media/genie-texture.ts
 * @description Sheet-texture composer for the expand-modal genie warp —
 * bakes the bounded modal card (the media figure's opaque frame +
 * media under its rounded clip) into one offscreen canvas the warp
 * backends consume as their texture. The fullscreen glass veil and
 * viewport chrome are NOT in the sheet — they fade via the veil's
 * opacity transitions while the funnel flies, matching the reference
 * where the window alone warps over the visible desktop. A DOM
 * rasterizer would copy the veil's `visibility:hidden` and cannot
 * reliably cross shadow roots + adopted stylesheets, so the card is
 * composed manually: element rects and computed styles are read once
 * inside the measure task (a single layout pass — no write→read
 * interleave), then the media slot re-stamps live each frame so a
 * playing video keeps moving inside the warp and a late decode
 * upgrades the texture mid-flight.
 */

import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { GENIE_WARP } from '@core/tokens/motion/genie.js'
import { calcMediaScale } from '@core/utils/wasm/wasm-layout.js'
import type { GenieRect } from './genie.js'

/**
 * The composited modal surface the strip-warp backends sample.
 * Coordinates of `mediaBox`/`clipBox` are content-local CSS px — the
 * texture ctx carries the dpr/scale transform, so every stamp (bake
 * and per-frame restamp alike) draws in CSS px.
 */
export interface GenieSheet {
  /** The baked texture canvas — null means "no surface", the warp ghosts. */
  tex: HTMLCanvasElement | null
  /** The texture's 2D context — the live restamp writes into it. */
  ctx: CanvasRenderingContext2D | null
  /**
   * Primary restamp source — the modal's media item. A <video> restamps
   * every frame (live frames); an undecoded <img> restamps once on
   * decode then drops. Null when the item is already baked and static.
   */
  media: CanvasImageSource | null
  /**
   * Standby restamp source — the video's poster primed as an off-DOM
   * Image; fills the media box until the video reports real pixels.
   * Drops after its first stamp.
   */
  back: CanvasImageSource | null
  /** Content-local CSS-px box the media item occupies (contain-fit inside). */
  mediaBox: GenieRect
  /** Content-local CSS-px clip — the figure's rounded rect. */
  clipBox: GenieRect
  /** The figure's corner radius (CSS px) applied to the restamp clip. */
  clipRadius: number
}

/** Intrinsic pixel dims of a drawable — naturalWidth for images, videoWidth for video. */
const dimsOf = (src: CanvasImageSource): { w: number; h: number } => {
  const s = src as {
    naturalWidth?: number
    naturalHeight?: number
    videoWidth?: number
    videoHeight?: number
  }

  return { w: s.naturalWidth || s.videoWidth || 0, h: s.naturalHeight || s.videoHeight || 0 }
}

/**
 * An off-DOM Image primed with a video's poster — drawImage on an
 * undecoded <video> paints nothing, but the poster URL is already in
 * the browser cache (the figure card showed it), so the detached Image
 * decodes within a frame or two and the restamp loop adopts it.
 * @param el The media element — `poster` only exists on <video>.
 * @returns The primed image, or null when no poster is set.
 */
const posterSource = (el: Element): CanvasImageSource | null => {
  const poster = el.getAttribute(MEDIA_ATTRS.POSTER) || ATTR_VALUES.EMPTY

  if (!poster) return null

  const img = new Image()

  img.src = poster

  return img
}

/**
 * Contain-fits a source into a box — mirrors the media item's
 * `object-fit: scale-down` so the baked frame lands exactly where the
 * letterboxed pixels live (not stretched across the item's box). The
 * `, 1)` in the scale is the scale-down half of the contract: a source
 * smaller than its box draws at natural size, never upscaled — the same
 * guarantee the modal's CSS gives the live element.
 * Writes into `out` (a scratch rect — no allocation per call).
 * @param sw Source pixel width.
 * @param sh Source pixel height.
 * @param box The item's content-local box.
 * @param out Scratch rect receiving the fitted draw box.
 */
export const fitContain = (sw: number, sh: number, box: GenieRect, out: GenieRect): void => {
  const s = calcMediaScale(sw, sh, box.w, box.h)
  const w = sw * s
  const h = sh * s

  out.x = box.x + (box.w - w) / 2
  out.y = box.y + (box.h - h) / 2
  out.w = w
  out.h = h
}

/**
 * Stamps the media figure: the figure's background + rounded-corner
 * clip, the placeholder layer, then the media item contain-fitted.
 * Returns the geometry the renderer needs for per-frame restamps
 * (the item's box, the figure clip, the corner radius) — all
 * content-local CSS px.
 * @param ctx The texture context.
 * @param content The modal content root.
 * @param ox Content-local origin x.
 * @param oy Content-local origin y.
 * @param out Scratch rect for fit math (reused per call).
 * @returns The figure geometry, or null when the figure is absent.
 */
const stampFigure = (
  ctx: CanvasRenderingContext2D,
  content: HTMLElement,
  ox: number,
  oy: number,
  out: GenieRect
): { mediaBox: GenieRect; clipBox: GenieRect; clipRadius: number; item: Element | null } => {
  // The item resolves independently of the figure — a media box can
  // still restamp even when the figure frame itself is absent/zero.
  const item = content.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

  const empty = {
    mediaBox: { x: 0, y: 0, w: 0, h: 0 },
    clipBox: { x: 0, y: 0, w: 0, h: 0 },
    clipRadius: 0,
    item,
  }

  const figure = content.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`)

  if (!figure) return empty

  const fr = figure.getBoundingClientRect()

  if (!(fr.width > 0) || !(fr.height > 0)) return empty

  const fcs = getComputedStyle(figure)

  const fx = fr.left - ox
  const fy = fr.top - oy

  const radius = parseFloat(fcs.borderTopLeftRadius || CHAR_STRINGS.EMPTY) || 0

  ctx.save()
  ctx.beginPath()

  if (radius > 0 && typeof ctx.roundRect === TYPE_STRINGS.FUNCTION) {
    ctx.roundRect(fx, fy, fr.width, fr.height, radius)
  } else {
    ctx.rect(fx, fy, fr.width, fr.height)
  }

  ctx.clip()
  ctx.fillStyle = fcs.backgroundColor
  ctx.fillRect(fx, fy, fr.width, fr.height)

  // The blur-up placeholder fills the figure box (absolute inset 0).
  const ph = content.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_PLACEHOLDER}`)

  if (ph && dimsOf(ph as CanvasImageSource).w > 0) {
    ctx.drawImage(ph as CanvasImageSource, fx, fy, fr.width, fr.height)
  }

  const mediaBox = { x: 0, y: 0, w: 0, h: 0 }
  const clipBox = { x: fx, y: fy, w: fr.width, h: fr.height }

  if (item) {
    const ir = item.getBoundingClientRect()

    mediaBox.x = ir.left - ox
    mediaBox.y = ir.top - oy
    mediaBox.w = ir.width
    mediaBox.h = ir.height

    const dims = dimsOf(item as CanvasImageSource)

    if (dims.w > 0 && mediaBox.w > 0 && mediaBox.h > 0) {
      fitContain(dims.w, dims.h, mediaBox, out)
      ctx.drawImage(item as CanvasImageSource, 0, 0, dims.w, dims.h, out.x, out.y, out.w, out.h)
    }
  }

  ctx.restore()

  return { mediaBox, clipBox, clipRadius: radius, item }
}

/**
 * Bakes the bounded modal card into an offscreen canvas — the sheet
 * the genie funnel warps. The extent is the media-figure rect (the
 * "window" — reference-faithful): its opaque frame, rounded clip,
 * placeholder and media item, all figure-local. The fullscreen glass
 * veil and viewport chrome stay out of the texture and fade under
 * `.expand-modal-genie-veil` while the funnel flies. One layout pass
 * (batched rect + style reads), one canvas, ~a dozen draw calls; the
 * result is a stable texture so the per-frame work stays a pure strip
 * resample. The texture long edge caps at GENIE_WARP.TEX_MAX_PX —
 * enough sharpness for a 700ms warp without an unbounded framebuffer.
 * @param content The modal content root (the figure lives inside it).
 * @param dpr The overlay's device-pixel cap (already clamped).
 * @returns The sheet record, or null when the card has no box or the
 *   canvas refuses a 2D context (the warp then ghosts).
 */
export const buildGenieSheet = (content: HTMLElement, dpr: number): GenieSheet | null => {
  const figure = content.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_FIGURE}`)

  const itemEl = content.querySelector(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM}`)

  // The card extent — figure first (the window), then the bare item,
  // then the content root, mirroring sheetRect's fallback chain.
  const hit = [figure, itemEl, content]
    .map((el) => el && { el, r: el.getBoundingClientRect() })
    .find((c) => c && c.r.width > 0 && c.r.height > 0)

  if (!hit) return null

  const cr = hit.r

  const scale = Math.min(dpr, GENIE_WARP.TEX_MAX_PX / Math.max(cr.width, cr.height))

  const tex = document.createElement(HTML_TAGS.CANVAS)

  tex.width = Math.max(1, Math.round(cr.width * scale))
  tex.height = Math.max(1, Math.round(cr.height * scale))

  const ctx = tex.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return null

  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const ox = cr.left
  const oy = cr.top

  // The card frame — the figure's opaque frame + rounded clip +
  // placeholder + item, all stamped figure-local. The viewport chrome
  // (title bar, bottom close) fades under the veil — it is not part of
  // the warp's texture.
  const scratch = { x: 0, y: 0, w: 0, h: 0 }
  const fig = stampFigure(ctx, content, ox, oy, scratch)

  // Live-restamp wiring — a <video> restamps every frame (the frames
  // keep moving inside the warp); an <img> undecoded at bake time
  // restamps once on decode. The poster prime stands in until the
  // video reports pixels.
  const item = fig.item

  const isVideo = item
    ? item.classList.contains(EXPAND_MODAL_CLASSES.EXPAND_MODAL_MEDIA_ITEM_VIDEO)
    : false

  const mediaDims = item ? dimsOf(item as CanvasImageSource) : { w: 0, h: 0 }

  const media = item && (isVideo || mediaDims.w === 0) ? (item as CanvasImageSource) : null

  const back = isVideo && mediaDims.w === 0 ? posterSource(item as Element) : null

  return {
    tex,
    ctx,
    media,
    back,
    mediaBox: fig.mediaBox,
    clipBox: fig.clipBox,
    clipRadius: fig.clipRadius,
  }
}
