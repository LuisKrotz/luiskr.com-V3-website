/**
 * @file sitemap-map-data-tails.test.js
 * @description Coverage tail for views/sitemap/map-data — the sitemap
 * link tree: portfolio rows with 16 locale leaves, media item blocks
 * carrying per-locale deep links (never raw CDN URLs), slug ordinals
 * on duplicate labels, and project-page fallbacks for
 * non-modal-addressable media.
 */
import { LOCALES } from '@core/constants.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { TRANSLATION_KEYS } from '@core/tokens/routes/translation-keys.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { VALID_LANGS } from '@core/i18n.js'
import { routeSlugs } from '@core/locale/ui-text.js'
import { FALLBACK_PAGES } from '@core/locale/fallback.js'
import store from '@core/store.js'
import { TEST_PROJECTS } from '@tests/fixtures/test-constants.js'
import { buildSitemapTree } from '@website/views/sitemap/map-data.js'

/** Slash char alias — path literals below stay readable without escapes. */
const S = CHAR_STRINGS.SLASH

/** Portfolio URL builder — `/portfolio/<slug>` under EN, `/<loc>/…` else. */
const projectUrl = (slug, loc) =>
  `${loc === LOCALES.EN ? CHAR_STRINGS.EMPTY : `${S}${loc}`}${S}${ROUTE_PATHS.PORTFOLIO_SEGMENT}${S}${slug}`

/**
 * Minimal two-locale projects fixture — the BR labels differ so
 * per-locale media slugs exercise the translation path; media srcs are
 * identical so the index-alignment check passes.
 */
const EN_PROJECT = {
  title: 'Sage',
  folder: 'sage/',
  cover: { src: 'covers/main', label: 'Sage cover', size: [1600, 900], isVideo: true },
  sections: [
    [
      ['a text row — skipped'],
      [
        { src: 'media/one', label: 'Overview', size: [3840, 2160], canExpand: true },
        { src: 'media/two', label: 'Overview' },
        { src: 'media/three' },
        { src: 'media/clip.mp4', label: 'Reel', isVideo: true, size: [1920, 1080] },
      ],
    ],
  ],
}

/** Portuguese project fixture — media rows cover the unlabeled/video arms. */
const BR_PROJECT = {
  title: 'Sage',
  folder: 'sage/',
  cover: { src: 'covers/main', label: 'Capa' },
  sections: [
    [
      ['texto'],
      [
        { src: 'media/one', label: 'Visão geral' },
        { src: 'media/two', label: 'Visão geral' },
        { src: 'media/three' },
        { src: 'media/clip.mp4', label: 'Reel', isVideo: true },
      ],
    ],
  ],
}

/** Per-locale project maps — the sitemap builder iterates locales over these. */
const projectsByLocale = {
  [LOCALES.EN]: { [TEST_PROJECTS.SAGE]: EN_PROJECT },
  [LOCALES.BR]: { [TEST_PROJECTS.SAGE]: BR_PROJECT },
}

/** Finds the media group — the first mosaic group (precedes playgroundMedia). */
const mediaGroup = (tree) => tree.children.find((g) => g.mosaic === true)

describe('sitemap map-data — groups and portfolio rows', () => {
  test('root carries the display-locale home href and all section groups', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    expect(tree.href).toBe(S)
    expect(tree.children.length).toBe(6)
    expect(mediaGroup(tree)).not.toBeUndefined()
    // The docs group stays English-only — one locale leaf.
    const docs = tree.children.find((g) => g.children.every((n) => n.children.length === 1))

    expect(docs).not.toBeUndefined()
  })

  test('portfolio group lists every project with 16 locale leaves', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const portfolio = tree.children.find((g) =>
      g.children.some((n) => n.label === EN_PROJECT.title)
    )

    expect(portfolio).not.toBeUndefined()

    const project = portfolio.children.find((n) => n.label === EN_PROJECT.title)

    expect(project.href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN))
    expect(project.children).toHaveLength(VALID_LANGS.length)
    expect(project.children[0].href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN))
    expect(project.children[1].href).toBe(projectUrl(TEST_PROJECTS.SAGE, VALID_LANGS[1]))
    expect(project.children[1].locale).toBe(VALID_LANGS[1])
  })
})

