/**
 * @file nav-render.tsx
 * @description JSX template for <app-nav>, extracted from AppNav.tsx —
 * logo button, burger strip, and the fullscreen menu overlay (the single
 * menu for every breakpoint). Pure render: reads host getters/state and
 * calls the host's delegate methods; returns an empty string while the
 * media-expand modal is open so the nav can't compete with its chrome.
 * The CTA label flips Contact → Selected work → Related by scroll state and
 * route; the menu items mirror the same conditional logic.
 */

import { BASE_TITLE } from '@core/tokens/routes.js'
import { FORM_ATTRS } from '@core/tokens/attrs/form.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { SECTIONS } from '@core/tokens/base.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { NAV_BURGER_CLASSES, NAV_CLASSES, NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { NAV_UI_KEYS, SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { MENU_CSS_PROPS } from '@core/tokens/css/menu.js'
import { h, Fragment } from '@core/jsx.js'
import { renderNavGear } from './gear.js'
import { isPlainClick } from '@core/utils/dom.js'
import '@website/components/media/DrawText.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { localePath } from '@core/i18n.js'
import { appText } from '@core/locale/ui-text.js'
import type { AppNav } from './AppNav.js'
import { DRAW_TIMINGS } from '@core/tokens/media/dimensions.js'

/**
 * Renders the <app-nav> template: logo, burger strip, and the fullscreen
 * menu overlay. Returns '' while the media-expand modal is open — an empty
 * render wipes the nav DOM so its z-index/focus can never compete with the
 * modal chrome. The CTA label chain (contact → selected work at page bottom →
 * related on project routes) mirrors the menu item order.
 * @param nav AppNav instance — reads its getters/state, calls delegates.
 * @returns JSX tree, or '' while a modal owns the screen.
 */
export const renderAppNav = (nav: AppNav) => {
  const modal = store.getters.getModal()
  if (modal?.open === true) {
    return ATTR_VALUES.EMPTY
  }

  const t = nav.translations
  const title = t?.title || BASE_TITLE

  const aboutDesc = t?.about?.description || appText(SECTION_UI_KEYS.ABOUT_DESCRIPTION)

  const isNotFound = nav.currentRoute?.name === ROUTE_NAMES.NOT_FOUND

  const logoClasses = `${NAV_CLASSES.NAV_LINK} ${!nav.isHomePage ? NAV_CLASSES.NAV_BACK : CHAR_STRINGS.EMPTY} ${nav.isHomePage && nav.activeSection === SECTIONS.HOME ? NAV_CLASSES.NAV_ACTIVE : CHAR_STRINGS.EMPTY} ${NAV_CLASSES.NAV_LOGO_BTN}`

  const aboutActive = nav.isHomePage && nav.activeSection === SECTIONS.ABOUT && !nav.onBottom

  const actionActive = nav.onBottom || (nav.isHomePage && nav.activeSection === SECTIONS.CONTACT)

  const itemClass = (active: boolean) =>
    `${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM}${active ? ` ${NAV_MENU_CLASSES.NAV_MENU_MODAL_ITEM_ACTIVE}` : CHAR_STRINGS.EMPTY}`

  // Letters draw first (draw-text stagger), then the item's own underline
  // sweeps in — --draw-ms = offset + chars·delay + one draw duration, so the
  // line lands the moment the label finishes drawing.
  let itemIdx = 0

  const drawTiming = (label: string) => {
    const offset = DRAW_TIMINGS.MENU_LABEL_OFFSET_MS + itemIdx * DRAW_TIMINGS.MENU_LABEL_STAGGER_MS

    itemIdx++

    return {
      offset,
      underline:
        offset +
        Math.max(0, label.length - 1) * DRAW_TIMINGS.MENU_LABEL_CHAR_DELAY +
        DRAW_TIMINGS.DRAW_ANIM_EXTRA_MS,
    }
  }

  const DrawText = COMPONENT_TAGS.DRAW_TEXT

  // The label also lives in the element's light DOM: textContent stays
  // populated for tests/no-upgrade paths while the shadow char spans do
  // the drawing. Unslotted light children are never rendered.
  const itemLabel = (label: string, offset: number) => (
    <DrawText text={label} delay={DRAW_TIMINGS.MENU_LABEL_CHAR_DELAY} offset={offset}>
      {label}
    </DrawText>
  )

  const menuLabel = (t?.menu || appText(NAV_UI_KEYS.MENU)) as string

  const closeLabel = (t?.close || appText(NAV_UI_KEYS.CLOSE)) as string

  // While the menu is open the burger IS the close control — it sits
  // exactly over the modal's close button and morphs into it.
  const burgerLabel = nav._menuOpen ? closeLabel : menuLabel

  // The space playground's scene is always dark — the nav needs the
  // light-ink variant there regardless of the global theme, otherwise
  // light mode paints dark links over the dark canvas. While the menu
  // is open the modal is the surface under the control, so the burger
  // (morphed into the close X) uses theme ink like every other page;
  // _menuOpen stays true through the close dissolve, releasing --on-dark
  // exactly when the dark scene is revealed again. The contact/footer
  // band is now theme-flipping (--bg-secondary) — only dark in dark
  // mode — so the bottom-of-page inversion applies under dark mode only;
  // light mode keeps theme ink over the light band.
  const darkTheme = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

  const onDark =
    !nav._menuOpen &&
    (nav.isPlaygroundPage ||
      (darkTheme && nav.isHomePage && (nav.onBottom || nav.activeSection === SECTIONS.CONTACT)))

  nav._onDark = onDark

  // Menu items — computed unconditionally so the persistent index below
  // and the open modal render the SAME list (one declaration, two
  // surfaces); route items carry real hrefs, dialog triggers stay
  // buttons.
  const aboutLabel = String(aboutDesc)
  const selectedWorkLabel = String(t?.featured || appText(NAV_UI_KEYS.SELECTED_WORK))
  const scrollUpLabel = String(t?.scrollUp || appText(NAV_UI_KEYS.SCROLL_UP))
  const contactLabel = String(t?.contact || appText(CMS_KEYS.CONTACT))
  const contactText = nav.onBottom ? scrollUpLabel : contactLabel
  const playgroundLabel = String(t?.earthPlayground || appText(CMS_KEYS.EARTH_PLAYGROUND))
  const starFieldLabel = String(t?.starField || appText(CMS_KEYS.STAR_FIELD))
  const prefLabel = String(t?.preferences || appText(NAV_UI_KEYS.PREFERENCES))
  const langLabel = String(nav.currentLangLabel)
  const experimentsLabel = String(t?.experiments || appText(NAV_UI_KEYS.EXPERIMENTS))

  const items: Array<{
    label: string
    cls: string
    onClick: (e: Event) => void
    prefix?: unknown
    title?: string
    /** Route items render as real anchors — right-click and
     *  open-in-new-tab reach the href; plain clicks go through
     *  the SPA handler. Dialog triggers stay buttons. */
    href?: string
    /** Category heading rendered above the first item carrying it —
     *  groups experiment links under a localized "Experiments" title. */
    group?: string
  }> = []

  if (!isNotFound) {
    // Selected work — scrolls to the mosaic on home; on other routes it
    // navigates home. Already over the section → just closes the menu.
    items.push({
      label: selectedWorkLabel,
      cls: `${NAV_CLASSES.NAV_ACTION_BTN} ${NAV_CLASSES.NAV_SELECTED_WORK}`,
      href: localePath('', nav.locale),
      onClick: (e: Event) => {
        if (e && !isPlainClick(e)) return

        e?.preventDefault?.()
        nav._closeMenu()

        if (!nav.isHomePage) {
          router.push(localePath('', nav.locale))
        } else if (nav.onBottom || nav.activeSection !== SECTIONS.HOME) {
          nav.scrollToTop()
        }
      },
    })
  }

  if (!isNotFound) {
    items.push({
      label: aboutLabel,
      cls: NAV_CLASSES.NAV_ABOUT_BTN,
      href: localePath(CMS_KEYS.ABOUT, nav.locale),
      onClick: (e: Event) => {
        nav._closeMenu()

        nav.handleAbout(e)
      },
    })
  }

  if (!isNotFound) {
    // Contact — or "scroll up" when the contact band is already showing:
    // the CTA at page bottom morphs into a return-to-top affordance.
    items.push({
      label: contactText,
      cls: `${NAV_CLASSES.NAV_ACTION_BTN}${nav.onBottom ? ` ${NAV_CLASSES.NAV_SCROLL_DOWN}` : CHAR_STRINGS.EMPTY}`,
      href: nav.onBottom ? localePath('', nav.locale) : localePath(CMS_KEYS.CONTACT, nav.locale),
      onClick: (e: Event) => {
        nav._closeMenu()

        nav.handleAction(e)
      },
    })
  }

  if (!nav.isEarthPlaygroundPage) {
    items.push({
      label: playgroundLabel,
      cls: CHAR_STRINGS.EMPTY,
      group: experimentsLabel,
      href: localePath(CMS_KEYS.EARTH_PLAYGROUND, nav.locale),
      onClick: (e: Event) => {
        if (!isPlainClick(e)) return

        e.preventDefault()
        nav._closeMenu()

        router.push(localePath(CMS_KEYS.EARTH_PLAYGROUND, nav.locale))
      },
    })
  }

  if (!nav.isStarFieldPage) {
    items.push({
      label: starFieldLabel,
      cls: CHAR_STRINGS.EMPTY,
      group: experimentsLabel,
      href: localePath(CMS_KEYS.STAR_FIELD, nav.locale),
      onClick: (e: Event) => {
        if (!isPlainClick(e)) return

        e.preventDefault()
        nav._closeMenu()

        router.push(localePath(CMS_KEYS.STAR_FIELD, nav.locale))
      },
    })
  }

  return (
    <nav
      className={`${NAV_CLASSES.NAV}${onDark ? ` ${NAV_CLASSES.NAV_ON_DARK}` : CHAR_STRINGS.EMPTY}${nav.isPlaygroundPage ? ` ${NAV_CLASSES.NAV_PLAYGROUND}` : CHAR_STRINGS.EMPTY}`}
      aria-label={title}
    >
      {/* Real anchor — right-click / open-in-new-tab reach the localized
          home route; the click handler only intercepts plain clicks. */}
      <a
        className={logoClasses}
        href={localePath('', nav.locale)}
        onClick={(e: Event) => nav.handleLogo(e)}
      >
        <DrawText text={title} delay={DRAW_TIMINGS.MENU_LABEL_CHAR_DELAY} offset={0} visible>
          {title}
        </DrawText>
      </a>

      {!isNotFound && (
        <div className={NAV_CLASSES.NAV_MOBILE_STRIP}>
          <div className={NAV_BURGER_CLASSES.NAV_BURGER_WRAP}>
            {nav._burgerCanvas(burgerLabel)}
            <button
              className={NAV_BURGER_CLASSES.NAV_BURGER_FALLBACK}
              type={FORM_ATTRS.TYPE_BUTTON}
              aria-label={burgerLabel}
              aria-expanded={nav._menuOpen ? ATTR_VALUES.TRUE : ATTR_VALUES.FALSE}
              aria-controls={APP_IDS.NAV_MENU_PANEL}
              onClick={() => nav._toggleMenu()}
            >
              <span className={NAV_BURGER_CLASSES.NAV_BURGER_SQUARE} />
              <span className={NAV_BURGER_CLASSES.NAV_BURGER_SQUARE} />
              <span className={NAV_BURGER_CLASSES.NAV_BURGER_SQUARE} />
              <span className={NAV_BURGER_CLASSES.NAV_BURGER_SQUARE} />
            </button>
          </div>

          {/* Round flag button — language switcher moved out of the menu
              modal: the disc holds the locale flag; on hover/focus the
              strip expands horizontally on the water curve (a
              critically damped settle — smooth, zero overshoot) to
              reveal the language name at hairline weight. Click/Enter
              opens the language dialog. Hidden on the English-only
              docs portal — no switcher exists there. */}
          {!nav.currentRoute?.meta?.docsRoute && (
            <button
              className={NAV_CLASSES.NAV_FLAG_BTN}
              type={FORM_ATTRS.TYPE_BUTTON}
              lang={nav.locale}
              aria-label={langLabel}
              title={langLabel}
              onClick={(e: Event) => nav.handleLang(e)}
            >
              {nav.renderLocaleFlag()}
              <span className={NAV_CLASSES.NAV_FLAG_LABEL} aria-hidden={ATTR_VALUES.TRUE}>
                {nav.currentLangLabel}
              </span>
            </button>
          )}

          {/* Round gear button — preferences moved out of the menu
              modal: a machined-steel gear on a slow perpetual spin that
              opens the preferences dialog on click/Enter. */}
          <button
            className={NAV_CLASSES.NAV_GEAR_BTN}
            type={FORM_ATTRS.TYPE_BUTTON}
            aria-label={prefLabel}
            title={prefLabel}
            onClick={(e: Event) => nav.handlePreferences(e)}
          >
            {renderNavGear()}
          </button>
        </div>
      )}

      {/* Menu index — the persistent copy of the items below: an
          sr-only landmark list of real anchors + action buttons kept in
          the a11y tree and DOM while the overlay is closed, so heading
          maps, landmark lists, crawlers and agents can enumerate the
          menu's links and functionality in every state. inert while the
          modal owns the same items so they're never announced twice;
          tabindex -1 keeps the hidden copies out of sequential tab
          order (the modal's own items are the interactive set). */}
      <nav
        className={A11Y_CLASSES.SR_ONLY}
        aria-label={menuLabel}
        inert={nav._menuOpen}
        data-nosnippet
      >
        <h2>{menuLabel}</h2>
        <ul>
          {items.map((item) => (
            <li key={item.label}>
              <h3>
                {item.href ? (
                  <a
                    href={item.href}
                    title={item.title || undefined}
                    tabIndex={CHAR_STRINGS.MINUS_ONE}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    type={FORM_ATTRS.TYPE_BUTTON}
                    title={item.title || undefined}
                    tabIndex={CHAR_STRINGS.MINUS_ONE}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </button>
                )}
              </h3>
            </li>
          ))}
        </ul>
      </nav>

      {/* Fullscreen menu modal — the single menu for every breakpoint.
          While open it IS the navigation landmark (aria-labelledby → the
          sr-only h2); the id is the burger toggles' aria-controls
          target. */}
      <div
        className={`${NAV_MENU_CLASSES.NAV_MENU_MODAL}${nav._menuOpen ? ` ${NAV_MENU_CLASSES.NAV_MENU_MODAL_OPEN}` : CHAR_STRINGS.EMPTY}${nav._menuClosing ? ` ${NAV_MENU_CLASSES.NAV_MENU_MODAL_CLOSING}` : CHAR_STRINGS.EMPTY}${nav._menuSettled ? ` ${NAV_MENU_CLASSES.NAV_MENU_MODAL_SETTLED}` : CHAR_STRINGS.EMPTY}`}
        id={APP_IDS.NAV_MENU_PANEL}
        role={nav._menuOpen ? ARIA_ATTRS.ROLE_NAVIGATION : undefined}
        aria-labelledby={nav._menuOpen ? APP_IDS.NAV_MENU_TITLE : undefined}
      >
        {nav._menuOpen ? nav._menuCanvas() : null}

        <div className={NAV_MENU_CLASSES.NAV_MENU_MODAL_FALLBACK} aria-hidden={ATTR_VALUES.TRUE} />

        {/* No dedicated close button here: the persistent burger stays
            above the overlay at the same coordinates and morphs into
            the close control — two stacked buttons would paint two Xs. */}

        {nav._menuOpen && (
          <div className={NAV_MENU_CLASSES.NAV_MENU_MODAL_CONTENT}>
            {/* Landmark heading for AT navigation — sr-only +
                data-nosnippet: a jump target, never indexed. The id
                makes the open overlay a labelled navigation landmark;
                the persistent index copy above carries the same items
                for closed-state discovery. */}
            <h2 className={A11Y_CLASSES.SR_ONLY} id={APP_IDS.NAV_MENU_TITLE} data-nosnippet>
              {menuLabel}
            </h2>
            {items.map((item, i) => {
              const timing = drawTiming(item.label)

              // First item of a group gets the localized category
              // heading ("Experiments" above the playground pair).
              const groupStart = item.group && (!i || items[i - 1].group !== item.group)

              // Active highlighting: only about/action rows can light
              // up — matched by class since items are plain data.
              const active =
                item.cls === NAV_CLASSES.NAV_ABOUT_BTN
                  ? aboutActive
                  : item.cls.includes(NAV_CLASSES.NAV_ACTION_BTN)
                    ? actionActive
                    : false

              const itemCls = `${itemClass(active)} ${item.cls}`.trim()
              const itemStyle = {
                [MENU_CSS_PROPS.DRAW_MS]: `${timing.underline}ms`,
                [MENU_CSS_PROPS.OFFSET_MS]: `${timing.offset}ms`,
              }
              const itemBody = (
                <Fragment>
                  {item.prefix}
                  {itemLabel(item.label, timing.offset)}
                </Fragment>
              )

              // Route items are real anchors (right-click/new-tab/crawl);
              // dialog triggers stay buttons. The sr-only h3 ahead of
              // each is the AT heading-jump target; absolutely
              // positioned, it never claims a grid cell.
              return (
                <Fragment key={item.label}>
                  {groupStart ? (
                    // The divider's fade leads its group's first label by
                    // one stagger step — the break lands just before the
                    // items it heads (--offset-ms consumed by the group's
                    // --open animation in _menu-overlay.scss).
                    <div
                      className={NAV_MENU_CLASSES.NAV_MENU_MODAL_GROUP}
                      style={{
                        [MENU_CSS_PROPS.OFFSET_MS]: `${Math.max(0, timing.offset - DRAW_TIMINGS.MENU_LABEL_STAGGER_MS)}ms`,
                      }}
                    >
                      <span className={NAV_MENU_CLASSES.NAV_MENU_MODAL_GROUP_TITLE}>
                        {item.group}
                      </span>
                    </div>
                  ) : null}
                  {/* sr-only heading — the AT heading-jump target for
                      the item (every label resolves non-empty through
                      its appText fallback). */}
                  <h3 className={A11Y_CLASSES.SR_ONLY} data-nosnippet>
                    {item.label}
                  </h3>
                  {item.href ? (
                    <a
                      className={itemCls}
                      href={item.href}
                      aria-label={item.label}
                      title={item.title || undefined}
                      style={itemStyle}
                      onClick={item.onClick}
                    >
                      {itemBody}
                    </a>
                  ) : (
                    <button
                      className={itemCls}
                      type={FORM_ATTRS.TYPE_BUTTON}
                      aria-label={item.label}
                      title={item.title || undefined}
                      style={itemStyle}
                      onClick={item.onClick}
                    >
                      {itemBody}
                    </button>
                  )}
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}
