/** Structural site config — things that are code, not content. Content lives in Sanity (with defaults in src/content/defaults.ts). */
export const site = {
  name: 'IMMRSV',
  /* No Home: the logo is the way home, as everywhere. No About: there is no
     about page, and the statement it pointed at sits right under the hero,
     one scroll down. Work first — it is what most people came for. */
  nav: [
    { label: 'Work', href: '/work' },
    { label: 'Studios', href: '/#studios' },
    { label: 'Contact', href: '/#contact' },
  ],
  studios: [
    { key: 'architecture', label: 'Architecture + Design' },
    { key: 'media', label: 'Creative Media' },
    { key: 'products', label: 'Digital Products' },
  ],
} as const;

export type StudioKey = (typeof site.studios)[number]['key'];
