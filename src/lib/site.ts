/** Structural site config — things that are code, not content. Content lives in Sanity (with defaults in src/content/defaults.ts). */
export const site = {
  name: 'IMMRSV',
  /* Home, the work, and the way to get in touch. Contact is a link to this
     same page's own foot: every page ends on the footer, so it never has to
     leave for the homepage to find it (scripts/ui/smoothScroll glides there). */
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Work', href: '/work' },
    { label: 'Contact', href: '#contact' },
  ],
  studios: [
    { key: 'architecture', label: 'Architecture + Design' },
    { key: 'media', label: 'Creative Media' },
    { key: 'products', label: 'Digital Products' },
  ],
} as const;

export type StudioKey = (typeof site.studios)[number]['key'];
