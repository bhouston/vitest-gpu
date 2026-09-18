# Release setup and operation

This monorepo publishes three npm packages from `packages/`:
`vitest-environment-webgl-node`, `vitest-environment-webgpu-node` and `vitest-screenshot`.
`pnpm release` runs `semantic-release -e semantic-release-monorepo` in each package. The
monorepo plugin filters commits to those touching the package's directory and uses the tag
format `<package>-v<version>`, so packages version independently.

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
`GITHUB_TOKEN` creates tags and GitHub Releases. The first publish of a new package cannot use
trusted publishing; publish `0.1.0` once manually with `npm publish --access public` from the
package directory, then configure the trusted publisher.

## GitHub configuration

Keep `main` as the sole integration branch. Enable merge commits and disable squash merges
(PRs are merged with merge commits, never squashed). Protect `main` with required PRs
and the required checks `Quality (macos-latest)`, `Quality (ubuntu-latest)` and `PR policy`.
Repository rules must allow the Actions token to create `*-v*` tags.

The `Release` workflow runs only through `workflow_dispatch` on `main`:
`gh workflow run release.yml --ref main` (`-f dry_run=true` to validate without publishing).

## Version baseline

Packages start at `0.0.0` with no tags. The first release of each package will be computed
by semantic-release from its commits; a `feat` commit yields `1.0.0`. To start lower, create a
baseline tag such as `vitest-screenshot-v0.1.0` on the commit that was manually published.

## Recovery

If npm succeeded but GitHub release creation failed, recover the GitHub release from the existing
tag; never republish the same npm version.
