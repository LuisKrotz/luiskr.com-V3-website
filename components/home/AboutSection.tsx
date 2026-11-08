/**
 * @file AboutSection.js
 * @description <about-section> — the home page's opening bio block: title,
 * the circular Gravatar portrait ringed by a particle-lattice light-field
 * mesh (with the always-on TV glitch overlay on the image itself) and the
 * floating location-coordinate HUD cycling the `locations` array — see
 * about/hud.ts — a large intro statement (the `frame` node, falling back
 * to col1's lead paragraph) and the remaining bio paragraphs as a single
 * column. The portrait itself tracks the rendered title-line width via
 * about/titlefit.ts (the --about-picture-w var). At ≥1280 the section
 * splits in two: `.about-main` stacks the title, subtitle and the
 * portrait/intro row on the left while the bio column runs the section's
 * full height on the right; 1024–1279 keeps the stacked tablet flow.
 * Translations come from the app dictionary (FALLBACK_PAGES snapshot
 * until Firebase loads).
 */

import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { SECTION_IDS } from '@core/tokens/ids/sections.js'
import { A11Y_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { IMAGE_SIZES } from '@core/tokens/media/sizes.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { BaseComponent } from '@core/Component.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import { indexedText } from '@core/locale/ui-text.js'
import { h, Fragment } from '@core/jsx.js'
import { calcDrawTextDelay, calcDrawTextOffset } from '@core/utils/wasm/wasm-layout.js'
import { excerptHeading, stripHtml } from '@core/utils/string.js'
import { getGravatarSrcset, getOptimizedGravatar } from '@core/utils/media.js'
import { attachGlitch, disarmGlitch } from './about/glitch.js'
import { attachMesh, disarmMesh } from './about/mesh.js'
import { attachHud, disarmHud, hudLines, syncHud } from './about/hud.js'
import { attachTitleFit, disarmTitleFit } from './about/titlefit.js'
import type { AboutLocation } from './about/hud.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import '@website/components/media/DrawText.js'
import aboutStyles from '@core/sass/components/home/about.scss?tiers'
import { GENERIC_DIMENSIONS } from '@core/tokens/media/dimensions.js'

interface AboutTranslations {
  title?: string
  subtitle?: string
  frame?: string
  col1?: string[]
  col2?: string[]
  locations?: AboutLocation[]
}

interface DrawItem {
  key: number
  text: string
  offset: number
}

interface DrawData {
  charDelay: number
  intro: DrawItem | null
  items: DrawItem[]
}

// The portrait rings are NOT stroked SVG — they're a particle lattice
// painted by about/mesh.ts on a 2D canvas (a polar dot grid displaced by
// a traveling radial wave + dotted guide spokes), so the markup only
// carries the picture box the canvas mounts into.

/**
 * The AboutSection — section class.
 */
export class AboutSection extends BaseComponent {
  private _aboutTranslations: AboutTranslations | null = null // pages/about node — title + frame + col1/col2 paragraphs + locations
  private _profilePicture: string | null = null // raw Gravatar URL from the CMS
  /** Active TV-glitch session on the portrait — see about/glitch.ts. */
  _glitch: import('./about/glitch.js').GlitchSession | null = null
  /** Active location-HUD session on the portrait — see about/hud.ts. */
  _hud: import('./about/hud.js').HudSession | null = null
  /** Active light-field mesh session on the portrait — see about/mesh.ts. */
  _mesh: import('./about/mesh.js').MeshSession | null = null
  /** Active portrait-to-title fit session — see about/titlefit.ts. */
  _titleFit: import('./about/titlefit.js').TitleFitSession | null = null

  constructor() {
    super(aboutStyles)
  }

  /**
   * Binds the portrait glitch handlers once the shadow root exists, then
   * subscribes to the store and ensures the components dictionary (which
   * carries contact.line1 for the links row) is loaded — same ensure-fetch
   * <contact-section> performs; whichever section mounts first fires it.
   */
  override onMounted() {
    attachGlitch(this)
    attachHud(this)
    attachMesh(this)
    attachTitleFit(this)
  }

  /** Stops any running glitch loop when the element leaves the DOM. */

  override onDestroy() {
    disarmGlitch(this)
    disarmHud(this)
    disarmMesh(this)
    disarmTitleFit(this)
  }

  /**
   * Re-binds the bio's continuous type-in description — the intro +
   * paragraph cascade is ONE coordinated animation (each paragraph starts
   * as the previous ends), so the text container carries the ABOUT_TEXT
   * record on top of each <draw-text>'s own TEXT_DRAW binding.
   */
  override onUpdated() {
    const text = this.$(`.${ABOUT_CLASSES.ABOUT_PROFILE_TEXT}`)

    if (text) applyAnimationDesc(text as Element, ANIMATION_IDS.ABOUT_TEXT)

    attachHud(this)
    syncHud(this)
    attachMesh(this)
    attachTitleFit(this)
  }

  /** Setter/getter — the about-page translation node pushed by the parent view. */

  set aboutTranslations(val: AboutTranslations | null) {
    this._aboutTranslations = val
    if (this._isMounted) this._updateDom()
  }

  get aboutTranslations(): AboutTranslations | null {
    return this._aboutTranslations
  }

  /** Setter/getter — raw Gravatar URL for the profile photo. */

  set profilePicture(val: string | null) {
    this._profilePicture = val
    if (this._isMounted) this._updateDom()
  }

  get profilePicture(): string | null {
    return this._profilePicture
  }

  /** CDN-resized Gravatar URL for the profile img. */

  get optimizedProfilePicture(): string {
    return getOptimizedGravatar(this.profilePicture || ATTR_VALUES.EMPTY)
  }

  /** Responsive srcset candidates for the profile photo. */

  get profilePictureSrcset(): string {
    return getGravatarSrcset(this.profilePicture || ATTR_VALUES.EMPTY)
  }

  /** The `locations` array of the about node — drives the orbiting HUD. */

  get aboutLocations(): AboutLocation[] {
    const live = this.aboutTranslations?.locations

    // Live Firebase nodes predate the field — the bundled snapshot keeps
    // the HUD populated until the CMS carries the real array.
    if (live?.length) return live

    return (
      (FALLBACK_PAGES[TRANSLATION_KEYS.ABOUT] as { locations?: AboutLocation[] } | undefined)
        ?.locations || []
    )
  }

  /** The `subtitle` tagline node — falls back to the bundled snapshot. */

  get aboutSubtitle(): string {
    return (
      this.aboutTranslations?.subtitle ||
      (FALLBACK_PAGES[TRANSLATION_KEYS.ABOUT] as { subtitle?: string } | undefined)?.subtitle ||
      ATTR_VALUES.EMPTY
    )
  }

  /**
   * Draw-timing plan for the intro + bio column. The `frame` node is the
   * hero statement (falling back to col1's lead paragraph); every remaining
   * paragraph follows in one column. All items share ONE 1500ms animation
   * budget: charDelay = 1500ms ÷ totalChars, and each paragraph's offset =
   * cumulative chars before it × delay — the bio reads as a single
   * continuous type-in flowing from the intro down the column.
   */
  get aboutDrawData(): DrawData {
    const col1 = this.aboutTranslations?.col1 || []
    const col2 = this.aboutTranslations?.col2 || []

    const introText = this.aboutTranslations?.frame || col1[0] || CHAR_STRINGS.EMPTY

    // The intro paragraph is lifted out of the body — `frame` mirrors
    // col1[0] in the CMS node, so dedupe by position (lead paragraph
    // skipped whenever it IS the intro), never by value.
    const body = [...col1.slice(col1[0] === introText ? 1 : 0), ...col2]

    const seq = introText ? [introText, ...body] : body

    const totalChars = seq.reduce((s, t) => s + stripHtml(t).length, 0)
    const charDelay = calcDrawTextDelay(totalChars, 1500)

    let charsBefore = 0
    const timed = seq.map((text, idx) => {
      const offset = calcDrawTextOffset(idx, charsBefore, charDelay)
      charsBefore += stripHtml(text).length
      return { key: idx, text, offset }
    })

    return {
      charDelay,
      intro: introText ? timed[0] : null,
      items: timed.slice(introText ? 1 : 0),
    }
  }

  /** JSX template for the component's shadow DOM. */

  override render() {
    const title = this.aboutTranslations?.title || ATTR_VALUES.EMPTY
    const drawData = this.aboutDrawData
    const DrawText = COMPONENT_TAGS.DRAW_TEXT
    const locations = this.aboutLocations
    const hudInit = hudLines(locations[this._hud?.index || 0])

    return (
      <section id={SECTION_IDS.ABOUT} className={ABOUT_CLASSES.ABOUT}>
        <div className={ABOUT_CLASSES.ABOUT_MAIN}>
          <h2
            className={ABOUT_CLASSES.ABOUT_TITLE}
            aria-label={
              title ||
              (FALLBACK_PAGES[TRANSLATION_KEYS.ABOUT] as { title?: string } | undefined)?.title
            }
          >
            {this.aboutTranslations ? (
              <DrawText text={title} trigger={COMMON_ATTRS.TRIGGER_VIEWPORT} />
            ) : (
              <span
                aria-hidden={ATTR_VALUES.TRUE}
                className={`${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_ABOUT_TITLE}`}
              />
            )}
          </h2>
          {this.aboutTranslations && this.aboutSubtitle ? (
            <p className={ABOUT_CLASSES.ABOUT_SUBTITLE}>{this.aboutSubtitle}</p>
          ) : null}
          <div className={ABOUT_CLASSES.ABOUT_PROFILE_SECTION}>
            <div className={ABOUT_CLASSES.ABOUT_PROFILE_MEDIA}>
              <div className={ABOUT_CLASSES.ABOUT_PROFILE_PICTURE}>
                {this.aboutTranslations && this.profilePicture ? (
                  <Fragment>
                    {locations.length ? (
                      <div
                        className={ABOUT_CLASSES.ABOUT_PROFILE_HUD}
                        aria-hidden={ATTR_VALUES.TRUE}
                      >
                        <div className={ABOUT_CLASSES.ABOUT_HUD_NAME}>
                          <span className={ABOUT_CLASSES.ABOUT_HUD_LINE}>{hudInit.name}</span>
                          <span className={ABOUT_CLASSES.ABOUT_HUD_LINE}>{hudInit.detail}</span>
                        </div>
                        <div className={ABOUT_CLASSES.ABOUT_HUD_COORDS}>
                          <span className={ABOUT_CLASSES.ABOUT_HUD_LINE}>{hudInit.lat}</span>
                          <span className={ABOUT_CLASSES.ABOUT_HUD_LINE}>{hudInit.lon}</span>
                        </div>
                      </div>
                    ) : null}
                    <img
                      decoding={MEDIA_ATTRS.DECODING_ASYNC}
                      loading={MEDIA_ATTRS.LOADING_LAZY}
                      className={ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG}
                      src={this.optimizedProfilePicture}
                      srcset={this.profilePictureSrcset || undefined}
                      sizes={IMAGE_SIZES.PROFILE_PICTURE}
                      alt={title}
                      width={GENERIC_DIMENSIONS.PROFILE_SIZE}
                      height={GENERIC_DIMENSIONS.PROFILE_SIZE}
                    />
                  </Fragment>
                ) : (
                  <div className={ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_PLACEHOLDER} />
                )}
              </div>
              <span className={`${ABOUT_CLASSES.ABOUT_PROFILE_NAME} ${A11Y_CLASSES.SR_ONLY}`}>
                {BASE_TITLE}
              </span>
            </div>
            {this.aboutTranslations ? (
              drawData.intro ? (
                // The intro carries both classes: about-item-text keeps the
                // shared paragraph skeleton (and the e2e draw-text lookup),
                // about-intro overrides the type ramp for the hero statement.
                <p className={`${ABOUT_CLASSES.ABOUT_ITEM_TEXT} ${ABOUT_CLASSES.ABOUT_INTRO}`}>
                  <DrawText
                    text={drawData.intro.text}
                    delay={drawData.charDelay}
                    offset={drawData.intro.offset}
                    trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
                  />
                </p>
              ) : null
            ) : (
              <p
                className={`${ABOUT_CLASSES.ABOUT_ITEM_TEXT} ${ABOUT_CLASSES.ABOUT_INTRO} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_ABOUT_P1}`}
              />
            )}
          </div>
        </div>
        <div className={ABOUT_CLASSES.ABOUT_PROFILE_TEXT}>
          {this.aboutTranslations ? (
            drawData.items.map((item) => (
              // Hidden navigation heading per paragraph — named after
              // the paragraph's own lead text, the numbered template is
              // the fallback. sr-only + data-nosnippet: an a11y jump
              // target, never indexed.
              <Fragment key={item.key}>
                <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                  {excerptHeading(item.text) ||
                    indexedText(A11Y_UI_KEYS.A11Y_PARAGRAPH, item.key + 1)}
                </h3>
                <p className={ABOUT_CLASSES.ABOUT_ITEM_TEXT}>
                  <DrawText
                    text={item.text}
                    delay={drawData.charDelay}
                    offset={item.offset}
                    trigger={COMMON_ATTRS.TRIGGER_VIEWPORT}
                  />
                </p>
              </Fragment>
            ))
          ) : (
            <div>
              <p
                className={`${ABOUT_CLASSES.ABOUT_ITEM_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_ABOUT_P2}`}
              />
              <p
                className={`${ABOUT_CLASSES.ABOUT_ITEM_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_ABOUT_P3}`}
              />
              <p
                className={`${ABOUT_CLASSES.ABOUT_ITEM_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_ABOUT_P4}`}
              />
              <p
                className={`${ABOUT_CLASSES.ABOUT_ITEM_TEXT} ${SKELETON_CLASSES.SKELETON_SHIMMER} ${SKELETON_CLASSES.SKELETON_ABOUT_P5}`}
              />
            </div>
          )}
        </div>
      </section>
    )
  }
}

if (!customElements.get(COMPONENT_TAGS.ABOUT_SECTION)) {
  customElements.define(COMPONENT_TAGS.ABOUT_SECTION, AboutSection)
}
