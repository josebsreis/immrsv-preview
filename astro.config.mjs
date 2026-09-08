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
  },
});
