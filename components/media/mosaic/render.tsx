/**
 * @file media/mosaic/render.tsx
 * @description JSX for <media-mosaic>: the packed tile wall (one
 * <media-figure> per media item, sized by the skyline pack) or the
 * ≤640px fallback — a plain <custom-carousel> the facade configures
 * post-render, identical to the one the view emits for regular groups.
 */
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_MOSAIC_CLASSES } from '@core/tokens/classes/media-mosaic.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { h } from '@core/jsx.js'
import type { MediaMosaicItem } from './types.js'
import type { MediaMosaic } from '../MediaMosaic.js'

/**
 * One wall tile — a positioned wrapper carrying the packed box plus a
 * <media-figure> at the item's intrinsic size (the figure's own sizing
 * contract clamps the painted box at --mf-natural-*; the tile is never
 * larger than the source). The sr-only h4 mirrors carousel slides: the
 * AT jump target that names this media, tabindex −1 so SR focus can land.
 * @param host The MediaMosaic element.
 * @param item The media descriptor.
 * @param i Item index (matches host.tiles order).
 */
const renderTile = (host: MediaMosaic, item: MediaMosaicItem, i: number) => {
  const itemW = item.size?.[0] || GENERIC_DIMENSIONS.DEFAULT_WIDTH

  const itemH = item.size?.[1] || GENERIC_DIMENSIONS.DEFAULT_HEIGHT

  const label = item.label || ATTR_VALUES.EMPTY

  const itemClass = item.class || ATTR_VALUES.EMPTY

  return (
    <div
      key={item.src || i}
      className={MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC_ITEM}
      style={host.tiles[i]?.tile || ATTR_VALUES.EMPTY}
    >
      {label ? (
        <h4 className={A11Y_CLASSES.SR_ONLY} tabIndex={ATTR_VALUES.NEGATIVE_TABINDEX}>
          {label}
        </h4>
      ) : null}

      <media-figure
        src={host._folder + item.src}
        width={itemW}
        height={itemH}
        can-expand={item.canExpand ?? false}
        is-video={item.isVideo ?? false}
        label={label}
        classes={`${MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC_ITEM_FIGURE}${
          itemClass ? `${CHAR_STRINGS.SPACE_CHAR}${itemClass}` : ATTR_VALUES.EMPTY
        }`}
        class={itemClass}
      />
    </div>
  )
}

/**
 * JSX template. Compact (≤640px) renders the carousel exactly as the
 * internals strip does today — the element is configured by the facade
 * after mount. Desktop renders the skyline-packed wall.
 * @param host The MediaMosaic element.
 */
export const renderMediaMosaic = (host: MediaMosaic) => {
  if (host._isCompact) {
    return <custom-carousel />
  }

  return (
    <div
      className={MEDIA_MOSAIC_CLASSES.MEDIA_MOSAIC}
      style={{
        position: STATE_STRINGS.RELATIVE,
        width: CHAR_STRINGS.PERCENT_100,
        height: host.wallH,
      }}
    >
      {host._items.map((item, i) => renderTile(host, item, i))}
    </div>
  )
}
