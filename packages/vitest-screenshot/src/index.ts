import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import sharp, { type FormatEnum } from 'sharp';
import { expect } from 'vitest';
import { metricsComparator, type MetricsOptions } from './metrics.js';
import { resolveScreenshotUpdateState } from './update-policy.js';

export type { Metric, MetricsOptions } from './metrics.js';

/** Anything with RGBA8 pixels, top row first: `ImageData`, node-webgl's `canvas.getImageData()`, or a WebGPU readback. */
export type RgbaImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

/**
 * A source of pixels: an `RgbaImage` / `ImageData`, a WebGPU `HeadlessCanvas` (`readPixels()`), a node-webgl
 * `Canvas` (`getImageData()`), or a node-webgl `Image` (decoded with `decode()`).
 */
export type ImageSource =
  | RgbaImage
  | { readPixels(): Promise<RgbaImage> }
  | { getImageData(): RgbaImage }
  | { decode(): Promise<void> };

/** A baseline: a file path with extension (relative to `baselineDir` or absolute), or an in-memory `ImageSource`. */
export type Reference = string | ImageSource;

/** What a comparator returns, as in Vitest browser mode: `diff` is written next to the baseline on failure. */
export type ComparatorResult = { pass: boolean; diff: RgbaImage | null; message: string | null };

/** A comparator, with the signature Vitest browser mode uses for `comparators`. */
export type Comparator<Options extends object = Record<string, unknown>> = (
  reference: RgbaImage,
  actual: RgbaImage,
  options: Options & { createDiff: boolean },
) => ComparatorResult;

/** Options of the default `pixelmatch` comparator, named as in Vitest browser mode. */
export type PixelmatchOptions = NonNullable<Parameters<typeof pixelmatch>[5]> & {
  /** Fraction (0..1) of pixels allowed to differ. */
  allowedMismatchedPixelRatio?: number;
  /** Number of pixels allowed to differ. With both limits given the stricter wins; with neither, none may differ. */
  allowedMismatchedPixels?: number;
};

/** Comparator names and their options. Augment this interface when registering a custom comparator. */
export interface ComparatorRegistry {
  pixelmatch: PixelmatchOptions;
  metrics: MetricsOptions;
}

type ComparatorName = Extract<keyof ComparatorRegistry, string>;
type ComparatorOptions<Name extends ComparatorName> = Extract<ComparatorRegistry[Name], object>;

/** Which registered comparator judges the images. `pixelmatch` is the default. */
export type ComparatorSelection =
  | {
      [Name in ComparatorName]: {
        comparatorName: Name;
        comparatorOptions?: ComparatorOptions<Name>;
      };
    }[ComparatorName]
  | { comparatorName?: undefined; comparatorOptions?: ComparatorOptions<ComparatorName> };

export type ScreenshotOptions = ComparatorSelection & {
  /** Directory relative reference paths and diff images live in. Default: `__screenshots__` beside the test file. */
  baselineDir?: string;
  /** Override Vitest's snapshot update mode. `true` creates/overwrites; `false` prevents both. */
  update?: boolean;
};

/** Defaults for every assertion plus custom comparators, like `test.browser.expect.toMatchScreenshot` in Vitest config. */
export type ScreenshotConfig = ComparatorSelection & {
  comparators?: { [Name in ComparatorName]?: Comparator<ComparatorOptions<Name>> };
};

declare module 'vitest' {
  interface Assertion {
    toMatchScreenshot(reference: Reference, options?: ScreenshotOptions): Promise<void>;
  }
}

const result = (pass: boolean, message: string) => ({ pass, message: () => message });

const raw = ({ width, height, data }: RgbaImage) => sharp(data, { raw: { width, height, channels: 4 } });

/** Decodes any format sharp reads (png, jpg, gif, webp, ...) into RGBA8. */
const readImage = async (file: string): Promise<RgbaImage> => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
};

/** Encodes by file extension; lossy formats (jpg, webp) alter pixels on write. */
const writeImage = (file: string, image: RgbaImage) => {
  mkdirSync(dirname(file), { recursive: true });
  return raw(image)
    .toFormat(extname(file).slice(1) as keyof FormatEnum)
    .toFile(file);
};