describe('sitemap map-data — media deep links', () => {
  test('media group renders one block per media item (cover + sections)', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const media = mediaGroup(tree)

    // cover + 4 section items = 5 page blocks.
    expect(media.children).toHaveLength(5)

    const overview = media.children.find((n) => n.label.endsWith('Overview'))

    expect(overview).not.toBeUndefined()
    // Label is prefixed with the project title (the block is flat — no
    // project wrapper in column flow).
    expect(overview.label).toBe(`${EN_PROJECT.title}${CHAR_STRINGS.COLON} Overview`)
  })

  test('media leaf hrefs are project/media deep links — never CDN URLs', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const media = mediaGroup(tree)

    const [first, second] = media.children.filter((n) => n.label.endsWith('Overview'))

    // Block href = current-locale deep link; first Overview claims the
    // bare slug, the duplicate gets the -2 ordinal.
    expect(first.href).toBe(`${projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN)}${S}overview`)
    expect(second.href).toBe(`${projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN)}${S}overview-2`)

    const allHrefs = media.children.flatMap((n) => [n.href, ...n.children.map((l) => l.href)])

    expect(allHrefs.every((h) => h.startsWith(S))).toBe(true)
    expect(allHrefs.some((h) => h.includes('://') || h.includes('storage.googleapis.com'))).toBe(
      false
    )
  })

  test('media leaves carry per-locale slugs derived from translated labels', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const media = mediaGroup(tree)

    const [first, second] = media.children.filter((n) => n.label.endsWith('Overview'))

    const brLeaf = first.children.find((l) => l.locale === LOCALES.BR)
    const brLeaf2 = second.children.find((l) => l.locale === LOCALES.BR)

    // BR slugs come from the BR labels — 'Visão geral' → visao-geral(-2).
    expect(brLeaf.href).toBe(`${projectUrl(TEST_PROJECTS.SAGE, LOCALES.BR)}${S}visao-geral`)
    expect(brLeaf2.href).toBe(`${projectUrl(TEST_PROJECTS.SAGE, LOCALES.BR)}${S}visao-geral-2`)
    // The leaf tooltip shows the caption in the leaf's own language.
    expect(brLeaf.tip).toBe('Visão geral')

    // A locale with no projects map falls back to its project page.
    const deLeaf = first.children.find((l) => l.locale === LOCALES.DE)

    expect(deLeaf.href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.DE))
  })

  test('cover + unlabeled media fall back to the localized project page', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const media = mediaGroup(tree)

    const cover = media.children[0]

    // Cover block — label is the caption; every leaf points at the
    // localized project page (the cover is the page's first visual).
    expect(cover.href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN))
    expect(cover.children.every((l) => l.href === projectUrl(TEST_PROJECTS.SAGE, l.locale))).toBe(
      true
    )

    const unlabeled = media.children.find((n) => n.label.endsWith(`${MEDIA.EXT}`))

    // Unlabeled items show the file name and fall back to the project
    // page — they have no modal slug to deep-link by.
    expect(unlabeled).not.toBeUndefined()
    expect(unlabeled.href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN))
    expect(unlabeled.children[0].href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN))
  })

  test('video rows resolve video-extension filenames in fallback labels', () => {
    const bareProjects = {
      [LOCALES.EN]: {
        [TEST_PROJECTS.SAGE]: {
          title: TEST_PROJECTS.METCHA_TITLE,
          sections: [[[{ src: 'clips/reel', isVideo: true }]]],
        },
      },
    }

    const tree = buildSitemapTree(null, bareProjects)

    const reel = mediaGroup(tree).children[0]

    expect(reel.label.endsWith(MEDIA.VIDEO_EXT)).toBe(true)
    expect(reel.href).toBe(projectUrl(TEST_PROJECTS.SAGE, LOCALES.EN))
  })
})

