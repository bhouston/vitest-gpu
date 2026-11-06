---
sidebar_position: 4
description: toMatchScreenshot() from vitest-screenshot compares a WebGL or WebGPU canvas, ImageData or raw pixels with a committed image baseline and writes diff images on failure.
---

# Screenshots

`vitest-screenshot` adds `await expect(image).toMatchScreenshot(reference)`. It compares a canvas, `ImageData` or raw pixels against a baseline committed next to your tests, with the same options as Vitest browser mode's `toMatchScreenshot`.

```sh
pnpm add -D vitest vitest-screenshot vitest-environment-webgl-node
```

```ts title="clear.test.ts"
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('clears to red', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const gl = canvas.getContext('webgl2')!;
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  await expect(canvas).toMatchScreenshot('red.png');
});
```

The first local run writes `__screenshots__/red.png`. Commit it. CI fails if the baseline is missing or differs.

The matcher is async: always `await` it. It is backend-agnostic: feed it a canvas from the [WebGL](./webgl.md) or [WebGPU](./webgpu.md) environment, an `ImageData`, a WebGPU texture readback, or pixels from a real browser.

## What you can compare

The received value and the reference can each be any of:

- `{ width, height, data }` with RGBA8 pixels, top row first (an `ImageData`, `canvas.getImageData()`, a WebGPU readback).
- A canvas: node-webgl's `Canvas` (read with `getImageData()`) or the WebGPU environment's `HeadlessCanvas` (read with `readPixels()`).
- An `Image` from `vitest-environment-webgl-node` (decoded with `decode()` first).

The reference may also be a file path. It must include the extension (`'knot.png'`, not `'knot'`), and resolves relative to `baselineDir` unless absolute.

## Baseline files

- Baselines live in `__screenshots__/` beside the test file. Override the directory with `baselineDir`.
- Any format sharp reads and writes works: png, jpg, gif, webp, avif, tiff. PNG is recommended: it is lossless, so a baseline written on the first run matches exactly. jpg and webp are re-encoded lossily on write and gif is limited to 256 colours, so loosen the comparator if you use them.
- Baselines follow Vitest's snapshot update mode: missing baselines are created locally, fail in CI, and `vitest -u` creates or overwrites them.
- `UPDATE_SCREENSHOTS=1 vitest` remains an alias for updating all screenshot baselines.
- Per assertion, `update: true` creates or overwrites a baseline and `update: false` prevents both overwriting and creating one. This explicit option takes precedence over Vitest's mode and `UPDATE_SCREENSHOTS`.
- `.not.toMatchScreenshot()` is unsupported and fails without reading pixels or writing baseline files.

## Failure artifacts

On failure `<name>.actual.png` and `<name>.diff.png` are written to `baselineDir`. When the reference is in memory they are named after the test. Add them to `.gitignore`:

```gitignore
**/__screenshots__/*.actual.png
**/__screenshots__/*.diff.png
```

In CI, upload them as build artifacts so you can inspect a failure.

## Comparators

