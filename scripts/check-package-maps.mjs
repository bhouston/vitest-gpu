import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

const workspace = process.cwd();
const packagesDirectory = join(workspace, 'packages');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'vitest-gpu-package-maps-'));

const findFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findFiles(path) : [path];
  });

try {
  const packageDirectories = readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(packagesDirectory, entry.name, 'package.json')))
    .map((entry) => join(packagesDirectory, entry.name));

  for (const packageDirectory of packageDirectories) {
    const packageName = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8')).name;
    const archiveDirectory = join(temporaryDirectory, packageName);
    mkdirSync(archiveDirectory);
    const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', archiveDirectory], {
      cwd: packageDirectory,
      encoding: 'utf8',
    });
    assert.equal(packed.status, 0, packed.stderr || packed.stdout);

    const [{ filename }] = JSON.parse(packed.stdout);
    const extracted = spawnSync('tar', ['-xzf', join(archiveDirectory, filename), '-C', archiveDirectory], {
      encoding: 'utf8',
    });
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);

    const packageRoot = join(archiveDirectory, 'package');
    const files = findFiles(packageRoot);
    const relativeFiles = files.map((file) => relative(packageRoot, file).split(sep).join('/'));
    assert(
      relativeFiles.some((file) => /^src\/.+\.ts$/.test(file)),
      `${packageName} contains no TypeScript sources`,
    );
    assert(
      relativeFiles.every(
        (file) =>
          !file.includes('.test.') &&
          !file.includes('/__snapshots__/') &&
          !file.startsWith('demo/') &&
          !/(^|\/)(?:vitest|tsconfig|release\.config)(?:\.|$)/.test(file),
      ),
      `${packageName} contains development-only files`,
    );

    const maps = files.filter((file) => file.endsWith('.js.map') || file.endsWith('.d.ts.map'));
    assert(maps.length > 0, `${packageName} contains no JavaScript or declaration maps`);
    for (const mapPath of maps) {
      const map = JSON.parse(readFileSync(mapPath, 'utf8'));
      assert(map.sources.length > 0, `${relative(packageRoot, mapPath)} contains no source references`);
      for (const source of map.sources) {
        const sourcePath = resolve(dirname(mapPath), map.sourceRoot ?? '', source);
        assert(
          sourcePath.startsWith(`${packageRoot}${sep}`) && existsSync(sourcePath),
          `${packageName}/${relative(packageRoot, mapPath)} has missing source ${source}`,
        );
      }
    }

    console.log(`${packageName}: verified ${maps.length} maps across ${relativeFiles.length} packed files`);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