describe('sitemap map-data — label edge cases', () => {
  test('media label already prefixed with the project title stays as-is', () => {
    const prefixed = {
      [LOCALES.EN]: {
        [TEST_PROJECTS.SAGE]: {
          title: EN_PROJECT.title,
          sections: [[[{ src: 'media/x', label: 'Sage detail' }]]],
        },
      },
    }

    const tree = buildSitemapTree(null, prefixed)

    expect(mediaGroup(tree).children[0].label).toBe('Sage detail')
  })

  test('empty projects map yields no portfolio/media children', () => {
    const tree = buildSitemapTree(null, {})

    const media = tree.children.find((g) => g.mosaic)

    const portfolio = tree.children.find((g) =>
      g.children.some((n) => n.label === EN_PROJECT.title)
    )

    expect(media).toBeUndefined()
    expect(portfolio).toBeUndefined()
    // Pages/legal/playground/docs remain.
    expect(tree.children.length).toBeGreaterThan(0)
  })
})

describe('sitemap map-data — media card payloads', () => {
  test('media nodes carry the figure payload (stem, size, isVideo, canExpand)', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const media = mediaGroup(tree)

    const first = media.children.find((n) => n.label.endsWith('Overview'))

    // folder + src is the extensionless stem the figure resolves.
    expect(first.media.kind).toBe('figure')
    expect(first.media.src).toBe(`${EN_PROJECT.folder}media/one`)
    expect(first.media.isVideo).toBeUndefined()
    expect(first.media.size).toEqual([3840, 2160])
    expect(first.media.canExpand).toBe(true)

    const cover = media.children[0]

    expect(cover.media.kind).toBe('figure')
    expect(cover.media.isVideo).toBe(true)
    expect(cover.media.size).toEqual([1600, 900])
  })

  test('a project without folder emits caption-only blocks', () => {
    const noFolder = {
      [LOCALES.EN]: {
        [TEST_PROJECTS.SAGE]: {
          title: EN_PROJECT.title,
          sections: [[[{ src: 'media/x', label: 'Loose' }]]],
        },
      },
    }

    const tree = buildSitemapTree(null, noFolder)

    const node = mediaGroup(tree).children[0]

    expect(node.media).toBeUndefined()
  })

  test('media + playground-media groups are collapsible, mosaic and keyed', () => {
    const shares = {
      earth: { images: [`${CDN_URLS.CDN_BASE}experiments/earth-playground/share/e1.png`] },
    }

    const tree = buildSitemapTree(null, projectsByLocale, shares)

    const media = tree.children.find((g) => g.key === 'media')
    const pgMedia = tree.children.find((g) => g.key === 'playgroundMedia')

    for (const g of [media, pgMedia]) {
      expect(g.collapsible).toBe(true)
      expect(g.mosaic).toBe(true)
    }

    // Every group carries a stable key; pages has no media flags.
    const pages = tree.children.find((g) => g.key === 'pages')

    expect(pages).not.toBeUndefined()
    expect(pages.mosaic).toBeUndefined()
    expect(pages.collapsible).toBeUndefined()
  })

  test('the portfolio group is flagged wide (full-span column flow)', () => {
    const tree = buildSitemapTree(null, projectsByLocale)

    const portfolio = tree.children.find((g) => g.key === 'portfolio')

    expect(portfolio).not.toBeUndefined()
    expect(portfolio.wide).toBe(true)
    // Wide is not a media contract — no mosaic/collapsible flags ride it.
    expect(portfolio.mosaic).toBeUndefined()
    expect(portfolio.collapsible).toBeUndefined()

    // The other page-list groups stay narrow.
    for (const g of tree.children) {
      if (g.key !== 'portfolio') expect(g.wide).toBeUndefined()
    }
  })
})

