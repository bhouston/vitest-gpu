import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { expect } from 'vitest';

/** Anything with RGBA8 pixels, top row first: `ImageData`, node-webgl's `canvas.getImageData()`, or a WebGPU readback. */
export type RgbaImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export type ScreenshotOptions = {
  /** Directory holding baseline PNGs. Default: `__screenshots__` beside the test file. */
  baselineDir?: string;
  /** Per-pixel colour distance (0..1) tolerated by pixelmatch. Default 0.1. */
  threshold?: number;
  /** Fraction (0..1) of pixels allowed to differ. Default 0.001. */
  maxDiffRatio?: number;
  /** Overwrite the baseline. Default: `UPDATE_SCREENSHOTS` env var is set. */
  update?: boolean;
};

declare module 'vitest' {
  interface Assertion {
    toMatchScreenshot(name: string, options?: ScreenshotOptions): void;
  }
}

const result = (pass: boolean, message: string) => ({ pass, message: () => message });

const toPng = ({ width, height, data }: RgbaImage): PNG => {
  const png = new PNG({ width, height });
  png.data = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return png;
};

export function extendMatchers(): void {
  expect.extend({
    toMatchScreenshot(received: RgbaImage, name: string, options: ScreenshotOptions = {}) {
      const dir = options.baselineDir ?? join(dirname(this.testPath ?? ''), '__screenshots__');
      const file = join(dir, `${name}.png`);
      const actual = toPng(received);
      const update = options.update ?? Boolean(process.env.UPDATE_SCREENSHOTS);
      if (update || (!existsSync(file) && !process.env.CI)) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, PNG.sync.write(actual));
        return result(true, `wrote baseline ${file}`);
      }
      if (!existsSync(file)) return result(false, `missing baseline ${file}; run with UPDATE_SCREENSHOTS=1`);
      const baseline = PNG.sync.read(readFileSync(file));
      if (baseline.width !== actual.width || baseline.height !== actual.height) {
        return result(
          false,
          `size mismatch: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`,
        );
      }
      const diff = new PNG({ width: actual.width, height: actual.height });
      const count = pixelmatch(baseline.data, actual.data, diff.data, actual.width, actual.height, {
        threshold: options.threshold ?? 0.1,
      });
      const ratio = count / (actual.width * actual.height);
      const pass = ratio <= (options.maxDiffRatio ?? 0.001);
      if (!pass) {
        writeFileSync(join(dir, `${name}.actual.png`), PNG.sync.write(actual));
        writeFileSync(join(dir, `${name}.diff.png`), PNG.sync.write(diff));
      }
      return result(
        pass,
        `${basename(file)}: ${count} pixels (${(ratio * 100).toFixed(3)}%) differ; see ${name}.diff.png`,
      );
    },
  });
}
