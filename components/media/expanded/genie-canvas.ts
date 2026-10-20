/**
 * @file media/genie-canvas.ts
 * @description 2D-canvas backend for the expand-modal genie warp — the
 * always-available renderer (mobile, every browser, the WebGPU
 * kill-switch off). Slices the composited modal sheet texture into
 * horizontal strips and applies the shared genie field — the per-row
 * staggered eased lerp the ui-layouts mac-genie reference implements
 * (see `core/tokens/motion/genie.ts`): leading-edge rows start their
 * journey first while far-edge rows wait out the stagger, so the
 * funnel's S-walls emerge from the easing alone. A soft white radial
 * flash lands on the figure for the last quarter of the run. The
 * sheet's media slot re-stamps live sources before each strip pass so
 * a playing video stays live inside the warp. Frame loop is
 * zero-allocation: strip math writes into a scratch Float32Array, the
 * glow gradient is built once in the ctor. All draw calls run in CSS
 * px — the caller installs a dpr transform on the ctx once.
 */

import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { GENIE_WARP } from '@core/tokens/motion/genie.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { fitContain } from './genie-texture.js'
import type { GenieSheet } from './genie-texture.js'
import type { GenieRect, GenieRenderer } from './genie.js'

/** Ghost-band alpha for the undecoded-media silhouette (subtle by design). */
const GHOST_ALPHA = 0.22

/**
 * easeInOutCubic — the row clock for the horizontal pinch. Zero slope
 * at both ends so the walls ease into the funnel and land softly.
 * @param t Progress 0..1.
 * @returns Eased progress 0..1.
 */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * The 2D genie renderer. Owns the ctx, the baked sheet and the strip
 * scratch buffers; `frame(dt, p)` draws one animation frame and
 * reports false only when the context is dead.
 */
export class GenieCanvas2D implements GenieRenderer {
  /** The overlay canvas — removed from the shadow on dispose. */
  private readonly canvas: HTMLCanvasElement

  /** 2D context — the caller owns the canvas element + its dpr transform. */
  private readonly ctx: CanvasRenderingContext2D

  /**
   * The composited modal sheet — one canvas baked at measure time that
   * carries the ENTIRE modal surface (dark panel, chrome text, media
   * figure). `src`/`srcW`/`srcH` are its texture-space dims; a null
   * sheet paints the soft accent silhouette (the untextured ghost).
   */
  private readonly sheet: GenieSheet | null

  /** The sheet's texture canvas — the strip sampler's source. */
  private src: CanvasImageSource | null

  /** Texture pixel size — the baked sheet's canvas dims. */
  private srcW: number
  private srcH: number

  /**
   * Live restamp slot — the modal's media item. A <video> restamps
   * every frame (frames move inside the warp); an undecoded <img>
   * drops itself after its first successful stamp.
   */
  private liveMedia: CanvasImageSource | null

  /**
   * Standby restamp slot — the primed poster Image standing in while
   * the video decodes; drops after its first stamp.
   */
  private liveBack: CanvasImageSource | null

  /** Origin rect (CSS px, viewport space). */
  private readonly from: GenieRect

  /** Destination rect (CSS px, viewport space). */
  private readonly to: GenieRect

  /** True while opening (origin → modal); false on the collapse. */
  private readonly opening: boolean

  /**
   * Ghost-silhouette fill — the rgba() string composed once in the
   * ctor; a per-frame template string would allocate at 240Hz.
   */
  private readonly ghost: string

  /**
   * Dock-flash gradient — the white radial bloom painted at the
   * figure's center for the last quarter of the run (the reference's
   * suck punctuation). Built once in the ctor: the figure rect never
   * moves mid-session, and a per-frame createRadialGradient would
   * violate the zero-allocation frame budget. Null when the ctx lacks
   * gradient support — the flash is decorative, never load-bearing.
   */
  private readonly glow: CanvasGradient | null

  /**
   * Strip-boundary scratch — the field evaluated at each strip edge
   * (STRIPS+1 boundaries): viewport-space y, left-corner x and
   * right-corner x. Neighbouring bands share a boundary corner, so the
   * parallelogram quads stay airtight along the funnel's S-walls;
   * allocating per frame would violate the zero-allocation frame
   * budget.
   */
  private readonly bdY: Float32Array

