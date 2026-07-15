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
  - `full`: prepare version files, promote `main` to `release`, wait for Tencent deployment, verify endpoints, and create the GitHub Release.
  - `prepare`: only create and merge the version/release-note PR into `main`.
  - `promote`: create and merge the `main` to `release` PR, deploy, verify production and preview health, and then create the GitHub Release.
  - `verify`: check production and preview pages, API health, and the private AI dependency reported by each API.

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
7. Wait up to 30 minutes for the Tencent release deployment workflow.
8. Verify both pages return successfully and both health payloads report `status=ok` with `dependencies.ai=ok`.
9. Create GitHub Release `v<version>` only after verification succeeds.

The workflow never pushes directly to `main` or `release`.

## Local Recovery

If a run stops after one phase, continue locally or from Actions:

```bash
node scripts/release-manager.mjs prepare --version 0.1.1
node scripts/release-manager.mjs promote --version 0.1.1
node scripts/release-manager.mjs verify --version 0.1.1
```
