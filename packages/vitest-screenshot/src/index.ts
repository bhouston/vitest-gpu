import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import sharp, { type FormatEnum } from 'sharp';
import { expect } from 'vitest';

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

export type ScreenshotOptions = {
  /** Directory relative reference paths and diff images live in. Default: `__screenshots__` beside the test file. */
  baselineDir?: string;
  /** Per-pixel colour distance (0..1) tolerated by pixelmatch. Default 0.1. */
  threshold?: number;
  /** Fraction (0..1) of pixels allowed to differ. Default 0.001. */
  maxDiffRatio?: number;
  /** Overwrite the baseline file. Default: `UPDATE_SCREENSHOTS` env var is set. */
  update?: boolean;
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

export function extendMatchers(): void {
  expect.extend({
    async toMatchScreenshot(received: ImageSource, reference: Reference, options: ScreenshotOptions = {}) {
      const dir = options.baselineDir ?? join(dirname(this.testPath ?? ''), '__screenshots__');
      const actual = await toRgba(received);
      let file: string | undefined;
      let baseline: RgbaImage;
      if (typeof reference === 'string') {
        if (!extname(reference))
          throw new Error(`reference "${reference}" needs an image extension, e.g. "${reference}.png"`);
        file = isAbsolute(reference) ? reference : join(dir, reference);
        const update = options.update ?? Boolean(process.env.UPDATE_SCREENSHOTS);
        if (update || (!existsSync(file) && !process.env.CI)) {
          await writeImage(file, actual);
          return result(true, `wrote baseline ${file}`);
        }
        if (!existsSync(file)) return result(false, `missing baseline ${file}; run with UPDATE_SCREENSHOTS=1`);
        baseline = await readImage(file);
      } else {
        baseline = await toRgba(reference);
      }
      const label = file ? basename(file) : (this.currentTestName ?? 'screenshot');
      if (baseline.width !== actual.width || baseline.height !== actual.height) {
        return result(
          false,
          `${label}: size mismatch: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`,
        );
      }
      const { width, height } = actual;
      const diff = { width, height, data: new Uint8Array(width * height * 4) };
      const count = pixelmatch(baseline.data, actual.data, diff.data, width, height, {
        threshold: options.threshold ?? 0.1,
      });
      const ratio = count / (width * height);
      const pass = ratio <= (options.maxDiffRatio ?? 0.001);
      const stem = join(dir, file ? basename(file, extname(file)) : label.replace(/[^\w-]+/g, '_'));
      if (!pass) await Promise.all([writeImage(`${stem}.actual.png`, actual), writeImage(`${stem}.diff.png`, diff)]);
      return result(pass, `${label}: ${count} pixels (${(ratio * 100).toFixed(3)}%) differ; see ${stem}.diff.png`);
    },
  });
}
