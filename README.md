# IMMRSV — website

Astro 7 (static) + Sanity (embedded Studio at `/admin`). The hero is a
vanilla three.js island; everything else is plain Astro components on a
token-driven design system.

## Run

```bash
npm install
cp .env.example .env        # add PUBLIC_SANITY_PROJECT_ID when the Sanity project exists
npm run dev                 # http://localhost:4321
npm run build && npm run preview
npx astro check             # types
```

Without a Sanity project id the site builds from `src/content/defaults.ts`,
so the hero and pages can be worked on before the CMS exists.

## Structure

```
src/
  styles/
    tokens.css        design tokens — colour (dark/light themes), scale, type, motion, layers
    global.css        reset + shared primitives (.label, .sq, .glass, .arrives)
  layouts/Base.astro  html shell, nav, footer, theme
  components/
    ui/               Button, ScrollCue, Wordmark, Mark, PortableText
    layout/           Nav, Footer
    hero/             Hero (the island's DOM), FeaturedProject
    home/             WordmarkPanel, Manifesto (stats reel + statement), Brands, Studios,
                      Process, Testimonials
    layout/Footer     the black screen under every page — PLACEHOLDER copy and links
    work/             ProjectCard, ProjectGrid, StudioFilter
    transitions/      SquareField
  pages/
    index.astro       homepage
    work/index.astro  all projects, filtered by studio
    work/[slug].astro project page (static paths from Sanity)
  scripts/
    hero/             the mark: config.ts (every tunable), mark.ts (plates + cloud), sim.ts,
                      shapes.ts + skin.ts (the forms), lens.ts, pointer.ts, index.ts (the reel)
    fluid.ts          the WebGL fluid (own canvas, under the hero)
    ui/               smoothScroll, scrollChoreography, rotatingWord, statsReel, wordmarkLetters,
                      directionalHover, videoInView, splitText, hoverAudio, workFilter
    home.ts           the homepage's client entry — wires everything by data attributes
  lib/
    site.ts           structural config (nav, studios, audio) — not content
    breakpoints.ts    the same breakpoints as tokens.css, for JS
    sanity/           client, GROQ queries (+ mappers, defaults fallback), types
  content/defaults.ts fallback content until Sanity is connected
  content/work.generated.json  what scripts/images.mjs put in public/work
sanity/schemas/       project, home
sanity.config.ts      the Studio
```

## Conventions

- **One face, two axes.** Inter is self-hosted (`public/fonts`), subset to
  latin: 103KB carrying weight 100–900 *and* an optical size 14–32, so there
  is no second file for headings. `font-optical-sizing` is on by default,
  which means a display-sized line is drawn with the display cut — tighter
  apertures and spacing, and most of why a big heading reads as expensive
  rather than merely big. Re-subset with
  `python3 -m fontTools.subset` if the copy ever needs glyphs outside latin.
- **Four type tiers, and everything belongs to one.** A tier owns its weight,
  tracking and leading together, because they only work as a set — light
  display type needs tight tracking and almost no leading; body copy needs
  neither. Nothing declares a raw weight, tracking or leading any more:

  | tier | sizes | weight | tracking | leading |
  |---|---|---|---|---|
  | display | `--t-display`, `--t-h2` | `300` | `-0.03em` | `0.98` |
  | title | `--t-statement`, `--t-figure` | `400` | `-0.025em` | `1.05` |
  | lead | `--t-lead` | `400` | `-0.01em` | `1.45` |
  | body | `--t-body`, `--t-small` | `400` | none | `1.7` |

  The reading sizes run deliberately small — 14px body, 13px small — while
  the display sizes stay large. The gap between them is the effect: at a
  comfortable 15px body copy reads as a website, and at 14 with the leading
  left open it reads as an interface, which is the register the work is being
  shown in. `--t-label` (10px) and `--t-caption` (11px) are at the floor and
  do not move.

  Uppercase runs the other way — small capitals set too tight, so
  `--track-caps` (0.12em) for 11px chips, tabs and buttons and
  `--track-label` (0.16em) for the 10px `.label`. `--w-ui: 500` is the only
  heavier weight, for controls where the size cannot carry the emphasis.
  Two documented exceptions: the statement panel is title-sized but *read*
  rather than named, so it keeps a leading of its own (1.22 — 1.05 would set
  a paragraph solid), and a one-line chip declares `line-height: 1` because
  leading means nothing to it.