describe('sitemap map-data — playground media branch', () => {
  const SHARES = {
    earth: {
      images: [
        `${CDN_URLS.CDN_BASE}experiments/earth-playground/share/earth-a.png`,
        `${CDN_URLS.CDN_BASE}experiments/earth-playground/share/earth-b.png`,
      ],
      videos: [`${CDN_URLS.CDN_BASE}experiments/earth-playground/share/clip.mp4`],
      label: 'Earth render',
    },
    star: {
      images: [`${CDN_URLS.CDN_BASE}experiments/star-field/share/star-a.png`],
      videos: [`${CDN_URLS.CDN_BASE}experiments/star-field/share/flyby.webm`],
      label: 'Star render',
    },
  }

  const playgroundGroup = (tree) => tree.children.find((g) => g.key === 'playgroundMedia')

  test('share captures become card nodes titled <playground>: <capture> N', () => {
    const tree = buildSitemapTree(null, {}, SHARES)

    const group = playgroundGroup(tree)

    expect(group).not.toBeUndefined()
    // 2 earth images + 1 earth video + 1 star image + 1 star video.
    expect(group.children).toHaveLength(5)

    const first = group.children[0]

    expect(first.label).toMatch(new RegExp(`render${CHAR_STRINGS.SPACE_CHAR}1$`))
    expect(first.href.startsWith(S)).toBe(true)

    // Locale leaves deep-link the localized playground route — never CDN.
    expect(first.children).toHaveLength(VALID_LANGS.length)
    expect(first.children[0].href.startsWith(S)).toBe(true)
    expect(first.children[0].href.includes('://')).toBe(false)
  })

  test('images keep absolute URLs (img kind); videos resolve to figure stems', () => {
    const tree = buildSitemapTree(null, {}, SHARES)

    const children = playgroundGroup(tree).children

    const img = children[0]

    expect(img.media.kind).toBe('img')
    expect(img.media.src).toBe(SHARES.earth.images[0])

    const mp4 = children.find((n) => n.media.isVideo && n.media.src.includes('clip'))

    expect(mp4.media.kind).toBe('figure')
    expect(mp4.media.src).toBe('experiments/earth-playground/share/clip')
    expect(mp4.media.isVideo).toBe(true)

    const webm = children.find((n) => n.media.src.includes('flyby'))

    expect(webm.media.kind).toBe('figure')
    expect(webm.media.src).toBe('experiments/star-field/share/flyby')
  })

  test('manifest dims map each capture URL onto media.size', () => {
    const imgUrl = `${CDN_URLS.CDN_BASE}experiments/earth-playground/share/sized.png`
    const clipUrl = `${CDN_URLS.CDN_BASE}experiments/earth-playground/share/sized-clip.mp4`
    const starUrl = `${CDN_URLS.CDN_BASE}experiments/star-field/share/s.png`

    const shares = {
      earth: {
        images: [imgUrl],
        videos: [clipUrl],
        dims: { [imgUrl]: [6852, 2475], [clipUrl]: [1920, 1080] },
      },
      star: { images: [starUrl] },
    }

    const children = playgroundGroup(buildSitemapTree(null, {}, shares)).children

    // The probed pair lands on img + figure media alike; a URL with no
    // dims entry (and a set with no dims at all) keeps an undefined
    // size so the packer falls back to its generic box.
    expect(children[0].media.size).toEqual([6852, 2475])
    expect(children[1].media.size).toEqual([1920, 1080])
    expect(children[2].media.size).toBeUndefined()
  })

  test('missing capture label falls back to the playground title', () => {
    const shares = { star: { images: [`${CDN_URLS.CDN_BASE}x/s.png`] } }

    const tree = buildSitemapTree(null, {}, shares)

    const node = playgroundGroup(tree).children[0]

    // base = title → text starts with it → no colon prefix re-added.
    expect(node.label.endsWith(`${CHAR_STRINGS.SPACE_CHAR}1`)).toBe(true)
    expect(node.label.includes(CHAR_STRINGS.COLON)).toBe(false)
  })

  test('no shares → no playground-media group; absent sets are skipped', () => {
    const tree = buildSitemapTree(null, {})

    expect(tree.children.find((g) => g.key === 'playgroundMedia')).toBeUndefined()

    const partial = buildSitemapTree(null, {}, { star: SHARES.star })

    expect(playgroundGroup(partial).children).toHaveLength(2)
  })

  test('images-only / videos-only sets fill the empty arms', () => {
    const shares = {
      earth: { images: [`${CDN_URLS.CDN_BASE}experiments/earth-playground/share/only.png`] },
      star: { videos: [`${CDN_URLS.CDN_BASE}experiments/star-field/share/only.mp4`] },
    }

    const children = playgroundGroup(buildSitemapTree(null, {}, shares)).children

    expect(children).toHaveLength(2)
    expect(children[0].media.kind).toBe('img')
    expect(children[1].media.kind).toBe('figure')
    expect(children[1].media.src).toBe('experiments/star-field/share/only')
  })

  test('non-CDN and non-video-ext share URLs pass shareStem through', () => {
    const foreign = 'https://other.cdn/clip.mp4'
    const oddExt = `${CDN_URLS.CDN_BASE}experiments/star-field/share/clip.mov`

    const shares = { star: { videos: [foreign, oddExt] } }

    const children = playgroundGroup(buildSitemapTree(null, {}, shares)).children

    // Foreign host — no CDN_BASE to strip; the .mp4 ext still drops.
    expect(children[0].media.src).toBe('https://other.cdn/clip')
    // No VIDEO_EXTS match → only the CDN_BASE prefix drops.
    expect(children[1].media.src).toBe('experiments/star-field/share/clip.mov')
  })
})

