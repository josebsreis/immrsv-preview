import type { Brand, HomeContent, Project, Studio } from '@lib/sanity/types';
import { site, type StudioKey } from '@lib/site';
import delivered from './work.generated.json';

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
    services: ['Concept design', 'Permits', 'Drawings', 'Interiors', 'Site supervision'],
    media: { kind: 'video', url: '/studios/architecture.mp4', poster: '/studios/architecture.jpg', alt: 'Architecture and design' },
  },
  {
    key: 'media',
    name: 'Creative Media',
    promise: 'The image that carries the idea before it exists.',
    description:
      'Stills, film and virtual tours built from the same models the architects work in. Nothing is redrawn to flatter the project, so what a client approves on screen is what they will walk into.',
    services: ['Visualisation', 'Animation', 'Film', 'Virtual tours', 'Art direction'],
    media: { kind: 'video', url: '/studios/media.mp4', poster: '/studios/media.jpg', alt: 'Creative media' },
  },
  {
    key: 'products',
    name: 'Digital Products',
    promise: 'The product people actually use.',
    description:
      'Apps, sites, configurators and internal tools, designed and built by the same team. Shipped and maintained rather than handed over as a mockup, and improved once real people are using them.',
    services: ['Product design', 'Web', 'Configurators', 'Design systems', 'Maintenance'],
    media: { kind: 'video', url: '/studios/products.mp4', poster: '/studios/products.jpg', alt: 'Digital products' },
  },
];

/** Fallback content so the site builds and previews before Sanity is connected.
 *  Once PUBLIC_SANITY_PROJECT_ID is set, Sanity wins and these are only used
 *  for fields the editor has left empty. */

/* ── the work ───────────────────────────────────────────────────────────
   The projects come from the client's own delivery, squeezed into
   public/work by scripts/images.mjs and listed in work.generated.json —
   the folder is the studio, the sub-folder is the project, the files are
   its media in order. Nothing here is invented but the write-ups: no
   project has arrived with copy yet, so every one carries the same visible
   stand-in, and the two digital-products entries are marked placeholders
   because that studio has sent no work at all. Delete them, and the
   PLACEHOLDER line, as the real thing lands. */
/* Stand-in copy, written to be usable rather than to look unwritten. It is
   pitched at the studio rather than at the project, so it says nothing that
   is not true of the work in general — no client names, no dates, no numbers,
   nothing anyone would have to check. A project that gets its own write-up
   simply overrides it.

   It reads as finished, which is the point and also the risk: nothing on the
   page announces itself as a placeholder any more, so this wants a read
   through before the site goes live. */
type Copy = { summary: string; challenge: string; approach: string; outcome: string; whatWeDid: string };

const COPY: Record<StudioKey, Copy> = {
  architecture: {
    summary: 'Architecture and interiors, drawn from the first sketch through to construction.',
    challenge:
      'A plan that had to hold at every scale — how the rooms are entered, where the light lands through the day, and what the structure would allow — settled while the drawings were still soft enough to change.',
    approach:
      'We modelled the whole building at real scale and made the decisions inside it, so what was approved on screen is what the contractor was handed. Nothing was resolved twice.',
    outcome:
      'A set that survived the site. The details were argued out where changes are cheap, and the rooms as built hold the proportions the model promised.',
    whatWeDid:
      'Concept design, the permit set, construction drawings and the interior packages — with the visualisation cut from the same model rather than rebuilt for the picture.',
  },
  media: {
    summary: 'Visualisation and film, made from the drawings rather than around them.',
    challenge:
      'The work had to be seen before it existed, and had to read as the thing itself rather than as a render — accurate to the design, and still worth looking at.',
    approach:
      "We built each shot from the project's own model and lit it like a photograph: real optics, real materials, and no flattery the building could not deliver.",
    outcome:
      'Images that carried the idea to the people who had to approve it, and that still describe the project honestly once it was standing.',
    whatWeDid:
      'Art direction, modelling and lookdev, stills and animation, and the final grade.',
  },
  products: {
    summary: 'Digital products, designed and built by the same team that draws.',
    challenge:
      'A great deal of information and very little patience for it: the interface had to make a wide range feel obvious, on a phone as much as on a desk.',
    approach:
      'We designed in the browser against real content, so the layout was proven at the sizes people actually use before anything was called finished.',
    outcome:
      'Something that shipped and kept working — quick on a phone, easy to keep up to date, and measured against how it is used rather than how it demoed.',
    whatWeDid:
      'Product design, the front-end build, the design system underneath it, and the maintenance after launch.',
  },
};

