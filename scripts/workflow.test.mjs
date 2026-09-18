import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import config from '../release.config.js';

const valid = {
  PR_BASE: 'main',
  PR_HEAD: 'feat/42-export',
  PR_BODY: 'Closes #42',
  PR_HEAD_REPO: 'owner/repo',
  PR_REPO: 'owner/repo',
};
for (const [name, overrides, passes] of [
  ['implementation', {}, true],
  ['wrong issue', { PR_BODY: 'Closes #420' }, false],
  ['missing issue', { PR_BODY: '' }, false],
  ['unnumbered branch', { PR_HEAD: 'feat/export' }, false],
  ['wrong target branch', { PR_BASE: 'dev' }, false],
  ['fork PR', { PR_HEAD_REPO: 'fork/repo' }, false],
]) {
  test(`PR policy: ${name}`, () => {
    const result = spawnSync(process.execPath, ['scripts/check-pr-policy.mjs'], {
      env: { ...process.env, ...valid, ...overrides },
      encoding: 'utf8',
    });
    assert.equal(result.status === 0, passes, result.stderr);
  });
}

for (const [message, expected] of [
  ['fix: handle empty output', 'patch'],
  ['feat: add export', 'minor'],
  ['feat!: remove old API', 'major'],
  ['fix: change API\n\nBREAKING CHANGE: remove legacy arguments', 'major'],
  ['chore: update workflow', null],
]) {
  test(`release analysis: ${message.split('\n')[0]}`, async () => {
    const actual = await analyzeCommits(config.plugins[0][1], {
      cwd: process.cwd(),
      commits: [{ hash: 'test', message }],
      logger: { log() {} },
    });
    assert.equal(actual, expected);
  });
}

test('release branch is only main', () => assert.deepEqual(config.branches, ['main']));
