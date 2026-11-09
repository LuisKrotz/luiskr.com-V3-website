/**
 * @file anim-demo/registry.ts — the ANIMATION_IDS → demo-driver map.
 * One entry per animation record the /animations page lists; the host
 * resolves its id through the map and mounts the matching driver onto
 * the stage stageContent() built. Ids absent from the map get a bare
 * stage (record text still renders — the demo area is simply inert).
 */

import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import {
  mountBurger,
  mountMenuBackground,
  mountFlag,
  mountSwitch,
  mountTheme,
  mountClose,
} from './widgets.js'
import {
  mountBurnDemo,
  mountDividerDemo,
  mountRingSheenDemo,
  mountBracketsDemo,
  mountGenieDemo,
} from './mounts.js'
import {
  mountLoaderDemo,
  mountMenuDemo,
  mountToastDemo,
  mountRelatedTilesDemo,
  mountDrawDemo,
  mountProgressBarDemo,
  mountGlowDemo,
  mountSkeletonDemo,
  mountMediaDemo,
  mountAuraDemo,
  mountTransitionDemo,
  mountSearchDemo,
  mountModalLoadingDemo,
  mountFeedWaveDemo,
} from './dom.js'
import {
  mountCardStackDemo,
  mountMentionsDeckDemo,
  mountAwardsCarouselDemo,
  mountCustomCarouselDemo,
  mountAboutSectionDemo,
  mountScene3dDemo,
} from './elements.js'
import type { DemoMount } from './types.js'

/**
 * The driver table — keyed by ANIMATION_IDS value (the CMS record key).
 * Read-only: Object.freeze keeps the contract immutable at runtime.
 */
export const ANIM_DEMO_DRIVERS: Readonly<Record<string, DemoMount>> = Object.freeze({
  /* ── Live widget canvases (the real widget classes) ── */
  [ANIMATION_IDS.BURGER_BUTTON]: mountBurger,
  [ANIMATION_IDS.NAV_MENU_BACKGROUND]: mountMenuBackground,
  [ANIMATION_IDS.NAV_FLAG]: mountFlag,
  [ANIMATION_IDS.SWITCH_SLIDER]: mountSwitch,
  [ANIMATION_IDS.CLOSE_BUTTON]: mountClose,

  /* ── Core-mount surfaces (the real mount helpers) ── */
  [ANIMATION_IDS.MOSAIC_BURN]: mountBurnDemo,
  [ANIMATION_IDS.DIVIDER_SHEEN]: mountDividerDemo,
  [ANIMATION_IDS.RING_SHEEN]: mountRingSheenDemo,
  [ANIMATION_IDS.CORNER_BRACKETS]: mountBracketsDemo,
  [ANIMATION_IDS.GENIE_MODAL]: mountGenieDemo,

  /* ── Staged-DOM replicas (class-driven choreography) ── */
  [ANIMATION_IDS.NAV_MENU]: mountMenuDemo,
  [ANIMATION_IDS.INTRO_LOADER]: mountLoaderDemo,
  [ANIMATION_IDS.SITE_TOAST]: mountToastDemo,
  [ANIMATION_IDS.SKELETON]: mountSkeletonDemo,
  [ANIMATION_IDS.RELATED_TILE]: mountRelatedTilesDemo,
  [ANIMATION_IDS.TEXT_DRAW]: mountDrawDemo,
  [ANIMATION_IDS.ABOUT_TEXT]: mountDrawDemo,
  [ANIMATION_IDS.BODY_GLOW]: mountGlowDemo,
  [ANIMATION_IDS.PROGRESS_BAR]: mountProgressBarDemo,
  [ANIMATION_IDS.MEDIA_PROGRESSIVE]: mountMediaDemo,

  /* ── Real-element mounts (the production components themselves) ── */
  [ANIMATION_IDS.CAROUSEL]: mountAwardsCarouselDemo,
  [ANIMATION_IDS.CUSTOM_CAROUSEL]: mountCustomCarouselDemo,
  [ANIMATION_IDS.MENTIONS_DECK]: mountMentionsDeckDemo,
  [ANIMATION_IDS.CARD_STACK]: mountCardStackDemo,
  [ANIMATION_IDS.GLITCH_PORTRAIT]: mountAboutSectionDemo,
  [ANIMATION_IDS.ABOUT_MESH]: mountAboutSectionDemo,

  /* ── WebGPU scene — real mount with the 2D starfield fallback ── */
  [ANIMATION_IDS.SCENE_3D]: mountScene3dDemo,
  [ANIMATION_IDS.THEME_SLIDER]: mountTheme,

  /* ── Later-added surfaces (staged replicas of component animations) ── */
  [ANIMATION_IDS.NAV_ICON_AURA]: mountAuraDemo,
  [ANIMATION_IDS.VIEW_TRANSITION]: mountTransitionDemo,
  [ANIMATION_IDS.ROUTE_SEARCH]: mountSearchDemo,
  [ANIMATION_IDS.EXPAND_MODAL_LOADING]: mountModalLoadingDemo,
  [ANIMATION_IDS.FOOTER_FEED_WAVE]: mountFeedWaveDemo,
})
