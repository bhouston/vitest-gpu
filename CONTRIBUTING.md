# Contributing

This is the single workflow standard for human contributors, Claude, and Codex.

## Issue, branch, implementation, PR

1. Before starting a feature or other change, open a GitHub issue (or reuse the
   existing issue). Use the feature template: description and motivation,
   acceptance criteria, and constraints. Agents should create the issue with
   `gh issue create`, supplying the same sections in the body.
2. Fetch `origin` and branch from `origin/main`. Name the branch
   `<type>/<issue-number>-<short-description>`, for example
   `feat/42-batch-export`. Never commit directly to `main`.
3. Implement the issue and add appropriate tests. Preserve unrelated local work.
4. Use Conventional Commits for every commit. Husky runs commitlint locally.
   Format: `type(optional-scope): description`. Use `feat` for a minor release,
   `fix` or `perf` for a patch, and `!` or a `BREAKING CHANGE:` footer for a major
   release. Other allowed types are `docs`, `chore`, `refactor`, `test`, `style`,
   `build`, `ci`, and `revert`; these ordinarily do not release. Reference the issue
   in the body when useful. Do not manually edit the version or release notes.
5. Run `pnpm lint`, `pnpm tsc`, `pnpm test --coverage`,
   `pnpm audit --audit-level=high`, and `pnpm package:check`.
   Install with `pnpm install --frozen-lockfile` using the Node version in
   `.nvmrc`. Coverage must be at least 95% for statements, branches, functions,
   and lines. The native GPU packages are real dependencies, so tests need a
   GPU or a software rasterizer (Metal on macOS, Mesa llvmpipe on Linux).
6. Push and open a PR **against `main`**, with a Conventional Commit title,
   a description of the final behavior, validation results, and `Closes #42`
   referencing the branch's issue number. Agents should use
   `gh pr create --base main --body-file <file>`. Mark incomplete work as draft.
7. PRs are merged into `main` with merge commits; do not squash or rebase-merge.
   Every commit on the branch lands on `main`, so each must be a valid
   Conventional Commit. Prefer `!` in the commit and PR titles for breaking
   changes. CI validates PR titles as Conventional Commits.

PR checks mechanically verify the base branch, issue-numbered branch name,
closing reference, and commit title. They cannot verify that an issue was opened
before work started; contributors remain responsible for this sequence.
Merging a PR closes its issue but does not publish a release.

## Controlled releases

Merges to `main` never publish by themselves. When ready to release, the
maintainer manually dispatches the `Release` workflow on `main`:
`gh workflow run release.yml --ref main`. It repeats all quality gates before
semantic-release computes the next version, generates the changelog, tags the
release, publishes to npm with OIDC, and creates a GitHub Release. Each package under
`packages/` is released independently by `semantic-release-monorepo`, which only
considers commits touching that package and tags as `<package>-v<version>`. If there
are no releasable changes, it publishes nothing. Generated versions and
changelogs are release artifacts; the source package version is not bumped by
the release bot. Pass `-f dry_run=true` to validate a release without
publishing. See [release setup](docs/releasing.md) for npm and GitHub
configuration, the initial tag baseline, and rollout to other repositories.

Do not run `pnpm release` or `npm publish` locally as part of normal development.