/** The live link, when there is one — and for now there is not. Most of the
 *  work has nothing public to point at, so no default carries one and the
 *  button is simply absent; give a project a `liveUrl` in Sanity and it
 *  appears on that project alone. */
const PLACEHOLDER_LIVE = undefined;

const STUDIO_OF: Record<string, StudioKey> = {
  'architecture-design': 'architecture',
  'creative-media': 'media',
  'digital-products': 'products',
};

/** what each studio does, reused as a project's services until a project
 *  names its own */
const servicesOf = (key: StudioKey): string[] =>
  studios.find((s) => s.key === key)?.services.slice(0, 4) ?? [];

type Shot = { src: string; w: number; h: number; widths: number[] };
type Clip = { src: string; poster: string; w: number; h: number };
type Delivered = { studio: string; name: string; slug: string; images: Shot[]; videos?: Clip[] };

/** every width that exists of one still, for the browser to choose from */
const srcset = (shot: Shot, ext: 'avif' | 'webp') =>
  shot.widths.map((w) => `${shot.src}-${w}.${ext} ${w}w`).join(', ');
/** the card's width — a grid of three never needs the big one */
const card = (shot: Shot) => `${shot.src}-${shot.widths[0]}.webp`;
/** both encodings' full ladder, for anything that lets the browser choose */
const ladder = (shot: Shot) => ({ avifSrcset: srcset(shot, 'avif'), webpSrcset: srcset(shot, 'webp') });
/** that file's own pixels, so a card holds the right room open */
const cardSize = (shot: Shot) => {
  const width = Math.min(shot.widths[0], shot.w);
  return { width, height: Math.round((shot.h * width) / shot.w) };
};
/** the last width is the largest, and the fallback for a browser with no srcset */
const full = (shot: Shot, ext: 'avif' | 'webp') => `${shot.src}-${shot.widths.at(-1)}.${ext}`;

/** One delivered folder, as a project: everything in it, in the order it
 *  arrived — every render, then every clip. The stills are the cover and the
 *  gallery too; the manifest writes them extension-less, because an .avif and
 *  a .webp exist for each. */
function fromDelivery(entry: Delivered): Project {
  const key = STUDIO_OF[entry.studio] ?? 'architecture';
  const shots = entry.images;
  const clips = entry.videos ?? [];
  return {
    _id: entry.slug,
    title: entry.name,
    slug: entry.slug,
    studios: [key],
    ...COPY[key],
    liveUrl: PLACEHOLDER_LIVE,
    services: servicesOf(key),
    /* a project that is only a film leads with the clip's poster */
    cover: shots[0]
      ? { url: card(shots[0]), alt: entry.name, ...cardSize(shots[0]), ...ladder(shots[0]) }
      : { url: clips[0].poster, alt: entry.name, width: clips[0].w, height: clips[0].h },
    gallery: shots.map((s) => ({ url: card(s), alt: entry.name, ...cardSize(s), ...ladder(s) })),
    media: [
      ...shots.map((s) => ({
        kind: 'image' as const, url: full(s, 'webp'), avif: full(s, 'avif'),
        avifSrcset: srcset(s, 'avif'), webpSrcset: srcset(s, 'webp'),
        width: s.w, height: s.h, alt: entry.name,
      })),
      ...clips.map((c) => ({
        kind: 'video' as const, url: c.src, poster: c.poster,
        width: c.w, height: c.h, alt: entry.name,
      })),
    ],
    body: [],
  };
}

/** Digital Products has sent nothing yet; these two hold its place in the
 *  grid and the filter, on the studio's own clip. */