const toRgba = async (source: ImageSource): Promise<RgbaImage> => {
  if ('data' in source) return source;
  if ('readPixels' in source) return source.readPixels();
  if ('getImageData' in source) return source.getImageData();
  await source.decode();
  // node-webgl's Image and ImageBitmap expose decoded pixels this way (it is what their own texImage2D uses).
  const rgba = (source as { _toRGBA8?: () => RgbaImage })._toRGBA8?.();
  if (!rgba) throw new Error('unsupported image source: expected RGBA data, readPixels(), getImageData() or an Image');
  return rgba;
};

/** `comparatorName: 'pixelmatch'` (default): Vitest browser mode's built-in comparison. */
export const pixelmatchComparator: Comparator<PixelmatchOptions> = (
  reference,
  actual,
  { createDiff, allowedMismatchedPixelRatio, allowedMismatchedPixels, ...pixelmatchOptions },
) => {
  const { width, height } = actual;
  const total = width * height;
  const diff = createDiff ? new Uint8Array(total * 4) : undefined;
  const count = pixelmatch(reference.data, actual.data, diff, width, height, pixelmatchOptions);
  const limits = [allowedMismatchedPixels, allowedMismatchedPixelRatio && allowedMismatchedPixelRatio * total];
  const allowed = limits.some((l) => l !== undefined) ? Math.min(...limits.filter((l) => l !== undefined)) : 0;
  return {
    pass: count <= allowed,
    diff: diff ? { width, height, data: diff } : null,
    message: `${count} pixels (${((count / total) * 100).toFixed(3)}%) differ, ${Math.floor(allowed)} allowed`,
  };
};

export function extendMatchers(config: ScreenshotConfig = {}): void {
  const comparators = {
    pixelmatch: pixelmatchComparator,
    metrics: metricsComparator,
    ...config.comparators,
  } as unknown as Record<string, Comparator>;
  expect.extend({
    async toMatchScreenshot(received: ImageSource, reference: Reference, options: ScreenshotOptions = {}) {
      if (this.isNot) throw new Error('`.not.toMatchScreenshot()` is not supported');
      const dir = options.baselineDir ?? join(dirname(this.testPath!), '__screenshots__');
      const actual = await toRgba(received);
      let file: string | undefined;
      let baseline: RgbaImage;
      if (typeof reference === 'string') {
        if (!extname(reference))
          throw new Error(`reference "${reference}" needs an image extension, e.g. "${reference}.png"`);
        file = isAbsolute(reference) ? reference : join(dir, reference);
        const exists = existsSync(file);
        const update = resolveScreenshotUpdateState(
          this.snapshotState,
          options.update,
          Boolean(process.env.UPDATE_SCREENSHOTS),
          Boolean(process.env.CI),
        );
        if (update === 'all' || (update === 'new' && !exists)) {
          await writeImage(file, actual);
          return result(true, `wrote baseline ${file}`);
        }
        if (!exists) return result(false, `missing baseline ${file}; run with UPDATE_SCREENSHOTS=1 or vitest -u`);
        baseline = await readImage(file);
      } else {
        baseline = await toRgba(reference);
      }
      const label = file ? basename(file) : this.currentTestName!;
      if (baseline.width !== actual.width || baseline.height !== actual.height) {
        return result(
          false,
          `${label}: size mismatch: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`,
        );
      }
      const name = options.comparatorName ?? config.comparatorName ?? 'pixelmatch';
      const comparator = comparators[name];
      if (!comparator) throw new Error(`unknown comparator "${name}"; known: ${Object.keys(comparators).join(', ')}`);
      const inherited = name === (config.comparatorName ?? 'pixelmatch') ? config.comparatorOptions : undefined;
      const { pass, diff, message } = comparator(baseline, actual, {
        ...inherited,
        ...options.comparatorOptions,
        createDiff: true,
      });
      const stem = join(dir, file ? basename(file, extname(file)) : label.replace(/[^\w-]+/g, '_'));
      const seeDiff = !pass && diff ? `; see ${stem}.diff.png` : '';
      if (!pass)
        await Promise.all([writeImage(`${stem}.actual.png`, actual), diff && writeImage(`${stem}.diff.png`, diff)]);
      return result(pass, `${label}: ${message ?? (pass ? 'matches' : 'differs')}${seeDiff}`);
    },
  });
}
