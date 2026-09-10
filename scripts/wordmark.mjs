/* Turn the wordmark into rows of lines.
 *
 *   node scripts/wordmark.mjs [--src ../logos/IMMRSV_Main.svg] [--rows 44]
 *
 * The footer draws the name as a set of horizontal lines rather than as a
 * letterform — the shape read one row at a time, the way a plotter would draw
 * it. That has to be worked out from the real artwork, so the mark is
 * rasterised once here and the runs of filled pixels on each row are written
 * to src/content/wordmark.generated.json. Nothing measures anything in the
 * browser: the page ships the lines.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

const SRC = path.resolve(opt('src', '../logos/IMMRSV_Main.svg'));
const OUT = path.resolve('src/content/wordmark.generated.json');
/** how many lines the name is drawn in — the whole look is in this number */
const ROWS = Number(opt('rows', 44));
const TMP = path.resolve('.wordmark.pbm');

/** the artwork's own proportions, so the raster is not squashed */
async function ratio() {
  const svg = await readFile(SRC, 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!box) throw new Error('the wordmark has no viewBox');
  return box[2] / box[3];
}

async function main() {
  const aspect = await ratio();
  const cols = Math.round(ROWS * aspect);

  /* a plain bitmap, one byte a pixel, is the least that can be read back */
  await run('magick', ['-background', 'none', SRC, '-resize', `${cols}x${ROWS}!`,
    '-alpha', 'extract', '-threshold', '50%', '-compress', 'none', `PGM:${TMP}`]);

  const text = await readFile(TMP, 'utf8');
  const nums = text.split(/\s+/).filter(Boolean);
  if (nums[0] !== 'P2') throw new Error(`unexpected raster: ${nums[0]}`);
  const w = Number(nums[1]), h = Number(nums[2]);
  const px = nums.slice(4).map(Number);           // P2, w, h, maxval, then data

  /* every run of ink on a row, as a start and a length in grid units */
  const rows = [];
  for (let y = 0; y < h; y++) {
    const runs = [];
    let x = 0;
    while (x < w) {
      if (px[y * w + x] > 127) {
        const start = x;
        while (x < w && px[y * w + x] > 127) x++;
        runs.push([start, x - start]);
      } else x++;
    }
    if (runs.length) rows.push({ y, runs });
  }

  await writeFile(OUT, JSON.stringify({ cols: w, rows: h, lines: rows }) + '\n');
  await unlink(TMP);
  const count = rows.reduce((n, r) => n + r.runs.length, 0);
  console.log(`${w}×${h} grid, ${rows.length} rows, ${count} lines → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
