/**
 * @file draw-text/sheet.ts — one constructed stylesheet shared by every
 * instance (a project page mounts dozens). The `?tiers` module keeps the
 * sheet's `@media print` block out of the base text behind a lazy
 * `rcss-print` chunk — fetched on the first mount's idle slice, it lands
 * on every live surface at once: the shared constructable sheet rewrites
 * in place (all adopting shadow roots see it), registered legacy `<style>`
 * nodes recompose their text.
 */

import { devWarn } from '@core/devlog.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { trackPrintJob } from '@core/utils/print/print.js'
import { isTieredStyles, type TierLoader, type TieredStyles } from '@core/utils/responsive-css.js'
import drawTextStyles from '@core/sass/components/media/draw-text.scss?tiers'

/**
 * Resolves a `?tiers` loader module to its css text — the chunk exports
 * the sheet string as default, a direct string is tolerated too.
 * @param mod resolved dynamic-import module.
 * @returns css text, or '' for unexpected shapes.
 */
const resolveTierText = (mod: unknown): string =>
  typeof mod === TYPE_STRINGS.STRING ? (mod as string) : (mod as { default: string }).default

/**
 * Runs `cb` at the next idle slice — requestIdleCallback bounded by the
 * shared prefetch timeout when available, a short setTimeout fallback
 * otherwise. Mirrors the Component/route-warmer schedule contract so
 * print-tier fetches never compete with mount-time frame work.
 * @param cb work to run in the next idle gap.
 */
const scheduleIdle = (cb: () => void): void => {
  if (
    typeof window !== TYPE_STRINGS.UNDEFINED &&
    typeof window.requestIdleCallback === TYPE_STRINGS.FUNCTION
  ) {
    window.requestIdleCallback(cb, { timeout: PREFETCH_CONFIG.IDLE_TIMEOUT })
  } else {
    setTimeout(cb, PREFETCH_CONFIG.FALLBACK_DELAY)
  }
}

/**
 * Sheet surface a draw-text host consumes: base text for legacy `<style>`
 * nodes, a shared constructable sheet for modern engines, and the legacy
 * print-tier registration.
 */
export interface DrawTextSheet {
  /** @returns the sheet's non-print css for the legacy <style> path. */
  baseStyleText(): string
  /**
   * Registers a legacy `<style>` node's print-tier update and arms the
   * lazy fetch — the callback receives the composed base+print text when
   * the chunk resolves.
   * @param apply receives the composed sheet text.
   * @returns unregister — call on disconnect so dead hosts drop.
   */
  onPrintText(apply: (text: string) => void): () => void
  /**
   * Registers a legacy `<style>` ELEMENT for print-tier updates — the
   * node's textContent recomposes to base+print when the chunk lands.
   * @param el the per-host `<style>` node.
   * @returns unregister — call on disconnect so dead hosts drop.
   */
  onPrintStyleNode(el: HTMLStyleElement): () => void
  /**
   * Lazily-built shared constructable sheet — all instances adopt the one
   * compiled sheet instead of re-parsing the SCSS per mount.
   * @returns the shared sheet, or null on engines without constructable
   * stylesheets.
   */
  getSharedSheet(): CSSStyleSheet | null
}

/**
 * Builds the sheet surface over one `?tiers`-shaped styles module. The
 * jest scss mocks answer plain strings for every query form, so the same
 * isTieredStyles probe Component uses keeps both shapes working: objects
 * deliver base+tiers+print lazily, strings behave as base-only sheets.
 * @param styles the `?tiers` module (or a plain css string).
 * @returns the sheet surface.
 */
export const createDrawTextSheet = (styles: TieredStyles | string): DrawTextSheet => {
  const tiered: TieredStyles | null = isTieredStyles(styles) ? styles : null

  /** Sheet text adopted synchronously — the module's base css. */
  const baseText: string = tiered ? tiered.base : (styles as string)

  /** Lazily-built shared stylesheet. */
  let sharedSheet: CSSStyleSheet | null = null

  /**
   * Legacy `<style>` updaters awaiting the print tier — constructable-
   * sheet hosts never register; the in-place rewrite reaches them.
   */
  const legacyPrintApply = new Set<(text: string) => void>()

  /** First mount arms the single lazy fetch. */
  let printArmed = false

  /**
   * Fetches the sheet's print blocks on the next idle slice and composes
   * them after the base text — matching the source order where the
   * `@media print` block sat at file end.
   */
  const armPrintTier = (): void => {
    if (printArmed || !tiered?.print) return

    printArmed = true

    /** Memoized tier fetch — one in-flight/resolving promise shared by
     *  the idle arm and the print-prepare kick. */
    let printPromise: Promise<void> | null = null

    const fetchPrint = () => {
      if (!printPromise) {
        printPromise = (tiered.print as TierLoader)()
          .then((mod) => {
            const css = resolveTierText(mod)

            if (!css) return

            const composed = `${baseText}\n${css}`

            if (sharedSheet) sharedSheet.replaceSync(composed)

            for (const apply of legacyPrintApply) apply(composed)
          })
          .catch((err: unknown) => devWarn('[draw-text] print-tier stylesheet load failed', err))
      }

      return printPromise
    }

    // The print tier IS the reveal contract on paper — a print arriving
    // before the idle fetch kicks it now and hands the promise to the
    // adapter's pending bag, so the gated snapshot can't compose the
    // pre-tier sheet (unrevealed writers would print empty). Already
    // resolved/in-flight runs fold through the memoized promise.
    window.addEventListener(PRINT_EVENTS.PREPARE, () => {
      trackPrintJob(fetchPrint())
    })

    scheduleIdle(fetchPrint)
  }

  return {
    baseStyleText: () => baseText,

    onPrintText: (apply) => {
      legacyPrintApply.add(apply)
      armPrintTier()

      return () => {
        legacyPrintApply.delete(apply)
      }
    },

    onPrintStyleNode: (el) => {
      const apply = (text: string) => {
        el.textContent = text
      }

      legacyPrintApply.add(apply)
      armPrintTier()

      return () => {
        legacyPrintApply.delete(apply)
      }
    },

    getSharedSheet: () => {
      if (
        sharedSheet ||
        typeof CSSStyleSheet === TYPE_STRINGS.UNDEFINED ||
        !CSSStyleSheet.prototype.replaceSync
      )
        return sharedSheet

      sharedSheet = new CSSStyleSheet()

      sharedSheet.replaceSync(baseText)
      armPrintTier()

      return sharedSheet
    },
  }
}

/** Production singleton — bound to the real `?tiers` module. */
const sheet = createDrawTextSheet(drawTextStyles)

/**
 * Base sheet text for the legacy `<style>` path — the print tier joins
 * it later through the onPrintText registration.
 * @returns the sheet's non-print css.
 */
export const baseStyleText = (): string => sheet.baseStyleText()

/**
 * Registers a legacy `<style>` ELEMENT for print-tier updates — the
 * node's textContent recomposes to base+print when the chunk lands.
 * @param el the per-host `<style>` node.
 * @returns unregister — call on disconnect so dead hosts drop.
 */
export const onPrintStyleNode = (el: HTMLStyleElement): (() => void) => sheet.onPrintStyleNode(el)

/**
 * Gets shared sheet.
 * @returns CSSStyleSheet | null
 */
export function getSharedSheet(): CSSStyleSheet | null {
  return sheet.getSharedSheet()
}
