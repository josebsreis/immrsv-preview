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
