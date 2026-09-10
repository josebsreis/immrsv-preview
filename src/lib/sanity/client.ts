import { createClient, type SanityClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

/** null until a project id is configured — callers fall back to defaults. */
export const sanity: SanityClient | null = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion: '2026-01-01',
      useCdn: true,
      token: import.meta.env.SANITY_API_READ_TOKEN,
      perspective: 'published',
    })
  : null;

const builder = sanity ? imageUrlBuilder(sanity) : null;

export function imageUrl(source: unknown, width = 1600): string | undefined {
  if (!builder || !source) return undefined;
  return builder.image(source as never).width(width).auto('format').fit('max').url();
}

/** The same ladder the local pipeline writes (scripts/images.mjs), asked of
 *  Sanity's CDN instead. `auto=format` means each of these URLs answers with
 *  AVIF or WebP by what the browser asked for, so one srcset covers both and
 *  no <source type> is needed. A width past the original is dropped —
 *  `fit: max` would return the original anyway, and two identical candidates
 *  only give the browser a worse choice. */
export function imageSrcset(source: unknown, widths: number[], full?: number): string | undefined {
  if (!builder || !source) return undefined;
  const usable = full ? widths.filter((w) => w <= full) : widths;
  if (usable.length === 0 && full) usable.push(full);
  return usable
    .map((w) => `${builder.image(source as never).width(w).auto('format').fit('max').url()} ${w}w`)
    .join(', ');
}
