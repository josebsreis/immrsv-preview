/** Structural site config — things that are code, not content. Content lives in Sanity (with defaults in src/content/defaults.ts). */
export const site = {
  name: 'IMMRSV',
  /* the menu is content: Menu & footer in Sanity (defaults.ts until then) */
  studios: [
    { key: 'architecture', label: 'Architecture + Design' },
    { key: 'media', label: 'Creative Media' },
    { key: 'products', label: 'Digital Products' },
  ],
} as const;

export type StudioKey = (typeof site.studios)[number]['key'];
