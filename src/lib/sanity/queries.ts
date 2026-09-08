import { sanity, imageUrl } from './client';
import type { HomeContent, Project, ImageRef } from './types';
import { defaultHome, defaultProjects } from '@/content/defaults';

/* ── GROQ ──────────────────────────────────────────────────────────── */
const imageFields = `{ asset, alt, "lqip": asset->metadata.lqip, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }`;

const projectFields = `{
  _id, title, "slug": slug.current, year, location, studios, summary, featured,
  "cover": cover ${imageFields},
  "gallery": coalesce(gallery[] ${imageFields}, []),
  "body": coalesce(body, [])
}`;

const homeQuery = `*[_type == "home"][0]{
  hero{ headline, words, description, primaryCta, secondaryCta },
  about{ tag, statement, stats, founder{ name, role, "portrait": portrait ${imageFields} } },
  brands{ tag, "items": items[]{ name, "logo": logo ${imageFields} } },
  "featuredProject": featuredProject-> ${projectFields}
}`;

const projectsQuery = `*[_type == "project"] | order(coalesce(order, 999) asc, year desc) ${projectFields}`;
const projectBySlugQuery = `*[_type == "project" && slug.current == $slug][0] ${projectFields}`;

/* ── mappers ───────────────────────────────────────────────────────── */
function mapImage(raw: any, fallback?: ImageRef): ImageRef | undefined {
  if (!raw?.asset) return fallback;
  return { url: imageUrl(raw)!, alt: raw.alt, lqip: raw.lqip, width: raw.width, height: raw.height };
}

function mapProject(raw: any): Project {
  return {
    _id: raw._id,
    title: raw.title,
    slug: raw.slug,
    year: raw.year,
    location: raw.location,
    studios: raw.studios ?? [],
    summary: raw.summary,
    cover: mapImage(raw.cover),
    gallery: (raw.gallery ?? []).map((g: any) => mapImage(g)).filter(Boolean),
    body: raw.body ?? [],
    featured: raw.featured,
  };
}

/* ── public API — every call degrades to defaults ──────────────────── */
export async function getHome(): Promise<HomeContent> {
  if (!sanity) return defaultHome;
  try {
    const raw = await sanity.fetch(homeQuery);
    if (!raw) return defaultHome;
    const founder = raw.about?.founder;
    const brandItems = (raw.brands?.items ?? [])
      .map((b: any) => ({ name: b.name, logo: mapImage(b.logo) }))
      .filter((b: any) => b.logo);
    return {
      hero: { ...defaultHome.hero, ...raw.hero },
      about: {
        ...defaultHome.about,
        ...raw.about,
        founder: founder ? { ...founder, portrait: mapImage(founder.portrait) } : defaultHome.about.founder,
      },
      brands: brandItems.length
        ? { tag: raw.brands?.tag ?? defaultHome.brands.tag, items: brandItems }
        : defaultHome.brands,
      featuredProject: raw.featuredProject ? mapProject(raw.featuredProject) : defaultHome.featuredProject,
    };
  } catch (e) {
    console.warn('[sanity] home fetch failed, using defaults', e);
    return defaultHome;
  }
}

export async function getProjects(): Promise<Project[]> {
  if (!sanity) return defaultProjects;
  try {
    const raw = await sanity.fetch(projectsQuery);
    return raw?.length ? raw.map(mapProject) : defaultProjects;
  } catch (e) {
    console.warn('[sanity] projects fetch failed, using defaults', e);
    return defaultProjects;
  }
}

export async function getProject(slug: string): Promise<Project | undefined> {
  if (!sanity) return defaultProjects.find((p) => p.slug === slug);
  try {
    const raw = await sanity.fetch(projectBySlugQuery, { slug });
    return raw ? mapProject(raw) : undefined;
  } catch (e) {
    console.warn('[sanity] project fetch failed', e);
    return defaultProjects.find((p) => p.slug === slug);
  }
}
