/**
 * @file anim-demo/stages.tsx — the staged DOM each ANIMATION_IDS entry
 * demos inside `<anim-demo>`. Three stage families:
 *
 *   canvas   — the real widget classes mount straight onto the element
 *              (burger/menu-bg/flag/switch/close) or a 2D
 *              approximation draws there (glitch/scene/mesh/theme);
 *   mounted  — a mini DOM surface the core mount helpers take over
 *              (burn card, divider hr, ring tiles, bracket button,
 *              genie backdrop/dialog);
 *   staged   — CSS/DOM replicas of document-level surfaces (menu items,
 *              loader, toast pill, tiles, carousel strip, glow, bar)
 *              carrying the same class-token contract.
 *
 * Demo copy never hardcodes strings: record-facing text resolves through
 * animationAlt()/animationLongDesc() so the stage's visible text is the
 * same localized record the listing renders next to.
 */

import { ANIM_DEMO_CLASSES } from '@core/tokens/classes/anim-demo.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { AWARDS_CLASSES } from '@core/tokens/classes/awards.js'
import { JOUST_CLASSES } from '@core/tokens/classes/joust.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { h } from '@core/jsx.js'
import { appText } from '@core/locale/ui-text.js'
import { animationAlt, animationLongDesc } from '@core/utils/a11y/animation-desc.js'

const C = ANIM_DEMO_CLASSES

/** The demo cover-image stem (bucket path, extensionless — the ladder composes rungs). */
export const DEMO_COVER_STEM = `${DB_PATHS.COVERS}dell-design-system`

/** Demo menu item count — mirrors the real nav's four primary routes. */
const _MENU_ITEMS = 4

/** Demo ring-sheen tile count — a row small enough to read the traveling sheen. */
const _SHEEN_TILES = 3

/**
 * A decorative demo canvas — every animated surface the stage mounts is
 * aria-hidden: the record's own dt/dd text is the a11y contract, the
 * canvas is pure demonstration.
 * @param extra Extra classes sizing the canvas (icon/frame variants).
 * @returns The canvas element.
 */
const demoCanvas = (extra: string): Node => (
  <canvas className={`${C.CANVAS} ${extra}`} aria-hidden={ATTR_VALUES.TRUE} />
)

/**
 * The staged DOM for one ANIMATION_IDS entry — the element(s) the
 * matching driver mounts its animation onto. Unknown ids get an empty
 * stage (the record still renders its text; only the demo area is bare).
 * @param id ANIMATION_IDS entry (the record key).
 * @returns Stage node for the demo, or null.
 */
