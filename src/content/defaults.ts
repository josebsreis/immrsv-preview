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
    tag: 'About',
    statement: 'We draw the space, render the image and build the interface — one team, from first sketch to built experience.',
    caps: 'Drawn with precision,\nbuilt with intent,\nexperienced as one.',
    body: 'Our work begins at the drawing and carries through to the built experience — spaces, images and interfaces made by one team, so nothing is lost between them.',
    cta: { label: 'More about us', href: '/#about' },
  },
  featuredProject: defaultProjects[0],
};
