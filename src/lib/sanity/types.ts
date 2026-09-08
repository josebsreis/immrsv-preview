import type { StudioKey } from '@lib/site';

export interface Cta { label: string; href: string; }

/** a figure and what it counts — one slide of the stats reel */
export interface Fact { value: string; label: string; }

/** whoever the statement is signed by */
export interface Person { name: string; role: string; portrait?: ImageRef; }

/** one logo in the brands grid */
export interface Brand { name: string; logo: ImageRef; }

/** a still or a silent loop — the studios' media band */
export interface Media { kind: 'image' | 'video'; url: string; poster?: string; alt?: string; }

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
}

export interface Project {
  _id: string;
  title: string;
  slug: string;
  year?: number;
  location?: string;
  studios: StudioKey[];
  summary?: string;
  cover?: ImageRef;
  gallery: ImageRef[];
  body: unknown[];      // Portable Text blocks
  featured?: boolean;
}

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
    intro: string;
    items: Studio[];
  };
  brands: {
    tag: string;
    items: Brand[];
  };
  featuredProject?: Project;
}
