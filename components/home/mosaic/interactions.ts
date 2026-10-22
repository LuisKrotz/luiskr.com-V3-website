/**
 * @file mosaic-interactions.ts — hover expansion + two-tap activation
 * for <home-mosaic> cards.
 */

import { KEYS, MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { TOUCH_EVENTS } from '@core/tokens/events/dom.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { MOSAIC_SELECTORS } from '@core/tokens/selectors/mosaic.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { WASM_STRINGS } from '@core/tokens/strings/wasm.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { npuPredict } from '@core/utils/gpu/npu-predict.js'
import { armCardBurn, disarmCardBurn } from './burn.js'
import type { MosaicItem } from './pack.js'
import type { HomeMosaic } from '../HomeMosaic.js'

/** Details-panel floor matching mosaic-layout's provisional height. */
const PROVISIONAL_BOTTOM_H = 130

/** Measured-height padding beyond the panel's scrollHeight. */
const DETAIL_H_PAD = 24

/** Resolves the mosaic card element + its data-index from a DOM event. */
export function cardIdxFromEvent(e: Event): { itemEl: Element; idx: number } | null {
  const itemEl = (e.target as Element | null)?.closest(MOSAIC_SELECTORS.HOME_MOSAIC_ITEM)

  if (!itemEl) return null

  const idx = parseInt(itemEl.getAttribute(DATA_ATTRS.DATA_INDEX) || CHAR_STRINGS.ZERO, 10)

  return { itemEl, idx }
}

/** The expanded details panel for card `i`, or null. */
function detailEl(host: HomeMosaic, i: number): Element | null {
  return host.$(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_DETAILS}[${DATA_ATTRS.DATA_INDEX}="${i}"]`)
}

/** Removes the hover-injected description paragraph from card `i`. */
function removeDesc(host: HomeMosaic, i: number): void {
  const detail = detailEl(host, i)

  const descEl = detail?.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_DESC}`)

  if (descEl) descEl.remove()
}

/**
 * Pointer-enter: expands the card's details region. Two-pass flow —
 * first layout() with a 130px provisional bottom, then after one frame
 * the real scrollHeight is measured into bottomHMap and the wall
 * reflows to its final geometry. npuPredict warms the likely route
 * (150ms debounce ≈ intentional hover vs cursor passing through).
 */
