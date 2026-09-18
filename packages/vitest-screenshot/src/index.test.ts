import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { extendMatchers, type RgbaImage } from './index.ts';

extendMatchers();

const solid = (w: number, h: number, rgba: number[]): RgbaImage => ({
  width: w,
  height: h,
  data: new Uint8ClampedArray(Array.from({ length: w * h }, () => rgba).flat()),
});
const red = solid(2, 2, [255, 0, 0, 255]);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'screenshot-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const withoutCi = async (fn: () => Promise<void>) => {
  const ci = process.env.CI;
  delete process.env.CI;
  try {
    await fn();
  } finally {
    if (ci !== undefined) process.env.CI = ci;
  }
};

it('writes a missing baseline outside CI, then matches it', () =>
  withoutCi(async () => {
    await expect(red).toMatchScreenshot('red.png', { baselineDir: dir });
    expect(existsSync(join(dir, 'red.png'))).toBe(true);
    await expect(red).toMatchScreenshot('red.png', { baselineDir: dir });
  }));

it('fails on a missing baseline in CI', async () => {
  process.env.CI = '1';
  await expect(expect(red).toMatchScreenshot('none.png', { baselineDir: dir })).rejects.toThrow(/missing baseline/);
});

it('requires an extension on a reference path', async () => {
  await expect(expect(red).toMatchScreenshot('knot', { baselineDir: dir })).rejects.toThrow(
    /"knot" needs an image extension, e.g. "knot.png"/,
  );
});

it.each(['png', 'jpg', 'gif', 'webp'])('round-trips a %s baseline', async (ext) => {
  const image = solid(8, 8, [0, 128, 255, 255]);
  await expect(image).toMatchScreenshot(`blue.${ext}`, { baselineDir: dir, update: true });
  await expect(image).toMatchScreenshot(`blue.${ext}`, { baselineDir: dir, maxDiffRatio: 0.05 });
  await expect(expect(red).toMatchScreenshot(`blue.${ext}`, { baselineDir: dir })).rejects.toThrow(/size mismatch/);
});

it('accepts an absolute reference path', async () => {
  const file = join(dir, 'nested', 'abs.png');
  await expect(red).toMatchScreenshot(file, { update: true });
  await expect(red).toMatchScreenshot(file);
});

it('fails past the diff ratio and writes actual and diff PNGs', async () => {
  const black = solid(4, 4, [0, 0, 0, 255]);
  const white = solid(4, 4, [255, 255, 255, 255]);
  await expect(black).toMatchScreenshot('black.webp', { baselineDir: dir, update: true });
  await expect(black).toMatchScreenshot('black.webp', { baselineDir: dir });
  await expect(expect(white).toMatchScreenshot('black.webp', { baselineDir: dir })).rejects.toThrow(
    /16 pixels \(100.000%\) differ/,
  );
  expect(readdirSync(dir).toSorted()).toEqual(['black.actual.png', 'black.diff.png', 'black.webp']);
  await expect(white).toMatchScreenshot('black.webp', { baselineDir: dir, maxDiffRatio: 1 });
});

it('compares against in-memory references and names diff files after the test', async () => {
  await expect(red).toMatchScreenshot(red, { baselineDir: dir });
  await expect(expect(red).toMatchScreenshot(solid(2, 2, [0, 0, 0, 255]), { baselineDir: dir })).rejects.toThrow(
    /4 pixels \(100.000%\) differ/,
  );
  await expect(expect(red).toMatchScreenshot(solid(1, 2, [0, 0, 0, 255]), { baselineDir: dir })).rejects.toThrow(
    /size mismatch: baseline 1x2, actual 2x2/,
  );
  expect(readdirSync(dir).toSorted()).toEqual([
    'compares_against_in-memory_references_and_names_diff_files_after_the_test.actual.png',
    'compares_against_in-memory_references_and_names_diff_files_after_the_test.diff.png',
  ]);
});

it('reads pixels from canvas-like and image-like sources', async () => {
  const webgpuCanvas = { readPixels: async () => red };
  const webglCanvas = { getImageData: () => red };
  const image = { decode: async () => {}, _toRGBA8: () => red };
  await expect(webgpuCanvas).toMatchScreenshot(webglCanvas, { baselineDir: dir });
  await expect(image).toMatchScreenshot(webgpuCanvas, { baselineDir: dir });
  await expect(expect({ decode: async () => {} }).toMatchScreenshot(red, { baselineDir: dir })).rejects.toThrow(
    /unsupported image source/,
  );
});

it('defaults the baseline dir to __screenshots__ beside the test file', async () => {
  process.env.UPDATE_SCREENSHOTS = '1';
  try {
    await expect(solid(1, 1, [0, 255, 0, 255])).toMatchScreenshot('default-dir.png');
  } finally {
    delete process.env.UPDATE_SCREENSHOTS;
  }
  const file = join(import.meta.dirname, '__screenshots__', 'default-dir.png');
  expect(existsSync(file)).toBe(true);
  rmSync(join(import.meta.dirname, '__screenshots__'), { recursive: true, force: true });
});
