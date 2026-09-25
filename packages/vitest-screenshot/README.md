# vitest-screenshot

[![npm version][npm-badge]][npm-url]
[![npm downloads][downloads-badge]][npm-url]
[![Tests][tests-badge]][tests-url]
[![Discord][discord-badge]][discord-url]

`await expect(image).toMatchScreenshot(reference)`: compare an image against a baseline committed next to your
tests, with the same options as Vitest browser mode's `toMatchScreenshot`. Pair it with a native GPU
environment and tests run up to 2.4x faster than in a browser — see the
[blog post](https://ben3d.ca/blog/native-gpu-testing-for-vitest-and-jest) for details.
Backend-agnostic: feed it a canvas from
[`vitest-environment-webgl-node`](../vitest-environment-webgl-node) or
[`vitest-environment-webgpu-node`](../vitest-environment-webgpu-node), an `ImageData`, a WebGPU texture
readback, or pixels from a real browser.

## Install

```sh
pnpm add -D vitest vitest-screenshot
```

## Usage

```ts
import { extendMatchers } from 'vitest-screenshot';
extendMatchers();

it('renders the knot', async () => {
  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('knot.png', {
    comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
  });
});
```

The matcher is async: always `await` it.

### What you can compare

The received value and the reference can each be any of:

- `{ width, height, data }` with RGBA8 pixels, top row first (an `ImageData`, `canvas.getImageData()`, a WebGPU readback).
- A canvas: node-webgl's `Canvas` (read with `getImageData()`) or the WebGPU environment's `HeadlessCanvas` (read with `readPixels()`).
- An `Image` from `vitest-environment-webgl-node` (decoded with `decode()` first).

The reference may also be a file path. It must include the extension (`'knot.png'`, not `'knot'`), and resolves
relative to `baselineDir` unless absolute.

### Baseline files

- Baselines live in `__screenshots__/` beside the test file (override with `baselineDir`).
- Any format sharp reads and writes works: png, jpg, gif, webp, avif, tiff. **We recommend png**: it is lossless,
  so a baseline written on the first run matches exactly. jpg and webp are re-encoded lossily on write and gif is
  limited to 256 colours, so loosen the comparator if you use them.
- Screenshot baselines follow Vitest's snapshot update mode: missing baselines are created locally, fail in CI,
  and `vitest -u` creates or overwrites them.
- `UPDATE_SCREENSHOTS=1 vitest` remains an alias for updating all screenshot baselines.
- Per assertion, `update: true` creates or overwrites a baseline and `update: false` prevents both overwriting and
  creating one. This explicit option takes precedence over Vitest's mode and `UPDATE_SCREENSHOTS`.
- `.not.toMatchScreenshot()` is unsupported and fails without reading pixels or writing baseline files.
- On failure `<name>.actual.png` and `<name>.diff.png` are written to `baselineDir` (named after the test when the
  reference is in memory). Gitignore them.

## Comparators

As in [Vitest browser mode](https://vitest.dev/guide/browser/visual-regression-testing), `comparatorName` picks
how the two images are judged and `comparatorOptions` configures it. Defaults for every assertion, and custom
comparators, go to `extendMatchers()` (the equivalent of `test.browser.expect.toMatchScreenshot` in Vitest config):

```ts
extendMatchers({
  comparatorName: 'pixelmatch',
  comparatorOptions: { threshold: 0.2, allowedMismatchedPixelRatio: 0.01 },
});
```

Per-assertion `comparatorOptions` are merged over the global ones when they name the same comparator. When an
assertion omits `comparatorName`, its options may match any registered comparator because the global default selects
their meaning at runtime. Supplying `comparatorName` checks the options strictly against that comparator.

### `pixelmatch` (default)

Vitest's built-in comparison: counts pixels whose perceptual colour distance exceeds `threshold`.

| Option                                                                   | Default             | Meaning                                                          |
| ------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------- |
| `threshold`                                                              | `0.1`               | Per-pixel colour distance (0..1) tolerated; smaller is stricter. |
| `allowedMismatchedPixelRatio`                                            |                     | Fraction (0..1) of pixels allowed to differ.                     |
| `allowedMismatchedPixels`                                                |                     | Number of pixels allowed to differ.                              |
| `includeAA`, `alpha`, `aaColor`, `diffColor`, `diffColorAlt`, `diffMask` | pixelmatch defaults | Forwarded to [pixelmatch](https://github.com/mapbox/pixelmatch). |

With both limits given the stricter wins; with neither, no pixel may differ. GPUs and drivers rasterize edges
slightly differently, so set a ratio for baselines shared across machines.

### `metrics`

Whole-image error bounds with the names and semantics of ImageMagick's `compare -metric`. Give any subset; the
assertion passes only if every bound holds. With none given it requires an exact match (`AE: 0`), like
`compare -metric AE`.

| Option  | Bound | Unit   | Meaning                                                                                                            |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `fuzz`  |       | 0..1   | `-fuzz`: colour distance within which two pixels count as equal (default 0). Only affects `AE` and the diff image. |
| `AE`    | max   | pixels | Absolute error: pixels differing by more than `fuzz`.                                                              |
| `PAE`   | max   | 0..1   | Peak absolute error: the largest channel difference anywhere.                                                      |
| `MAE`   | max   | 0..1   | Mean absolute error.                                                                                               |
| `MSE`   | max   | 0..1   | Mean squared error.                                                                                                |
| `RMSE`  | max   | 0..1   | Root mean squared error.                                                                                           |
| `PSNR`  | min   | dB     | Peak signal-to-noise ratio; `Infinity` for identical images. 30–50 dB is typical for "same picture".               |
| `SSIM`  | min   | 0..1   | Structural similarity (Gaussian 11×11 window, σ 1.5, over RGB); 1 is identical.                                    |
| `DSSIM` | max   | 0..1   | Structural dissimilarity, `(1 − SSIM) / 2`.                                                                        |

```ts
await expect(canvas).toMatchScreenshot('knot.png', {
  comparatorName: 'metrics',
  comparatorOptions: { fuzz: 0.05, AE: 50, PSNR: 40 }, // few pixels off by >5%, and low overall error
});
```

`AE`, `PAE`, `MAE`, `MSE`, `RMSE` and `PSNR` are computed as ImageMagick does for images with an alpha channel
(colours alpha-premultiplied, all four channels averaged) and agree with `magick compare` to the printed digits.
`SSIM` is the textbook definition over RGB, the value `magick compare -metric SSIM` on an opaque image reports
as `(1 − SSIM) / 2`. The failure message lists every computed metric so you can pick a bound from a real run:

```
knot.png: AE 760 (fuzz 0), PAE 0.1569, MAE 0.01042, MSE 0.0007709, RMSE 0.02777, PSNR 31.13; failed: AE 760 > 0; see __screenshots__/knot.diff.png
```

### Custom comparators

A comparator has Vitest's signature: `(reference, actual, options) => { pass, diff, message }`, where `reference`
and `actual` are `{ width, height, data }`, `options` carries `comparatorOptions` plus `createDiff`, and `diff`
(an RGBA image or `null`) is written as `<name>.diff.png` on failure. Register it under `comparators` and select
it with `comparatorName`. Add its option type to `ComparatorRegistry` so registration and assertions check the
custom name and options:

```ts
import { type Comparator, extendMatchers } from 'vitest-screenshot';

declare module 'vitest-screenshot' {
  interface ComparatorRegistry {
    'red-channel': { tolerance?: number };
  }
}

const redChannel: Comparator<{ tolerance?: number }> = (reference, actual, { tolerance = 0 }) => {
  const difference = Math.abs(reference.data[0]! - actual.data[0]!);
  return { pass: difference <= tolerance, diff: null, message: `red channel differs by ${difference}` };
};

extendMatchers({ comparators: { 'red-channel': redChannel } });

await expect(image).toMatchScreenshot('baseline.png', {
  comparatorName: 'red-channel',
  comparatorOptions: { tolerance: 2 },
});
```

See [`demo/test/screenshots`](../../demo/test/screenshots) for every source, format and comparator combination.

## Author

Created by [Ben Houston](https://ben3d.ca) and sponsored by [Land of Assets](https://landofassets.com).

## License

MIT

[npm-badge]: https://img.shields.io/npm/v/vitest-screenshot.svg
[npm-url]: https://www.npmjs.com/package/vitest-screenshot
[downloads-badge]: https://img.shields.io/npm/dm/vitest-screenshot.svg
[tests-badge]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml/badge.svg
[tests-url]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml
[discord-badge]: https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white
[discord-url]: https://discord.gg/fwupDN493R
