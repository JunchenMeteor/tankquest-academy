#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const config = {
  repo: 'JunchenMeteor/tankquest-academy',
  projectName: 'TankQuest Academy',
  branchPrefix: 'dev/chore/release-',
  promotionBranch: (version) =>
    `dev/chore/release-v${version.replaceAll('.', '')}-promotion`,
  issuePrefix: '[Chore]',
  issueLabel: 'chore',
  versionFiles: ['package.json', 'package-lock.json'],
  releaseDoc: (version) => `docs/releases/v${version}.md`,
  pageUrls: [
    'https://tankquest.jcmeteor.com/',
    'https://tankquest.jcmeteor.com/parent',
    'https://tq-pre.jcmeteor.com/',
    'https://tq-pre.jcmeteor.com/parent',
  ],
  healthUrls: [
    'https://tankquest.jcmeteor.com/api/health',
    'https://tq-pre.jcmeteor.com/api/health',
  ],
  parentReportUrls: [
    {
      en: 'https://tankquest.jcmeteor.com/api/children/child_demo/report?locale=en',
      zh: 'https://tankquest.jcmeteor.com/api/children/child_demo/report?locale=zh-CN',
    },
    {
      en: 'https://tq-pre.jcmeteor.com/api/children/child_demo/report?locale=en',
      zh: 'https://tq-pre.jcmeteor.com/api/children/child_demo/report?locale=zh-CN',
    },
  ],
  requiredPrChecks: [
    'Verify',
    'TankQuest / Container image (api-runtime)',
    'TankQuest / Container image (web-runtime)',
    'TankQuest / Container image (ai-runtime)',
  ],
  deployWorkflow: 'deploy-tencent.yml',
  deployTimeoutMs: 30 * 60 * 1000,
  checkRegistrationTimeoutMs: 5 * 60 * 1000,
};

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const options = parseOptions(args.slice(1));

if (command === 'help' || options.help) {
  printHelp();
  process.exit(command === 'help' ? 0 : 1);
}

const version = normalizeVersion(options.version);
const tag = `v${version}`;
const prepareTitle = `${config.issuePrefix} Prepare ${tag} release`;
const releaseTitle = `${config.issuePrefix} Release ${tag}`;
const dryRun = options.dryRun === true;

switch (command) {
  case 'full':
    await fullRelease();
    break;
  case 'prepare':
    await prepareRelease();
    break;
  case 'promote':
    await promoteRelease();
    break;
  case 'verify':
    await verifyRelease();
    break;
  default:
    fail(`Unknown command: ${command}`);
}

async function fullRelease() {
  await prepareRelease();
  await promoteRelease();
}

async function prepareRelease() {
  ensureTooling();
  ensureCleanWorktree();
  fetchBase();
  ensureTagDoesNotExist(tag);

  if (mainAlreadyPrepared(version)) {
    log(`main already contains ${tag}; skipping preparation PR`);
    return;
  }

  const issue = createOrFindIssue(
    prepareTitle,
    issueBody('Prepare release version files and release notes.')
  );
  const branch = `${config.branchPrefix}${tag.replaceAll('.', '')}`;

  run('git', ['checkout', '-B', branch, 'origin/main']);
  updateVersionFiles(version);
  writeReleaseDoc(version);

  run('git', [
    'add',
    ...config.versionFiles.filter(exists),
    config.releaseDoc(version),
  ]);
  run('git', ['commit', '-m', `Prepare ${tag} release`]);
  run('git', ['push', '-u', 'origin', branch]);

  const pr = createOrFindPr(
    prepareTitle,
    branch,
    'main',
    prBody(issue.number, 'Prepare the release version files and release notes.')
  );
  waitForPrChecks(pr.number);
  mergePr(pr.number, true);
  log(`Prepared ${tag} on main through PR #${pr.number}`);
}

async function promoteRelease() {
  ensureTooling();
  ensureCleanWorktree();
  fetchBase();
  ensureTagDoesNotExist(tag);

  const issue = createOrFindIssue(
    releaseTitle,
    issueBody('Promote main to release and publish the GitHub Release.')
  );
  const promotionBranch = createPromotionBranch();
  const pr = createOrFindPr(
    releaseTitle,
    promotionBranch,
    'release',
    prBody(
      issue.number,
      'Promote main to the protected production release branch.'
    )
  );

  waitForPrChecks(pr.number);
  const mergeCommit = mergePr(pr.number, true);
  waitForDeploy('release', mergeCommit);
  await verifyRelease();
  createGithubRelease(tag, mergeCommit);
  closeIssue(issue.number);
  log(`Released ${tag}: https://github.com/${config.repo}/releases/tag/${tag}`);
}

