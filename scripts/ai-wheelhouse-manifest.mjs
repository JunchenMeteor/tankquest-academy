import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SCHEMA_VERSION = 1;

function fail(message) {
  throw new Error(`AI wheelhouse manifest: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function hashFile(filePath) {
  return sha256(await readFile(filePath));
}

function assertSafeFileName(name) {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.length > 255 ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) {
    fail(`unsafe file name: ${JSON.stringify(name)}`);
  }
}

function canonicalPayload(files) {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, files });
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('root must be an object');
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    fail(`unsupported schema version: ${manifest.schemaVersion}`);
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail('files must be a non-empty array');
  }

  let previousName = '';
  const files = manifest.files.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('every file entry must be an object');
    }

    const { name, sha256: digest, size } = entry;
    assertSafeFileName(name);
    if (name <= previousName) {
      fail('file names must be unique and sorted');
    }
    if (!Number.isSafeInteger(size) || size <= 0) {
      fail(`invalid size for ${name}`);
    }
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/u.test(digest)) {
      fail(`invalid SHA-256 for ${name}`);
    }

    previousName = name;
    return { name, size, sha256: digest };
  });

  const contentKey = sha256(canonicalPayload(files));
  if (manifest.contentKey !== contentKey) {
    fail('content key does not match the file manifest');
  }

  return { schemaVersion: SCHEMA_VERSION, contentKey, files };
}

export async function readManifest(manifestPath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${manifestPath}: ${error.message}`);
  }
  return validateManifest(parsed);
}

export async function createManifest(wheelhousePath, manifestPath) {
  const entries = await readdir(wheelhousePath, { withFileTypes: true });
  if (entries.length === 0) fail('wheelhouse is empty');

  const files = [];
  for (const entry of entries.sort((left, right) =>
    compareNames(left.name, right.name)
  )) {
    assertSafeFileName(entry.name);
    if (!entry.isFile()) fail(`only regular files are allowed: ${entry.name}`);

    const filePath = path.join(wheelhousePath, entry.name);
    const fileStat = await stat(filePath);
    if (fileStat.size <= 0) fail(`file is empty: ${entry.name}`);
    files.push({
      name: entry.name,
      size: fileStat.size,
      sha256: await hashFile(filePath),
    });
  }

  const contentKey = sha256(canonicalPayload(files));
  const manifest = { schemaVersion: SCHEMA_VERSION, contentKey, files };
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  return manifest;
}

export async function verifyWheelhouse(wheelhousePath, manifestPath) {
  const manifest = await readManifest(manifestPath);
  const entries = await readdir(wheelhousePath, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort(compareNames);
  const expectedNames = manifest.files.map((entry) => entry.name);

  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    fail('wheelhouse files do not exactly match the manifest');
  }

  for (const [index, entry] of entries
    .sort((left, right) => compareNames(left.name, right.name))
    .entries()) {
    const expected = manifest.files[index];
    if (!entry.isFile()) fail(`only regular files are allowed: ${entry.name}`);

    const filePath = path.join(wheelhousePath, entry.name);
    const fileStat = await stat(filePath);
    if (fileStat.size !== expected.size) fail(`size mismatch: ${entry.name}`);
    if ((await hashFile(filePath)) !== expected.sha256) {
      fail(`SHA-256 mismatch: ${entry.name}`);
    }
  }

  return manifest.contentKey;
}

async function main() {
  const [command, firstPath, secondPath] = process.argv.slice(2);
  if (command === 'create' && firstPath && secondPath) {
    const manifest = await createManifest(firstPath, secondPath);
    console.log(manifest.contentKey);
    return;
  }
  if (command === 'key' && firstPath && !secondPath) {
    console.log((await readManifest(firstPath)).contentKey);
    return;
  }
  if (command === 'verify' && firstPath && secondPath) {
    console.log(await verifyWheelhouse(firstPath, secondPath));
    return;
  }
  fail(
    'usage: create <wheelhouse> <manifest> | key <manifest> | verify <wheelhouse> <manifest>'
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
