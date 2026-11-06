import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import sharp, { type FormatEnum } from 'sharp';
import { expect } from 'vitest';
import { metricsComparator, type MetricsOptions } from './metrics.js';
import { resolveScreenshotUpdateState } from './update-policy.js';

export type { Metric, MetricsOptions } from './metrics.js';

/** Anything with RGBA8 pixels, top row first: `ImageData`, node-webgl's `canvas.getImageData()`, or a WebGPU readback. */
export type RgbaImage = {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** RGBA8 bytes, four per pixel, row by row from the top. */
  data: Uint8Array | Uint8ClampedArray;
};

/**
 * A source of pixels: an `RgbaImage` / `ImageData`, a WebGPU `HeadlessCanvas` (`readPixels()`), a node-webgl
 * `Canvas` (`getImageData()`), or a node-webgl `Image` (decoded with `decode()`).
 */
export type ImageSource =
  | RgbaImage
  | {
      /** Reads the pixels back from the GPU, as the WebGPU environment's `HeadlessCanvas` does. */
      readPixels(): Promise<RgbaImage>;
    }
  | {
      /** Returns the canvas pixels synchronously, as node-webgl's `Canvas` does. */
      getImageData(): RgbaImage;
    }
  | {
      /** Decodes the image so its pixels can be read, as node-webgl's `Image` does. */
      decode(): Promise<void>;
    };

/** A baseline: a file path with extension (relative to `baselineDir` or absolute), or an in-memory `ImageSource`. */
export type Reference = string | ImageSource;

/** What a comparator returns, as in Vitest browser mode: `diff` is written next to the baseline on failure. */
export type ComparatorResult = {
  /** Whether the two images count as the same. */
  pass: boolean;
  /** An image of the differences, written as `<name>.diff.png` on failure, or `null` for none. */
  diff: RgbaImage | null;
  /** A description of the result, included in the failure message. */
  message: string | null;
};

/**
 * A comparator, with the signature Vitest browser mode uses for `comparators`.
 *
 * @typeParam Options - The comparator's own options, taken from `comparatorOptions`.
 * @param reference - The baseline image.
 * @param actual - The image under test.
 * @param options - The comparator options plus `createDiff`, which says whether a diff image is wanted.
 * @returns Whether the images match, with an optional diff image and message.
 */
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
  /** Options of the default `pixelmatch` comparator. */
  pixelmatch: PixelmatchOptions;
  /** Options of the `metrics` comparator. */
  metrics: MetricsOptions;
}

type ComparatorName = Extract<keyof ComparatorRegistry, string>;
type ComparatorOptions<Name extends ComparatorName> = Extract<ComparatorRegistry[Name], object>;

/** Which registered comparator judges the images. `pixelmatch` is the default. */
export type ComparatorSelection =
  | {
      [Name in ComparatorName]: {
        /** The registered comparator to use. */
        comparatorName: Name;
        /** Options for that comparator. */
        comparatorOptions?: ComparatorOptions<Name>;
      };
    }[ComparatorName]
  | {
      /** Omitted: the comparator chosen in `extendMatchers()` applies, or `pixelmatch` by default. */
      comparatorName?: undefined;
      /** Options for the default comparator. */
      comparatorOptions?: ComparatorOptions<ComparatorName>;
    };

/** Options for one `toMatchScreenshot()` assertion: the comparator selection plus where baselines live. */
export type ScreenshotOptions = ComparatorSelection & {
  /** Directory relative reference paths and diff images live in. Default: `__screenshots__` beside the test file. */
  baselineDir?: string;
  /** Override Vitest's snapshot update mode. `true` creates/overwrites; `false` prevents both. */
  update?: boolean;
};

/** Defaults for every assertion plus custom comparators, like `test.browser.expect.toMatchScreenshot` in Vitest config. */
export type ScreenshotConfig = ComparatorSelection & {
  /** Custom comparators, keyed by the name used in `comparatorName`. */
  comparators?: { [Name in ComparatorName]?: Comparator<ComparatorOptions<Name>> };
};

declare module 'vitest' {
  // Vitest 5's `Assertion` gained a second type parameter (`R`); this augmentation must declare
  // the same arity TypeScript sees for the installed Vitest major, or the two `interface`
  // declarations fail to merge. Vitest 4/3 ignore the extra defaulted parameter.
  interface Assertion<R extends void | Promise<void> = void, T = unknown> {
    toMatchScreenshot(reference: Reference, options?: ScreenshotOptions): Promise<void>;
  }
}

const result = (pass: boolean, message: string) => ({ pass, message: () => message });

const raw = ({ width, height, data }: RgbaImage) => sharp(data, { raw: { width, height, channels: 4 } });

/** Decodes any format sharp reads (png, jpg, gif, webp, ...) into RGBA8. */
const readImage = async (file: string): Promise<RgbaImage> => {
  // Decode from a buffer: sharp(path) leaves the handle in libvips' cache, which locks the file on Windows.
  const { data, info } = await sharp(await readFile(file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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

/**
 * Registers `toMatchScreenshot()` on Vitest's `expect`. Call it once per test file, or from a setup file.
 *
 * @param config - Default comparator and options for every assertion, and any custom comparators.
 */
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
