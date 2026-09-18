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

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'screenshot-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('writes a missing baseline outside CI, then matches it', () => {
  const ci = process.env.CI;
  delete process.env.CI;
  try {
    expect(solid(2, 2, [255, 0, 0, 255])).toMatchScreenshot('red', { baselineDir: dir });
    expect(existsSync(join(dir, 'red.png'))).toBe(true);
    expect(solid(2, 2, [255, 0, 0, 255])).toMatchScreenshot('red', { baselineDir: dir });
  } finally {
    if (ci !== undefined) process.env.CI = ci;
  }
});

it('fails on a missing baseline in CI', () => {
  process.env.CI = '1';
  expect(() => expect(solid(1, 1, [0, 0, 0, 255])).toMatchScreenshot('none', { baselineDir: dir })).toThrow(
    /missing baseline/,
  );
});

it('fails past the diff ratio and writes actual and diff PNGs', () => {
  expect(solid(4, 4, [0, 0, 0, 255])).toMatchScreenshot('black', { baselineDir: dir, update: true });
  expect(solid(4, 4, [0, 0, 0, 255])).toMatchScreenshot('black', { baselineDir: dir });
  expect(() => expect(solid(4, 4, [255, 255, 255, 255])).toMatchScreenshot('black', { baselineDir: dir })).toThrow(
    /16 pixels \(100.000%\) differ/,
  );
  expect(readdirSync(dir).toSorted()).toEqual(['black.actual.png', 'black.diff.png', 'black.png']);
  expect(solid(4, 4, [255, 255, 255, 255])).toMatchScreenshot('black', { baselineDir: dir, maxDiffRatio: 1 });
});

it('fails on a size mismatch', () => {
  expect(solid(2, 2, [0, 0, 0, 255])).toMatchScreenshot('sz', { baselineDir: dir, update: true });
  expect(() => expect(solid(1, 2, [0, 0, 0, 255])).toMatchScreenshot('sz', { baselineDir: dir })).toThrow(
    /size mismatch: baseline 2x2, actual 1x2/,
  );
});

it('defaults the baseline dir to __screenshots__ beside the test file', () => {
  process.env.UPDATE_SCREENSHOTS = '1';
  try {
    expect(solid(1, 1, [0, 255, 0, 255])).toMatchScreenshot('default-dir');
  } finally {
    delete process.env.UPDATE_SCREENSHOTS;
  }
  const file = join(import.meta.dirname, '__screenshots__', 'default-dir.png');
  expect(existsSync(file)).toBe(true);
  rmSync(join(import.meta.dirname, '__screenshots__'), { recursive: true, force: true });
});
