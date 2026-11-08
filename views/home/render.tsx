/**
 * @file routes/views/home/render.tsx
 * @description JSX template for <view-home> — the selected-work
 * card-stack deck, about section, contact footer and awards strip,
 * each wrapped in its anchor target for same-view scroll navigation.
 */

import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { h } from '@core/jsx.js'
import type { ViewHome } from './Home.js'

/**
 * Renders home.
 * @param view — the view
 */
export function renderHome(view: ViewHome) {
  const CardStack = COMPONENT_TAGS.CARD_STACK
  const AboutSection = COMPONENT_TAGS.ABOUT_SECTION
  const ContactSection = COMPONENT_TAGS.CONTACT_SECTION
  const AwardsMentions = COMPONENT_TAGS.AWARDS_MENTIONS

  return (
    <article className={view.hasTouch ? 'has_touch' : ''}>
      <div id="home">
        <CardStack />
      </div>

      <div id="about">
        <AboutSection />
      </div>

      <div id="contact">
        <ContactSection />
      </div>

      <AwardsMentions />
    </article>
  )
}
