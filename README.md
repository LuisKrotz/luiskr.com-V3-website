# luiskr.com V3 — website

The public-facing site — the portfolio a visitor actually sees. `website/` contains
every routed view (`<view-home>`, `<view-project>`, `<view-legal>`, `<view-not-found>`)
and every presentational component they mount: the nav, the dialogs, the carousels,
the mosaic, the media pipeline, the footer — plus the visual-effects modules that
give the site its character (VHS glitch portrait, paper-burn titles, WebGL
skeletons and widgets).

Everything here builds on `core/` primitives and renders through `shared/src`
(the app shell) — `website` owns no boot code, only views and components.

## How a page is made

1. The router (in `core/`) resolves the URL — locale prefix + localized slug → route.
2. `shared/src/app/view.ts` lazy-imports the view's chunk and mounts its element
   into `#view-outlet`.
3. The view's custom element (e.g. `<view-home>`) fetches its translation/content
   nodes via the SWR data layer — bundled snapshot instantly, Firebase revalidate.
4. It renders JSX into a shadow root, mounts its children, keeps JSON-LD in sync,
   and pushes loaded data down into section components.

## Views — the routed surface

### `views/home/` — the landing page

| File          | What it does                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Home.tsx`    | `<view-home>` — hero carousel, about section, mosaic grid, contact footer, awards strip. Three SWR sources fetched in parallel; JSON-LD kept in sync. |
| `children.ts` | Pushes loaded translations/items into section children.                                                                                               |
| `data.ts`     | Data loading — `pages/home`, `components/projects`, `pages/about` + profile picture.                                                                  |
| `render.tsx`  | JSX template — the hero mosaic, about, contact footer, awards.                                                                                        |
| `scroll.ts`   | Post-navigation scroll — same-view `#about`/`#contact` re-scrolls after the route fade.                                                               |
| `types.ts`    | Shapes — portfolio list item, `pages/home` node, `pages/about` node.                                                                                  |

### `views/project/` — portfolio detail

| File            | What it does                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Project.tsx`   | `<view-project>` — hero cover, case-study sections (media + copy), awards, related carousel. Owns the expand modal and the project JSON-LD graph. |
| `carousels.ts`  | Configures each `<custom-carousel>` — eager for the first sections, idle batches for the rest.                                                    |
| `data.ts`       | Slug resolution, robots-meta for drafts, the SWR fetch + title + JSON-LD.                                                                         |
| `layout.ts`     | Section height from media ratio, stagger delays, landscape-group detector.                                                                        |
| `modal.ts`      | Auto-open — `?open=` deep link commits the expand-modal payload.                                                                                  |
| `modal-dom.tsx` | Imperative modal sync — mirrors the store descriptor without re-rendering (a re-render would kill every mounted carousel).                        |
| `render.tsx`    | JSX — title, cover figure, section list.                                                                                                          |
| `types.ts`      | Media items, section children, project node, carousel contract.                                                                                   |

### `views/legal/` + `views/not-found/`

| File           | What it does                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `Legal.tsx`    | `<view-legal>` — privacy/GDPR/terms/license: the requested document's translated body in the internals chrome. |
| `NotFound.tsx` | `<view-not-found>` — the 404 "signal lost" page.                                                               |

## Components — the presentational layer

### `components/nav/` — the top bar

| File          | What it does                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppNav.tsx`  | `<app-nav>` — logo, burger button, menu overlay, locale flag trigger, preferences trigger. Hosts the WebGL widgets; tracks scroll for `--on-dark`. |
| `flag.tsx`    | Locale flag rendering + FlagWebGL lifecycle.                                                                                                       |
| `handlers.ts` | Click handlers — logo, section links, CTA, dialog triggers.                                                                                        |
| `menu.tsx`    | Fullscreen menu overlay — persistent canvases, open→settled→closing state machine.                                                                 |
| `render.tsx`  | JSX template — logo, burger, menu overlay.                                                                                                         |
| `scroll.ts`   | Section navigation — scroll-top/about/contact through `smoothScrollTo`.                                                                            |

### `components/dialogs/` — the two modals

| File                                            | What it does                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `PreferencesModal.tsx`                          | `<preferences-modal>` — theme slider, reduced-motion/autoplay/grid/stats switches, NPU readout. Genie-opens from nav. |
| `preferences/render.tsx`                        | Dialog template — WebGL canvas paints the affordance; real inputs receive clicks (double-layered for fallback).       |
| `preferences/sync.ts`, `webgl.ts`, `types.ts`   | DOM/widget sync, widget mount/teardown, `pref.*` node shape.                                                          |
| `LangDialog.tsx`                                | `<lang-dialog>` — 16-locale grid with WebGL waving flags; selection rewrites the URL and reloads translations.        |
| `lang-dialog/events.ts`                         | Option clicks, dismissal, the GPU glass-follower highlight.                                                           |
| `lang-dialog/locale.ts`                         | URL → new-locale mapping — known routes rebuild via localized slug; dynamic routes keep path minus prefix.            |
| `lang-dialog/render.tsx`, `sync.ts`, `webgl.ts` | Template, open-state sync, per-option FlagWebGL mounts.                                                               |