const productPlaceholders: Project[] = [
  {
    _id: 'placeholder-configurator',
    title: 'Unit Configurator',
    slug: 'unit-configurator',
    studios: ['products'],
    ...COPY.products,
    liveUrl: PLACEHOLDER_LIVE,
    services: servicesOf('products'),
    cover: { url: '/studios/products.jpg', alt: 'Digital products' },
    gallery: [],
    media: [
      { kind: 'video', url: '/studios/products.mp4', poster: '/studios/products.jpg', alt: 'Digital products' },
      { kind: 'image', url: '/studios/products.jpg', alt: 'Digital products' },
    ],
    body: [],
  },
  {
    _id: 'placeholder-design-system',
    title: 'Practice Design System',
    slug: 'practice-design-system',
    studios: ['products'],
    ...COPY.products,
    liveUrl: PLACEHOLDER_LIVE,
    services: servicesOf('products'),
    cover: { url: '/studios/media.jpg', alt: 'Digital products' },
    gallery: [],
    media: [
      { kind: 'image', url: '/studios/media.jpg', alt: 'Digital products' },
      { kind: 'video', url: '/studios/media.mp4', poster: '/studios/media.jpg', alt: 'Digital products' },
    ],
    body: [],
  },
];

/** the grid reads across the practice rather than down one studio, so the
 *  three are dealt out in turn */
function interleave(items: Project[]): Project[] {
  const lanes = site.studios.map((s) => items.filter((p) => p.studios[0] === s.key));
  const out: Project[] = [];
  for (let i = 0; lanes.some((l) => l[i]); i++) for (const lane of lanes) if (lane[i]) out.push(lane[i]);
  return out;
}

export const defaultProjects: Project[] = interleave([
  ...(delivered as Delivered[]).map(fromDelivery),
  ...productPlaceholders,
]);

