import { sanity, imageUrl, imageSrcset } from './client';
import type { HomeContent, Project, ImageRef, Media } from './types';
import { defaultHome, defaultProjects } from '@/content/defaults';

/* ── GROQ ──────────────────────────────────────────────────────────── */
const imageFields = `{ asset, alt, "lqip": asset->metadata.lqip, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }`;

const projectFields = `{
  _id, title, "slug": slug.current, year, location, studios, summary, featured,
  challenge, approach, outcome, whatWeDid, liveUrl,
  "services": coalesce(services, []),
  "cover": cover ${imageFields},
  "gallery": coalesce(gallery[] ${imageFields}, []),
  "media": coalesce(media[]{
    _type,
    _type == "clip" => { "url": coalesce(file.asset->url, url), "poster": poster ${imageFields}, alt },
    _type == "image" => ${imageFields}
  }, []),
  "body": coalesce(body, [])
}`;

const homeQuery = `*[_type == "home"][0]{
  hero{ headline, words, description, primaryCta, secondaryCta },
  about{ tag, statement, stats, founder{ name, role, "portrait": portrait ${imageFields} } },
  studios{ tag, intro, "items": items[]{ key, name, promise, description, services,
    "media": media{ kind, "url": coalesce(file.asset->url, url), "poster": poster ${imageFields}, alt } } },
  brands{ tag, "items": items[]{ name, "logo": logo ${imageFields} } },
  process{ tag, title, intro, "steps": coalesce(steps[]{ title, body }, []) },
  testimonials{ tag, "items": coalesce(items[]{ label, quote, name, role, "portrait": portrait ${imageFields} }, []) },
  "featuredProject": featuredProject-> ${projectFields}
}`;

const projectsQuery = `*[_type == "project"] | order(coalesce(order, 999) asc, year desc) ${projectFields}`;
const projectBySlugQuery = `*[_type == "project" && slug.current == $slug][0] ${projectFields}`;

/* ── mappers ───────────────────────────────────────────────────────── */
/** the same ladder scripts/images.mjs writes for the local files, so a page
 *  behaves the same whichever the picture came from */
const WIDTHS = [900, 1400, 2200];

function mapImage(raw: any, fallback?: ImageRef): ImageRef | undefined {
  if (!raw?.asset) return fallback;
  return {
    url: imageUrl(raw)!,
    alt: raw.alt,
    lqip: raw.lqip,
    width: raw.width,
    height: raw.height,
    /* one srcset, not two: every URL is auto=format, so the CDN answers each
       with AVIF or WebP by what the browser asked for */
    webpSrcset: imageSrcset(raw, WIDTHS, raw.width),
  };
}

/** One entry of the project's media list. A still keeps its whole ladder and
 *  its own pixels; a clip keeps its poster, which is also what holds the room
 *  open before it loads. An entry with nothing behind it is dropped. */
function mapMedia(raw: any): Media | undefined {
  if (raw?._type === 'clip') {
    if (!raw.url) return undefined;
    const poster = mapImage(raw.poster);
    return { kind: 'video', url: raw.url, poster: poster?.url, alt: raw.alt ?? poster?.alt,
             width: poster?.width, height: poster?.height };
  }
  const img = mapImage(raw);
  if (!img) return undefined;
  return { kind: 'image', url: img.url, alt: img.alt, webpSrcset: img.webpSrcset,
           width: img.width, height: img.height };
}

function mapProject(raw: any): Project {
  const cover = mapImage(raw.cover);
  const gallery = (raw.gallery ?? []).map((g: any) => mapImage(g)).filter(Boolean);
  /* the Media field is the page; the old gallery stands in until it is filled */
  const media: Media[] = (raw.media ?? []).map(mapMedia).filter(Boolean);
  return {
    _id: raw._id,
    title: raw.title,
    slug: raw.slug,
    year: raw.year,
    location: raw.location,
    studios: raw.studios ?? [],
    summary: raw.summary,
    challenge: raw.challenge,
    approach: raw.approach,
    outcome: raw.outcome,
    whatWeDid: raw.whatWeDid,
    liveUrl: raw.liveUrl,
    services: raw.services ?? [],
    cover,
    gallery,
    media: media.length
      ? media
      : [cover, ...gallery].filter(Boolean).map((img: any) => ({
          kind: 'image' as const, url: img.url, alt: img.alt,
          webpSrcset: img.webpSrcset, width: img.width, height: img.height,
        })),
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
    const studioItems = (raw.studios?.items ?? [])
      .filter((st: any) => st?.key && st?.name)
      .map((st: any) => ({
        ...st,
        services: st.services ?? [],
        media: st.media?.url ? { ...st.media, poster: mapImage(st.media.poster)?.url } : undefined,
      }));
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
      studios: studioItems.length
        ? { tag: raw.studios?.tag ?? defaultHome.studios.tag, intro: raw.studios?.intro ?? defaultHome.studios.intro, items: studioItems }
        : defaultHome.studios,
      testimonials: raw.testimonials?.items?.length
        ? {
            tag: raw.testimonials.tag ?? defaultHome.testimonials.tag,
            items: raw.testimonials.items.map((t: any) => ({ ...t, portrait: mapImage(t.portrait) })),
          }
        : defaultHome.testimonials,
      process: raw.process?.steps?.length
        ? { ...defaultHome.process, ...raw.process }
        : defaultHome.process,
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
