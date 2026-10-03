import type { APIRoute } from 'astro';
import { getProjects, getHome, getWorkPage, getLegal } from '@lib/sanity/queries';

/* Every page a search engine should know about, written from the content
   itself: a project added in the Studio is in it at the next build, and a
   page set to "Hide from search engines" is left out. */
export const GET: APIRoute = async ({ site }) => {
  const [projects, home, work, privacy, terms] = await Promise.all([
    getProjects(), getHome(), getWorkPage(), getLegal('privacy'), getLegal('terms'),
  ]);
  const pages: [string, boolean | undefined][] = [
    ['/', home.seo?.noIndex],
    ['/work', work.seo?.noIndex],
    ...projects.map((p): [string, boolean | undefined] => [`/work/${p.slug}`, p.seo?.noIndex]),
    ['/privacy', privacy?.seo?.noIndex],
    ['/terms', terms?.seo?.noIndex],
  ];
  const urls = pages.filter(([, hide]) => !hide).map(([path]) => `  <url><loc>${new URL(path, site).href}</loc></url>`);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
};
