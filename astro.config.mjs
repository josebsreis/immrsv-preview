// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'https://immrsv.studio',
  output: 'static',
  /* The stylesheets go into the page rather than beside it: three pages,
     and each was waiting on two requests before it could paint a thing.
     Inlined, the first paint has nothing to wait for. */
  build: { inlineStylesheets: 'always' },
  /* The editor is not part of the site: it is hosted by Sanity at
     immrsv.sanity.studio, and /admin only points there (src/pages/admin.astro).
     The content is read at build time by src/lib/sanity. */
  vite: {
    ssr: { noExternal: ['three'] },
    build: {
      /* What the CSS is minified for. Without it the minifier assumes a
         browser set that needs no vendor prefixes and collapses a
         prefixed/standard pair down to one — which quietly cost us the blur
         on the glass: it kept whichever of -webkit-backdrop-filter and
         backdrop-filter came last, so one engine or the other lost it.
         Safari below 18 wants the prefix and Firefox only takes the standard
         property, so both have to survive. */
      cssTarget: ['chrome100', 'safari15', 'firefox103', 'edge100'],
    },
  },
});
