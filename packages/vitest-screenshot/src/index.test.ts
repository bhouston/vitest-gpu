import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Comparator, extendMatchers, pixelmatchComparator, type RgbaImage } from './index.js';
import { distortion, metricsComparator, ssim } from './metrics.js';

declare module './index.js' {
  interface ComparatorRegistry {
    'top-left': { tolerance?: number };
    silent: Record<string, unknown>;
  }
}

extendMatchers();

const solid = (w: number, h: number, rgba: number[]): RgbaImage => ({
  width: w,
  height: h,
  data: new Uint8ClampedArray(Array.from({ length: w * h }, () => rgba).flat()),
});
const red = solid(2, 2, [255, 0, 0, 255]);

/** Deterministic 32x24 fixtures; the ImageMagick values below were produced from these with `magick compare -metric`. */
const image = (f: (x: number, y: number) => number[]): RgbaImage => {
  const width = 32;
  const height = 24;
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++)
    data.set(
      f(p % width, Math.floor(p / width)).map((v) => Math.max(0, Math.min(255, v))),
      p * 4,
    );
  return { width, height, data };
};
let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const base = image((x, y) => [x * 8, y * 10, (x * y) & 255, 255]);
const noisy = image((x, y) => [
  x * 8 + Math.floor(rnd() * 20) - 10,
  y * 10 + Math.floor(rnd() * 6) - 3,
  ((x * y) & 255) + (rnd() < 0.1 ? 40 : 0),
  255,
]);
const alphaA = image((x, y) => [x * 8, 200, 50, 100 + y * 5]);
const alphaB = image((x, y) => [x * 8 + 7, 190, 60, 110 + y * 5]);

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

it.each([
  ['existing file', 'existing.png', false],
  ['existing file in update mode', 'existing.png', true],
  ['missing file', 'missing.png', false],
  ['missing file in update mode', 'missing.png', true],
  ['in-memory baseline', 'memory', false],
  ['in-memory baseline in update mode', 'memory', true],
] as const)('rejects negation before reading pixels or writing baselines: %s', async (_name, kind, update) => {
  await expect(red).toMatchScreenshot('existing.png', { baselineDir: dir, update: true });
  const actualRead = vi.fn().mockResolvedValue(red);
  const baselineRead = vi.fn().mockResolvedValue(red);
  const reference = kind === 'memory' ? { readPixels: baselineRead } : kind;

  await expect(
    expect({ readPixels: actualRead }).not.toMatchScreenshot(reference, { baselineDir: dir, update }),
  ).rejects.toThrow('`.not.toMatchScreenshot()` is not supported');
  expect(actualRead).not.toHaveBeenCalled();
  expect(baselineRead).not.toHaveBeenCalled();
  expect(readdirSync(dir)).toEqual(['existing.png']);
});

it('requires an extension on a reference path', async () => {
  await expect(expect(red).toMatchScreenshot('knot', { baselineDir: dir })).rejects.toThrow(
    /"knot" needs an image extension, e.g. "knot.png"/,
  );
});

it.each(['png', 'jpg', 'gif', 'webp'])('round-trips a %s baseline', async (ext) => {
  const blue = solid(8, 8, [0, 128, 255, 255]);
  await expect(blue).toMatchScreenshot(`blue.${ext}`, { baselineDir: dir, update: true });
  await expect(blue).toMatchScreenshot(`blue.${ext}`, {
    baselineDir: dir,
    comparatorOptions: { allowedMismatchedPixelRatio: 0.05 },
  });
  await expect(expect(red).toMatchScreenshot(`blue.${ext}`, { baselineDir: dir })).rejects.toThrow(/size mismatch/);
});

it('accepts an absolute reference path', async () => {
  const file = join(dir, 'nested', 'abs.png');
  await expect(red).toMatchScreenshot(file, { update: true });
  await expect(red).toMatchScreenshot(file);
});

