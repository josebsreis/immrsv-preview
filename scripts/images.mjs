/* Turn the client's delivery folder into web assets.
 *
 *   node scripts/images.mjs [--src ../projects] [--width 1200]
 *
 * The renders arrive as 30–40MB PNGs (one TIFF at 262MB). Nothing that size
 * belongs anywhere near a browser, so each one is resized and written twice —
 * AVIF for everyone current, WebP for everyone else — into public/work, and a
 * manifest is written to src/content/work.generated.json listing what came out.
 * The originals are never copied and never referenced.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};

const SRC = path.resolve(opt('src', '../projects'));
const OUT = path.resolve('public/work');
const MANIFEST = path.resolve('src/content/work.generated.json');
const WIDTH = Number(opt('width', 1200));
const IMAGE = /\.(png|jpe?g|tiff?|webp)$/i;

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** the first number in a filename, so Render_01 comes before Render_02 */
const order = (name) => {
  const m = name.match(/(\d+)(?=[^\d]*$)/);
  return m ? Number(m[1]) : 0;
};

async function dirs(where) {
  const out = [];
  for (const e of await readdir(where, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('.')) out.push(e.name);
  }
  return out.sort();
}

async function main() {
  const studios = await dirs(SRC);
  const manifest = [];
  let count = 0, bytes = 0;

  for (const studio of studios) {
    for (const project of await dirs(path.join(SRC, studio))) {
      const from = path.join(SRC, studio, project);
      const files = (await readdir(from))
        .filter((f) => IMAGE.test(f))
        .sort((a, b) => order(a) - order(b) || a.localeCompare(b));
      if (!files.length) continue;

      const dir = path.join(slug(studio), slug(project));
      await mkdir(path.join(OUT, dir), { recursive: true });

      const images = [];
      for (const [i, file] of files.entries()) {
        const base = String(i + 1).padStart(2, '0');
        const src = path.join(from, file);
        const avif = path.join(OUT, dir, `${base}.avif`);
        const webp = path.join(OUT, dir, `${base}.webp`);
        // ffmpeg reads the huge TIFF the others choke on, and AV1 is the
        // smallest thing every current browser can read
        await run('ffmpeg', ['-y', '-v', 'error', '-i', src,
          '-vf', `scale='min(${WIDTH},iw)':-2:flags=lanczos`,
          '-c:v', 'libsvtav1', '-crf', '34', '-frames:v', '1', avif]);
        await run('magick', [src, '-resize', `${WIDTH}x${WIDTH}>`, '-quality', '74',
          '-define', 'webp:method=6', '-strip', webp]);
        for (const f of [avif, webp]) bytes += (await stat(f)).size;
        count += 2;
        images.push(`/work/${dir}/${base}`);
        process.stdout.write(`\r${dir} ${i + 1}/${files.length}          `);
      }
      manifest.push({ studio: slug(studio), name: project, slug: slug(project), images });
    }
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  console.log(`${manifest.length} projects, ${count} files, ${(bytes / 1e6).toFixed(1)}MB`);
  console.log(`manifest → ${path.relative(process.cwd(), MANIFEST)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