function createPromotionBranch() {
  const branch = config.promotionBranch(version);
  const mainTree = capture('git', ['rev-parse', 'origin/main^{tree}']).trim();
  const commit = capture('git', [
    'commit-tree',
    mainTree,
    '-p',
    'origin/release',
    '-p',
    'origin/main',
    '-m',
    `Promote ${tag} from accepted main`,
  ]).trim();

  run('git', ['checkout', '-B', branch, commit]);
  run('git', ['diff', '--exit-code', 'origin/main', 'HEAD']);
  run('git', ['merge-base', '--is-ancestor', 'origin/release', 'HEAD']);
  run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
  run('git', ['push', '--force-with-lease', '-u', 'origin', branch]);
  return branch;
}

async function verifyRelease() {
  for (const url of config.pageUrls) {
    run('curl', [
      '--fail',
      '--show-error',
      '--silent',
      '--location',
      '--max-time',
      '15',
      '--output',
      '/dev/null',
      url,
    ]);
  }

  for (const url of config.healthUrls) {
    const health = fetchJson(url, 'Health endpoint');
    if (health.status !== 'ok' || health.dependencies?.ai !== 'ok') {
      fail(`Health endpoint or AI dependency is not healthy: ${url}`);
    }
  }

  for (const urls of config.parentReportUrls) {
    const english = fetchJson(urls.en, 'Parent report endpoint');
    const chinese = fetchJson(urls.zh, 'Parent report endpoint');
    validateParentReport(english, urls.en);
    validateParentReport(chinese, urls.zh);
    const fields = ['practiceContent', 'progress', 'attention', 'nextStep'];
    if (
      fields.every(
        (field) => english.data.summary[field] === chinese.data.summary[field]
      )
    ) {
      fail(`English and Chinese parent summaries are identical: ${urls.en}`);
    }
  }
}

function fetchJson(url, label) {
  const response = capture('curl', [
    '--fail',
    '--show-error',
    '--silent',
    '--location',
    '--max-time',
    '15',
    url,
  ]);
  try {
    return JSON.parse(response);
  } catch {
    fail(`${label} did not return valid JSON: ${url}`);
  }
}

function validateParentReport(report, url) {
  const summary = report.data?.summary;
  const fields = ['practiceContent', 'progress', 'attention', 'nextStep'];
  if (
    !summary ||
    !fields.every(
      (field) =>
        typeof summary[field] === 'string' && summary[field].trim().length > 0
    )
  ) {
    fail(`Parent report summary contract is invalid: ${url}`);
  }
}

function parseOptions(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith('--')) continue;
    const key = arg
      .slice(2)
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = rawArgs[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function normalizeVersion(value) {
  if (!value || typeof value !== 'string') {
    fail('Missing --version, for example: --version 0.1.1');
  }
  const normalized = value.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
    fail(`Invalid version "${value}". Use semver like 0.1.1.`);
  }
  return normalized;
}

function ensureTooling() {
  run('git', ['--version']);
  run('gh', ['--version']);
  run('curl', ['--version']);
  run('git', ['config', 'user.name', 'JunchenMeteor'], { allowFail: true });
  run(
    'git',
    ['config', 'user.email', '15767428+JunchenMeteor@users.noreply.github.com'],
    { allowFail: true }
  );
}

function ensureCleanWorktree() {
  const status = capture('git', ['status', '--porcelain']);
  if (status.trim()) fail(`Worktree is not clean:\n${status}`);
}

function fetchBase() {
  run('git', ['fetch', 'origin', 'main', 'release', '--tags']);
}

function ensureTagDoesNotExist(tagName) {
  const existing = capture('git', ['tag', '--list', tagName]).trim();
  if (existing) fail(`Tag ${tagName} already exists.`);
}

