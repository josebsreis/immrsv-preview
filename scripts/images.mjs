/* Turn the client's delivery folder into web assets.
 *
 *   node scripts/images.mjs [--src ../projects] [--widths 900,1400,2200] [--force]
 *
 * The renders arrive as 30–40MB PNGs (one TIFF at 262MB) and the odd 4K
 * animation at 27MB. Nothing that size belongs anywhere near a browser, so
 * each still comes out at a ladder of widths — the pages say what they need
 * and the browser takes the one that fits — each written twice, AVIF for
 * everyone current and WebP for everyone else. Each clip is resized to a silent,
 * streamable mp4 with a poster frame beside it. All of it goes into public/work, and a
 * manifest is written to src/content/work.generated.json listing what came
 * out, with each file's pixel size. The originals are never copied and never
 * referenced.
 *
 * Work already done is left alone; --force does it again.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
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
/* The ladder every still is written at, for the browser to choose from.
   A card in the grid is 330–820 CSS px depending on the screen and a project
   page's column reaches about 1050, and a retina screen wants twice either
   number: 900 covers a card on a phone or a laptop, 1400 a card on a big
   screen, 2200 a page on one. Every width is a ceiling — nothing is ever
   enlarged past what arrived. */
const WIDTHS = String(opt('widths', '900,1400,2200'))
  .split(',').map(Number).filter(Boolean).sort((a, b) => a - b);
/* a clip is watched, not inspected: 1080p is where the file size stops
   buying anything you can see at this size */
const VIDEO_WIDTH = Number(opt('video-width', 1920));
const FORCE = args.includes('--force');
const IMAGE = /\.(png|jpe?g|tiff?|webp)$/i;
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;

/** already there and not asked to do it again */
const done = async (file) => !FORCE && (await access(file).then(() => true, () => false));

/** what came out, in pixels — written into the manifest so the pages can
 *  hold the right amount of room open before a lazy file arrives */
async function size(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0:nk=1', file]);
  const [w, h] = stdout.trim().split(',').map(Number);
  return { w, h };
}

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
      const byOrder = (a, b) => order(a) - order(b) || a.localeCompare(b);
      const all = await readdir(from);
      const files = all.filter((f) => IMAGE.test(f)).sort(byOrder);
      const clips = all.filter((f) => VIDEO.test(f)).sort(byOrder);
      if (!files.length && !clips.length) continue;

      const dir = path.join(slug(studio), slug(project));
      await mkdir(path.join(OUT, dir), { recursive: true });
      const grew = async (...written) => {
        for (const f of written) bytes += (await stat(f)).size;
        count += written.length;
      };

      const images = [];
      for (const [i, file] of files.entries()) {
        const base = String(i + 1).padStart(2, '0');
        const src = path.join(from, file);
        let biggest;
        for (const w of WIDTHS) {
          const avif = path.join(OUT, dir, `${base}-${w}.avif`);
          const webp = path.join(OUT, dir, `${base}-${w}.webp`);
          if (!(await done(avif)) || !(await done(webp))) {
            // ffmpeg reads the huge TIFF the others choke on, and AV1 is the
            // smallest thing every current browser can read
            await run('ffmpeg', ['-y', '-v', 'error', '-i', src,
              '-vf', `scale='min(${w},iw)':-2:flags=lanczos`,
              '-c:v', 'libsvtav1', '-crf', '28', '-frames:v', '1', avif]);
            await run('magick', [src, '-resize', `${w}x${w}>`, '-quality', '84',
              '-define', 'webp:method=6', '-strip', webp]);
            await grew(avif, webp);
          }
          biggest = await size(webp);
          process.stdout.write(`\r${dir} ${i + 1}/${files.length} @${w}      `);
        }
        // the ratio is the file's own; the widths are what exists to choose from
        images.push({ src: `/work/${dir}/${base}`, ...biggest, widths: WIDTHS });
      }

      /* The clips are 4K masters. They come out at the same width as the
         stills, silent (nothing on the site plays sound), and with their
         index at the front so a player can start on the first frames rather
         than after the whole file. A poster is pulled a second in — frame
         zero of a render is often still fading up. */
      const videos = [];
      for (const [i, file] of clips.entries()) {
        const base = `v${String(i + 1).padStart(2, '0')}`;
        const src = path.join(from, file);
        const mp4 = path.join(OUT, dir, `${base}.mp4`);
        const poster = path.join(OUT, dir, `${base}.jpg`);
        if (!(await done(mp4)) || !(await done(poster))) {
          await run('ffmpeg', ['-y', '-v', 'error', '-i', src,
            '-vf', `scale='min(${VIDEO_WIDTH},iw)':-2:flags=lanczos`,
            '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
          await run('ffmpeg', ['-y', '-v', 'error', '-ss', '1', '-i', mp4,
            '-frames:v', '1', '-q:v', '4', poster]);
          await grew(mp4, poster);
        }
        videos.push({ src: `/work/${dir}/${base}.mp4`, poster: `/work/${dir}/${base}.jpg`, ...(await size(mp4)) });
        process.stdout.write(`\r${dir} clip ${i + 1}/${clips.length}      `);
      }

      manifest.push({ studio: slug(studio), name: project, slug: slug(project), images,
                      ...(videos.length ? { videos } : {}) });
    }
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  console.log(count
    ? `${manifest.length} projects, ${count} new files, ${(bytes / 1e6).toFixed(1)}MB`
    : `${manifest.length} projects, nothing new (--force to redo)`);
  console.log(`manifest → ${path.relative(process.cwd(), MANIFEST)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
