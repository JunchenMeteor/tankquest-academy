import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const environments = [
  {
    environment: 'development',
    apiOrigin: 'http://127.0.0.1:3000',
    envFile: 'apps/web/.env.tauri-development',
    configFile: 'apps/desktop/src-tauri/tauri.conf.json',
    buildCommand: 'npm run build:web',
    connectSources: [
      'ipc:',
      'http://ipc.localhost',
      'http://127.0.0.1:3000',
      'ws://127.0.0.1:5173',
    ],
  },
  {
    environment: 'preview',
    apiOrigin: 'https://tq-pre.jcmeteor.com',
    envFile: 'apps/web/.env.tauri-preview',
    configFile: 'apps/desktop/src-tauri/tauri.preview.conf.json',
    buildCommand: 'npm run build:web:preview',
    connectSources: [
      'ipc:',
      'http://ipc.localhost',
      'https://tq-pre.jcmeteor.com',
    ],
  },
  {
    environment: 'release',
    apiOrigin: 'https://tankquest.jcmeteor.com',
    envFile: 'apps/web/.env.tauri-release',
    configFile: 'apps/desktop/src-tauri/tauri.release.conf.json',
    buildCommand: 'npm run build:web:release',
    connectSources: [
      'ipc:',
      'http://ipc.localhost',
      'https://tankquest.jcmeteor.com',
    ],
  },
];

for (const expected of environments) {
  const env = parseEnv(await readFile(expected.envFile, 'utf8'));
  const config = JSON.parse(await readFile(expected.configFile, 'utf8'));
  const csp = config.app?.security?.csp;

  assert.equal(env.VITE_RUNTIME_TARGET, 'tauri-windows');
  assert.equal(env.VITE_RUNTIME_ENVIRONMENT, expected.environment);
  assert.equal(env.VITE_API_URL, expected.apiOrigin);
  assert.equal(config.build?.beforeBuildCommand, expected.buildCommand);
  assert.equal(typeof csp, 'string');
  assert.deepEqual(
    readCspDirective(csp, 'connect-src').sort(),
    [...expected.connectSources, 'blob:'].sort()
  );
  assert.deepEqual(readCspDirective(csp, 'media-src'), ["'self'", 'blob:']);

  for (const other of environments) {
    if (other.environment === expected.environment) continue;
    assert.doesNotMatch(csp, new RegExp(escapeRegex(other.apiOrigin)));
  }
}

console.log(
  'Verified isolated desktop API origins, Vite modes, and CSP pairs.'
);

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        assert.notEqual(separator, -1, `Invalid env line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

function readCspDirective(csp, name) {
  const directive = csp
    .split(';')
    .map((value) => value.trim())
    .find((value) => value === name || value.startsWith(`${name} `));
  assert.ok(directive, `Missing CSP directive: ${name}`);
  return directive.split(/\s+/u).slice(1);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
