#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const skipE2e = process.argv.includes('--skip-e2e');

const gates = [
  ['Repository rules, security, and unit tests', ['test']],
  ['Published content matrix', ['run', 'content:verify']],
  ['Versioned asset catalog', ['run', 'assets:verify']],
  ['PWA safety boundary', ['run', 'pwa:verify']],
  ['Production build and performance budgets', ['run', 'build']],
  ...(!skipE2e
    ? [
        [
          'Web desktop, touch, fallback, and authoritative journeys',
          ['run', 'test:e2e'],
        ],
      ]
    : []),
];

for (const [label, args] of gates) {
  console.log(`\n[product-experience] ${label}`);
  const result = spawnSync(npm, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Phase 5.1 product experience gate failed: ${label} (exit ${result.status ?? 'unknown'})`
    );
  }
}

console.log(
  `\nVerified Phase 5.1 product experience gates${skipE2e ? ' (E2E skipped by request)' : ''}.`
);