export const defaultHome: HomeContent = {
  hero: {
    /* The line under it carries the page's idea — one team, the work
       arrives whole — and the handover pays it off; the headline itself
       stays the practice's own. */
    headline: 'Designing the future\nof',
    words: ['experience.', 'space.', 'media.', 'products.'],
    description: 'Architecture, creative media and digital products, designed by one team, so whatever you\u2019re building arrives whole.',
    primaryCta: { label: 'Start a project', href: '/#contact' },
    secondaryCta: { label: 'See the work', href: '/work' },
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
      { value: '03', label: 'Studios, one team between them' },
      { value: '1:1', label: 'Built to be used before it is launched' },
    ],
  },
  studios: {
    tag: 'Studios',
    title: 'Three studios.',
    intro: 'Three doors into the same room. Whichever one you come in by, the same people design it, show it and build it.',
    items: studios,
  },
  brands: {
    tag: 'Clients we work with',
    items: [...clients, ...clients],
  },
  testimonials: {
    tag: 'Client stories',
    /* The client's own, as delivered — the words are theirs and are not to be
       edited for length. Each `label` is a word taken verbatim from its own
       quote, which is what the chooser on the left is called: the company
       would have been the obvious choice, but two of these five are Wolcott
       and two are LePesi, and a list with the same name twice cannot be used
       to choose. Every one of these firms is already in the brands
       grid above, which is the point: the quote and the mark are the same
       relationship, said twice. */
    items: [
      {
        quote:
          'Oscar is a powerhouse of creativity and vision, delivering designs that extend far beyond aesthetics to create experiences that are memorable, inspiring, and impactful. His approach to design is thoughtful and innovative, consistently setting a higher standard and making every project feel both purposeful and enduring.',
        label: 'Vision',
        name: 'Carlos Carrasquillo',
        role: 'Principal | Wolcott Architecture',
        portrait: { url: '/testimonials/carlos-carrasquillo', alt: 'Carlos Carrasquillo' },
      },
      {
        quote:
          'Oscar is our everything! For 15 years, he\u2019s been a dream to work with\u2014an incredibly talented, driven designer and a genuinely kind soul. His reliability, communication, and leadership have been vital to our success, and I\u2019m forever grateful to work with him. He has the unique ability to balance creativity with professionalism in every way.',
        label: 'Reliability',
        name: 'Carlie Campesi',
        role: 'Partner | LePesi Architecture',
        portrait: { url: '/testimonials/carlie-campesi', alt: 'Carlie Campesi' },
      },
      {
        quote:
          'Working with Oscar has been nothing short of exceptional. His creativity, clarity, and deep understanding of design made every stage of the process smooth, effective, and enjoyable. Proactive and detail-oriented, he aligned seamlessly with our vision and goals, offering insights that elevated the outcome. He is truly an outstanding partner.',
        label: 'Clarity',
        name: 'Stephen Lesko',
        role: 'Partner | LePesi Architecture',
        portrait: { url: '/testimonials/stephen-lesko', alt: 'Stephen Lesko' },
      },
      {
        quote:
          'Oscar brings a rare combination of creativity, dedication, and professionalism to every project. His strong work ethic and forward-thinking vision consistently push boundaries and inspire others. Just as importantly, his ability to truly listen and understand makes him an invaluable partner, helping projects succeed through collaboration and trust.',
        label: 'Collaboration',
        name: 'Joe Ho',
        role: 'Studio Director | Wolcott Architecture',
        portrait: { url: '/testimonials/joe-ho', alt: 'Joe Ho' },
      },
      {
        quote:
          'Collaborating with Oscar is always an exceptional experience. He balances creative vision with technical expertise, bringing both efficiency and refinement to every stage of the design process. He is highly proactive and detail-oriented, consistently delivering thoughtful solutions that elevate the final product. I would highly recommend Oscar as an architectural partner.',
        label: 'Refinement',
        name: 'Matthew Citron',
        role: 'Principal | Alvarez & Marsal Capital RE',
        portrait: { url: '/testimonials/matthew-citron', alt: 'Matthew Citron' },
      },
    ],
  },
  work: {
    title: 'Selected work.',
    intro: 'Some of what they were talking about.',
    /* None of the studio reels' projects: those already have a place on the
       page, and the pile is for the work that has not been shown yet. Dealt
       so the studios take turns. Stand-ins until the client picks his own —
       and there is no Digital Products work to deal in until he sends it. */
    featured: [
      'racel-residence', 'spiderman', 'pacific-palisades-residence', 'rogers-cafe',
      'grubhub', 'mishawaka', 'ruthchris-bar', 'swing-suite',
    ],
    cta: { label: 'See all the work', href: '/work' },
  },
  faqs: {
    tag: 'FAQs',
    title: "What you'll want to know before working with us.",
    aside: 'Something not answered here?\nAsk Oscar directly.',
    cta: { label: 'Book a call', href: '#contact' },
    items: [
      {
        q: 'Who actually works on my project?',
        a: 'Oscar leads every project — the drawings, the direction and the decisions — and he is who you speak to throughout.\n\nA small group of people he has worked with for years comes in where a project needs them. The team changes size; the standard does not.',
      },
      {
        q: 'How long does a project take?',
        a: 'A set of images is usually two to four weeks from the model being ready. A building drawn from concept to construction runs in months rather than weeks, and depends far more on approvals than on us.\n\nWe give a date at the start and tell you the moment it is at risk, which is earlier than most people expect to hear it.',
      },
      {
        q: 'Can you do the drawings and the images, or only one?',
        a: 'Either, and the reason to do both with us is that they come from the same model. Nothing is rebuilt to make a picture, so what is approved on screen is what the contractor is handed.\n\nPlenty of clients arrive with an architect already. We work to their drawings without complaint.',
      },
      {
        q: 'What do you need from me to start?',
        a: 'What the project has to do, whatever drawings or references already exist, and one person who can approve things.\n\nIf that is all still unsettled, say so — deciding it is the first part of the work, and it is cheaper to do at the start than halfway through.',
      },
      {
        q: 'What happens after it is delivered?',
        a: 'Files are yours, in the formats you can actually use, with nothing withheld.\n\nFor a site or a tool we stay with it — what people do with it once it is live tells us more than what was approved, and we correct against that.',
      },
      {
        q: 'Do you work with clients outside your region?',
        a: 'Most of the work is remote and always has been. Time zones are a scheduling problem, not a quality one.\n\nWhere a project needs someone on site we say so before it starts rather than after.',
      },
      {
        q: 'What does a project cost?',
        a: 'It depends on scope, and anyone who quotes before hearing the scope is guessing.\n\nTell us what you have in mind and you will get a fixed price against a written scope, not a rate card and an estimate that moves.',
      },
    ],
  },
  process: {
    tag: 'Our process',
    title: 'How we work',
    intro: 'A repeatable method applied\nacross every engagement.',
    steps: [
      {
        title: 'Understand',
        body: 'We start by listening. What the project has to do, who moves through it and where the real constraint sits — settled before anything is drawn, while the decisions are still cheap to change.',
      },
      {
        title: 'Design & Build',
        body: 'One team draws it, images it and builds it. Nothing is handed over halfway, so the drawing, the render and the interface stay the same idea the whole way through.',
      },
      {
        title: 'Refine & Evolve',
        body: 'We stay with it after it is delivered. What gets used tells us more than what got approved, and the work is corrected against that rather than left as it was signed off.',
      },
    ],
  },
  featuredProject: defaultProjects[0],
};