- **A drawn corner and a rounded one cannot share a card.** The hero's
  featured project used to be a hairline frame with the site's square on each
  of its four corners — which worked while everything was square, and stopped
  the moment the picture inside it took a radius. The frame and the squares
  are gone; it is a filled plane now, `--glass` on `--radius-media`, the same
  corner as the picture it holds, lifting to `--glass-hover` on hover.
  **Its inset is the card's padding, not a margin on the picture**: with no
  border left to stop it, a top margin on the first child collapses straight
  through the card and the picture sits on its edge. The founder's portrait
  takes the same corner — it is a picture like any other.
- **A corner cannot be flush.** Once the studios' media band took
  `--radius-media` it could no longer run to the card's own rule above it or
  to the edge of the screen at its right — a radius pressed against either
  reads as a mistake rather than as a shape. It sits inside the card by the
  page's own margin on three sides, and the inset from the page edge is the
  *card's padding*, not a margin on the clip: the band's width has to stay
  the column's, or its ratio and its floor fight over the box and push it off
  the page.
- **Two radii, both small.** `--radius` (4px) for the UI — buttons, nav and
  filter pills, chips, anything on `.glass` — and `--radius-media` (6px) for
  pictures and clips: the larger surface takes the larger corner. Neither is
  big enough to read as rounded; they exist so nothing has a hard corner
  against the grey ground. Both fixed pixels, like `--square`: drawn details,
  not measures. **The marker stays square** — it is 5px across, and a radius
  on it would be a blur rather than a corner. Where media is stacked and
  clipped (the studio reel), the corner comes off the band, not the frames
  inside it; a chip that carries `var(--glass)` without the `.glass` class
  has to ask for the radius itself.
- **The light ground is not white.** `#f5f5f7`. A page of pure `#fff` gives a
  white render, a glass pill and a hairline nothing to sit on.
- **Shared primitives, not repeated rules.** `global.css` holds the objects
  that appear in more than one place: `.chip` / `.chips` (a service, a
  discipline, a thing that was done — two components carried it at different
  padding and gap until it was one class), `.section-tag` (the square and the
  word that name a section), `.label`, `.sq`, `.glass`, `.visually-hidden`.
  **Name a primitive carefully**: `.tag` was tried for the section name and
  silently restyled a plain label elsewhere that already used that class.
- **Tokens only.** Components never carry raw colours or px values; they read
  `var(--…)` from `tokens.css`. The root `font-size` is fluid (16px at 1440,
  growing at half rate, capped at 26px) and every layout value is in `rem`,
  so the whole page scales proportionally on large screens.
- **Themes.** `data-theme="dark|light"` on any element re-resolves the colour
  tokens inside it. The nav carries `data-theme-follows` and is flipped by the
  scroll choreography when the white section takes over.
- **One square, one size.** The marker is `--square` everywhere it appears —
  the buttons, the nav, the brands lattice, the studio reel, the process rule
  — and it is never scaled to suit its surroundings. Where one needs more
  presence, use more of them: the marquee makes a chevron of six rather than
  blowing one up to the height of a word.
  It is **5 fixed pixels, deliberately odd**, and one of the few values on
  the site not in rem. A mark centred on a 1px hairline only lands on whole
  pixels if it is odd (2 + 1 + 2); at 4px, and worse in rem — where the root
  scales past 1440 and the mark became 4.7px at 1920 — its edges fell on half
  pixels and it drew soft. It belongs with `--hairline`, not with the spacing
  scale: it is a drawn mark, not a measure.
- **Placement belongs to the parent.** Astro scopes styles per component, so a
  parent never styles a child's root class; it wraps the child in its own
  element (`.cue-slot`, `.feat-slot`) or uses `:global()` for elements the
  child renders (`.home :global(svg)`).
- **Behaviour by data attribute.** Scripts find their elements with
  `data-*` hooks (`data-hero-canvas`, `data-fluid`,
  `data-rotating-word`, `data-reveal-words`, `data-reveal-group`, `data-rule`,
  `data-rise`, `data-next`, `data-square-field`, `data-hold`, `data-theme-follows`,
  `data-tap`, `data-split`), never by layout class.
- **The dark/light handover.** The dark half is `position: sticky` with a
  negative top (`[data-hold]`, set in JS to viewport − height), so it holds
  once its end meets the bottom of the screen. The light half then rides up
  over it, led by `SquareField` — a grid of squares in the light half's own ground
  colour that fill from the top down as the band crosses the screen.
  While it climbs, the held half creeps upward and a scrim (`[data-scrim]`)
  puts it out, so the two move at different speeds.
  Anything that must sit over the hero's fixed canvases needs
  `z-index: var(--z-ui)`: the light half, and the footer, which is outside
  `main` and so competes with it directly.