### `components/home/` — landing sections

| File                 | What it does                                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AboutSection.tsx`   | `<about-section>` — bio block with Gravatar portrait + `<draw-text>` copy.                                                                                                                                             |
| `ContactSection.tsx` | `<contact-section>` — contact footer over the dark band.                                                                                                                                                               |
| `HomeMosaic.tsx`     | `<home-mosaic>` — the masonry project grid: WASM-packed cards, hover previews, skeleton layer.                                                                                                                         |
| `AwardsMentions.tsx` | `<awards-mentions>` — footer awards carousel + legal links.                                                                                                                                                            |
| `about/glitch*.ts`   | The VHS/glitch portrait — ambient corruption always on, ramps to full VHS on hover (channel ghosts, scanlines, slice tears, tracking).                                                                                 |
| `awards/`            | Awards data (SWR fetch), carousel wiring (progress arc), JSX template.                                                                                                                                                 |
| `mosaic/`            | Layout engine (sync + WASM), hover interactions, JSX, and the **burn** pipeline — the paper-combustion title effect where card titles ignite and re-ink themselves (front geometry, particle sim, paper raster, loop). |

### `components/media/` — the media pipeline

| File                                                    | What it does                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `MediaFigure.tsx`                                       | `<media-figure>` — the core media card: thumb → high-res crossfade or muted-autoplay video, skeleton shimmer, expand modal.           |
| `figure/load.ts`                                        | CDN variant matrix + progressive loading — zero-CLS SVG placeholder, detached-preload swap.                                           |
| `figure/modal.ts`, `mount.ts`, `render.tsx`, `video.ts` | Expand-modal open + deep-link, mount lifecycle, JSX, video plumbing.                                                                  |
| `DrawText.tsx`                                          | `<draw-text>` — character-staggered reveal; per-char delay via WASM so lines land in the target duration.                             |
| `draw-text/`                                            | Tokenizer, shared sheet, fit-to-width, trigger wiring.                                                                                |
| `MediaExpanded.tsx`                                     | `<media-expanded>` — fullscreen viewer inside the expand modal.                                                                       |
| `expanded/`                                             | Dismissal sequence (genie zoom-out → teardown), mount (full-res pipeline: disk cache → WASM decode → blob swap), four-affordance JSX. |

### `components/carousel/` — carousels

| File                 | What it does                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `CustomCarousel.tsx` | `<custom-carousel>` — infinite-loop carousel (clone-ended native scroll), WebGL arrow controls, dot nav, viewport-gated autoplay. |
| `custom-carousel/`   | Arrows/widget wiring, autoplay+progress ring engine, lifecycle, nav (clone teleport), sizing, JSX.                                |
| `AwardsCarousel.tsx` | `<awards-carousel>` — lighter sibling for text/award content (30s autoplay, ≥50% visibility gate).                                |
| `awards-carousel/`   | Autoplay ticker, events, nav, observer, render, types.                                                                            |

### `components/portfolio/`, `components/legal/`, `components/feedback/`

| File                                 | What it does                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `portfolio/Related.tsx` + `related/` | `<portfolio-related>` — related-projects strip: fuzzy join of the related node against the home portfoliolist. |
| `legal/Footer.tsx`                   | `<legal-footer>` — shared footer strip: legal links, credits, disclaimer.                                      |
| `feedback/CookieBanner.tsx`          | `<cookie-banner>` — consent bar persisted to localStorage.                                                     |
| `feedback/SiteToast.tsx`             | `<site-toast>` — the in-page notification fallback surface.                                                    |
| `feedback/StatsHud.tsx`              | `<stats-hud>` — stats-for-nerds overlay fed by `statsEngine`.                                                  |

### Root files

| File             | What it does                                                                    |
| ---------------- | ------------------------------------------------------------------------------- |
| `index.ts`       | Barrel — importing it self-registers every `<view-*>` element transitively.     |
| `dev.ts`         | Standalone dev entry — boots the real app shell through the module vite config. |
| `vite.config.js` | Library build — emits `website/dist/website.js`.                                |

## Commands

```bash
yarn dev      # boots the real app shell (shared/src) through this module's vite config
yarn test     # jest suite for website
yarn build    # emits website/dist/website.js
```

---

Submodule of [luiskr.com-V3](https://github.com/LuisKrotz/luiskr.com-V3). Install
deps from the superproject (`yarn install` at the root), then run `yarn dev` /
`yarn test` / `yarn build` in this folder — see `package.json` scripts.

License: [MPL-2.0](https://github.com/LuisKrotz/luiskr.com-V3/blob/development/LICENSE)