  /** Per-boundary left-corner x — same scratch discipline as bdY. */
  private readonly bdL: Float32Array

  /** Per-boundary right-corner x — same scratch discipline as bdY. */
  private readonly bdR: Float32Array

  /**
   * The caller-installed ctx transform (the dpr scale) captured as six
   * scalars — each strip's parallelogram composes under it via
   * setTransform, then the pass restores it. Read once in the ctor:
   * a per-frame getTransform() allocates a DOMMatrix at 240Hz.
   */
  private readonly ba: number = 1
  private readonly bb: number = 0
  private readonly bc: number = 0
  private readonly bd: number = 1
  private readonly be: number = 0
  private readonly bf: number = 0

  /** Overlay size in CSS px — the dock flash's full-surface stamp. */
  private readonly viewW: number
  private readonly viewH: number

  /** Restamp-fit scratch rect — zero-allocation frame discipline. */
  private readonly fit: GenieRect = { x: 0, y: 0, w: 0, h: 0 }

  /**
   * Builds the renderer around the composited sheet. The sheet's media
   * slot re-stamps live sources each frame — the <video> keeps playing
   * inside the warp and a late decode upgrades the texture mid-flight —
   * so the funnel never shows a flat ghost rectangle. A null sheet (or
   * one without a texture) paints the soft accent silhouette.
   * @param canvas The overlay canvas (device-px sized already).
   * @param ctx Its 2D context — caller validated non-null.
   * @param sheet The composited modal sheet from `buildGenieSheet`.
   * @param from Origin rect in viewport CSS px.
   * @param to Destination rect in viewport CSS px.
   * @param opening True on open (from→to), false on close.
   * @param host Element used to resolve theme CSS vars.
   */
  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    sheet: GenieSheet | null,
    from: GenieRect,
    to: GenieRect,
    opening: boolean,
    host: HTMLElement
  ) {
    this.canvas = canvas
    this.ctx = ctx
    this.sheet = sheet
    this.src = sheet && sheet.tex ? sheet.tex : null
    this.liveMedia = sheet ? sheet.media : null
    this.liveBack = sheet ? sheet.back : null
    this.from = from
    this.to = to
    this.opening = opening

    this.srcW = sheet && sheet.tex ? sheet.tex.width : to.w || 1
    this.srcH = sheet && sheet.tex ? sheet.tex.height : to.h || 1

    this.bdY = new Float32Array(GENIE_WARP.STRIPS + 1)
    this.bdL = new Float32Array(GENIE_WARP.STRIPS + 1)
    this.bdR = new Float32Array(GENIE_WARP.STRIPS + 1)

    // Base ctx transform (the caller's dpr scale) — captured as scalars
    // so strip quads compose under it without per-frame DOMMatrix churn.
    const base = typeof ctx.getTransform === TYPE_STRINGS.FUNCTION ? ctx.getTransform() : null

    if (base) {
      this.ba = base.a
      this.bb = base.b
      this.bc = base.c
      this.bd = base.d
      this.be = base.e
      this.bf = base.f
    }

    this.viewW = this.ba !== 0 ? canvas.width / this.ba : canvas.width
    this.viewH = this.bd !== 0 ? canvas.height / this.bd : canvas.height

    // Strip resample quality — 'low' bilinear smears the sheet texture
    // into streaks through the funnel's compression; 'high' keeps the
    // warped surface readable mid-flight.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = STATE_STRINGS.HIGH as ImageSmoothingQuality

    const accent = parseCssColor(
      getComputedStyle(host).getPropertyValue(THEME_CSS_PROPS.COLOR_ACCENT)
    )

    const tint = accent ? [accent[0], accent[1], accent[2]] : [1, 1, 1]

    const tint255 = `${(tint[0] * 255) | 0},${(tint[1] * 255) | 0},${(tint[2] * 255) | 0}`

    this.ghost = `rgba(${tint255},${GHOST_ALPHA})`

    // Dock flash — the figure rect is D (see drawStrips for the S/D
    // pick); the white bloom rides the reference's end-of-run accent.
    const D = opening ? from : to

    const gr = Math.min(D.w, D.h) * GENIE_WARP.GLOW_RADIUS_FRAC
    const gx = D.x + D.w / 2
    const gy = D.y + D.h / 2

    const g =
      gr > 0 && typeof ctx.createRadialGradient === TYPE_STRINGS.FUNCTION
        ? ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
        : null

    const white = parseCssColor(getComputedStyle(host).getPropertyValue(THEME_CSS_PROPS.WHITE))

    const w255 = white ? `${white[0]},${white[1]},${white[2]}` : tint255

    g?.addColorStop(0, `rgba(${w255},1)`)
    g?.addColorStop(1, `rgba(${w255},0)`)

    this.glow = g ?? null
  }

  /**
   * Re-stamps the sheet's media slot before the strip pass. The media
   * item leads while it reports pixels (a <video> stamps every frame —
   * its frames keep playing inside the warp; an <img> drops the slot
   * after its first stamp since the bitmap is static). The primed
   * poster fills in while the video is still decoding, then drops.
   * Nothing allocates: the contain-fit writes into the scratch `fit`
   * rect and the draw runs inside the figure's saved clip.
   */
  private restamp(): void {
    const sheet = this.sheet
    const tctx = sheet ? sheet.ctx : null

    if (!sheet || !tctx || !sheet.tex) return

    const media = this.liveMedia
    const back = this.liveBack

    let src: CanvasImageSource | null = null
    let sw = 0
    let sh = 0

    if (media) {
      const m = media as { naturalWidth?: number; videoWidth?: number }

      sw = m.naturalWidth || m.videoWidth || 0

      if (sw > 0) {
        src = media

        const mh = media as { naturalHeight?: number; videoHeight?: number }

        sh = mh.naturalHeight || mh.videoHeight || 0
      }
    }

    if (!src && back) {
      const b = back as { naturalWidth?: number; naturalHeight?: number }

      sw = b.naturalWidth || 0
      sh = b.naturalHeight || 0

      if (sw > 0) src = back
    }

    if (!src || !sh) return

    // Static sources retire after their stamp — only a live video keeps
    // its slot (its pixels change every frame).
    if (src === media && !(src as { videoWidth?: number }).videoWidth) this.liveMedia = null

    if (src === back) this.liveBack = null

    const box = sheet.mediaBox
    const clip = sheet.clipBox

    if (!(box.w > 0) || !(box.h > 0)) return

    fitContain(sw, sh, box, this.fit)

    tctx.save()
    tctx.beginPath()

    if (sheet.clipRadius > 0 && typeof tctx.roundRect === TYPE_STRINGS.FUNCTION) {
      tctx.roundRect(clip.x, clip.y, clip.w, clip.h, sheet.clipRadius)
    } else {
      tctx.rect(clip.x, clip.y, clip.w, clip.h)
    }

    tctx.clip()
    tctx.drawImage(src, 0, 0, sw, sh, this.fit.x, this.fit.y, this.fit.w, this.fit.h)
    tctx.restore()
  }

  /**
   * `frame` — one animation tick: clear, strip-warp the sheet texture,
   * stamp the dock flash in the run's last quarter, restore composite
   * state.
   * @param _dt Frame delta seconds — unused by the field (progress is
   *   positional, not integrated) but part of the renderer contract.
   * @param p Eased funnel progress 0..1 (0 = modal sheet, 1 = figure funnel).
   * @returns False when the context is gone (caller force-settles).
   */
  frame(_dt: number, p: number): boolean {
    const ctx = this.ctx

    // Live-media restamp — the video frame (or a late-decoding poster)
    // updates the baked sheet before the strips sample it.
    this.restamp()

    // Clear in device px — the ctx transform maps CSS→device, so the
    // clear must run under the identity to cover the whole surface
    // exactly (a CSS-px clearRect would over-clear dpr× the canvas).
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()

    this.drawStrips(p)

    // Dock flash — the white radial bloom at the figure's center while
    // the sheet lands (the reference's final-quarter accent). Ease-out
    // so the flash peaks fast then breathes out into the hand-off.
    if (this.glow && p > GENIE_WARP.GLOW_START && p < 1) {
      const gp = (p - GENIE_WARP.GLOW_START) / (1 - GENIE_WARP.GLOW_START)

      ctx.globalAlpha = (1 - (1 - gp) * (1 - gp)) * GENIE_WARP.GLOW_ALPHA
      ctx.fillStyle = this.glow
      ctx.fillRect(0, 0, this.viewW, this.viewH)
      ctx.globalAlpha = 1
    }

    return true
  }

  /**
   * Draws the sheet as STRIPS horizontal bands under the genie field —
   * the per-row staggered eased lerp the ui-layouts mac-genie
   * reference implements. The field always warps the MODAL rect (S)
   * toward the FIGURE rect (D) — on open `S=to`/`D=from`, on close
   * `S=from`/`D=to`; `p` arrives already flipped (see genie.ts).
   *
   * Strip math (viewport CSS px — the ctx transform maps to device
   * px): rows index in "down-space" — ty runs 0 at the sheet's far
   * edge to 1 at the figure-facing edge — and each row owns two
   * staggered clocks:
   *   xs = (1−ty)·STAGGER_X   xe = easeInOutCubic(clamp((p−xs)/(1−xs)))
   *   ys = (1−ty)·STAGGER_Y   ye = easeInQuad(    clamp((p−ys)/(1−ys)))
   * The leading edge's rows start at p=0 while the far edge waits out
   * its stagger — the funnel's S-walls and the "window flows through
   * the neck" look emerge from the stagger alone (no sine bow, no
   * shear term). Each row lands on its proportional row inside the
   * card rect at p=1 — the canonical point-collapse mouth suits a dock
   * icon, not a half-viewport card. Rows stay horizontal (y depends
   * only on ty), so bands tile exactly — the shared boundary corners
   * keep neighbouring parallelograms airtight through the funnel.
   * @param p Eased funnel progress 0..1 (0 = modal, 1 = figure).
   */
  private drawStrips(p: number): void {
    const ctx = this.ctx

    // Direction-free field frame: S is the modal rect, D the figure
    // rect — `opening` only selects which of from/to plays each role;
    // `p` arrives already flipped (see genie.ts).
    const S = this.opening ? this.to : this.from
    const D = this.opening ? this.from : this.to

    // Down-space basis — `sgn`/`farY` map the field's y back into
    // viewport coords: farY is the sheet edge AWAY from the figure.
    const nearBottom = D.y + D.h / 2 > S.y + S.h / 2

    const sgn = nearBottom ? 1 : -1
    const farY = nearBottom ? S.y : S.y + S.h

    const W = S.w
    const H = S.h

    // Adaptive tessellation — ~STRIP_TARGET_PX tall bands, floored at
    // MIN_STRIPS and capped at STRIPS (the scratch arrays' fixed size).
    // The fixed 96-band pass stair-stepped the funnel's sloped walls at
    // ~9px pitch; ~5px bands keep the walls raster-smooth.
    const n = Math.min(
      GENIE_WARP.STRIPS,
      Math.max(GENIE_WARP.MIN_STRIPS, Math.ceil(H / GENIE_WARP.STRIP_TARGET_PX))
    )

    // Landing rect in down-space — iYfar is the far-edge → figure
    // far-edge distance, iH the figure's thickness.
    const iYfar = nearBottom ? D.y - S.y : S.y + S.h - (D.y + D.h)
    const iH = D.h

    // Hoisted field terms — the per-row stagger windows are affine in
    // ty, so the loop only runs the two clamps + eases.
    const stagX = GENIE_WARP.STAGGER_X
    const stagY = GENIE_WARP.STAGGER_Y

    const shiftL = D.x - S.x
    const shiftR = D.x + D.w - S.x - W

    const srcHn = this.srcH / n
    const srcW = this.srcW

    const bdY = this.bdY
    const bdL = this.bdL
    const bdR = this.bdR

    // Pass 1 — the field at each strip boundary (STRIPS+1 rows). Bands
    // share boundary corners, so the per-band parallelograms tile
    // airtight along the funnel's sloped S-walls — the previous
    // axis-aligned rects stair-stepped the diagonal walls into a
    // visible band staircase.
    for (let i = 0; i <= n; i++) {
      const ty = nearBottom ? i / n : 1 - i / n

      // Staggered horizontal clock — leading rows (ty→1) start at
      // p=0, far-edge rows wait out (1−ty)·STAGGER_X of the run.
      const xs = (1 - ty) * stagX
      const xp = Math.min(1, Math.max(0, (p - xs) / (1 - xs)))
      const xe = easeInOutCubic(xp)

      // Staggered vertical clock — quadratic ease-in: the collapse
      // accelerates into the card (the dock suck).
      const ys = (1 - ty) * stagY
      const yp = Math.min(1, Math.max(0, (p - ys) / (1 - ys)))

      // Row ty lands on iYfar + ty·iH at ye=1 — the warped sheet
      // converges exactly onto the card it hands off to.
      const tyH = ty * H

      bdY[i] = farY + sgn * (tyH + (iYfar + ty * iH - tyH) * yp * yp)
      bdL[i] = S.x + shiftL * xe
      bdR[i] = S.x + W + shiftR * xe
    }

    // Pass 2 — each band draws its texture slice through an affine
    // transform that maps the unit square onto the band's
    // parallelogram: top edge (bdL[i],bdY[i])→(bdR[i],bdY[i]) stays
    // horizontal (rows stay horizontal in the field), the shear
    // term c = xBl−xTl tilts the side walls so the S-curve renders
    // continuous instead of stair-stepped. The draw width/height pick
    // the larger of the band's two edges plus EDGE_OVERDRAW_PX —
    // where the funnel necks, adjacent wall widths differ and the
    // overdraw keeps the opaque seam airtight. The composed matrix is
    // base ∘ band so the caller's dpr scale stays installed.
    const sa = this.ba
    const sb = this.bb
    const sc = this.bc
    const sd = this.bd
    const se = this.be
    const sf = this.bf
    const od = GENIE_WARP.EDGE_OVERDRAW_PX

    if (!this.src) ctx.fillStyle = this.ghost

    for (let i = 0; i < n; i++) {
      const yT = bdY[i]
      const hh = bdY[i + 1] - yT
      const xTl = bdL[i]
      const xBl = bdL[i + 1]
      const wT = bdR[i] - xTl
      const wB = bdR[i + 1] - xBl
      // A parallelogram can't express the width change between the
      // band's two edges — mid-width splits the residual error
      // symmetrically so neither wall grows a full-delta sawtooth.
      const w = (wT + wB) * 0.5 + od
      // Bands collapsing toward the card converge to sub-pixel heights
      // — skipping them leaves hairline gaps that read as stripes on
      // the funnel. Clamp to a sliver instead: the src slice stretches
      // into the gap and the surface stays continuous.
      const dh = Math.max(hh, GENIE_WARP.MIN_BAND_PX) + od

      if (w <= od) continue

      if (this.src) {
        ctx.setTransform(
          sa * w,
          sb * w,
          sa * (xBl - xTl) + sc * dh,
          sb * (xBl - xTl) + sd * dh,
          sa * xTl + sc * yT + se,
          sb * xTl + sd * yT + sf
        )
        ctx.drawImage(this.src, 0, i * srcHn, srcW, srcHn, 0, 0, 1, 1)
      } else {
        ctx.beginPath()
        ctx.moveTo(xTl, yT)
        ctx.lineTo(xTl + w, yT)
        ctx.lineTo(xBl + w, yT + hh)
        ctx.lineTo(xBl, yT + hh)
        ctx.closePath()
        ctx.fill()
      }
    }

    // Restore the caller-installed base transform (the dpr scale).
    ctx.setTransform(sa, sb, sc, sd, se, sf)
  }

  /** Removes the overlay canvas — the sheet ctx dies with the session. */
  dispose(): void {
    this.canvas.remove()
  }
}
