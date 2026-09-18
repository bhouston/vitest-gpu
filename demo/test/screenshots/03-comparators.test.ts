import { describe, expect, it } from 'vitest';
import { type Comparator, extendMatchers } from 'vitest-screenshot';
import { quadrants } from './quadrants.js';

declare module 'vitest-screenshot' {
  interface ComparatorRegistry {
    'centre-pixel': { tolerance?: number };
  }
}

/** Shift every pixel by `by` levels: invisible to the eye, but a different value everywhere. */
const shifted = (by: number) => {
  const image = quadrants();
  for (let i = 0; i < image.data.length; i++) if (i % 4 !== 3) image.data[i] = Math.min(255, image.data[i]! + by);
  return image;
};

/** A custom comparator with the signature Vitest browser mode uses: passes if the centre pixel matches. */
const centrePixel: Comparator<{ tolerance?: number }> = (reference, actual, { tolerance = 0 }) => {
  const i = (reference.height / 2) * reference.width * 4 + (reference.width / 2) * 4;
  const same = reference.data.slice(i, i + 4).every((v, k) => Math.abs(v - actual.data[i + k]!) <= tolerance);
  return { pass: same, diff: null, message: same ? 'centre pixel matches' : 'centre pixel differs' };
};

// Like `test.browser.expect.toMatchScreenshot` in Vitest config: defaults for every assertion plus custom comparators.
extendMatchers({
  comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
  comparators: { 'centre-pixel': centrePixel },
});

describe('comparators', () => {
  it('pixelmatch (default) counts pixels whose colour distance exceeds threshold', async () => {
    await expect(shifted(2)).toMatchScreenshot('quadrants.png'); // 2 levels are within pixelmatch's default threshold
    // Shifting saturates the yellow quadrant at 255, so three of the four quadrants differ.
    await expect(expect(shifted(60)).toMatchScreenshot('quadrants.png')).rejects.toThrow(
      /3072 pixels \(75.000%\) differ, 40 allowed/,
    );
  });

  it('metrics judges the whole image with ImageMagick compare -metric bounds', async () => {
    const metrics = { comparatorName: 'metrics' } as const;
    // Every pixel is off by 2 levels, so the exact-match default and a pixel count fail...
    await expect(expect(shifted(2)).toMatchScreenshot('quadrants.png', metrics)).rejects.toThrow(/failed: AE 4096 > 0/);
    // ...while fuzz, peak error and PSNR can each express "close enough".
    await expect(shifted(2)).toMatchScreenshot('quadrants.png', {
      ...metrics,
      comparatorOptions: { fuzz: 0.01, AE: 0 },
    });
    await expect(shifted(2)).toMatchScreenshot('quadrants.png', {
      ...metrics,
      comparatorOptions: { PAE: 2 / 255, PSNR: 40 },
    });
    await expect(
      expect(shifted(60)).toMatchScreenshot('quadrants.png', {
        ...metrics,
        comparatorOptions: { PAE: 2 / 255, PSNR: 40 },
      }),
    ).rejects.toThrow(/failed: PAE 0.2353 > 0.007843, PSNR 1\d.\d+ < 40/);
  });

  it('custom comparators are selected by name', async () => {
    await expect(shifted(0)).toMatchScreenshot('quadrants.png', { comparatorName: 'centre-pixel' });
    await expect(shifted(1)).toMatchScreenshot('quadrants.png', {
      comparatorName: 'centre-pixel',
      comparatorOptions: { tolerance: 1 },
    });
    await expect(
      expect(shifted(1)).toMatchScreenshot('quadrants.png', { comparatorName: 'centre-pixel' }),
    ).rejects.toThrow(/centre pixel differs/);
  });
});
