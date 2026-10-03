/* ═══════════════════════════════════════════════════════════════════
   Files every picture and clip in the Studio's Media tab by where the site
   uses it — read from the content, never typed by hand, so a tag can only
   say something true and running this again makes it true again.

     npm run cms:tag             show what would change, write nothing
     npm run cms:tag -- --apply  do it

   Runs with the signed-in user's own access (sanity exec --with-user-token).

   The tags, all derived:
     what it is part of   projects · clients · testimonials · team
     which studio         architecture-design · creative-media · digital-products
     which project        the project's slug, e.g. cedar-park
     what kind            video
     not used anywhere    unused — the shortlist to tidy, never deleted here

   A file still carrying the bare name it was delivered under — 01-2200.webp,
   v01.mp4 — is given its project's instead (cedar-park-01.webp), so it can
   be told apart in the grid. A name somebody chose is never touched.

   Tags not made by this script — anything added by hand in the Studio — are
   left alone: only tags whose id this script gives (media.tag.<name>) are
   rewritten. Tags rather than folders because one picture can be used in
   two places — a project and the homepage — and a folder holds it once.
   ═══════════════════════════════════════════════════════════════════ */
import { getCliClient } from 'sanity/cli';

const APPLY = process.argv.includes('--apply');
const client = getCliClient({ apiVersion: '2026-01-01' }).withConfig({ perspective: 'raw', useCdn: false });

const STUDIO_TAG = { architecture: 'architecture-design', media: 'creative-media', products: 'digital-products' };
/** the homepage's sections, by the field the picture sits under */
const HOME_TAG = { brands: 'clients', testimonials: 'testimonials', about: 'team' };
const tagId = (name) => `media.tag.${name}`;

/** every asset id referenced anywhere inside a value */
function refsIn(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => refsIn(v, out));
  else if (value && typeof value === 'object') {
    if (typeof value._ref === 'string' && /^(image|file)-/.test(value._ref)) out.add(value._ref);
    Object.values(value).forEach((v) => refsIn(v, out));
  }
  return out;
}

const [assets, projects, homes] = await Promise.all([
  client.fetch(`*[_type in ["sanity.imageAsset", "sanity.fileAsset"]]{
    _id, _type, originalFilename, "existing": opt.media.tags[]{ _ref, "name": @->name.current }
  } | order(originalFilename asc)`),
  // drafts count: a picture placed in an unpublished edit is in use
  client.fetch(`*[_type == "project"]{ _id, "slug": slug.current, studios, cover, media }`),
  client.fetch(`*[_type == "home"]`),
]);

const want = new Map(assets.map((a) => [a._id, new Set()]));
const give = (id, tag) => want.get(id)?.add(tag);

/** a project's name for each of its files, in the order the page shows them */
const named = new Map();
for (const p of projects) {
  const slug = p.slug;
  [...refsIn([p.media, p.cover])].forEach((id, k) => {
    if (slug && !named.has(id)) named.set(id, `${slug}-${String(k + 1).padStart(2, '0')}`);
  });
  for (const id of refsIn([p.cover, p.media])) {
    give(id, 'projects');
    if (slug) give(id, slug);
    for (const s of p.studios ?? []) if (STUDIO_TAG[s]) give(id, STUDIO_TAG[s]);
  }
}
for (const h of homes) {
  for (const [field, tag] of Object.entries(HOME_TAG)) for (const id of refsIn(h[field])) give(id, tag);
}
for (const a of assets) {
  if (a._type === 'sanity.fileAsset') give(a._id, 'video');
  // a clip or picture nothing points at; "video" alone does not count as use
  const s = want.get(a._id);
  if (![...s].some((t) => t !== 'video')) s.add('unused');
}

/** delivered as a bare number, not named by anyone */
const bare = (name) => !name || /^(v?\d+)(-\d+)?\.[a-z0-9]+$/i.test(name);
const plan = assets.map((a) => {
  const ours = (a.existing ?? []).filter((t) => t._ref?.startsWith('media.tag.'));
  const manual = (a.existing ?? []).filter((t) => !t._ref?.startsWith('media.tag.'));
  const next = [...want.get(a._id)].sort();
  const ext = (a.originalFilename ?? '').split('.').pop();
  const rename = bare(a.originalFilename) && named.has(a._id) ? `${named.get(a._id)}.${ext}` : null;
  const changed = rename !== null || next.join() !== ours.map((t) => t.name).sort().join();
  return { ...a, next, manual, rename, changed };
});

const names = [...new Set(plan.flatMap((p) => p.next))].sort();
const changing = plan.filter((p) => p.changed);
console.log(`\n${assets.length} assets · ${names.length} tags · ${changing.length} to change\n`);
for (const t of names) console.log(`  ${String(plan.filter((p) => p.next.includes(t)).length).padStart(4)}  ${t}`);

if (!changing.length) { console.log('\n  Every asset already has the right tags.\n'); process.exit(0); }
if (!APPLY) {
  console.log('\n  For example:');
  for (const p of changing.slice(0, 10)) console.log(`    ${(p.originalFilename ?? p._id).slice(0, 28).padEnd(28)} → ${(p.rename ?? '(same name)').padEnd(36)} ${p.next.join(', ')}`);
  console.log('\n  Nothing was written. Run again with --apply to save.\n');
  process.exit(0);
}

// the tags first: an asset's tags are references, and they must point at something
const tagTx = client.transaction();
for (const name of names) tagTx.createIfNotExists({ _id: tagId(name), _type: 'media.tag', name: { _type: 'slug', current: name } });
await tagTx.commit();

const BATCH = 50;
for (let i = 0; i < changing.length; i += BATCH) {
  const tx = client.transaction();
  for (const p of changing.slice(i, i + BATCH)) {
    tx.patch(p._id, { set: {
      'opt.media.tags': [
        ...p.manual.map((t) => ({ _type: 'reference', _key: t._ref, _ref: t._ref })),
        ...p.next.map((name) => ({ _type: 'reference', _key: name, _ref: tagId(name) })),
      ],
      ...(p.rename ? { originalFilename: p.rename } : {}),
    } });
  }
  await tx.commit();
  console.log(`  tagged ${Math.min(i + BATCH, changing.length)}/${changing.length}`);
}
console.log(`\n  Done: the Media tab's sidebar has ${names.length} tags.\n`);
