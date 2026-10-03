/* ═══════════════════════════════════════════════════════════════════
   Step two of seeding Sanity: the JSON written by scripts/cms/export.ts,
   loaded into the project — every picture and clip uploaded from public/,
   then the homepage, the site settings, the Work page, the small print and
   every project written as documents. Run with the signed-in user's own
   access, so no token is kept anywhere:

     npx sanity exec scripts/cms/seed.mjs --with-user-token -- <seed.json>

   Safe to run again: uploads of the same file come back as the same asset,
   and each document is replaced whole by its fixed id. It replaces — so
   run it on an empty project, not over edits made in the Studio.
   ═══════════════════════════════════════════════════════════════════ */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const file = process.argv.at(-1);
if (!file?.endsWith('.json')) throw new Error('usage: sanity exec scripts/cms/seed.mjs --with-user-token -- <seed.json>');
const seed = JSON.parse(readFileSync(file, 'utf8'));
const client = getCliClient({ apiVersion: '2026-01-01' });

let n = 0;
const key = () => `s${(n++).toString(36)}`;
const keyed = (list) => (list ?? []).map((x) => ({ _key: key(), ...x }));

/* ── files ─────────────────────────────────────────────────────────── */
/** the largest file a picture exists at, from its srcset or its own url */
function largest(ref) {
  const set = ref?.webpSrcset || ref?.avifSrcset;
  if (set) {
    const best = set.split(',').map((s) => s.trim().split(/\s+/))
      .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).sort((a, b) => b.w - a.w)[0];
    if (best) return best.u;
  }
  return ref?.url;
}
const local = (url) => {
  if (!url || /^https?:/.test(url)) return null;
  const p = path.join('public', decodeURI(url.split('?')[0]));
  return existsSync(p) ? p : null;
};

const uploaded = new Map();
async function upload(kind, url) {
  const p = local(url);
  if (!p) { if (url) console.warn(`  ! not found locally, skipped: ${url}`); return null; }
  if (!uploaded.has(p)) {
    uploaded.set(p, client.assets.upload(kind, createReadStream(p), { filename: path.basename(p) })
      .then((a) => { console.log(`  ↑ ${p}`); return a._id; }));
  }
  return uploaded.get(p);
}
/** an image field from a site picture, its alt text kept */
async function image(ref, extra = {}) {
  const id = await upload('image', largest(ref));
  return id ? { _type: 'image', asset: { _type: 'reference', _ref: id }, ...(ref?.alt ? { alt: ref.alt } : {}), ...extra } : undefined;
}

/* ── documents ─────────────────────────────────────────────────────── */
const projectId = (slug) => `project-${slug}`;

async function project(p, order) {
  const media = [];
  for (const m of p.media ?? []) {
    if (m.kind === 'video') {
      const fileId = await upload('file', m.url);
      const poster = m.poster ? await image({ url: m.poster }) : undefined;
      media.push({ _type: 'clip', _key: key(), alt: m.alt,
        ...(fileId ? { file: { _type: 'file', asset: { _type: 'reference', _ref: fileId } } } : { url: m.url }),
        ...(poster ? { poster } : {}) });
    } else {
      const img = await image(m);
      if (img) media.push({ ...img, _key: key() });
    }
  }
  return {
    _id: projectId(p.slug), _type: 'project',
    title: p.title, slug: { _type: 'slug', current: p.slug },
    year: p.year, location: p.location, studios: p.studios,
    summary: p.summary, brief: p.brief, whatWeDid: p.whatWeDid,
    links: keyed(p.links), services: p.services ?? [],
    cover: await image(p.cover), media,
    body: p.body ?? [], featured: !!p.featured, order,
  };
}

async function home(h) {
  const brands = [];
  for (const b of h.brands.items) {
    const logo = await image(b.logo);
    if (logo) brands.push({ _key: key(), name: b.name, logo });
  }
  const testimonials = [];
  for (const t of h.testimonials.items) {
    testimonials.push({ _key: key(), label: t.label, quote: t.quote, name: t.name, role: t.role,
      ...(t.portrait ? { portrait: await image(t.portrait) } : {}) });
  }
  const founder = h.about.founder;
  return {
    _id: 'home', _type: 'home',
    hero: h.hero,
    about: {
      tag: h.about.tag, statement: h.about.statement, lead: h.about.lead,
      stats: keyed(h.about.stats),
      founder: { name: founder.name, role: founder.role, ...(founder.portrait ? { portrait: await image(founder.portrait) } : {}) },
    },
    team: { lead: h.team.lead, tail: h.team.tail, note: h.team.note, steps: keyed(h.team.steps) },
    studios: {
      tag: h.studios.tag, kicker: h.studios.kicker, title: h.studios.title, intro: h.studios.intro,
      items: h.studios.items.map((s) => ({ _key: key(), key: s.key, name: s.name, promise: s.promise,
        description: s.description, services: s.services })),
    },
    brands: { tag: h.brands.tag, items: brands },
    testimonials: { tag: h.testimonials.tag, items: testimonials },
    process: { tag: h.process.tag, title: h.process.title, intro: h.process.intro, steps: keyed(h.process.steps) },
    work: {
      tag: h.work.tag, title: h.work.title, intro: h.work.intro, cta: h.work.cta,
      featured: h.work.featured.map((slug) => ({ _key: key(), _type: 'reference', _ref: projectId(slug) })),
    },
    faqs: { tag: h.faqs.tag, title: h.faqs.title, aside: h.faqs.aside, cta: h.faqs.cta, items: keyed(h.faqs.items) },
  };
}

const settings = (s) => ({
  _id: 'settings', _type: 'settings',
  description: s.description,
  contact: { email: s.email, phone: s.phone },
  footer: { words: s.words, buttons: keyed(s.buttons), location: s.location, city: s.city, social: keyed(s.social) },
});

/* ── run ───────────────────────────────────────────────────────────── */
console.log(`seeding ${client.config().projectId}/${client.config().dataset}`);
const docs = [];
console.log('projects');
for (const [i, p] of seed.projects.entries()) docs.push(await project(p, i + 1));
console.log('homepage');
docs.push(await home(seed.home));
docs.push(settings(seed.settings));
docs.push({ _id: 'workPage', _type: 'workPage', ...seed.workPage });
for (const id of ['privacy', 'terms']) docs.push({ _id: id, _type: 'legalPage', ...seed.legal[id] });

const tx = client.transaction();
for (const d of docs) tx.createOrReplace(JSON.parse(JSON.stringify(d)));   // drops undefined
await tx.commit();
console.log(`done: ${docs.length} documents, ${uploaded.size} files`);
