import type { StudioKey } from '@lib/site';

export interface Cta { label: string; href: string; }

/** a figure and what it counts — the row under the About columns */
export interface Fact { value: string; label: string; }

/** a numbered position the practice takes */
export interface Principle { title: string; text: string; }

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
  about: {
    tag: string;
    statement: string;
    caps: string;
    body: string;
    cta: Cta;
    /** optional blocks — each renders only when the editor fills it */
    facts?: Fact[];
    principles?: Principle[];
  };
  featuredProject?: Project;
}