function mainAlreadyPrepared(targetVersion) {
  run('git', ['checkout', 'origin/main']);
  return (
    readJson('package.json').version === targetVersion &&
    existsSync(config.releaseDoc(targetVersion))
  );
}

function updateVersionFiles(targetVersion) {
  for (const file of config.versionFiles) {
    if (!existsSync(file)) continue;
    const json = readJson(file);
    json.version = targetVersion;
    if (file.endsWith('package-lock.json') && json.packages?.['']) {
      json.packages[''].version = targetVersion;
    }
    writeJson(file, json);
  }
}

function writeReleaseDoc(targetVersion) {
  const file = config.releaseDoc(targetVersion);
  if (existsSync(file)) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `# Release Notes

Release focus: production promotion for ${config.projectName} ${targetVersion}.

## Highlights

- Promoted validated main branch changes to the production release branch.
- Updated the repository package version to \`${targetVersion}\`.
- Published GitHub Release tag \`v${targetVersion}\`.

## Deployment

- Production branch: \`release\`
- Preview branch: \`main\`
- Production URL: \`https://tankquest.jcmeteor.com/\`
- Preview URL: \`https://tq-pre.jcmeteor.com/\`

## Versioning

- Repository version: \`${targetVersion}\`
- Release tag: \`v${targetVersion}\`

## Validation

\`\`\`bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
\`\`\`
`
  );
}

function createOrFindIssue(title, body) {
  const existing = JSON.parse(
    capture('gh', [
      'issue',
      'list',
      '--repo',
      config.repo,
      '--state',
      'all',
      '--search',
      `${JSON.stringify(title)} in:title`,
      '--json',
      'number,title,state,url',
      '--limit',
      '20',
    ])
  ).find((issue) => issue.title === title);
  if (existing) return existing;

  if (dryRun) return { number: 0, title, url: 'dry-run' };
  const output = capture('gh', [
    'issue',
    'create',
    '--repo',
    config.repo,
    '--title',
    title,
    '--body',
    body,
    '--label',
    config.issueLabel,
  ]);
  return parseIssueUrl(output.trim());
}

function createOrFindPr(title, head, base, body) {
  const existing = JSON.parse(
    capture('gh', [
      'pr',
      'list',
      '--repo',
      config.repo,
      '--state',
      'open',
      '--head',
      head,
      '--base',
      base,
      '--json',
      'number,title,url',
      '--limit',
      '20',
    ])
  ).find((pr) => pr.title === title);
  if (existing) return existing;

  if (dryRun) return { number: 0, title, url: 'dry-run' };
  const output = capture('gh', [
    'pr',
    'create',
    '--repo',
    config.repo,
    '--title',
    title,
    '--body',
    body,
    '--head',
    head,
    '--base',
    base,
  ]);
  return parsePrUrl(output.trim());
}

function waitForPrChecks(number) {
  if (dryRun) return;
  const startedAt = Date.now();
  for (;;) {
    const pr = JSON.parse(
      capture('gh', [
        'pr',
        'view',
        String(number),
        '--repo',
        config.repo,
        '--json',
        'statusCheckRollup',
      ])
    );
    const registered = new Set(
      (pr.statusCheckRollup ?? []).map((check) => check.name)
    );
    const missing = config.requiredPrChecks.filter(
      (check) => !registered.has(check)
    );
    if (missing.length === 0) break;
    if (Date.now() - startedAt > config.checkRegistrationTimeoutMs) {
      fail(
        `Timed out waiting for PR checks to register: ${missing.join(', ')}`
      );
    }
    log(`Waiting for PR checks to register: ${missing.join(', ')}`);
    sleep(5_000);
  }
  run('gh', [
    'pr',
    'checks',
    String(number),
    '--repo',
    config.repo,
    '--watch',
    '--fail-fast',
  ]);
}

function mergePr(number, deleteBranch) {
  if (dryRun) return capture('git', ['rev-parse', 'origin/main']).trim();
  const args = [
    'pr',
    'merge',
    String(number),
    '--repo',
    config.repo,
    '--squash',
  ];
  if (deleteBranch) args.push('--delete-branch');
  run('gh', args);
  const pr = JSON.parse(
    capture('gh', [
      'pr',
      'view',
      String(number),
      '--repo',
      config.repo,
      '--json',
      'mergeCommit',
    ])
  );
  return pr.mergeCommit?.oid ?? '';
}

