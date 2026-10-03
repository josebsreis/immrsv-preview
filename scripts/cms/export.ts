/* ═══════════════════════════════════════════════════════════════════
   Step one of seeding Sanity: the site's built-in content, written out as
   plain JSON for scripts/cms/seed.mjs to load. Run with tsx, which knows
   the project's path aliases:

     npx tsx scripts/cms/export.ts <out.json>

   The small print is read from the privacy and terms pages themselves, so
   what is imported is what the site says today.
   ═══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { defaultHome, defaultProjects, defaultSettings, defaultWorkPage } from '../../src/content/defaults';

const out = process.argv[2];
if (!out) throw new Error('usage: tsx scripts/cms/export.ts <out.json>');

let key = 0;
const k = () => `k${(key++).toString(36)}`;

/** a run of HTML text — with <a href> in it — as Portable Text children */
function inline(html: string) {
  const children: any[] = [];
  const markDefs: any[] = [];
  const re = /<a href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let at = 0, m: RegExpExecArray | null;
  const text = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  while ((m = re.exec(html))) {
    if (m.index > at) children.push({ _type: 'span', _key: k(), text: text(html.slice(at, m.index)), marks: [] });
    const def = { _key: k(), _type: 'link', href: m[1] };
    markDefs.push(def);
    children.push({ _type: 'span', _key: k(), text: text(m[2]), marks: [def._key] });
    at = m.index + m[0].length;
  }
  if (at < html.length) children.push({ _type: 'span', _key: k(), text: text(html.slice(at)), marks: [] });
  return { children, markDefs };
}

function legal(file: string) {
  const src = readFileSync(file, 'utf8');
  const pick = (name: string) => new RegExp(`${name}=\\{cms\\?\\.${name} \\?\\? "([^"]*)"\\}`).exec(src)?.[1];
  const title = pick('title')!, updatedText = pick('updated')!, description = pick('description');
  // the text the page carries, without the part that is not editable
  const bodyHtml = src.slice(src.indexOf('>', src.indexOf('<LegalPage')) + 1, src.indexOf('</LegalPage>'))
    .replace(/<Fragment slot="after">[\s\S]*?<\/Fragment>/, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const body: any[] = [];
  for (const m of bodyHtml.matchAll(/<(h2|p)>([\s\S]*?)<\/\1>/g)) {
    body.push({ _type: 'block', _key: k(), style: m[1] === 'h2' ? 'h2' : 'normal', ...inline(m[2].trim()) });
  }
  const d = new Date(`${updatedText} 12:00 UTC`);
  const updated = isNaN(+d) ? undefined : d.toISOString().slice(0, 10);
  return { title, updated, description, body };
}

writeFileSync(out, JSON.stringify({
  home: defaultHome,
  projects: defaultProjects,
  settings: defaultSettings,
  workPage: defaultWorkPage,
  legal: { privacy: legal('src/pages/privacy.astro'), terms: legal('src/pages/terms.astro') },
}, null, 2));
console.log(`wrote ${out}`);