describe('pixelmatch comparator', () => {
  const black = solid(4, 4, [0, 0, 0, 255]);
  const white = solid(4, 4, [255, 255, 255, 255]);

  it('allows no mismatched pixels by default and writes actual and diff PNGs', async () => {
    await expect(black).toMatchScreenshot('black.webp', { baselineDir: dir, update: true });
    await expect(black).toMatchScreenshot('black.webp', { baselineDir: dir });
    await expect(expect(white).toMatchScreenshot('black.webp', { baselineDir: dir })).rejects.toThrow(
      /16 pixels \(100.000%\) differ, 0 allowed; see .*black.diff.png/,
    );
    expect(readdirSync(dir).toSorted()).toEqual(['black.actual.png', 'black.diff.png', 'black.webp']);
  });

  it('takes the stricter of allowedMismatchedPixelRatio and allowedMismatchedPixels', async () => {
    const opts = { baselineDir: dir };
    await expect(white).toMatchScreenshot(black, { ...opts, comparatorOptions: { allowedMismatchedPixelRatio: 1 } });
    await expect(white).toMatchScreenshot(black, { ...opts, comparatorOptions: { allowedMismatchedPixels: 16 } });
    await expect(
      expect(white).toMatchScreenshot(black, {
        ...opts,
        comparatorOptions: { allowedMismatchedPixelRatio: 1, allowedMismatchedPixels: 15 },
      }),
    ).rejects.toThrow(/16 pixels \(100.000%\) differ, 15 allowed/);
    await expect(
      expect(white).toMatchScreenshot(black, {
        ...opts,
        comparatorOptions: { allowedMismatchedPixelRatio: 0.5, allowedMismatchedPixels: 16 },
      }),
    ).rejects.toThrow(/8 allowed/);
  });

  it('forwards pixelmatch options', async () => {
    const grey = solid(4, 4, [8, 8, 8, 255]);
    await expect(
      expect(grey).toMatchScreenshot(black, { baselineDir: dir, comparatorOptions: { threshold: 0 } }),
    ).rejects.toThrow(/16 pixels/);
    await expect(grey).toMatchScreenshot(black, { baselineDir: dir, comparatorOptions: { threshold: 0.5 } });
  });
});

const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 5);

describe('metrics comparator', () => {
  it('matches magick compare for PAE, MAE, MSE, RMSE and PSNR', () => {
    const m = distortion(base, noisy, 0);
    close(m.PAE, 0.156863);
    close(m.MAE, 0.0104154);
    close(m.MSE, 0.000770902);
    close(m.RMSE, 0.0277651);
    expect(m.PSNR).toBeCloseTo(31.13, 2);
    const a = distortion(alphaA, alphaB, 0);
    close(a.PAE, 0.0623606);
    close(a.MAE, 0.0289312);
    close(a.MSE, 0.00106443);
    close(a.RMSE, 0.0326257);
    expect(a.PSNR).toBeCloseTo(29.7288, 3);
  });

  it('counts AE within fuzz like ImageMagick, including the alpha cone', () => {
    expect(distortion(base, noisy, 0).AE).toBe(760);
    expect(distortion(base, noisy, 0.05).AE).toBe(79); // only the +40 blue spikes exceed 5%
    expect(distortion(alphaA, alphaB, 0).AE).toBe(768);
    expect(distortion(alphaA, alphaB, 0.05).AE).toBe(0); // alpha differs by 10/255 and colour by less, all scaled by alpha
    const clear = solid(1, 1, [255, 0, 0, 0]);
    expect(distortion(clear, solid(1, 1, [0, 0, 255, 0]), 0).AE).toBe(0); // fully transparent pixels always match
    expect(distortion(clear, solid(1, 1, [0, 0, 255, 255]), 0.5).AE).toBe(1); // alpha itself is out of fuzz
  });

  it('is exact on identical images', () => {
    const m = distortion(base, base, 0);
    expect(m).toMatchObject({ AE: 0, PAE: 0, MAE: 0, MSE: 0, RMSE: 0, PSNR: Infinity });
    expect(ssim(base, base)).toBe(1);
  });

  it('drops SSIM with noise and with structure lost', () => {
    const s = ssim(base, noisy);
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThan(1);
    expect((1 - s) / 2).toBeCloseTo(0.032717, 5); // magick compare -metric SSIM prints (1 - SSIM) / 2 for RGB images
    expect(ssim(base, solid(32, 24, [128, 128, 128, 255]))).toBeLessThan(0.3);
  });

  it('requires an exact match by default and reports every metric', async () => {
    const opts = { baselineDir: dir, comparatorName: 'metrics' } as const;
    await expect(base).toMatchScreenshot(base, opts);
    await expect(expect(noisy).toMatchScreenshot(base, opts)).rejects.toThrow(
      /AE 760 \(fuzz 0\), PAE 0.1569, MAE 0.01042, MSE 0.0007709, RMSE 0.02777, PSNR 31.13; failed: AE 760 > 0; see/,
    );
    expect(readdirSync(dir).toSorted()).toEqual([
      'metrics_comparator_requires_an_exact_match_by_default_and_reports_every_metric.actual.png',
      'metrics_comparator_requires_an_exact_match_by_default_and_reports_every_metric.diff.png',
    ]);
  });

  it('checks every given bound and names the failing ones', async () => {
    const opts = { baselineDir: dir, comparatorName: 'metrics' } as const;
    await expect(noisy).toMatchScreenshot(base, {
      ...opts,
      comparatorOptions: { fuzz: 0.05, AE: 79, PSNR: 31, SSIM: 0.9 },
    });
    await expect(
      expect(noisy).toMatchScreenshot(base, {
        ...opts,
        comparatorOptions: { PAE: 0.1, PSNR: 40, SSIM: 0.99, MAE: 0.02 },
      }),
    ).rejects.toThrow(/SSIM 0.9346, DSSIM 0.03272; failed: PAE 0.1569 > 0.1, PSNR 31.13 < 40, SSIM 0.9346 < 0.99; see/);
    await expect(
      expect(noisy).toMatchScreenshot(base, { ...opts, comparatorOptions: { DSSIM: 0.01, MSE: 1, RMSE: 1 } }),
    ).rejects.toThrow(/failed: DSSIM 0.03272 > 0.01; see/);
  });

  it('rejects unknown metrics', () => {
    expect(() => metricsComparator(base, base, { createDiff: false, NCC: 1 } as never)).toThrow(/unknown metric "NCC"/);
  });
});

