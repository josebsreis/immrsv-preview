/* ═══════════════════════════════════════════════════════════════════
   Move a built site under a sub-path.

   The site is written root-relative, which is what it is: it will live
   at the root of its own domain. A GitHub Pages project site does not —
   it is served from /<repo>/ — so every absolute path in the build has
   to be moved under that prefix before it is published.

   This runs on the build, not on the source: nothing in src knows or
   cares, and the real deploy never calls it.

   Only the paths the site actually owns are moved, named here rather
   than matched by shape, because "/" appears in a great deal of text
   that is not a URL. A path is taken as a path when it is opened by a
   quote, a bracket, or a srcset's comma.
   ═══════════════════════════════════════════════════════════════════ */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const prefix = (process.argv[2] || '').replace(/\/$/, '');
if (!prefix) { console.error('usage: rebase.mjs /prefix'); process.exit(1); }

/** everything the site serves from its own root */
const OWNED = ['work', 'studios', 'brands', 'team', 'audio', 'shapes',
               'fonts', 'testimonials', 'favicon.svg', '_astro'];
/** the files a path can be written in */
const TEXT = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.webmanifest']);

const opener = `(?<=["'(\`]|,\\s)`;
const assets = new RegExp(`${opener}/(${OWNED.join('|')})\\b`, 'g');
/** the two internal routes, and the home page */
const routes = new RegExp(`${opener}/(work/[a-z0-9-]+|work|)(?=["')\`])`, 'g');

let files = 0, hits = 0;
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (!TEXT.has(extname(e.name))) continue;
    const before = await readFile(p, 'utf8');
    const after = before.replace(assets, `${prefix}/$1`).replace(routes, `${prefix}/$1`);
    if (after === before) continue;
    files++;
    hits += (before.match(assets)?.length ?? 0) + (before.match(routes)?.length ?? 0);
    await writeFile(p, after);
  }
}

await walk('dist');
console.log(`rebased ${hits} paths under ${prefix} across ${files} files`);
