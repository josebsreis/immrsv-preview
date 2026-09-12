/** Structural site config — things that are code, not content. Content lives in Sanity (with defaults in src/content/defaults.ts). */
export const site = {
  name: 'IMMRSV',
  nav: [
    { label: 'Studios', href: '/#studios' },
    { label: 'Work', href: '/work' },
    { label: 'About', href: '/#about' },
    { label: 'Contact', href: '/#contact' },
  ],
  studios: [
    { key: 'architecture', label: 'Architecture + Design' },
    { key: 'media', label: 'Creative Media' },
    { key: 'products', label: 'Digital Products' },
  ],
} as const;

export type StudioKey = (typeof site.studios)[number]['key'];
