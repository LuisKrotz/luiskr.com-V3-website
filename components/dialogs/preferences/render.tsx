/**
 * @file preferences/render.tsx — the dialog's JSX template.
 *
 * Two layering conventions: the theme canvas is itself the accessible
 * control (role=slider + real tabindex — its widget handles arrows),
 * while the switch canvases stay decorative inside real <button> hosts.
 * If WebGL fails both paths degrade to plain DOM controls.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { SWITCH_TYPES } from '@core/tokens/theme/switches.js'
import { THEME } from '@core/tokens/theme/theme.js'
import { h } from '@core/jsx.js'
import store from '@core/store.js'
import { isPlaygroundRoute } from '@core/router/playground.js'
import { themeToP } from '@core/utils/canvas/widgets/theme-slider/math.js'
import type { PreferencesModal } from '../PreferencesModal.js'
import { prefThemeLabel, type PrefThemeOption } from './types.js'

/** One theme choice button (🌙/⚙️/☀️ row under the canvas slider). */
function renderThemeBtn(theme: string, current: string, icon: string, option: PrefThemeOption) {
  const active =
    current === theme
      ? ` ${PREF_CLASSES.PREF_THEME_BTN_ACTIVE} ${STATE_CLASSES.ACTIVE}`
      : ATTR_VALUES.EMPTY

  return (
    <button
      className={`${PREF_CLASSES.PREF_THEME_BTN}${active}`}
      data-theme={theme}
      type={FORM_ATTRS.BUTTON}
      onClick={() => store.commit(PREF_MUTATIONS.SET_THEME, theme)}
    >
      <span>{icon}</span>
      <span>{option.label}</span>
    </button>
  )
}

/** One dev-tools switch row: accessible button + decorative GL canvas. */
function renderSwitchRow(
  label: string,
  desc: string,
  active: boolean,
  switchType: string,
  mutation: string
) {
  return (
    <div
      className={PREF_CLASSES.PREF_SWITCH_ROW}
      role={ARIA_ATTRS.ROLE_GROUP}
      onClick={(e: MouseEvent) => {
        if (!(e.target as Element | null)?.closest(HTML_TAGS.BUTTON)) store.commit(mutation)
      }}
    >
      <div className={PREF_CLASSES.PREF_SWITCH_INFO}>
        <span className={PREF_CLASSES.PREF_SWITCH_LABEL}>{label}</span>
        <span className={PREF_CLASSES.PREF_SWITCH_DESC}>{desc}</span>
      </div>
      <button
        className={active ? PREF_CLASSES.PREF_SWITCH_ON : PREF_CLASSES.PREF_SWITCH}
        aria-checked={String(active)}
        aria-label={label}
        role={ARIA_ATTRS.ROLE_SWITCH}
        type={FORM_ATTRS.BUTTON}
        onClick={(e: MouseEvent) => {
          e.stopPropagation()
          store.commit(mutation)
        }}
      >
        <canvas
          className={PREF_CLASSES.PREF_SWITCH_CANVAS}
          data-switch={switchType}
          aria-hidden={ATTR_VALUES.TRUE}
        />
      </button>
    </div>
  )
}

