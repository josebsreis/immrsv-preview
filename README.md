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
    home/             WordmarkPanel, Manifesto (stats reel + statement), Brands, Studios
    work/             ProjectCard, ProjectGrid
    transitions/      Loader, Shutter
  pages/
    index.astro       homepage
    work/index.astro  all projects
    work/[slug].astro project page (static paths from Sanity)
  scripts/
    hero/             the mark: config.ts (every tunable), mark.ts, sim.ts, lens.ts, pointer.ts, index.ts
    fluid.ts          the WebGL fluid (own canvas, under the hero)
    ui/               smoothScroll, scrollChoreography, rotatingWord, statsReel, wordmarkLetters,
                      directionalHover, videoInView, splitText, hoverAudio, loader
    home.ts           the homepage's client entry — wires everything by data attributes
  lib/
    site.ts           structural config (nav, studios, audio) — not content
    breakpoints.ts    the same breakpoints as tokens.css, for JS
    sanity/           client, GROQ queries (+ mappers, defaults fallback), types
  content/defaults.ts fallback content until Sanity is connected
sanity/schemas/       project, home
sanity.config.ts      the Studio
```

## Conventions

- **Tokens only.** Components never carry raw colours or px values; they read
  `var(--…)` from `tokens.css`. The root `font-size` is fluid (16px at 1440,
  growing at half rate, capped at 26px) and every layout value is in `rem`,
  so the whole page scales proportionally on large screens.
- **Themes.** `data-theme="dark|light"` on any element re-resolves the colour
  tokens inside it. The nav carries `data-theme-follows` and is flipped by the
  scroll choreography when the white section takes over.
- **Placement belongs to the parent.** Astro scopes styles per component, so a
  parent never styles a child's root class; it wraps the child in its own
  element (`.cue-slot`, `.feat-slot`) or uses `:global()` for elements the
  child renders (`.home :global(svg)`).
- **Behaviour by data attribute.** Scripts find their elements with
  `data-*` hooks (`data-hero-canvas`, `data-fluid`, `data-loader`,
  `data-rotating-word`, `data-reveal-words`, `data-rule`, `data-pin`,
  `data-spacer`, `data-next`, `data-shutter`, `data-theme-follows`,
  `data-tap`, `data-split`), never by layout class.
- **Directional hover.** Anything that should fill from the edge the cursor
  crossed marks itself `data-dhover-item` with a `data-dhover-tile` inside;
  `data-axis="x|y"` (on the item or a `data-dhover` wrapper) limits it to one
  pair of edges. Used by the buttons, the nav pills and the brands grid.
- **Hero tunables** live in `src/scripts/hero/config.ts`; a page can override
  any of them via `createHero({ config })`.
- **Anything on the homepage that sits over the hero** needs its own layer:
  the hero's canvases are `position: fixed`, so a plain section paints under
  them. Give it `position: relative; z-index: var(--z-ui)`.
- **Breakpoints:** 719 (phone), 859 (tablet), 1099 (wide). Keep
  `tokens.css` and `breakpoints.ts` in sync.

## Sanity

1. Create a project at manage.sanity.io, put its id in `.env`.
2. `npm run dev` → `/admin` is the Studio. Content types: **Homepage** (hero
   copy, rotating words, statement panel with its figures and signature,
   brands, featured project) and **Project** (title,
   slug, year, location, studios, summary, cover, gallery, story, featured,
   order).
3. Handover: in manage.sanity.io invite the client as admin; they take over
   billing. The project id doesn't change, so nothing in the code does.

## Deploy

Static output — Vercel/Netlify/Cloudflare Pages all work with `npm run build`
→ `dist/`. Set the `PUBLIC_SANITY_*` env vars in the host. (Draft preview /
visual editing would need `output: 'server'` + an adapter; not wired yet.)
