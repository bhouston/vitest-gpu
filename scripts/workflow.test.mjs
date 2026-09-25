import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import config from '../release.config.js';
import { checkPullRequest } from './check-pr.mjs';

const valid = { base: { ref: 'main' }, body: 'Closes #42' };
for (const [name, overrides, passes] of [
  ['implementation', {}, true],
  ['missing issue', { body: '' }, false],
  ['wrong target branch', { base: { ref: 'dev' } }, false],
]) {
  test(`PR policy: ${name}`, () => {
    const pr = { ...valid, ...overrides };
    if (passes) assert.doesNotThrow(() => checkPullRequest(pr));
    else assert.throws(() => checkPullRequest(pr));
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