describe('sitemap map-data — residual branch tails', () => {
  test('section traversal skips non-arrays, object groups and src-less items', () => {
    const project = {
      [LOCALES.EN]: {
        [TEST_PROJECTS.SAGE]: {
          title: EN_PROJECT.title,
          folder: 'sage/',
          sections: [
            'not-a-section',
            [{ src: 'media/loose' }], // object group — not a row
            [
              ['text row'],
              [
                { label: 'no src' },
                { src: 'media/vid', isVideo: true }, // unlabeled video → filename leaf
              ],
            ],
          ],
        },
      },
    }

    const children = mediaGroup(buildSitemapTree(null, project)).children

    // Only the src-bearing item survives the traversal gates.
    expect(children).toHaveLength(1)
    // Unlabeled video → tail slug + .mp4 suffix.
    expect(children[0].label).toBe(
      `${EN_PROJECT.title}${CHAR_STRINGS.COLON}${CHAR_STRINGS.SPACE_CHAR}vid${MEDIA.VIDEO_EXT}`
    )
  })

  test('titleless projects fall back to the slug; coverless ones skip the cover arm', () => {
    const bare = {
      [LOCALES.EN]: {
        untitled: {
          sections: [[[{ src: 'media/x', label: 'Loose' }]]],
        },
        coverless: {
          title: 'Coverless',
          cover: { label: 'no src' },
          sections: [[[{ src: 'media/y', label: 'Loose' }]]],
        },
      },
    }

    const tree = buildSitemapTree(null, bare)

    const mediaChildren = mediaGroup(tree).children

    expect(mediaChildren.some((n) => n.label.startsWith('untitled'))).toBe(true)
    // coverless: 1 section item only (no cover row in front).
    expect(mediaChildren.filter((n) => n.label.startsWith('Coverless'))).toHaveLength(1)
  })

  test('locale drift — a diverging BR media list yields project-page leaf fallbacks', () => {
    const drift = {
      [LOCALES.EN]: {
        [TEST_PROJECTS.SAGE]: {
          title: EN_PROJECT.title,
          folder: 'sage/',
          sections: [
            [
              [
                { src: 'media/a', label: 'One' },
                { src: 'media/b', label: 'Two' },
                { src: 'media/c', label: 'Three' },
              ],
            ],
          ],
        },
      },
      [LOCALES.BR]: {
        [TEST_PROJECTS.SAGE]: {
          title: EN_PROJECT.title,
          folder: 'sage/',
          sections: [
            [
              [
                { src: 'media/a', label: 'Um' },
                { src: 'media/different', label: 'Dois' }, // src drift at index 1
              ],
            ],
          ],
        },
      },
    }

    const children = mediaGroup(buildSitemapTree(null, drift)).children

    const brLeaf = (node) => node.children.find((l) => l.locale === LOCALES.BR)

    // Index 0 aligns → the BR leaf deep-links its own slug.
    expect(brLeaf(children[0]).href).toContain('um')
    // Index 1 src mismatch → '' slug → the leaf falls back to the project page.
    expect(brLeaf(children[1]).href.endsWith(`/${TEST_PROJECTS.SAGE}`)).toBe(true)
    // Index 2 has no BR item at all (shorter list) → same fallback arm.
    expect(brLeaf(children[2]).href.endsWith(`/${TEST_PROJECTS.SAGE}`)).toBe(true)
  })

  test('page node groups override label fallbacks per key', () => {
    const tree = buildSitemapTree({ groups: { media: 'Files' } }, projectsByLocale)

    const media = mediaGroup(tree)

    expect(media.label).toBe('Files')
    // Other keys still fall back.
    expect(tree.children.find((g) => g.key === 'pages').label).toBe('Pages')
  })

  test('legal leaf hrefs — slug-matched tails relocalize, foreign tails prefix raw', () => {
    const enSlug = routeSlugs(LOCALES.EN)

    const prev = store.state.lang.components
    store.state.lang.components = {
      [CMS_KEYS.LEGAL_FOOTER]: {
        links: [
          { link: `/${enSlug.sitemap || 'sitemap'}`, page: 'Slugged' },
          { link: '/zzz-foreign-tail', page: 'Foreign' },
        ],
      },
    }

    try {
      const tree = buildSitemapTree(null, {})

      const legal = tree.children.find((g) => g.key === 'legal')
      const foreign = legal.children.find((n) => n.label === 'Foreign')
      const brLeaf = foreign.children.find((l) => l.locale === LOCALES.BR)

      // No slug-table key matches the tail → raw locale-prefixed path.
      expect(brLeaf.href).toBe(`/${LOCALES.BR}/zzz-foreign-tail`)
    } finally {
      store.state.lang.components = prev
    }
  })

  test('non-EN current locale re-anchors EN-only pages; invalid locale falls back to EN', () => {
    const prev = store.state.lang.locale

    try {
      store.state.lang.locale = LOCALES.BR

      const tree = buildSitemapTree(null, {})

      const docs = tree.children.find((g) => g.key === 'docs')
      const docsPage = docs.children[0]

      // The docs row is the locale-free literal — '/docs' under any locale.
      expect(docsPage.href).toBe(ROUTE_PATHS.DOCS)

      // 'xx' ∉ VALID_LANGS → pageNode anchors locales[0] for its own
      // href (and each media block anchors the EN leaf). The projects
      // map must carry the 'xx' key — media rows build from the
      // CURRENT locale's map.
      store.state.lang.locale = 'xx'

      const xxTree = buildSitemapTree(null, { xx: { [TEST_PROJECTS.SAGE]: EN_PROJECT } })

      const home = xxTree.children.find((g) => g.key === 'pages').children[0]
      expect(home.href).toBe(home.children[0].href)

      const stray = mediaGroup(xxTree).children[0]

      const enLeaf = stray.children.find((l) => l.locale === LOCALES.EN)
      expect(stray.href).toBe(enLeaf.href)
    } finally {
      store.state.lang.locale = prev
    }
  })

  test('deliberate-empty CMS strings ride every appText/label || EMPTY arm', () => {
    // appText returns `live ?? fallback` — a live '' wins over the EN
    // snapshot (deliberate value), so '' forces every `|| EMPTY` arm in
    // the tree: PAGE_ROWS, the root title, homeLabel's appText arm, the
    // playground page labels and the shareMediaNodes title args.
    const app = {}

    for (const path of [
      SECTION_UI_KEYS.TITLE,
      SECTION_UI_KEYS.ABOUT_DESCRIPTION,
      CMS_KEYS.CONTACT,
      SECTION_UI_KEYS.SEARCH,
      CMS_KEYS.ANIMATIONS,
      SECTION_UI_KEYS.SITEMAP,
      CMS_KEYS.EARTH_PLAYGROUND,
      CMS_KEYS.STAR_FIELD,
    ]) {
      const segs = path.split(CHAR_STRINGS.DOT)
      const leaf = segs.pop()

      let cur = app

      for (const seg of segs) cur = cur[seg] = {}

      cur[leaf] = ''
    }

    const prevApp = store.state.lang.app
    const prevComponents = store.state.lang.components
    store.state.lang.app = app
    // labels[0].page='' forces homeLabel's `fallback[0].page || appText`
    // arm too — the legal group keeps one real row ('/x' is not a
    // locale root so it survives HAS_LINK).
    store.state.lang.components = {
      [CMS_KEYS.LEGAL_FOOTER]: {
        links: [
          { link: S, page: '' },
          { link: `${S}x`, page: 'X' },
        ],
      },
    }

    try {
      const tree = buildSitemapTree(null, projectsByLocale, {
        earth: { images: [`${CDN_URLS.CDN_BASE}e.png`] },
        star: { videos: [`${CDN_URLS.CDN_BASE}s.mp4`] },
      })

      // Every label resolved '' — the tree still builds.
      expect(tree.label).toBe('')
      expect(tree.children.find((g) => g.key === 'pages').children.length).toBeGreaterThan(0)
    } finally {
      store.state.lang.app = prevApp
      store.state.lang.components = prevComponents
    }
  })

  test('a falsy CMS slug override falls back to the route key', () => {
    const prev = store.state.lang.slugs
    store.state.lang.slugs = { [TRANSLATION_KEYS.SITEMAP]: '' }

    try {
      const tree = buildSitemapTree(null, {})

      const sitemapHref = `${S}${TRANSLATION_KEYS.SITEMAP}`

      const sitemap = tree.children
        .find((g) => g.key === 'pages')
        .children.find((n) => n.children.some((l) => l.href === sitemapHref))

      // '' override → `slugs[key] || key` → the key itself.
      expect(sitemap.href).toBe(sitemapHref)
    } finally {
      store.state.lang.slugs = prev
    }
  })

  test('BR display locale + EN-only map rides the missing-locale project arms', () => {
    const prev = store.state.lang.locale
    store.state.lang.locale = LOCALES.BR

    try {
      const tree = buildSitemapTree(null, {
        [LOCALES.EN]: { [TEST_PROJECTS.SAGE]: EN_PROJECT },
      })

      // Portfolio rows still build from the EN fallback map…
      expect(tree.children.find((g) => g.key === 'portfolio').children).toHaveLength(1)
      // …but media rows need the display locale's own project —
      // `projectsByLocale['br']?.['sage']` misses → the group filters out.
      expect(tree.children.find((g) => g.key === 'media')).toBeUndefined()
    } finally {
      store.state.lang.locale = prev
    }
  })

  test('omitted maps ride the parameter defaults + falsy-locale EN arm', () => {
    const prev = store.state.lang.locale
    store.state.lang.locale = ''

    try {
      const tree = buildSitemapTree(null)

      expect(tree.children.find((g) => g.mosaic)).toBeUndefined()
      expect(tree.children.find((g) => g.key === 'pages')).not.toBeUndefined()
    } finally {
      store.state.lang.locale = prev
    }
  })

  test('the bundled fallback page node supplies group labels', () => {
    FALLBACK_PAGES[TRANSLATION_KEYS.SITEMAP] = { groups: { media: 'Shelf' } }

    try {
      const tree = buildSitemapTree(null, projectsByLocale)

      expect(mediaGroup(tree).label).toBe('Shelf')
    } finally {
      delete FALLBACK_PAGES[TRANSLATION_KEYS.SITEMAP]
    }
  })

  test('null items + a sections-less project ride the traversal guards', () => {
    const bare = {
      [LOCALES.EN]: {
        [TEST_PROJECTS.SAGE]: {
          title: EN_PROJECT.title,
          sections: [[['text'], [{ src: 'media/a', label: 'One' }, null]]],
        },
        nosections: { title: 'Bare' },
      },
    }

    const children = mediaGroup(buildSitemapTree(null, bare)).children

    // Only the single src-bearing item survives.
    expect(children).toHaveLength(1)
  })
})
