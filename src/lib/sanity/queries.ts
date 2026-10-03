import { sanity, imageUrl, imageSrcset } from './client';
import type { HomeContent, Project, ImageRef, Media, Settings, WorkPage, LegalPage } from './types';
import { defaultHome, defaultProjects, defaultSettings, defaultWorkPage } from '@/content/defaults';

/* ── GROQ ──────────────────────────────────────────────────────────── */
const imageFields = `{ asset, alt, "lqip": asset->metadata.lqip, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }`;

const projectFields = `{
  _id, title, "slug": slug.current, year, location, studios, summary, featured,
  brief, whatWeDid, liveUrl, "links": coalesce(links[]{ label, url }, []),
  "services": coalesce(services, []),
  "cover": cover ${imageFields},
  "media": coalesce(media[]{
    _type,
    _type == "clip" => { "url": coalesce(file.asset->url, url), "poster": poster ${imageFields}, alt },
    _type == "image" => ${imageFields}
  }, [])
}`;

const homeQuery = `*[_type == "home"][0]{
  description,
  hero{ headline, words, description, primaryCta, secondaryCta },
  about{ tag, statement, lead, stats, founder{ name, role, "portrait": portrait ${imageFields} } },
  studios{ tag, kicker, title, intro, "items": items[]{ key, name, promise, description, services,
    "media": media{ kind, "url": coalesce(file.asset->url, url), "poster": poster ${imageFields}, alt } } },
  brands{ tag, "items": items[]{ name, "logo": logo ${imageFields} } },
  process{ tag, title, intro, "steps": coalesce(steps[]{ title, body }, []) },
  testimonials{ tag, "items": coalesce(items[]{ label, quote, name, role, "portrait": portrait ${imageFields} }, []) },
  work{ tag, title, intro, "featured": coalesce(featured[]->slug.current, []), cta },
  faqs{ tag, title, aside, cta, "items": coalesce(items[]{ q, a }, []) },
  team{ lead, tail, note, "steps": coalesce(steps[]{ word, line }, []) }
}`;

const settingsQuery = `*[_id == "settings"][0]{
  description, contact{ email, phone },
  footer{ words, "buttons": coalesce(buttons[]{ label, href }, []), location, city, "social": coalesce(social[]{ label, url }, []) }
}`;
const workPageQuery = `*[_id == "workPage"][0]{ title, description, empty }`;
const legalQuery = `*[_id == $id][0]{ title, updated, description, "body": coalesce(body, []) }`;

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
  /* the Media field is the page; a project with none shows its cover */
  const media: Media[] = (raw.media ?? []).map(mapMedia).filter(Boolean);
  return {
    _id: raw._id,
    title: raw.title,
    slug: raw.slug,
    year: raw.year,
    location: raw.location,
    studios: raw.studios ?? [],
    summary: raw.summary,
    brief: raw.brief,
    whatWeDid: raw.whatWeDid,
    /* the buttons; a project from before them that only has the old live
       link keeps it, as it was shown */
    links: (raw.links ?? []).filter((l: any) => l?.label && l?.url).length
      ? raw.links.filter((l: any) => l?.label && l?.url)
      : raw.liveUrl ? [{ label: 'View live', url: raw.liveUrl }] : [],
    services: raw.services ?? [],
    cover,
    gallery: [],
    media: media.length
      ? media
      : [cover].filter(Boolean).map((img: any) => ({
          kind: 'image' as const, url: img.url, alt: img.alt,
          webpSrcset: img.webpSrcset, width: img.width, height: img.height,
        })),
    body: [],
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
    const team = raw.team ?? {};
    const steps = (team.steps ?? []).filter((t: any) => t?.word);
    /** a field left empty in the studio falls back to the default, rather
     *  than coming through as nothing */
    const keep = <T extends object>(base: T, over: any): T => {
      const out: any = { ...base };
      for (const [k, v] of Object.entries(over ?? {})) if (v !== null && v !== undefined && v !== '') out[k] = v;
      return out;
    };
    return {
      description: raw.description || undefined,
      team: { ...keep(defaultHome.team, { lead: team.lead, tail: team.tail, note: team.note }),
              steps: steps.length ? steps : defaultHome.team.steps },
      hero: { ...defaultHome.hero, ...raw.hero },
      about: {
        ...defaultHome.about,
        ...raw.about,
        founder: founder ? { ...founder, portrait: mapImage(founder.portrait) } : defaultHome.about.founder,
      },
      /* the defaults first, so a field the studio has not filled in — its
         heading, say — falls back rather than coming through undefined */
      studios: studioItems.length
        ? {
            ...defaultHome.studios,
            tag: raw.studios?.tag ?? defaultHome.studios.tag,
            kicker: raw.studios?.kicker ?? defaultHome.studios.kicker,
            title: raw.studios?.title ?? defaultHome.studios.title,
            intro: raw.studios?.intro ?? defaultHome.studios.intro,
            items: studioItems,
          }
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
      work: raw.work?.featured?.length
        ? { ...defaultHome.work, ...raw.work }
        : defaultHome.work,
      faqs: raw.faqs?.items?.length
        ? { ...defaultHome.faqs, ...raw.faqs }
        : defaultHome.faqs,
      brands: brandItems.length
        ? { tag: raw.brands?.tag ?? defaultHome.brands.tag, items: brandItems }
        : defaultHome.brands,
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

/* every page asks for the settings, for its footer; one fetch serves the build */
let settingsOnce: Promise<Settings> | null = null;
export function getSettings(): Promise<Settings> {
  settingsOnce ??= (async () => {
    if (!sanity) return defaultSettings;
    try {
      const raw = await sanity.fetch(settingsQuery);
      if (!raw) return defaultSettings;
      const f = raw.footer ?? {};
      const list = <T>(v: T[] | undefined, d: T[]) => (v && v.length ? v : d);
      return {
        description: raw.description || defaultSettings.description,
        email: raw.contact?.email || defaultSettings.email,
        phone: raw.contact?.phone || defaultSettings.phone,
        words: list(f.words, defaultSettings.words),
        buttons: list(f.buttons?.filter((b: any) => b?.label && b?.href), defaultSettings.buttons),
        location: f.location || defaultSettings.location,
        city: f.city || defaultSettings.city,
        social: list(f.social?.filter((x: any) => x?.label && x?.url), defaultSettings.social),
      };
    } catch (e) {
      console.warn('[sanity] settings fetch failed, using defaults', e);
      return defaultSettings;
    }
  })();
  return settingsOnce;
}

export async function getWorkPage(): Promise<WorkPage> {
  if (!sanity) return defaultWorkPage;
  try {
    const raw = await sanity.fetch(workPageQuery);
    return {
      title: raw?.title || defaultWorkPage.title,
      description: raw?.description || undefined,
      empty: raw?.empty || defaultWorkPage.empty,
    };
  } catch (e) {
    console.warn('[sanity] work page fetch failed, using defaults', e);
    return defaultWorkPage;
  }
}

/** the privacy policy or the terms from the studio — or nothing, and the
 *  page keeps its own text */
export async function getLegal(id: 'privacy' | 'terms'): Promise<LegalPage | undefined> {
  if (!sanity) return undefined;
  try {
    const raw = await sanity.fetch(legalQuery, { id });
    return raw?.body?.length ? raw : undefined;
  } catch (e) {
    console.warn('[sanity] legal fetch failed', e);
    return undefined;
  }
}