export function onHover(host: HomeMosaic, i: number): void {
  if (host.hasTouch) return

  host.hoveredIdx = i

  host.layout()

  npuPredict.predictTargetLikelihood(WASM_STRINGS.MOSAIC_CARD, null, 150)

  const item = host.processedItems[i]

  const detail = detailEl(host, i)

  if (detail && item?.description) {
    let descEl: Element | null = detail.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_DESC}`)

    if (!descEl) {
      descEl = document.createElement(HTML_TAGS.P)
      descEl.className = HOME_MOSAIC_CLASSES.HOME_MOSAIC_DESC

      const drawTextEl = document.createElement(COMPONENT_TAGS.DRAW_TEXT)
      drawTextEl.setAttribute(FORM_ATTRS.TEXT, item.description)
      // 30ms/char — same pace the pre-rendered expanded desc uses; the
      // burn's own pacing (_DESC_CHAR_MS + the rewrite's DELAY_8) is
      // unchanged, so combustion still resolves at the old clip.
      drawTextEl.setAttribute(COMMON_ATTRS.DELAY, CHAR_STRINGS.DELAY_30)
      descEl.appendChild(drawTextEl)

      const btn = detail.querySelector(`.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_BTN}`)

      if (btn) detail.insertBefore(descEl, btn)
      else detail.appendChild(descEl)
    }

    // Combust the overlay title top→bottom + rewrite it above the desc.
    armCardBurn(host, i, item)
  }

  requestAnimationFrame(() => {
    const detail = detailEl(host, i)

    if (detail) {
      host.bottomHMap[i] = Math.max(detail.scrollHeight + DETAIL_H_PAD, PROVISIONAL_BOTTOM_H)
    }

    host.layout()
  })
}

/** Pointer-leave: clears hover state. */
export function onLeave(host: HomeMosaic): void {
  if (host.hasTouch) return

  const prevIdx = host.hoveredIdx
  host.hoveredIdx = null

  if (prevIdx !== null) {
    removeDesc(host, prevIdx)
    disarmCardBurn(host, prevIdx)
  }

  host.layout()
}

/**
 * Builds the localized destination URL for one mosaic project card.
 * @param item project metadata containing the route slug
 * @returns localized portfolio URL, or an empty string without a slug
 */
export function projectHref(item: MosaicItem): string {
  if (!item.link) return ATTR_VALUES.EMPTY

  const lang = store.getters.getLang()
  const prefix = lang === LOCALES.EN ? ATTR_VALUES.EMPTY : `${ROUTE_PATHS.ROOT}${lang}`

  return `${prefix}${ROUTE_PATHS.PORTFOLIO}${item.link}`
}

/**
 * Card activation. Desktop: straight to the project route. Touch:
 * first tap expands the details (records bottomH so the wall reflows),
 * second tap on the SAME card navigates — the two-tap pattern gives
 * touch users the hover preview desktop users get for free.
 * Keyboard/NVDA/Narrator activation synthesizes a click with `detail`
 * === 0 (no pointer coordinates) — it must navigate outright, never
 * queue as a "first tap". 'ontouchstart' in window is true for every
 * touchscreen laptop, so without this gate Enter only expanded the
 * card and screen readers announced "no action".
 */
export function onClick(host: HomeMosaic, item: MosaicItem, i: number, e?: Event): void {
  const isTouch =
    Boolean(host.hasTouch) ||
    TOUCH_EVENTS.TOUCHSTART in window ||
    (window.matchMedia && window.matchMedia(MEDIA_QUERIES.POINTER_COARSE).matches)

  if (!item.link) return

  const dest = projectHref(item)

  const keyboardActivation = e !== undefined && (e as MouseEvent).detail === 0

  if (isTouch && !keyboardActivation && host.touchIdx !== i) {
    const prevIdx = host.touchIdx
    host.touchIdx = i

    if (prevIdx !== null && prevIdx !== i) {
      removeDesc(host, prevIdx)
      disarmCardBurn(host, prevIdx)

      delete host.bottomHMap[prevIdx]
    }

    host._updateDom()

    requestAnimationFrame(() => {
      const d = detailEl(host, i)

      if (d) {
        const detailH = d.scrollHeight

        if (detailH > 0) host.bottomHMap[i] = detailH + DETAIL_H_PAD

        // Post-render arm — _updateDom wipes per-card overlays, so the
        // burn must mount against the fresh nodes.
        armCardBurn(host, i, item)
      }

      host.layout()
    })
  } else {
    router.push(dest)
  }
}

/** Center point of packed card `i` parsed from its absolute style box. */
function cardCenter(host: HomeMosaic, i: number): { x: number; y: number } | null {
  const style = host.cards[i]?.card

  if (!style) return null

  const left = parseFloat(style.left)

  const top = parseFloat(style.top)

  const w = parseFloat(style.width)

  const h = parseFloat(style.height)

  if ([left, top, w, h].some(Number.isNaN)) return null

  return { x: left + w / 2, y: top + h / 2 }
}

/**
 * Nearest card in the arrow direction — the packed wall is masonry, so
 * neighbors are resolved spatially from card centers, not DOM order.
 * The direction must dominate (dx for left/right, dy for up/down) and
 * the cross-axis distance is penalized 2× so ArrowDown prefers the card
 * directly below over a far diagonal.
 * @returns The target card index, or null at the wall's edge.
 */
function nextCardIdx(host: HomeMosaic, fromIdx: number, key: string): number | null {
  const from = cardCenter(host, fromIdx)

  if (!from) return null

  let best: number | null = null

  let bestScore = Infinity

  for (let j = 0; j < host.processedItems.length; j++) {
    if (j === fromIdx) continue

    const c = cardCenter(host, j)

    if (!c) continue

    const dx = c.x - from.x
    const dy = c.y - from.y

    const horizontal = key === KEYS.ARROW_LEFT || key === KEYS.ARROW_RIGHT

    const primary = horizontal ? dx : dy
    const cross = horizontal ? dy : dx

    const forward = horizontal ? key === KEYS.ARROW_RIGHT : key === KEYS.ARROW_DOWN

    if (forward ? primary <= 0 : primary >= 0) continue

    const score = Math.abs(primary) + Math.abs(cross) * 2

    if (score < bestScore) {
      bestScore = score
      best = j
    }
  }

  return best
}

/**
 * Arrow-key navigation — moves focus to the nearest card in the arrow
 * direction (roving focus over the card anchors; the focusin handler
 * then expands it exactly like hover). Non-arrow keys pass through.
 */
export function onCardKeyDown(host: HomeMosaic, e: Event): void {
  const key = (e as KeyboardEvent).key

  if (
    key !== KEYS.ARROW_LEFT &&
    key !== KEYS.ARROW_RIGHT &&
    key !== KEYS.ARROW_UP &&
    key !== KEYS.ARROW_DOWN
  )
    return

  const card = cardIdxFromEvent(e)

  if (!card) return

  const target = nextCardIdx(host, card.idx, key)

  if (target === null) return

  const targetEl = host.$(
    `.${HOME_MOSAIC_CLASSES.HOME_MOSAIC_ITEM}[${DATA_ATTRS.DATA_INDEX}="${target}"]`
  )

  if (!targetEl) return

  e.preventDefault()

  ;(targetEl as HTMLElement).focus()
}