- **A floating control carries the page with it.** `.glass` — the nav pills,
  the buttons, the studio filter — is two layers: `--veil`, the page's own
  ground at 62%, which is what keeps a dark label readable where it crosses a
  dark photograph, and `--glass` over it, the 5% tint that gives the pill an
  edge on the plain page where the veil is invisible. Plus a blur with a
  `saturate` — a blur alone greys out what it stands on, and pulling the
  colour back is what makes it read as glass rather than fog. `--veil` is
  written once and resolves per theme, because `--ground-rgb` does.
  A component overriding the hover must set `background-image`, not the
  `background` shorthand, which would take the veil out from under it.
- **The CSS target is set on purpose.** `vite.build.cssTarget` in
  `astro.config.mjs` names real browsers. Left unset, the minifier assumes a
  set that needs no prefixes and collapses a prefixed/standard pair to
  whichever comes last — which silently cost the glass its blur in Firefox
  (only `-webkit-backdrop-filter` survived) and then in Safari when the order
  was reversed. Both have to ship. This is the second thing that minifier has
  quietly eaten; the other is `translate` in a rule that also sets
  `transform` (see the project page's rail).
- **Picking up a card.** On the Work grid a card scales *down* to 0.985 while
  the picture inside it pushes *out* to 1.06 — two speeds, 0.55s for the card
  and 1.4s for the image, so the tile answers immediately and the image keeps
  travelling. That difference is what reads as depth rather than as a hover
  state. An arrow travels in from behind the title and back out the same way,
  rather than fading on the spot — and comes to rest exactly on its own line.
  Hover-capable pointers only, and off entirely for reduced motion.
- **Directional hover.** Anything that should fill from the edge the cursor
  crossed marks itself `data-dhover-item` with a `data-dhover-tile` inside;
  `data-axis="x|y"` (on the item or a `data-dhover` wrapper) limits it to one
  pair of edges. Used by the buttons, the nav pills and the brands grid.
- **The hero is a cube, a cloud, and a reel.** The mark arrives spinning and
  keeps its slow turn about its diagonal for the whole visit; it never tumbles
  and never loses its shape. In the void at its notch a second population of
  particles gathers out of the dark and churns — its own `THREE.Points`, on a
  pivot of its own so the cube's turn does not carry it — and that cloud is
  what every form is made of and what each one falls back to: tree, figure,
  screen (`hero/shapes.ts`, baked point clouds under `public/shapes/`). The
  cube opens by getting bigger and by nothing else — the same particles over
  three times the area, so it thins as it grows — and after the first opening
  it only breathes: out to `open.scale` while a form stands, back to
  `open.rest` while the cloud is between two. The scale is held back on a
  screen without the room (`open.fill`), so the cube reaches just past the
  edge on every viewport rather than off it. The wait while the first shape
  is fetched is the cloud churning (`core.settle`, floored by `core.patience`)
  — the one loading beat in the visit, and it looks like one on purpose.
  Reduced motion gets the cube alone.
- **The hero engine loads late.** three.js is ~135KB gzipped, so `home.ts`
  imports it dynamically once the browser is idle, and never for a reader
  who asked for less motion. The page's own bundle is ~4KB; everything but
  the mark works before it arrives.
- **Hero tunables** live in `src/scripts/hero/config.ts`; a page can override
  any of them via `createHero({ config })`.
- **Anything on the homepage that sits over the hero** needs its own layer:
  the hero's canvases are `position: fixed`, so a plain section paints under
  them. Give it `position: relative; z-index: var(--z-ui)`.
- **The name is drawn as lines, and worked out before the browser sees it.**
  `node scripts/wordmark.mjs` rasterises the real artwork
  (`logos/IMMRSV_Main_Logo.svg` — the letters, without the cube) and writes
  every run of ink on every row to `wordmark.generated.json`: 33 rows, 350
  lines. The footer ships those as `<rect>`s, one `<g>` a row. Nothing is
  measured or generated in the page.
  The cursor combs it: each row follows the pointer sideways by an amount
  that falls away with its distance from the pointer's own height, so the
  mark answers where it is touched. One rAF writes one custom property per
  row — no element is rebuilt and no layout is read while it runs, and the
  loop is stopped whenever the footer is off screen, which it usually is.
  A screen that cannot hover gets the other half: the rows arrive one after
  another the first time it is scrolled to, then nothing is left running.
  **The footer wires and unwires itself** (`astro:page-load` /
  `astro:before-swap`) because it is on every page and is *not* persisted —
  without the teardown its loop would go on writing to a discarded element
  and a second loop would start beside it on the next page.
- **One instrument, turned on two things.** The testimonials use the same reel
  as the statement panel — `statsReel.ts`, found by `[data-stats]`, which is
  why `home.ts` creates one per match rather than one for the page: a bar that
  fills for the life of a slide, arrows to step it by hand, and a count. What
  it turns is different. A quote is long-form, so the person who said it
  stands beside it: the portrait is the picture the section needed and also
  the evidence, since every one of these firms is already a mark in the brands
  grid. The slides are stacked in one grid cell so the section keeps a single
  height whatever length a quote runs to — and **the frame holds still inside
  it**: the marks own the top and the foot of that space, the attribution
  rides at the bottom with the closing one, and the paragraph takes the slack
  as equal margins above and below, which centres it between the two. Without
  that, a short quote left all of its air under the closing mark and the
  section looked cut off; now only what is inside the frame changes.
  The words are the client's, from their own document, and are not to be
  edited for length.
  The left column reads in the order it is used: the bar, then the arrows and
  the count, then the list of what there is to go to — a bar and two arrows
  read as one control at the top of a column and as an afterthought under it.
  Each entry jumps straight to its slide (`[data-stats-go]`, which the reel
  marks the way it marks the slides) and the one being read carries the site's
  square in front of it. The marker takes no room in the row — it is out of
  the flow — so a name that is not being read begins exactly where the square
  would be; the chosen one steps forward by the square's own width plus the
  space after it, and the square slides in behind it from the left.
  **The entries are labels, not names.** Each is a word taken verbatim from
  its own quote — Vision, Fifteen years, Clarity, Collaboration, Refinement.
  The company would have been the obvious choice, but two of the five are
  Wolcott and two are LePesi, and a list with the same name twice cannot be
  used to choose. `label` is a field, so the client can change them. The face belongs to the *name* — 4rem,
  level with the two lines it labels, on the quote's own left edge — so the
  three read as one attribution rather than as a picture with text beside it.
- **How we work reads itself.** The section opens on its heading alone: no
  step is there yet and the rule is a single square with nothing drawn from
  it. As the rule grows it brings each step in — up from below and out of
  nothing, the move `[data-rise]` makes elsewhere, driven by scroll position
  rather than by a crossing. `--lit` per step is opacity and offset, not
  colour: a step is either not here yet or it is here. There is no track
  waiting to be filled, only the line that has grown.
  `processRail.ts` reads the same one number twice — the line's length and
  the steps' arrival cannot drift apart — and it reads it two ways, because
  a rule can only measure the direction its steps run in:
  **across** (860 up) the section is a sticky pane in a tall track, holding
  still while a screen or so of scroll draws the rule left to right under
  three columns; the squares are evenly spaced, so both come straight off the
  travel. The rule finishes at 86% of it (`CROSS`) and the rest is the
  section holding, finished, before it lets go — without that the last square
  arrived on the final pixel of the pin and was gone unseen.
  **down** (below 860) nothing pins; there is no room to hold a screen still
  on a phone. The rule stands to the left of the stacked steps and grows with
  the page, reaching each square as its step arrives at a reading line 72%
  down the screen. Steps down a page are as tall as their words, so the
  squares are placed from JS against the steps' real tops (and the inline
  tops are cleared again when the layout goes back across).
  For a reader who asked for less motion nothing pins, the rule is drawn and
  every step is simply there.
