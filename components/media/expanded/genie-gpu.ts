/**
 * @file media/genie-gpu.ts
 * @description WebGPU/Rust backend for the expand-modal genie warp —
 * mounts the `genie` crate on the overlay canvas through the shared
 * widget bridge (`mountWebGpuWidget`). When the render-worker route is
 * available the artifact, the GPUDevice, and every draw call live on a
 * dedicated worker thread; the main thread only forwards uniforms +
 * `frame(dt)` ticks, which is the multi-threaded render path. The
 * media texture is decoded in the wasm-media worker pool and uploaded
 * as an ImageBitmap (zero-copy on the worker route). Any failure
 * resolves null — the driver falls through to the 2D backend.
 */

import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { EXPAND_MODAL_CLASSES } from '@core/tokens/classes/modal.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { localMediaCache } from '@core/utils/media/local-media-cache.js'
import { wasmMediaThreads } from '@core/utils/wasm/wasm-media-threads.js'
import { VIDEO_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import type { MediaExpanded } from '../MediaExpanded.js'
import type { GenieSheet } from './genie-texture.js'
import type { GenieRect, GenieRenderer } from './genie.js'

/**
 * The crate's wasm-bindgen surface — mirrors `rust/genie/src/lib.rs`.
 * Method calls on a worker-routed handle are fire-and-forget
 * postMessages (transferables move zero-copy); in-page mounts call the
 * widget directly. Either way the contract is synchronous-looking.
 */
interface GenieWasm {
  /**
   * Pushes the warp rect pair — viewport CSS px. Always
   * (modal rect, figure rect) regardless of direction.
   * @param fx @param fy @param fw @param fh The modal rect.
   * @param tx @param ty @param tw @param th The figure rect.
   */
  set_rects(
    fx: number,
    fy: number,
    fw: number,
    fh: number,
    tx: number,
    ty: number,
    tw: number,
    th: number
  ): void
  /**
   * Pushes the field flags — direction + which edge faces the figure.
   * @param opening 1 while opening, 0 on the collapse.
   * @param nearBottom 1 when the figure sits below the modal.
   */
  set_flags(opening: number, nearBottom: number): void
  /**
   * Pushes the accent rgba 0-1 — the untextured ghost fill reads it.
   * @param r @param g @param b @param a Rgba channels.
   */
  set_tint(r: number, g: number, b: number, a: number): void
  /**
   * Pushes the eased funnel progress — the driver owns the clock.
   * @param p Funnel progress 0..1 (0 = modal sheet, 1 = figure funnel).
   */
  set_progress(p: number): void
  /**
   * Uploads the decoded media frame — callable repeatedly (the thumb
   * lands first, the full-res upgrade follows when it decodes).
   * @param bitmap The decoded frame — transferred on the worker route.
   * @param w Frame width px.
   * @param h Frame height px.
   */
  upload_bitmap(bitmap: ImageBitmap, w: number, h: number): void
  /**
   * One render tick — the crate repacks uniforms and draws the mesh.
   * @param dt Frame delta seconds.
   * @returns False when the surface is stale/lost.
   */
  frame(dt: number): boolean
}

/**
 * Decodes the media in the wasm worker pool and uploads the bitmap to
 * the crate — fire-and-forget: until the texture lands the shader
 * draws the accent-tinted ghost, so a slow decode never stalls the
 * warp. Thumb first (page-cached, decodes in a frame or two); the
 * full-res source follows as an upgrade.
 * @param w The crate handle.
 * @param el The <media-expanded> element — thumb/source/dimensions.
 */
const uploadMediaTexture = (w: GenieWasm, el: MediaExpanded): void => {
  const push = (url: string | null): void => {
    if (!url) return

    wasmMediaThreads
      .decodeMediaInSeparateThread(
        url,
        el.mediaWidth || VIDEO_DIMENSIONS.VIDEO_DEFAULT_WIDTH,
        el.mediaHeight || VIDEO_DIMENSIONS.VIDEO_DEFAULT_HEIGHT
      )
      .then((bitmap) => {
        if (bitmap) w.upload_bitmap(bitmap, bitmap.width, bitmap.height)
      })
      .catch(() => undefined)
  }

  localMediaCache
    .fetchOrGetLocalMedia(el.thumb || el.source)
    .then((localUrl) => push(localUrl))
    .catch(() => undefined)
}

/**
 * Uploads the composited modal sheet as the warp texture — the whole
 * surface (glass panel + chrome text + media figure) funnels into the
 * figure, matching the 2D backend. `createImageBitmap` on the baked
 * canvas is a GPU-side copy (cheap, fire-and-forget); a missing/uneven
 * bake or a rejected raster falls back to the media-file upload.
 * @param w The crate handle.
 * @param el The <media-expanded> element — media fallback source.
 * @param sheet The composited sheet from `buildGenieSheet`.
 */
const uploadSheetTexture = (
  w: GenieWasm,
  el: MediaExpanded,
  sheet: GenieSheet | null | undefined
): void => {
  if (!sheet || !sheet.tex || typeof createImageBitmap !== TYPE_STRINGS.FUNCTION) {
    uploadMediaTexture(w, el)

    return
  }

  // premultiplyAlpha:'none' keeps straight alpha — fs_mesh premultiplies
  // rgb×a itself, so a premultiplied bitmap would double-darken the
  // translucent glass panel.
  createImageBitmap(sheet.tex, { premultiplyAlpha: 'none' })
    .then((bitmap) => {
      w.upload_bitmap(bitmap, bitmap.width, bitmap.height)
    })
    .catch(() => uploadMediaTexture(w, el))
}

/**
 * Attempts the WebGPU/Rust genie backend on the overlay canvas.
 * MANUAL drive — the genie driver's own eased clock owns `frame(dt)`
 * pacing so both backends render identical progress sequences.
 * @param canvas The overlay canvas (device-px sized by the driver).
 * @param el The <media-expanded> element — media source/dimensions.
 * @param from Origin rect, viewport CSS px.
 * @param to Destination rect, viewport CSS px.
 * @param opening True on open, false on the collapse.
 * @param sheet The composited modal sheet — uploaded as the warp
 *   texture when present (the media-file decode stands in otherwise).
 * @returns The renderer wrapping the widget handle, or null on any
 *   capability/artifact/init failure (the driver falls back to 2D).
 */
export const mountGenieGpu = async (
  canvas: HTMLCanvasElement,
  el: MediaExpanded,
  from: GenieRect,
  to: GenieRect,
  opening: boolean,
  sheet?: GenieSheet | null
): Promise<GenieRenderer | null> => {
  const handle = await mountWebGpuWidget(GPU_WIDGET_KINDS.GENIE, canvas, undefined, {
    drive: GPU_WIDGET_DRIVE.MANUAL,
  })

  if (!handle) {
    // The worker route may have transferred the canvas and swapped in a
    // dead clone — sweep every element carrying the overlay class out of
    // the shadow so a failed mount leaves nothing behind. The sweep
    // roots at el.shadowRoot because a transferred/swapped canvas has
    // no parentElement to query from.
    canvas.remove()

    el.shadowRoot
      ?.querySelectorAll(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS}`)
      .forEach((c) => c.remove())

    return null
  }

  const w = handle.widget as unknown as GenieWasm

  // Direction-free field frame — the uniform pair is always
  // (modal rect, figure rect); `opening` only flips the eased funnel
  // progress the driver pushes (see genie.ts).
  const modal = opening ? to : from
  const figure = opening ? from : to

  const nearBottom = figure.y + figure.h / 2 > modal.y + modal.h / 2 ? 1 : 0

  w.set_rects(modal.x, modal.y, modal.w, modal.h, figure.x, figure.y, figure.w, figure.h)

  w.set_flags(opening ? 1 : 0, nearBottom)

  const accent = parseCssColor(getComputedStyle(el).getPropertyValue(THEME_CSS_PROPS.COLOR_ACCENT))

  if (accent) w.set_tint(accent[0], accent[1], accent[2], 1)

  uploadSheetTexture(w, el, sheet)

  return {
    frame: (dt: number, p: number): boolean => {
      w.set_progress(p)

      return w.frame(dt) !== false
    },
    dispose: () => {
      handle.destroy()

      // The live canvas (or its worker-route clone) leaves with the widget.
      canvas.remove()

      el.shadowRoot
        ?.querySelectorAll(`.${EXPAND_MODAL_CLASSES.EXPAND_MODAL_GENIE_CANVAS}`)
        .forEach((c) => c.remove())
    },
  }
}
