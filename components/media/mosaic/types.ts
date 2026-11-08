/**
 * @file media/mosaic/types.ts
 * @description Shared shapes for <media-mosaic>: the media item contract
 * (mirrors the project view's ProjectMediaItem), the per-tile style object
 * the packer emits, and the structural contract of the nested
 * <custom-carousel> used as the ≤640px fallback.
 */

/**
 * A media row inside the mosaic — `src` is the extensionless CDN stem,
 * `size` the intrinsic [w,h] for aspect layout, `label`/`class`/`isVideo`/
 * `canExpand` the render modifiers. Index signature passes through extra
 * CMS fields.
 */
export interface MediaMosaicItem {
  src: string
  size?: number[]
  label?: string
  class?: string
  isVideo?: boolean
  canExpand?: boolean
  [key: string]: unknown
}

/** Style objects emitted per placed tile. */
export interface MosaicTileStyle {
  /** Absolutely-positioned tile shell box (top/left/width/height). */
  tile: Record<string, string>
}

/**
 * Structural contract for the fallback <custom-carousel> — the mosaic
 * calls `configure()` after rendering it on ≤640px viewports, mirroring
 * the project binder's call exactly (the element is registered by the
 * importing view, so only the method surface is typed here).
 */
export interface CarouselLikeElement extends HTMLElement {
  configure(_opts: { items?: unknown[]; folder?: string; forceActive?: boolean }): void
}
