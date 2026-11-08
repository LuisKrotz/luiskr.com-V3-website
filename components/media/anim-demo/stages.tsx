/**
 * @file anim-demo/stages.tsx — the staged DOM each ANIMATION_IDS entry
 * demos inside `<anim-demo>`. Three stage families:
 *
 *   canvas   — the real widget classes mount straight onto the element
 *              (burger/menu-bg/flag/switch/theme/close) or a 2D
 *              approximation draws there (glitch/scene);
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
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { h } from '@core/jsx.js'
import { animationAlt, animationLongDesc } from '@core/utils/a11y/animation-desc.js'

const C = ANIM_DEMO_CLASSES

/** The demo cover-image stem (bucket path, extensionless — the ladder composes rungs). */
export const DEMO_COVER_STEM = `${DB_PATHS.COVERS}home-foundations`

/** Demo menu item count — mirrors the real nav's four primary routes. */
const _MENU_ITEMS = 4

/** Demo ring-sheen tile count — a row small enough to read the traveling sheen. */
const _SHEEN_TILES = 3

/** Demo carousel slide count — enough slides for the track to overhang the strip. */
const _CAROUSEL_SLIDES = 5

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
    case ANIMATION_IDS.GLITCH_PORTRAIT:
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

    case ANIMATION_IDS.MOSAIC_TILE:
      return (
        <div className={C.TILES} aria-hidden={ATTR_VALUES.TRUE}>
          <div className={`${C.TILE} ${C.TILE_SPRING}`}>
            <span className={C.TILE_INNER} />
          </div>
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

    /* ── Carousel momentum demo ── */
    case ANIMATION_IDS.CAROUSEL:
      return (
        <div className={C.STRIP} aria-hidden={ATTR_VALUES.TRUE}>
          <div className={C.TRACK}>
            {Array.from({ length: _CAROUSEL_SLIDES }, (_, i) => (
              <div key={i} className={C.SLIDE} />
            ))}
          </div>
          <div className={C.PROGRESS}>
            <div className={C.PROGRESS_FILL} />
          </div>
        </div>
      )

    /* ── Document-surface replicas ── */
    case ANIMATION_IDS.BODY_GLOW:
      return <div className={C.GLOW} aria-hidden={ATTR_VALUES.TRUE} />

    case ANIMATION_IDS.PROGRESS_BAR:
      return <div className={C.BAR} aria-hidden={ATTR_VALUES.TRUE} />

    case ANIMATION_IDS.NOTE_DOT:
      return (
        <p className={C.NOTES} aria-hidden={ATTR_VALUES.TRUE}>
          <i className={C.DOT} />
          <i className={C.DOT} />
          <i className={C.DOT} />
        </p>
      )

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

    /* ── Card-stack deal-through demo ── */
    case ANIMATION_IDS.CARD_STACK:
      return (
        <div className={C.FAN} aria-hidden={ATTR_VALUES.TRUE}>
          {[-2, -1, 0, 1, 2].map((slot) => (
            <div key={slot} className={C.FAN_CARD} {...{ [DATA_ATTRS.DATA_INDEX]: String(slot) }} />
          ))}
        </div>
      )

    /* ── Nav icon-aura demo ── */
    case ANIMATION_IDS.NAV_ICON_AURA:
      return (
        <div className={C.CHIPS} aria-hidden={ATTR_VALUES.TRUE}>
          <span className={C.CHIP} />
          <span className={C.CHIP} />
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
          <span className={C.SEARCH_DOTS}>
            <i className={C.SEARCH_DOT} />
            <i className={C.SEARCH_DOT} />
            <i className={C.SEARCH_DOT} />
          </span>
        </div>
      )

    /* ── Custom-carousel demo — the strip with project-card slides ── */
    case ANIMATION_IDS.CUSTOM_CAROUSEL:
      return (
        <div className={`${C.STRIP} ${C.STRIP_PROJECT}`} aria-hidden={ATTR_VALUES.TRUE}>
          <div className={C.TRACK}>
            {Array.from({ length: _CAROUSEL_SLIDES }, (_, i) => (
              <div key={i} className={C.SLIDE} />
            ))}
          </div>
          <div className={C.PROGRESS}>
            <div className={C.PROGRESS_FILL} />
          </div>
        </div>
      )

    /* ── Mentions-deck demo ── */
    case ANIMATION_IDS.MENTIONS_DECK:
      return (
        <div className={C.DECK} aria-hidden={ATTR_VALUES.TRUE}>
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className={C.DECK_CARD}
              {...{ [DATA_ATTRS.DATA_INDEX]: String(slot) }}
            />
          ))}
        </div>
      )

    /* ── Expand-modal loading demo ── */
    case ANIMATION_IDS.EXPAND_MODAL_LOADING:
      return (
        <div className={C.MODAL} aria-hidden={ATTR_VALUES.TRUE}>
          <span className={C.MODAL_SPIN} />
          <span className={C.MODAL_SHEEN} />
        </div>
      )

    /* ── Footer feed-wave demo ── */
    case ANIMATION_IDS.FOOTER_FEED_WAVE:
      return (
        <div className={C.FEED} aria-hidden={ATTR_VALUES.TRUE}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={C.FEED_ITEM} />
          ))}
        </div>
      )

    /* ── About-mesh demo — 2D canvas approximation (canvas2d driver) ── */
    case ANIMATION_IDS.ABOUT_MESH:
      return demoCanvas(ATTR_VALUES.EMPTY)

    default:
      return null
  }
}
