/**
 * Website module barrel.
 *
 * Public site's routable
 * surface (home, legal, not-found, project detail). Importing the barrel runs
 * each view module once, so every `<view-*>` element self-registers via its
 * `customElements.define` guard and every component the views pull in is
 * registered transitively. Re-export-only file: `istanbul ignore` because
 * there is no executable logic to cover.
 */
/* istanbul ignore file */

export { ViewHome } from './views/home/Home.js'
export { ViewLegal } from './views/legal/Legal.js'
export { ViewNotFound } from './views/not-found/NotFound.js'
export { ViewProject } from './views/project/Project.js'
