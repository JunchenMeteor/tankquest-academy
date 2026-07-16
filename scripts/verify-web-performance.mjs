import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distAssets = resolve(root, 'apps/web/dist/assets');
const visualRoot = resolve(root, 'apps/web/public/assets/phase4');
const budgets = {
  shellJsGzip: 130 * 1024,
  gameJsGzip: 400 * 1024,
  totalJsGzip: 540 * 1024,
  cssGzip: 32 * 1024,
  visualFile: 256 * 1024,
  visualTotal: 2 * 1024 * 1024,
};

function fail(message) {
  throw new Error(`Web performance budget failed: ${message}`);
}

const buildFiles = (await readdir(distAssets, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
let shellJsGzip = 0;
let gameJsGzip = 0;
let cssGzip = 0;
for (const name of buildFiles) {
  const bytes = await readFile(resolve(distAssets, name));
  const gzipBytes = gzipSync(bytes).byteLength;
  if (name.endsWith('.css')) cssGzip += gzipBytes;
  else if (name.endsWith('.js') && name.startsWith('create-game-')) {
    gameJsGzip += gzipBytes;
  } else if (name.endsWith('.js')) shellJsGzip += gzipBytes;
}
if (shellJsGzip > budgets.shellJsGzip) {
  fail(`application shell JS is ${shellJsGzip} gzip bytes`);
}
if (gameJsGzip === 0 || gameJsGzip > budgets.gameJsGzip) {
  fail(`lazy game JS is ${gameJsGzip} gzip bytes`);
}
if (shellJsGzip + gameJsGzip > budgets.totalJsGzip) {
  fail(`total JS is ${shellJsGzip + gameJsGzip} gzip bytes`);
}
if (cssGzip > budgets.cssGzip) fail(`CSS is ${cssGzip} gzip bytes`);

const visualFiles = await walk(visualRoot);
let visualTotal = 0;
for (const file of visualFiles) {
  const size = (await stat(file)).size;
  if (size > budgets.visualFile) fail(`${file} is ${size} bytes`);
  visualTotal += size;
}
if (visualTotal > budgets.visualTotal) {
  fail(`visual resources total ${visualTotal} bytes`);
}

console.log(
  `Verified gzip budgets: shell=${shellJsGzip}, game=${gameJsGzip}, css=${cssGzip}, visuals=${visualTotal} bytes.`
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}
