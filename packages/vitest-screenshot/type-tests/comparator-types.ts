import { expect } from 'vitest';
import { type Comparator, extendMatchers, type RgbaImage, type ScreenshotOptions } from 'vitest-screenshot';

declare module 'vitest-screenshot' {
  interface ComparatorRegistry {
    custom: { tolerance?: number };
  }
}

const custom: Comparator<{ tolerance?: number }> = (reference, actual, { createDiff, tolerance = 0 }) => ({
  pass: Math.abs(reference.data[0]! - actual.data[0]!) <= tolerance,
  diff: createDiff ? actual : null,
  message: null,
});
const wrongCustom: Comparator<{ threshold?: number }> = () => ({ pass: true, diff: null, message: null });

extendMatchers({ comparators: { custom } });
extendMatchers({ comparatorName: 'custom', comparatorOptions: { tolerance: 2 }, comparators: { custom } });
declare const image: RgbaImage;
void expect(image).toMatchScreenshot(image, {
  comparatorName: 'custom',
  comparatorOptions: { tolerance: 2 },
});
extendMatchers({ comparatorName: 'metrics', comparatorOptions: { PSNR: 30 } });
void expect(image).toMatchScreenshot(image, { comparatorOptions: { PSNR: 40 } });

const selections = [
  { comparatorName: 'pixelmatch', comparatorOptions: { threshold: 0.2 } },
  { comparatorName: 'metrics', comparatorOptions: { fuzz: 0.01, PSNR: 40 } },
  { comparatorName: 'custom', comparatorOptions: { tolerance: 2 } },
] as const satisfies readonly ScreenshotOptions[];
void selections;

// @ts-expect-error metrics options are not valid for pixelmatch
const wrongBuiltInOptions: ScreenshotOptions = { comparatorName: 'pixelmatch', comparatorOptions: { PSNR: 40 } };
// @ts-expect-error pixelmatch options are not valid for metrics
const wrongMetricsOptions: ScreenshotOptions = { comparatorName: 'metrics', comparatorOptions: { threshold: 0.2 } };
// @ts-expect-error custom comparator options use the augmented registry entry
const wrongCustomOptions: ScreenshotOptions = { comparatorName: 'custom', comparatorOptions: { threshold: 0.2 } };
// @ts-expect-error unknown comparators must be added to ComparatorRegistry
const unknownComparator: ScreenshotOptions = { comparatorName: 'unknown' };
// @ts-expect-error registered comparator signature must use its registry options
extendMatchers({ comparators: { custom: wrongCustom } });

void [wrongBuiltInOptions, wrongMetricsOptions, wrongCustomOptions, unknownComparator];
