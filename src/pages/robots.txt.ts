import type { APIRoute } from 'astro';

/* What search engines may read. A preview build (PUBLIC_NOINDEX=1) is closed
   to them entirely; the real site keeps only the editor out. */
export const GET: APIRoute = ({ site }) => {
  const body = import.meta.env.PUBLIC_NOINDEX === '1'
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /admin\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