- **The Work page's filter.** The chosen studio is in the URL —
  `/work?studio=media` — so a filtered page can be linked to and the back
  button steps through the choices. `workFilter.ts` reads the parameter on
  load, writes it on a click, and hides what does not match by putting
  `data-off` on the card — the rule lives in `global.css` with the other
  behaviour attributes. Without JS every project is shown; the filter only
  ever takes things away.
  The change is made **card by card**. Each one leaves for itself — fading and
  shrinking to 0.965 — a beat after the one before it; the filter is applied
  while none of them can be seen, which is also when the rows close up and the
  page changes height; then the new set arrives the same way, more slowly than
  it left. The wave is capped at five beats, or a full grid would take an age
  to clear. `300 / 30 / 5` live in both `workFilter.ts` and `ProjectCard.astro`
  and have to stay in step.
  **Which pill is lit is not part of the wave**: a reader has just pressed it,
  so `mark()` runs in that frame and only the cards wait their turn.
  **The swap owns `scale` and the hover owns `transform`** — that is the only
  reason both can sit on the card at once, since they are separate properties
  and they compose. It also means `transform` has to be in the card's
  transition list, or the hover has nothing to animate and snaps.
  Two things were tried and dropped: a blur on the way out, which was more
  effect than the rest of the site spends anywhere; and blurring the grid as
  one sheet, which read as a panel switching rather than as a set of things
  leaving. Cards gliding between positions (`startViewTransition`, a name per
  card) read as a UI reflowing rather than a page changing its mind.