it('comparators skip the diff image when createDiff is false', () => {
  expect(pixelmatchComparator(red, red, { createDiff: false, allowedMismatchedPixelRatio: 0 })).toEqual({
    pass: true,
    diff: null,
    message: '0 pixels (0.000%) differ, 0 allowed',
  });
  expect(metricsComparator(red, red, { createDiff: false }).diff).toBeNull();
});

/** A comparator with no message of its own: the matcher then reports plain 'matches' / 'differs'. */
const silent: Comparator = (reference, actual) => ({
  pass: reference.data[0] === actual.data[0],
  diff: null,
  message: null,
});

describe('configuration', () => {
  it('applies global comparator defaults only to that comparator, per-call options winning', async () => {
    extendMatchers({ comparatorName: 'metrics', comparatorOptions: { PSNR: 30 } });
    try {
      await expect(noisy).toMatchScreenshot(base, { baselineDir: dir });
      await expect(
        expect(noisy).toMatchScreenshot(base, { baselineDir: dir, comparatorOptions: { PSNR: 40 } }),
      ).rejects.toThrow(/PSNR 31.13 < 40/);
      await expect(
        expect(red).toMatchScreenshot(solid(2, 2, [0, 0, 0, 255]), { baselineDir: dir, comparatorName: 'pixelmatch' }),
      ).rejects.toThrow(/4 pixels .* differ, 0 allowed/); // metrics defaults do not leak into pixelmatch
    } finally {
      extendMatchers();
    }
  });

  it("runs custom comparators with Vitest's signature and rejects unknown names", async () => {
    const calls: unknown[] = [];
    const topLeft: Comparator<{ tolerance?: number }> = (reference, actual, options) => {
      calls.push(options);
      const d = Math.abs(reference.data[0]! - actual.data[0]!);
      return { pass: d <= (options.tolerance ?? 0), diff: null, message: `red channel off by ${d}` };
    };
    extendMatchers({ comparators: { 'top-left': topLeft, silent } });
    try {
      const opts = { baselineDir: dir, comparatorName: 'top-left' };
      await expect(solid(1, 1, [250, 0, 0, 255])).toMatchScreenshot(solid(1, 1, [255, 0, 0, 255]), {
        ...opts,
        comparatorOptions: { tolerance: 5 },
      });
      expect(calls).toEqual([{ tolerance: 5, createDiff: true }]);
      await expect(expect(red).toMatchScreenshot(solid(2, 2, [0, 0, 0, 255]), opts)).rejects.toThrow(
        /red channel off by 255$/,
      );
      expect(readdirSync(dir)).toEqual([
        'configuration_runs_custom_comparators_with_Vitest_s_signature_and_rejects_unknown_names.actual.png',
      ]);
      await expect(red).toMatchScreenshot(red, { baselineDir: dir, comparatorName: 'silent' });
      await expect(
        expect(red).toMatchScreenshot(solid(2, 2, [0, 0, 0, 255]), { baselineDir: dir, comparatorName: 'silent' }),
      ).rejects.toThrow(/: differs$/);
      await expect(expect(red).toMatchScreenshot(red, { baselineDir: dir, comparatorName: 'nope' })).rejects.toThrow(
        /unknown comparator "nope"; known: pixelmatch, metrics, top-left, silent/,
      );
    } finally {
      extendMatchers();
    }
  });
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
  const img = { decode: async () => {}, _toRGBA8: () => red };
  await expect(webgpuCanvas).toMatchScreenshot(webglCanvas, { baselineDir: dir });
  await expect(img).toMatchScreenshot(webgpuCanvas, { baselineDir: dir });
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
