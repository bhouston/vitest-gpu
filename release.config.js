import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Packages published to npm. No interdependencies among them, so order doesn't matter.
const packages = [
  'packages/vitest-environment-webgl-node',
  'packages/vitest-environment-webgpu-node',
  'packages/vitest-screenshot',
];

export default {
  branches: ['main'],
  repositoryUrl: 'https://github.com/bhouston/vitest-gpu.git',
  tagFormat: 'v${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    // pkgRoot only (no tarballDir): @anolilab/semantic-release-pnpm's tarballDir option
    // shells out to `pnpm pack <pkgRoot>`, which pnpm silently ignores in favor of packing
    // the cwd -- it would attach the private monorepo root tarball to the GitHub Release
    // instead of each package's own tarball. Pack explicitly below, once all three
    // packages have their final bumped version.
    ...packages.map((path) => ['@anolilab/semantic-release-pnpm', { pkgRoot: path }]),
    {
      // Guards against the failure mode where a computed version was already published
      // (e.g. the tag baseline lagged npm): @anolilab/semantic-release-pnpm treats npm's
      // "cannot publish over previously published version" 403 as "already published,
      // skipping" and the release still reports success. Fail loudly instead.
      verifyRelease: (pluginConfig, { nextRelease }) => {
        for (const path of packages) {
          const { name } = JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'));
          try {
            execFileSync('npm', ['view', `${name}@${nextRelease.version}`, 'version'], {
              stdio: 'pipe',
            });
          } catch {
            // Nonzero exit (e.g. npm's E404) means that version isn't published yet, as expected.
            continue;
          }
          throw new Error(`${name}@${nextRelease.version} is already published on npm.`);
        }
      },
    },
    {
      prepare: () => {
        // Absolute destination: `pnpm --dir <path>` changes pnpm's cwd, so a relative
        // destination would land inside each package instead of the repo-root
        // `release-artifacts` that @semantic-release/github globs for its release assets.
        const tarballDir = resolve('release-artifacts');
        for (const path of packages) {
          execFileSync('pnpm', ['--dir', path, 'pack', '--pack-destination', tarballDir], {
            stdio: 'inherit',
          });
        }
      },
    },
    [
      '@semantic-release/github',
      {
        assets: ['release-artifacts/*.tgz'],
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
