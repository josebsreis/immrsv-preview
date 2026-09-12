// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const projectId = env.PUBLIC_SANITY_PROJECT_ID ?? '';
const dataset = env.PUBLIC_SANITY_DATASET ?? 'production';

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'https://immrsv.studio',
  output: 'static',
  /* The stylesheets go into the page rather than beside it: three pages,
     and each was waiting on two requests before it could paint a thing.
     Inlined, the first paint has nothing to wait for. */
  build: { inlineStylesheets: 'always' },
  integrations: [
    // Content + the embedded Studio at /admin. Without a project id the
    // integration is skipped entirely so the site still builds from defaults.
    ...(projectId
      ? [
          sanity({
            projectId,
            dataset,
            useCdn: false,
            apiVersion: '2026-01-01',
            studioBasePath: '/admin',
          }),
          react(),
        ]
      : []),
  ],
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