function waitForDeploy(branch, headSha) {
  if (dryRun) return;
  const startedAt = Date.now();
  for (;;) {
    const runs = JSON.parse(
      capture('gh', [
        'run',
        'list',
        '--repo',
        config.repo,
        '--branch',
        branch,
        '--workflow',
        config.deployWorkflow,
        '--json',
        'databaseId,status,conclusion,headSha,createdAt',
        '--limit',
        '10',
      ])
    );
    const runInfo = runs.find((item) => item.headSha === headSha);
    if (runInfo?.status === 'completed') {
      if (runInfo.conclusion !== 'success') {
        fail(
          `${config.deployWorkflow} failed with conclusion: ${runInfo.conclusion}`
        );
      }
      return;
    }
    if (Date.now() - startedAt > config.deployTimeoutMs) {
      fail(`Timed out waiting for ${config.deployWorkflow}`);
    }
    log(`Waiting for ${config.deployWorkflow} on ${branch}...`);
    sleep(15_000);
  }
}

function createGithubRelease(tagName, target) {
  if (dryRun) return;
  const existing = capture('gh', [
    'release',
    'list',
    '--repo',
    config.repo,
    '--json',
    'tagName',
    '--limit',
    '100',
  ]);
  if (JSON.parse(existing).some((release) => release.tagName === tagName))
    return;
  run('gh', [
    'release',
    'create',
    tagName,
    '--repo',
    config.repo,
    '--target',
    target,
    '--title',
    tagName,
    '--notes-file',
    config.releaseDoc(version),
    '--latest',
  ]);
}

function closeIssue(number) {
  if (dryRun || number === 0) return;
  const issue = JSON.parse(
    capture('gh', [
      'issue',
      'view',
      String(number),
      '--repo',
      config.repo,
      '--json',
      'state',
    ])
  );
  if (issue.state !== 'CLOSED') {
    run('gh', [
      'issue',
      'close',
      String(number),
      '--repo',
      config.repo,
      '--comment',
      `Released ${tag}: https://github.com/${config.repo}/releases/tag/${tag}`,
    ]);
  }
}

function issueBody(summary) {
  return `## Summary

${summary}

## Expected Behavior

The release is promoted from main to release through protected PR checks, deployed to Tencent production, and published as a GitHub Release.

## Proposed Changes

- Update release version files and release notes when needed.
- Promote main to release through a pull request.
- Wait for deployment validation before publishing the GitHub Release.

## Test Plan

- Automated Release Manager PR checks.
- Tencent release deployment workflow.
- Production and preview URL verification.`;
}

function prBody(issueNumber, summary) {
  return `## Summary

${summary}

## Test Plan

- Automated CI, build, security, and deployment checks.
- Release Manager endpoint verification.

Closes #${issueNumber}`;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function exists(file) {
  return existsSync(file);
}

function parseIssueUrl(url) {
  const match = url.match(/issues\/(\d+)/);
  if (!match) fail(`Could not parse issue URL: ${url}`);
  return { number: Number(match[1]), url };
}

function parsePrUrl(url) {
  const match = url.match(/pull\/(\d+)/);
  if (!match) fail(`Could not parse PR URL: ${url}`);
  return { number: Number(match[1]), url };
}

function capture(commandName, commandArgs) {
  return run(commandName, commandArgs, { capture: true });
}

function run(commandName, commandArgs, options = {}) {
  const printable = `${commandName} ${commandArgs.join(' ')}`;
  log(printable);
  if (dryRun && !options.capture && !['git', 'gh'].includes(commandName))
    return '';
  try {
    return execFileSync(commandName, commandArgs, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
  } catch (error) {
    if (options.allowFail) return '';
    const stderr = error.stderr?.toString?.() ?? '';
    fail(`${printable} failed${stderr ? `:\n${stderr}` : ''}`);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function log(message) {
  console.log(`[release-manager] ${message}`);
}

function fail(message) {
  console.error(`[release-manager] ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  node scripts/release-manager.mjs full --version 0.1.1
  node scripts/release-manager.mjs prepare --version 0.1.1
  node scripts/release-manager.mjs promote --version 0.1.1
  node scripts/release-manager.mjs verify --version 0.1.1`);
}
