import assert from 'node:assert/strict';

const { PR_BASE, PR_HEAD, PR_BODY = '', PR_HEAD_REPO, PR_REPO } = process.env;
assert.equal(PR_BASE, 'main', 'PRs must target main.');
assert.equal(PR_HEAD_REPO, PR_REPO, 'PRs must come from this repository, not a fork.');
const match =
  /^(?:feat|feature|fix|docs|chore|refactor|test|perf|build|ci|style|revert)\/(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(
    PR_HEAD ?? '',
  );
assert(match, 'Name the branch <type>/<issue-number>-<short-description>.');
assert(
  new RegExp(`\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#${match[1]}\\b`, 'i').test(PR_BODY),
  `PR description must include Closes #${match[1]}.`,
);
console.log('PR policy passed.');