- **A project is read in four turns.** The left column carries the name, the
  line under it, then a tab row — the challenge, the approach, the outcome,
  what we did — showing one at a time (`scripts/ui/tabs.ts`), all four
  written fields on the project. A turn with nothing behind it is not
  offered, so a project with no write-up simply has fewer names in the row,
  never an empty panel. Every panel ships in the HTML with the first shown,
  so a reader with no JS gets all four rather than none; the row walks with
  the arrow keys. **The panels are held at the height of the longest of
  them**, measured once the face has settled: only one is in the document at
  a time, so without it the names — and in a centred column the title above
  them — walk up and down as the reader moves along the row, which reads as
  the page flinching. Four forced layouts once, not per frame, re-measured on
  resize.
  **The four names must sit on one line**, which is why the column is a width
  and not a proportion: the row measures 368px beside 80px of the column's
  own padding, so `--side` is 29rem — 28 would be exact and therefore no
  width at all — and the page stacks below 1100 rather than squeezing it.
  Widen the labels and you have to widen the column.
  At the foot, under everything: the services as tags, then the live link as
  the site's own button, then the way out. The tags were briefly the fourth
  tab and are not — they are what was ours on the project, not an answer to a
  question. `liveUrl` is empty on most projects and the button goes with it.
- **A project page is two halves.** The left column is everything written
  about the project and the only way out of it — back to Work, and the
  previous/next project, which wrap so there is always a next.
  **It is a card, not a margin.** It carries `--surface` — one plane above the
  page's ground — begins on the same line as the first picture (`--media-top`,
  shared by both), takes the same `--radius-media` off its corners, and is
  only as tall as what is in it. No border: the plane is the edge. A
  full-height column read as furniture, and more structure *inside* it
  (labelled bands, rules between every part) was tried and read as a spec
  sheet; what it wanted was to be one of the things on the page rather than
  the frame around them.
  It is `position: sticky` at that same line, so it holds while the media
  runs past. The `max-height` is only for a write-up long enough to outgrow
  the screen — past that the words scroll inside the card rather than the
  card growing off the bottom. Below 1100 the card stops holding still
  and loses its surface altogether: everything written, full width on the
  page's own ground, and the media running under it. The right
  column is the media in order — stills and silent loops together, from
  `project.media`, falling back to the cover and gallery — and its height
  is the page's scroll. Nothing is hijacked: scrolling anywhere runs the
  media past because the media is the only thing in flow.
- **The delivery, squeezed.** `node scripts/images.mjs` turns the client's
  folder into `public/work` and writes `work.generated.json`. Every still
  comes out at a ladder of widths — 900, 1400, 2200 — each as AVIF and WebP;
  every clip comes out as a silent 1080p mp4 with a poster beside it. Both
  the grid and the project page hand the browser the whole ladder with a
  `sizes` that describes their own column, so each picture is fetched at the
  width that screen actually needs. **A `sizes` has to follow its layout** —
  the card's repeats the grid's breakpoints, margins and gaps. The manifest carries each file's
  pixel size, which is what the `width`/`height` attributes hold open before
  a lazy file lands. Anything already made is skipped; `--force` redoes it.
  **If a tag carries those attributes its CSS must say `height: auto`** —
  otherwise the tag's pixel height wins and the picture stretches.
- **Where a ratio is forced.** The grid crops every card to 4:3 so the rows
  read as rows. A project page never does: the media is `width: 100%;
  height: auto`, so whatever shape the client sends is the shape it keeps.
- **The stand-in copy reads as finished, on purpose.** `defaults.ts` carries a
  write-up per *studio*, not per project — summary, challenge, approach,
  outcome, what we did — so it says nothing that is not true of the work in
  general: no client names, no dates, no numbers, nothing anyone would have
  to check. A project with its own write-up in Sanity overrides it.
  **Nothing on the page announces itself as unwritten any more**, which is
  the point and also the risk: it wants a read-through before the site goes
  live. No project carries a `liveUrl`, so the *View live* button is absent
  everywhere until one is given a real address in the Studio.
