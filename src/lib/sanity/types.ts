import type { StudioKey } from '@lib/site';

export interface Cta { label: string; href: string; }

/** a figure and what it counts — one slide of the stats reel */
export interface Fact { value: string; label: string; }

/** whoever the statement is signed by */
export interface Person { name: string; role: string; portrait?: ImageRef; }

/** one logo in the brands grid */
export interface Brand { name: string; logo: ImageRef; }

/** a still or a silent loop — the studios' media band */
export interface Media {
  kind: 'image' | 'video';
  url: string;             // the file itself, or the largest of a still's widths
  poster?: string;
  alt?: string;
  /** the same still in AVIF, offered first */
  avif?: string;
  /** every width there is, for the browser to choose from */
  avifSrcset?: string;
  webpSrcset?: string;
  /** the file's own pixels — only ever used to hold the right amount of room
   *  open before it arrives; the CSS still sizes it */
  width?: number;
  height?: number;
}

/** what a client said, and who said it */
export interface Testimonial {
  /** what the chooser calls it — a word from the quote itself, not a name */
  label?: string;
  quote: string;
  name: string;
  role: string;          // 'Principal | Wolcott Architecture'
  portrait?: ImageRef;
}

/** one of the three practices, as it reads on the homepage */
export interface Studio {
  key: StudioKey;
  name: string;
  promise: string;        // the one line
  description: string;
  services: string[];
  media?: Media;
}

export interface ImageRef {
  url: string;          // resolved URL (Sanity CDN or local fallback)
  alt?: string;
  width?: number;
  height?: number;
  lqip?: string;        // tiny base64 placeholder from Sanity's image metadata
  /** every width there is, for the browser to choose from */
  avifSrcset?: string;
  webpSrcset?: string;
}

export interface Project {
  _id: string;
  title: string;
  slug: string;
  year?: number;
  location?: string;
  studios: StudioKey[];
  summary?: string;
  /** what we did on it — the list in the project page's left column */
  services: string[];
  /** the project read in four turns, one at a time: the first three are
   *  written, the fourth is the services above */
  challenge?: string;
  approach?: string;
  outcome?: string;
  whatWeDid?: string;
  /** where the finished thing lives, if it lives anywhere public */
  liveUrl?: string;
  cover?: ImageRef;
  gallery: ImageRef[];
  /** the project page's right column, in order: stills and silent loops
   *  together. Falls back to cover + gallery when a project has none. */
  media: Media[];
  body: unknown[];      // Portable Text blocks
  featured?: boolean;
}

/** one step of the process, as it reads on the homepage */
export interface Step { title: string; body: string; }

export interface HomeContent {
  hero: {
    headline: string;   // '\n' marks the line break before the rotating word
    words: string[];
    description: string;
    primaryCta: Cta;
    secondaryCta: Cta;
  };
  /** the statement panel: the reel of figures on the left, the statement and
   *  its author on the right */
  about: {
    tag: string;
    statement: string;      // a blank line starts a new paragraph
    founder: Person;
    stats?: Fact[];
  };
  studios: {
    tag: string;
    /** the section's own heading, at display scale */
    title: string;
    intro: string;
    items: Studio[];
  };
  brands: {
    tag: string;
    items: Brand[];
  };
  /** what clients said, one at a time */
  testimonials: {
    tag: string;
    items: Testimonial[];
  };
  /** how the work is made, read one step at a time as the section is scrolled */
  process: {
    tag: string;
    title: string;
    intro: string;
    steps: Step[];
  };
  /** what a client wants to know before they commit, and who to ask */
  faqs: {
    tag: string;
    title: string;
    /** the line under the founder's picture, and the way to reach him */
    aside: string;
    cta: Cta;
    items: { q: string; a: string }[];
  };
  /** the selected work: a pile of cards fanned across the page, one project
   *  on show at a time — named by slug, in the order they are dealt */
  work: {
    title: string;
    /** the line under the title — the hand-over from the stories above it */
    intro: string;
    featured: string[];
    cta: Cta;
  };
  featuredProject?: Project;
}
