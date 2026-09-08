import type { Brand, HomeContent, Project, Studio } from '@lib/sanity/types';

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

/** The four client marks we have so far. Doubled below only to fill the grid
 *  — drop the repeat once there are eight real ones. */
const clients: Brand[] = [
  { name: 'Alvarez & Marsal', logo: { url: '/brands/alvarez-marsal.svg', alt: 'Alvarez & Marsal' } },
  { name: 'Ellis Adams Group', logo: { url: '/brands/ellis-adams-group.svg', alt: 'Ellis Adams Group' } },
  { name: 'Lepesi', logo: { url: '/brands/lepesi.svg', alt: 'Lepesi' } },
  { name: 'Wolcott', logo: { url: '/brands/wolcott.svg', alt: 'Wolcott' } },
];

const studios: Studio[] = [
  {
    key: 'architecture',
    name: 'Architecture + Design',
    promise: 'The building, drawn to the last detail.',
    description:
      'Concept through construction drawings for houses, interiors and small commercial work. We draw at real scale from the first sketch, so what gets built is what was agreed — and the decisions are made where they are still cheap to make.',
    services: ['Concept design', 'Planning and permits', 'Construction drawings', 'Interiors', 'Site supervision'],
    media: { kind: 'video', url: '/studios/architecture.mp4', poster: '/studios/architecture.jpg', alt: 'Architecture and design' },
  },
  {
    key: 'media',
    name: 'Creative Media',
    promise: 'The image that carries the idea before it exists.',
    description:
      'Stills, film and virtual tours built from the same models the architects work in. Nothing is redrawn to flatter the project, so what a client approves on screen is what they will walk into.',
    services: ['Architectural visualisation', 'Animation and film', 'Virtual tours', 'Art direction', 'Photography direction'],
    media: { kind: 'video', url: '/studios/media.mp4', poster: '/studios/media.jpg', alt: 'Creative media' },
  },
  {
    key: 'products',
    name: 'Digital Products',
    promise: 'The interface people actually move through.',
    description:
      'Sites, configurators and internal tools, designed and built by the same team. Shipped and maintained rather than handed over as a mockup, and measured once real people are using them.',
    services: ['Product design', 'Web development', 'Configurators', 'Design systems', 'Maintenance'],
    media: { kind: 'video', url: '/studios/products.mp4', poster: '/studios/products.jpg', alt: 'Digital products' },
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
    founder: {
      name: 'Oscar Nino',
      role: 'Founder, IMMRSV',
      portrait: { url: '/team/oscar-nino.jpg', alt: 'Oscar Nino' },
    },
    stats: [
      { value: '30+', label: 'Projects delivered across the three studios' },
      { value: '2019', label: 'Founded in Lisbon, working across Europe' },
      { value: '03', label: 'Studios under one roof, one team' },
      { value: '1:1', label: 'Drawn at real scale before anything is built' },
    ],
  },
  studios: {
    tag: 'Studios',
    intro: 'Three studios under one roof. Work moves between them without a handover, which is the whole point.',
    items: studios,
  },
  brands: {
    tag: "Brands we've helped",
    items: [...clients, ...clients],
  },
  featuredProject: defaultProjects[0],
};