- **Projects without their own images.** Everything in `public/work` is the
  client's own delivery. Digital Products has sent nothing at all — its two
  entries are placeholders on the studio's own clip. Delete them as the real
  thing lands.
- **Pages swap, the nav does not.** `<ClientRouter />` is in `Base.astro`,
  so a navigation replaces the body instead of loading a document. The page
  that is leaving fades and lifts a little as it goes; the one arriving comes
  up from under it — the same move `[data-rise]` makes everywhere on the
  site, so a whole page arrives the way a paragraph does. They travel the
  same way rather than crossing, which reads as one thing replacing another
  instead of two things swapping. 380ms out, 620ms in
  (`::view-transition-*` in `global.css`, off for reduced motion). The nav carries `transition:persist` — **on the
  `<header>` itself, in `Nav.astro`; on the `<Nav />` tag the directive is
  not forwarded to the element** — so it is the same node from the first
  page to the last, listeners and all. It also carries `transition:name` and
  `transition:animate="none"`: persisting keeps the *node*, but the fade
  snapshots the whole page, nav included, so without a name of its own the
  bar would still be seen to fade out and in while never having moved. Named,
  it is its own snapshot; unanimated, that snapshot holds still. Only the
  page under it crosses over, and the bar just follows the new ground's
  colour (`.nav` already transitions `color`, so the flip eases rather than
  jumps).
  `.arrives` is stripped from persisted elements on the first swap, for the
  same reason: a moved node restarts its animations, so the intro would play
  again on every navigation.
- **A page's scripts run per visit, not per document.** A module is loaded
  once for the whole visit, so a page wires itself inside
  `onPage('<name>', …)` (`scripts/lifecycle.ts`): the setup runs on every
  `astro:page-load` **that lands on that page**, and whatever it returns is
  destroyed on the way out. Both halves matter. Without the name, the
  homepage's listener wires the homepage up over Work as well — two smooth
  scrolls fighting each other. Without the teardown, every visit leaves its
  Lenis, its observers and the hero's WebGL context behind. The name is
  matched against `data-page` on the page's own `<main>`.
  The lab pages under `/lab` are the exception: nothing links to them, so
  they are only ever reached by a full load, and their scripts are inline.
- **The nav takes the ground it is standing on, everywhere.** A page declares
  its grounds — any element with an explicit `data-theme` is a section — and
  `lifecycle.ts` gives whichever one is under the nav's own line to every
  `[data-theme-follows]`; later in the document wins, which is what makes the
  homepage's sticky halves resolve as they overlap. One owner for the whole
  site: no page works this out for itself, and the homepage's choreography no
  longer touches it. That is what the black footer needs — a white page ends
  on a dark screen, and dark nav ink over it would be invisible.
  The nav is persisted, so it also has to be re-read for the page that has
  just arrived: `onPage` calls `syncNavTheme()` before any setup runs.
- **Breakpoints:** 719 (phone), 859 (tablet), 1099 (wide). Keep
  `tokens.css` and `breakpoints.ts` in sync.

## Sanity

1. Create a project at manage.sanity.io, put its id in `.env`.
2. `npm run dev` → `/admin` is the Studio. Content types: **Homepage** (hero
   copy, rotating words, statement panel with its figures and signature,
   brands, featured project) and **Project** (title, slug, year, location,
   studios, summary, what we did, cover, **media**, story, featured, order).
   **Media** is the project page itself: stills and clips in one ordered
   list. A still is asked of Sanity's CDN at the same 900/1400/2200 ladder
   the local pipeline writes, as one `auto=format` srcset — the CDN answers
   each URL with AVIF or WebP by what the browser asked for, so there is no
   second `<source>`. A clip is an uploaded file (or a URL) with a poster,
   and the poster is what holds the page's room open. The old `gallery` is
   only read while Media is empty.

   Nothing on the Sanity path has been run against a real dataset yet —
   there is no project id — so treat the first import as the test.
3. Handover: in manage.sanity.io invite the client as admin; they take over
   billing. The project id doesn't change, so nothing in the code does.

## Deploy

Static output — Vercel/Netlify/Cloudflare Pages all work with `npm run build`
→ `dist/`. Set the `PUBLIC_SANITY_*` env vars in the host. (Draft preview /
visual editing would need `output: 'server'` + an adapter; not wired yet.)