export const stageContent = (id: string): Node | null => {
  const DrawText = COMPONENT_TAGS.DRAW_TEXT
  const MediaFigure = COMPONENT_TAGS.MEDIA_FIGURE
  const CardStack = COMPONENT_TAGS.CARD_STACK
  const MentionsDeck = COMPONENT_TAGS.MENTIONS_DECK
  const AwardsCarousel = COMPONENT_TAGS.AWARDS_CAROUSEL
  const CustomCarousel = COMPONENT_TAGS.CUSTOM_CAROUSEL
  const AboutSection = COMPONENT_TAGS.ABOUT_SECTION

  switch (id) {
    /* ── Live widget canvases ── */
    case ANIMATION_IDS.BURGER_BUTTON:
    case ANIMATION_IDS.CLOSE_BUTTON:
      // The sized wrapper IS the widget's parentElement — the close
      // widget's resize observer reads the parent box (production: the
      // 56px button), so a bare stage-root canvas would measure 695px.
      return <span className={C.ICON_WRAP}>{demoCanvas(C.ICON)}</span>

    case ANIMATION_IDS.NAV_MENU_BACKGROUND:
    case ANIMATION_IDS.SCENE_3D:
      return demoCanvas(ATTR_VALUES.EMPTY)

    case ANIMATION_IDS.NAV_FLAG:
      return demoCanvas(C.FLAG)

    case ANIMATION_IDS.SWITCH_SLIDER:
      return demoCanvas(C.SWITCH)

    case ANIMATION_IDS.THEME_SLIDER:
      return demoCanvas(C.THEME)

    /* ── Staged DOM replicas ── */
    case ANIMATION_IDS.NAV_MENU:
      return (
        <div className={C.MENU} aria-hidden={ATTR_VALUES.TRUE}>
          {Array.from({ length: _MENU_ITEMS }, (_, i) => (
            <span key={i} className={C.MENU_ITEM} />
          ))}
        </div>
      )

    case ANIMATION_IDS.INTRO_LOADER:
      return (
        <div className={C.LOADER} aria-hidden={ATTR_VALUES.TRUE}>
          <span className={C.LOADER_RING} />
          <span className={C.LOADER_RING_INNER} />
          <span className={C.LOADER_COUNTER}>0%</span>
          <span className={C.LOADER_BAR}>
            <span className={C.LOADER_FILL} />
          </span>
        </div>
      )

    case ANIMATION_IDS.SITE_TOAST:
      return (
        <div className={C.TOAST} aria-hidden={ATTR_VALUES.TRUE}>
          <div className={C.TOAST_ITEM}>
            <strong>{animationAlt(id)}</strong>
            <span>{animationLongDesc(id)}</span>
          </div>
        </div>
      )

    case ANIMATION_IDS.SKELETON:
      return (
        <div className={C.SKEL}>
          <span
            className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_TITLE_MD}`}
          />
          <span
            className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_FULL}`}
          />
          <span
            className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_94}`}
          />
          <span
            className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_PARA_65}`}
          />
          <span
            className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_MEDIA}`}
          />
        </div>
      )

    /* ── Core-mount surfaces ── */
    case ANIMATION_IDS.MOSAIC_BURN:
      return (
        <div className={C.CARD} {...{ [DATA_ATTRS.DATA_INDEX]: '0' }}>
          <div className={C.OVERLAY}>
            <h2 className={C.TITLE}>{animationAlt(id)}</h2>
          </div>
          <div className={C.DETAILS}>
            <p>{animationLongDesc(id)}</p>
          </div>
        </div>
      )

    case ANIMATION_IDS.DIVIDER_SHEEN:
      return <hr className={C.DIVIDER} aria-hidden={ATTR_VALUES.TRUE} />

    case ANIMATION_IDS.RING_SHEEN:
    case ANIMATION_IDS.RELATED_TILE:
      return (
        <div className={C.TILES} aria-hidden={ATTR_VALUES.TRUE}>
          {Array.from({ length: _SHEEN_TILES }, (_, i) => (
            <div key={i} className={C.TILE}>
              <span className={C.TILE_INNER} />
            </div>
          ))}
        </div>
      )

    case ANIMATION_IDS.CORNER_BRACKETS:
      return (
        <button
          className={C.BUTTON}
          type={FORM_ATTRS.TYPE_BUTTON}
          aria-hidden={ATTR_VALUES.TRUE}
          tabIndex={-1}
        >
          {animationAlt(id)}
        </button>
      )

    case ANIMATION_IDS.GENIE_MODAL:
      return (
        <div className={C.SCENE} aria-hidden={ATTR_VALUES.TRUE}>
          <span className={C.ORIGIN} />
          <div className={C.BACKDROP}>
            <div className={C.DIALOG}>
              <p className={C.DIALOG_TEXT}>{animationAlt(id)}</p>
            </div>
          </div>
        </div>
      )

    /* ── Real element demos (registered by the view) ── */
    case ANIMATION_IDS.CAROUSEL:
      return <AwardsCarousel className={C.ELEMENT} />

    /* ── Document-surface replicas ── */
    case ANIMATION_IDS.BODY_GLOW:
      return <div className={C.GLOW} aria-hidden={ATTR_VALUES.TRUE} />

    case ANIMATION_IDS.PROGRESS_BAR:
      return <div className={C.BAR} aria-hidden={ATTR_VALUES.TRUE} />

    /* ── Real custom elements (registered by the view) ── */
    case ANIMATION_IDS.TEXT_DRAW:
      return (
        <DrawText
          className={C.DRAW}
          text={animationAlt(id)}
          trigger={COMMON_ATTRS.PROP}
          fit={ATTR_VALUES.EMPTY}
        />
      )

    case ANIMATION_IDS.ABOUT_TEXT:
      return (
        <DrawText
          className={C.DRAW}
          text={animationLongDesc(id)}
          trigger={COMMON_ATTRS.PROP}
          fit={ATTR_VALUES.EMPTY}
        />
      )

    case ANIMATION_IDS.MEDIA_PROGRESSIVE:
      return (
        <MediaFigure
          className={C.FIGURE}
          {...{
            [MEDIA_ATTRS.SRC]: DEMO_COVER_STEM,
            [MEDIA_ATTRS.WIDTH]: String(GENERIC_DIMENSIONS.DEFAULT_WIDTH),
            [MEDIA_ATTRS.HEIGHT]: String(GENERIC_DIMENSIONS.DEFAULT_HEIGHT),
            [FORM_ATTRS.LABEL]: animationAlt(id),
          }}
        />
      )

    /* ── Card-stack deal-through demo — the real coverflow element ── */
    case ANIMATION_IDS.CARD_STACK:
      return <CardStack className={C.ELEMENT} />

    /* ── Nav icon-aura demo — the real strip/chip classes the aura
        session mounts on (C.CHIP stays the demo's styling hook). ── */
    case ANIMATION_IDS.NAV_ICON_AURA:
      return (
        <div
          className={`${NAV_CLASSES.NAV_MOBILE_STRIP} ${C.CHIPS}`}
          aria-hidden={ATTR_VALUES.TRUE}
        >
          <span className={`${NAV_CLASSES.NAV_SEARCH_BTN} ${JOUST_CLASSES.JOUST} ${C.CHIP}`} />
          <span className={`${NAV_CLASSES.NAV_GEAR_BTN} ${JOUST_CLASSES.JOUST} ${C.CHIP}`} />
        </div>
      )

    /* ── View-transition demo ── */
    case ANIMATION_IDS.VIEW_TRANSITION:
      return (
        <div className={C.PANES} aria-hidden={ATTR_VALUES.TRUE}>
          <div className={C.PANE} />
          <div className={`${C.PANE} ${C.PANE_GONE}`} />
        </div>
      )

    /* ── Route-search demo ── */
    case ANIMATION_IDS.ROUTE_SEARCH:
      return (
        <div className={C.SEARCH} aria-hidden={ATTR_VALUES.TRUE}>
          <span className={C.SEARCH_ICON} />
          <span className={C.SEARCH_TEXT} />
          <span className={C.SEARCH_DOTS}>
            <i className={C.SEARCH_DOT} />
            <i className={C.SEARCH_DOT} />
            <i className={C.SEARCH_DOT} />
          </span>
        </div>
      )

    /* ── Custom-carousel demo — the real project-strip element ── */
    case ANIMATION_IDS.CUSTOM_CAROUSEL:
      return <CustomCarousel className={C.ELEMENT} />

    /* ── Mentions-deck demo — the real fan element ── */
    case ANIMATION_IDS.MENTIONS_DECK:
      return <MentionsDeck className={C.ELEMENT} />

    /* ── Expand-modal loading demo ── */
    case ANIMATION_IDS.EXPAND_MODAL_LOADING:
      return (
        <div className={C.MODAL} aria-hidden={ATTR_VALUES.TRUE}>
          <span className={C.MODAL_SPIN} />
          <span className={C.MODAL_SHEEN} />
        </div>
      )

    /* ── Footer feed-wave demo — the real feed-link contract: one
        anchor carrying the real feedGlyph svg (prepended by the
        driver) + the localized RSS label. ── */
    case ANIMATION_IDS.FOOTER_FEED_WAVE:
      return (
        <a
          className={`${AWARDS_CLASSES.AWARDS_FOOTER_ITEM} ${AWARDS_CLASSES.AWARDS_FOOTER_FEED} ${C.FEED}`}
          aria-hidden={ATTR_VALUES.TRUE}
        >
          {appText(SECTION_UI_KEYS.RSS_FEED)}
        </a>
      )

    /* ── About-section demos — the real element mounts its own glitch
        session, warp mesh and draw-text bio (the production surface). ── */
    case ANIMATION_IDS.GLITCH_PORTRAIT:
    case ANIMATION_IDS.ABOUT_MESH:
      return <AboutSection className={C.ELEMENT} />

    default:
      return null
  }
}
