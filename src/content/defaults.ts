import type { HomeContent, Project } from '@lib/sanity/types';

/** Fallback content so the site builds and previews before Sanity is connected.
 *  Once PUBLIC_SANITY_PROJECT_ID is set, Sanity wins and these are only used
 *  for fields the editor has left empty. */
export const defaultProjects: Project[] = [
  {
    _id: 'casa-do-vale',
    title: 'Casa do Vale',
    slug: 'casa-do-vale',
    year: 2025,
    location: 'Lisbon',
    studios: ['architecture', 'media'],
    summary: 'Residential — architecture, archviz, virtual tour',
    cover: { url: '/featured.jpeg', alt: 'Casa do Vale — interior render' },
    gallery: [],
    body: [],
    featured: true,
  },
];

export const defaultHome: HomeContent = {
  hero: {
    headline: 'Designing the future\nof',
    words: ['experience.', 'space.', 'media.', 'products.'],
    description: 'An independent practice working across architecture, creative media and digital products.',
    primaryCta: { label: 'Discuss your project', href: '/#contact' },
    secondaryCta: { label: 'See our portfolio', href: '/work' },
  },
  about: {
    tag: 'What we do',
    statement:
      'A building, a film and a product are the same problem — someone has to move through it and understand it. Most studios solve one of the three and hand you the rest.\n\n' +
      'We keep all three under one roof, so the drawing, the image and the interface are made by the same people, and the work arrives whole.',
    founder: { name: 'Oscar Nino', role: 'Founder, IMMRSV' },
    stats: [
      { value: '30+', label: 'Projects delivered across the three studios' },
      { value: '2019', label: 'Founded in Lisbon, working across Europe' },
      { value: '03', label: 'Studios under one roof, one team' },
      { value: '1:1', label: 'Drawn at real scale before anything is built' },
    ],
  },
  brands: {
    tag: "Brands we've helped",
    items: [
      { name: 'Alvarez & Marsal', logo: { url: '/brands/alvarez-marsal.svg', alt: 'Alvarez & Marsal' } },
      { name: 'Ellis Adams Group', logo: { url: '/brands/ellis-adams-group.svg', alt: 'Ellis Adams Group' } },
      { name: 'Lepesi', logo: { url: '/brands/lepesi.svg', alt: 'Lepesi' } },
      { name: 'Wolcott', logo: { url: '/brands/wolcott.svg', alt: 'Wolcott' } },
    ],
  },
  featuredProject: defaultProjects[0],
};
