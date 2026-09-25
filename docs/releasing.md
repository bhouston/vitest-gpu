# Release setup and operation

This monorepo publishes three npm packages from `packages/`:
`vitest-environment-webgl-node`, `vitest-environment-webgpu-node` and `vitest-screenshot`.
They share a single version stream: `pnpm release` runs `semantic-release` once at the repo
root, which computes one next version from all commits since the last `v<version>` tag and
publishes all three packages at that version together (via `@anolilab/semantic-release-pnpm`,
one instance per package). If there are no releasable changes, nothing publishes.

## npm trusted publisher

On npm, for **each** package open Settings → Trusted publishing, choose GitHub Actions and enter:

| Field                | Value         |
| -------------------- | ------------- |
| Organization or user | `bhouston`    |
| Repository           | `vitest-gpu`  |
| Workflow filename    | `release.yml` |
| Environment          | Leave blank   |

The workflow runs on GitHub-hosted Ubuntu with `id-token: write` and uses the Node version in
`.nvmrc`. Do not add `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or `registry-url` to setup-node. The built-in
`GITHUB_TOKEN` creates tags and GitHub Releases. Each package has already published under its
prior per-package versioning, so trusted publishing is already configured; nothing new to set up
per package for the switch to a shared version.

## GitHub configuration

Keep `main` as the sole integration branch. Enable merge commits and disable squash merges
(PRs are merged with merge commits, never squashed). Protect `main` with required PRs
and the required checks `ci (macos-latest, Node 22)`, `ci (macos-latest, Node 26)`, `ci (ubuntu-latest, Node 22)`,
`ci (ubuntu-latest, Node 26)` and `pr-policy / contribution`.
Repository rules must allow the Actions token to create `v*` tags.

The `Release` workflow runs only through `workflow_dispatch` on `main`:
`gh workflow run release.yml --ref main` (`-f dry_run=true` to validate without publishing).

## Version baseline

All three packages now share one version, seeded from the highest of their prior independent
versions (`vitest-environment-webgl-node@1.0.1`, `vitest-environment-webgpu-node@2.0.1`,
`vitest-screenshot@1.1.0`): **2.0.1**. Every package.json's `version` field is set to `2.0.1` in
source as the baseline; the tag format is `v<version>` (not the old `<package>-v<version>`).

**Before the first release under this scheme, the maintainer must push the baseline tag:**

```sh
git tag v2.0.1 <sha-of-the-commit-that-set-version-to-2.0.1>
git push origin v2.0.1
```

Without it, semantic-release has no `v*` tag to compute the next version from and will treat the
whole commit history as unreleased. semantic-release does not bump `package.json` in git; it sets
the version on disk during the release job only, immediately before packing/publishing.

## Recovery

If npm succeeded but GitHub release creation failed, recover the GitHub release from the existing
tag; never republish the same npm version.