As in [Vitest browser mode](https://vitest.dev/guide/browser/visual-regression-testing), `comparatorName` picks how the two images are judged and `comparatorOptions` configures it. Defaults for every assertion, and custom comparators, go to `extendMatchers()`:

```ts
extendMatchers({
  comparatorName: 'pixelmatch',
  comparatorOptions: { threshold: 0.2, allowedMismatchedPixelRatio: 0.01 },
});
```

Per-assertion `comparatorOptions` are merged over the global ones when they name the same comparator. When an assertion omits `comparatorName`, its options may match any registered comparator because the global default selects their meaning at runtime. Supplying `comparatorName` checks the options strictly against that comparator.

### pixelmatch (default)

Vitest's built-in comparison: counts pixels whose perceptual colour distance exceeds `threshold`.

| Option                                                                   | Default             | Meaning                                                          |
| ------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------- |
| `threshold`                                                              | `0.1`               | Per-pixel colour distance (0..1) tolerated; smaller is stricter. |
| `allowedMismatchedPixelRatio`                                            |                     | Fraction (0..1) of pixels allowed to differ.                     |
| `allowedMismatchedPixels`                                                |                     | Number of pixels allowed to differ.                              |
| `includeAA`, `alpha`, `aaColor`, `diffColor`, `diffColorAlt`, `diffMask` | pixelmatch defaults | Forwarded to [pixelmatch](https://github.com/mapbox/pixelmatch). |

With both limits given the stricter wins; with neither, no pixel may differ. GPUs and drivers rasterize edges slightly differently, so set a ratio for baselines shared across machines.

```ts
await expect(canvas).toMatchScreenshot('knot.png', {
  comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
});
```

### metrics

Whole-image error bounds with the names and semantics of ImageMagick's `compare -metric`. Give any subset; the assertion passes only if every bound holds. With none given it requires an exact match (`AE: 0`), like `compare -metric AE`.

| Option  | Bound | Unit   | Meaning                                                                                                            |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `fuzz`  |       | 0..1   | `-fuzz`: colour distance within which two pixels count as equal (default 0). Only affects `AE` and the diff image. |
| `AE`    | max   | pixels | Absolute error: pixels differing by more than `fuzz`.                                                              |
| `PAE`   | max   | 0..1   | Peak absolute error: the largest channel difference anywhere.                                                      |
| `MAE`   | max   | 0..1   | Mean absolute error.                                                                                               |
| `MSE`   | max   | 0..1   | Mean squared error.                                                                                                |
| `RMSE`  | max   | 0..1   | Root mean squared error.                                                                                           |
| `PSNR`  | min   | dB     | Peak signal-to-noise ratio; `Infinity` for identical images. 30 to 50 dB is typical for "same picture".            |
| `SSIM`  | min   | 0..1   | Structural similarity (Gaussian 11x11 window, sigma 1.5, over RGB); 1 is identical.                                |
| `DSSIM` | max   | 0..1   | Structural dissimilarity, `(1 - SSIM) / 2`.                                                                        |

```ts
await expect(canvas).toMatchScreenshot('knot.png', {
  comparatorName: 'metrics',
  comparatorOptions: { fuzz: 0.05, AE: 50, PSNR: 40 }, // few pixels off by >5%, and low overall error
});
```

`AE`, `PAE`, `MAE`, `MSE`, `RMSE` and `PSNR` are computed as ImageMagick does for images with an alpha channel (colours alpha-premultiplied, all four channels averaged) and agree with `magick compare` to the printed digits. `SSIM` is the textbook definition over RGB. The failure message lists every computed metric so you can pick a bound from a real run:

```text
knot.png: AE 760 (fuzz 0), PAE 0.1569, MAE 0.01042, MSE 0.0007709, RMSE 0.02777, PSNR 31.13; failed: AE 760 > 0; see __screenshots__/knot.diff.png
```

### Custom comparators

A comparator has Vitest's signature: `(reference, actual, options) => { pass, diff, message }`. `reference` and `actual` are `{ width, height, data }`, `options` carries `comparatorOptions` plus `createDiff`, and `diff` (an RGBA image or `null`) is written as `<name>.diff.png` on failure.

Register it under `comparators` and select it with `comparatorName`. Add its option type to `ComparatorRegistry` so registration and assertions check the custom name and options:

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

## Render and snapshot a three.js cube

The first local run creates a baseline in `__screenshots__/` beside the test. Commit it so later runs can compare against it.

```ts title="cube.test.ts"
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a cube', async () => {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(256, 256, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
  cube.rotation.set(0.4, 0.6, 0);
  scene.add(cube);

  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('cube.png');
  renderer.dispose();
});
```

For WebGPU, install `vitest-environment-webgpu-node` instead of the WebGL package and set `environment: 'webgpu-node'`. The same assertion works on the headless canvas from `createCanvas()` (see the [WebGPU page](./webgpu.md#headless-canvas)):

```ts title="cube.test.ts"
import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { createCanvas } from 'vitest-environment-webgpu-node';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a cube', async () => {
  const canvas = createCanvas(256, 256);
  const renderer = new THREE.WebGPURenderer({ canvas: canvas.asElement() });
  await renderer.init();
  renderer.setSize(256, 256, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
  cube.rotation.set(0.4, 0.6, 0);
  scene.add(cube);

  await renderer.renderAsync(scene, camera);
  await expect(canvas).toMatchScreenshot('cube.png');
  renderer.dispose();
});
```

The repository's [`demo/test/screenshots`](https://github.com/bhouston/vitest-gpu/tree/main/demo/test/screenshots) folder covers every source, format and comparator combination.

## Supported versions

Vitest 4 and 5, and Node 22 or later. Image decoding uses [sharp](https://sharp.pixelplumbing.com), which ships prebuilt binaries for common platforms. Baselines rendered on different GPUs or drivers can differ slightly: use `allowedMismatchedPixelRatio` or the `metrics` comparator for baselines shared across machines.

See the [API reference](./api/vitest-screenshot.md) for every exported type.
