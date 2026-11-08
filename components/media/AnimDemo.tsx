/**
 * @file AnimDemo.tsx
 * @description <anim-demo> — the live preview stage mounted beside every
 * animation record on the /animations route. The `animation` attribute
 * names the ANIMATION_IDS entry being demoed; the stage DOM comes from
 * ./anim-demo/stages.tsx and the matching driver from
 * ./anim-demo/registry.ts mounts the real widget/mount-helper (or the
 * staged replica / 2D approximation) onto it, then auto-cycles the
 * same state hooks a pointer would. Every driver returns a teardown —
 * disconnect + attribute swaps run it before any re-mount, so widget
 * instances, GPU sessions and interval loops never leak across a
 * locale swap or a record re-render.
 *
 * Facade — behavior lives in ./anim-demo-* modules:
 *   anim-demo/stages    stage DOM per id (canvas / mounted / staged)
 *   anim-demo/registry  id → driver map
 *   anim-demo/widgets   real widget-class mounts (burger/flag/switch/…)
 *   anim-demo/mounts    core mount-helper surfaces (burn/sheen/genie)
 *   anim-demo/dom       staged replica drivers (menu/toast/tiles/…)
 *   anim-demo/canvas2d  2D approximations (glitch / space scene)
 *   anim-demo/cycle     the interval choreography clock
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { BaseComponent } from '@core/Component.js'
import { h } from '@core/jsx.js'
import { stageContent } from './anim-demo/stages.js'
import { ANIM_DEMO_DRIVERS } from './anim-demo/registry.js'
import type { DemoContext } from './anim-demo/types.js'
import animDemoStyles from '@core/sass/components/media/anim-demo.scss?tiers'

/**
 * The <anim-demo> host element — one live preview stage per record.
 */
export class AnimDemo extends BaseComponent {
  /** Live driver teardown — widget destroy / mount teardown / loop stop. */
  _teardown: (() => void) | null = null

  /** Mounted flag — set even for teardown-less drivers (pure-CSS stages),
   *  so repeated intersection entries never re-fire a mount. */
  _mounted = false

  /** Viewport-proximity watcher — drivers mount on approach, die on exit. */
  _io: IntersectionObserver | null = null

  static get observedAttributes() {
    return [COMMON_ATTRS.ANIMATION]
  }

  constructor() {
    super(animDemoStyles)
  }

  /**
   * `animation` attr swaps re-render the stage and re-mount the matching
   * driver — the teardown always precedes the swap so the previous id's
   * loops + contexts die with its stage DOM. Only ANIMATION is observed,
   * so the callback never fires for any other name.
   * @param _name Changed attribute (unused — only ANIMATION is observed).
   * @param _oldVal Previous value (unused).
   * @param _newVal New value (unused).
   */
  attributeChangedCallback(_name: string, _oldVal: string | null, _newVal: string | null): void {
    if (!this._isMounted) return

    this._destroyDemo()
    this._updateDom()
    this._mountDemo()
  }

  /**
   * JSX template — the framed stage root plus the id's staged content.
   * @returns The stage wrapper node.
   */
  override render() {
    const id = this.getAttribute(COMMON_ATTRS.ANIMATION) || ATTR_VALUES.EMPTY

    return <div className={ANIM_DEMO_CLASSES.ANIM_DEMO}>{stageContent(id)}</div>
  }

  /** Post-mount — resolves + mounts the driver for the attr's id. */
  override onMounted(): void {
    this._mountDemo()
  }

  /** Disconnect — runs the driver's teardown (widgets, GPU, loops). */
  override onDestroy(): void {
    this._destroyDemo()
  }

  /**
   * Mounts the demo for the current `animation` id — gated on viewport
   * proximity rather than mounted unconditionally: a page-wide record
   * list instantiating every driver at once spikes the live WebGL
   * context count past the browser's ~16 budget, and Chrome force-loses
   * the excess (widgets flip to is-fallback and stay dead until a
   * recovery action). Mounting on intersection + tearing down on exit
   * keeps the simultaneous-context count at a handful — the same
   * budget discipline webglPool enforces on its registered canvases.
   * Without IntersectionObserver the mount runs eagerly (old engines).
   */
  _mountDemo(): void {
    const id = this.getAttribute(COMMON_ATTRS.ANIMATION) || ATTR_VALUES.EMPTY

    const stage = this.$<HTMLElement>(`.${ANIM_DEMO_CLASSES.ANIM_DEMO}`)

    const mount = ANIM_DEMO_DRIVERS[id]

    // Stage always exists (render() emits the root) and every registered
    // id resolves a driver — both null-guards stay for the swap edge.
    if (!stage || !mount) return

    if (typeof IntersectionObserver === TYPE_STRINGS.UNDEFINED) {
      this._runMount(id, stage)

      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        // Stale-callback guard — a disconnected/replaced observer can
        // still deliver a pending entry; it must not mount a driver
        // (its captured stage/id belong to the previous lifecycle).
        if (this._io !== io) return

        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._runMount(id, stage)
          } else {
            // Exit runs the driver teardown only — the observer must
            // stay live so the next approach re-mounts the demo.
            this._stopDriver()
          }
        }
      },
      // Same 100px margin webglPool uses — a wider gate would mount widgets
      // into the pool's dead band (mounted but purged: the pool's own IO
      // releases contexts beyond 100px, leaving a canvas that acquired GL
      // and immediately lost it).
      { rootMargin: QUERY_STRINGS.ROOT_MARGIN_100 }
    )

    this._io = io
    this._io.observe(this)
  }

  /**
   * Runs the resolved driver for the id — idempotent against repeated
   * intersection entries (a still-live mount is not re-run).
   * @param id The animation id (registry key).
   * @param stage The stage root element.
   */
  _runMount(id: string, stage: HTMLElement): void {
    if (this._mounted) return

    const mount = ANIM_DEMO_DRIVERS[id]

    // Registry resolution re-checked — attr swaps can race a rebuild.
    if (!mount) return

    this._mounted = true

    const ctx: DemoContext = { host: this, stage, id }

    this._teardown = mount(ctx) || null
  }

  /** Runs + clears the live driver teardown — idempotent. */
  _stopDriver(): void {
    this._teardown?.()
    this._teardown = null
    this._mounted = false
  }

  /**
   * Disconnects the observer and runs the live teardown — idempotent
   * (destroy can land before mount finished, or twice across attr swap
   * + disconnect).
   */
  _destroyDemo(): void {
    this._io?.disconnect()
    this._io = null
    this._stopDriver()
  }
}

if (!customElements.get(COMPONENT_TAGS.ANIM_DEMO)) {
  customElements.define(COMPONENT_TAGS.ANIM_DEMO, AnimDemo)
}
