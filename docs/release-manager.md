# TankQuest Release Manager

TankQuest Academy uses `TankQuest Release Manager` to run the release flow from one manual GitHub Actions entry while preserving the protected branch model.

## Entry Point

Open:

```text
GitHub -> Actions -> TankQuest Release Manager -> Run workflow
```

Inputs:

- `version`: semantic version without the `v` prefix, for example `0.1.1`.
- `action`:
  - `full`: prepare version files, promote `main` to `release`, wait for Tencent deployment, verify public contracts, and create the GitHub Release.
  - `prepare`: only create and merge the version/release-note PR into `main`.
  - `promote`: create and merge the `main` to `release` PR, deploy, verify production and preview contracts, and then create the GitHub Release.
  - `verify`: check production and preview pages, API/AI health, parent reports, PWA cache policy, and versioned asset manifest bytes.

## Required Secret

Configure repository secret `RELEASE_MANAGER_TOKEN` with a fine-grained GitHub token that can read and write contents, issues, pull requests, actions, checks, and releases for this repository.

The workflow falls back to `GITHUB_TOKEN` if the secret is missing. GitHub may not trigger follow-up workflows for branches pushed by `GITHUB_TOKEN`, so unattended `full` releases require `RELEASE_MANAGER_TOKEN`. Use `prepare` and `promote` separately for recovery.

## Full Release Flow

1. Confirm tag `v<version>` does not already exist.
2. Create or reuse a release tracking issue.
3. Create a preparation branch from `origin/main`.
4. Update root/desktop npm, Cargo, Tauri, Service Worker cache versions and create `docs/releases/v<version>.md`.
5. Open a PR into `main`, wait for checks, and squash merge it.
6. Create a dedicated promotion branch whose parents include the current `release` and accepted `main`, while its file tree exactly matches `main`.
7. Open a PR from the promotion branch into `release`, wait for fresh Verify and all three runtime container checks to register and pass, and squash merge it.
8. Wait up to 30 minutes for the Tencent release deployment workflow. The deployment script verifies the same contracts through the local host port before declaring success, and restores the previous deployment if they fail.
9. Verify both home/parent pages return successfully, both health payloads report `status=ok` with `dependencies.ai=ok`, and both environments return non-empty English/Chinese parent summaries.
10. Verify the Web App Manifest and versioned PNG icons, require `sw.js` to return `no-cache, no-store, must-revalidate`, and download every public asset-manifest entry to compare its size and SHA-256.
11. Create GitHub Release `v<version>` only after verification succeeds.

The workflow never pushes directly to `main` or `release`. The dedicated promotion branch prevents squash-history conflicts while the exact-tree check ensures production receives the accepted `main` contents.

## Local Recovery

If a run stops after one phase, continue locally or from Actions:

```bash
node scripts/release-manager.mjs prepare --version 0.1.1
node scripts/release-manager.mjs promote --version 0.1.1
node scripts/release-manager.mjs verify --version 0.1.1
npm run release-version:verify
```

To run the deployment contract probe directly against one or more environments:

```bash
node scripts/verify-public-deployment.mjs https://tq-pre.jcmeteor.com https://tankquest.jcmeteor.com
```