/** JSX template. */
export function renderPreferences(host: PreferencesModal) {
  if (!host.isOpen) return null

  const t = host.t
  const theme = host.currentTheme
  const reduced = host.reducedMotion
  const highContrast = host.highContrast
  const statsForNerds = store.getters.getStatsForNerds()
  const showGrid = store.getters.getShowGrid()

  // Experiment routes force dark and lock switching — the appearance
  // section is withheld there rather than rendered disabled, so the
  // dialog never shows a control whose mutation can't take effect.
  const themeLocked = isPlaygroundRoute()

  return (
    <div
      className={PREF_CLASSES.PREF_BACKDROP}
      tabIndex={CHAR_STRINGS.MINUS_ONE}
      onClick={(e: MouseEvent) => {
        if (e.target === e.currentTarget) host.close()
      }}
    >
      <div
        className={PREF_CLASSES.PREF_DIALOG}
        role={ARIA_ATTRS.ROLE_DIALOG}
        aria-modal={ATTR_VALUES.TRUE}
        aria-labelledby="pref-title"
      >
        <header className={PREF_CLASSES.PREF_HEADER}>
          <h2 id="pref-title" className={PREF_CLASSES.PREF_TITLE}>
            {t.title}
          </h2>
          <button
            className={PREF_CLASSES.PREF_CLOSE_BTN}
            aria-label={t.closeLabel}
            type={FORM_ATTRS.BUTTON}
            onClick={() => host.close()}
          >
            <canvas className={PREF_CLASSES.PREF_CLOSE_CANVAS} aria-hidden={ATTR_VALUES.TRUE} />
          </button>
        </header>

        <div className={PREF_CLASSES.PREF_BODY}>
          {themeLocked ? null : (
            <section className={PREF_CLASSES.PREF_SECTION}>
              <h3 className={PREF_CLASSES.PREF_SECTION_TITLE}>{t.appearance.title}</h3>
              <p className={PREF_CLASSES.PREF_SECTION_DESC}>{t.appearance.desc}</p>
              <div className={PREF_CLASSES.PREF_THEME_WRAPPER}>
                <div
                  className={PREF_CLASSES.PREF_THEME_SLIDER}
                  role={ARIA_ATTRS.ROLE_GROUP}
                  aria-label={t.appearance.title}
                >
                  {/* The GL track IS the control — role=slider exposes it
                      to AT and arrow keys reach the widget's own keydown
                      handler; the labelled buttons below only surface when
                      the canvas falls back to the non-WebGL path. */}
                  <canvas
                    className={PREF_CLASSES.PREF_THEME_CANVAS}
                    role={ARIA_ATTRS.ROLE_SLIDER}
                    tabIndex={CHAR_STRINGS.ZERO}
                    aria-label={t.appearance.title}
                    aria-orientation={ATTR_VALUES.HORIZONTAL}
                    aria-valuemin={themeToP(THEME.DARK)}
                    aria-valuemax={themeToP(THEME.LIGHT)}
                    aria-valuenow={themeToP(theme)}
                    aria-valuetext={prefThemeLabel(t.appearance, theme)}
                  />
                </div>
                <div className={PREF_CLASSES.PREF_THEME_LABELS}>
                  {renderThemeBtn(THEME.DARK, theme, '🌙', t.appearance.dark)}
                  {renderThemeBtn(THEME.SYSTEM, theme, '⚙️', t.appearance.system)}
                  {renderThemeBtn(THEME.LIGHT, theme, '☀️', t.appearance.light)}
                </div>
              </div>
            </section>
          )}

          {/* Accessibility before developer tools — contrast and motion
              are user-facing aids; diagnostics stay last. */}
          <section className={PREF_CLASSES.PREF_SECTION}>
            <h3 className={PREF_CLASSES.PREF_SECTION_TITLE}>{t.a11y.title}</h3>
            <p className={PREF_CLASSES.PREF_SECTION_DESC}>{t.a11y.desc}</p>
            {renderSwitchRow(
              t.a11y.reducedMotion,
              t.a11y.reducedMotionDesc,
              reduced,
              SWITCH_TYPES.MOTION,
              PREF_MUTATIONS.TOGGLE_REDUCED_MOTION
            )}
            {renderSwitchRow(
              t.a11y.highContrast,
              t.a11y.highContrastDesc,
              highContrast,
              SWITCH_TYPES.CONTRAST,
              PREF_MUTATIONS.TOGGLE_HIGH_CONTRAST
            )}
          </section>

          <section className={PREF_CLASSES.PREF_SECTION}>
            <h3 className={PREF_CLASSES.PREF_SECTION_TITLE}>{t.devTools.title}</h3>
            {renderSwitchRow(
              t.devTools.statsForNerds,
              t.devTools.statsForNerdsDesc,
              statsForNerds,
              SWITCH_TYPES.STATS,
              PREF_MUTATIONS.TOGGLE_STATS_FOR_NERDS
            )}
            {renderSwitchRow(
              t.devTools.showGrid,
              t.devTools.showGridDesc,
              showGrid,
              SWITCH_TYPES.GRID,
              PREF_MUTATIONS.TOGGLE_SHOW_GRID
            )}
          </section>
        </div>

        <footer className={PREF_CLASSES.PREF_FOOTER}>
          <button
            className={PREF_CLASSES.PREF_DONE_BTN}
            type={FORM_ATTRS.BUTTON}
            onClick={() => host.close()}
          >
            {t.done}
          </button>
        </footer>
      </div>
    </div>
  )
}
