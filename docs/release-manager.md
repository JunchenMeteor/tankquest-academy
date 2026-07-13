# Release Manager

TankQuest Academy uses `Release Manager` to run the release flow from one manual GitHub Actions entry while preserving the protected branch model.

## Entry Point

Open:

```text
GitHub -> Actions -> Release Manager -> Run workflow
```

Inputs:

- `version`: semantic version without the `v` prefix, for example `0.1.1`.
- `action`:
  - `full`: prepare version files, promote `main` to `release`, wait for Tencent deployment, verify endpoints, and create the GitHub Release.
  - `prepare`: only create and merge the version/release-note PR into `main`.
  - `promote`: only create and merge the `main` to `release` PR, deploy, and create the GitHub Release.
  - `verify`: only check production and preview Web/API endpoints.

## Required Secret

Configure repository secret `RELEASE_MANAGER_TOKEN` with a fine-grained GitHub token that can read and write contents, issues, pull requests, actions, checks, and releases for this repository.

The workflow falls back to `GITHUB_TOKEN` if the secret is missing. GitHub may not trigger follow-up workflows for branches pushed by `GITHUB_TOKEN`, so unattended `full` releases require `RELEASE_MANAGER_TOKEN`. Use `prepare` and `promote` separately for recovery.

## Full Release Flow

1. Confirm tag `v<version>` does not already exist.
2. Create or reuse a release tracking issue.
3. Create a preparation branch from `origin/main`.
4. Update root package versions and create `docs/releases/v<version>.md`.
5. Open a PR into `main`, wait for checks, and squash merge it.
6. Open a PR from `main` into `release`, wait for checks, and squash merge it.
7. Wait for the Tencent release deployment workflow.
8. Create GitHub Release `v<version>`.
9. Verify the public Web and API endpoints.

The workflow never pushes directly to `main` or `release`.

## Local Recovery

If a run stops after one phase, continue locally or from Actions:

```bash
node scripts/release-manager.mjs prepare --version 0.1.1
node scripts/release-manager.mjs promote --version 0.1.1
node scripts/release-manager.mjs verify --version 0.1.1
```
